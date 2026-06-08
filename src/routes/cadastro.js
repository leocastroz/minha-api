const express = require('express');
const router = express.Router();
const { sql, connectDB } = require('../db');

const CAMPOS_EDITAVEIS = [
  'CodigoEmpresa',
  'CodigoLancamento',
  'Nome',
  'NomeFantasia',
  'CPFCNPJ',
  'RG',
  'RGOrgao',
  'RGOrgaoUF',
  'DataNascimento',
  'Pessoa',
  'Sexo',
  'DataCadastro',
  'SobreNome',
  'IE',
  'Eliminado',
  'TipoDescontoNFe',
  'IdentificacaoEstrangeiro',
];

const CAMPOS_CRIACAO = [
  'CodigoEmpresa',
  'CodigoLancamento',
  'Nome',
  'NomeFantasia',
  'CPFCNPJ',
  'RG',
  'RGOrgao',
  'RGOrgaoUF',
  'DataNascimento',
  'Pessoa',
  'Sexo',
  'DataCadastro',
  'SobreNome',
  'IE',
  'Eliminado',
  'TipoDescontoNFe',
  'IdentificacaoEstrangeiro',
];

function montarAtualizacao(body, aceitarParcial) {
  const entradas = Object.entries(body).filter(([chave]) => CAMPOS_EDITAVEIS.includes(chave));

  if (entradas.length === 0) {
    return { erro: 'Envie ao menos um campo editável para atualizar.' };
  }

  if (!aceitarParcial) {
    const faltantes = CAMPOS_EDITAVEIS.filter((campo) => !(campo in body));
    if (faltantes.length > 0) {
      return {
        erro: 'No PUT, envie todos os campos editáveis.',
        faltantes,
      };
    }
  }

  const setClause = entradas.map(([campo]) => `${campo} = @${campo}`).join(', ');
  const params = entradas.map(([campo, valor]) => ({ campo, valor }));

  return { setClause, params };
}

function montarCriacao(body) {
  // Validação de campo obrigatório
  const erros = [];

  if (!body.Nome || typeof body.Nome !== 'string') {
    erros.push('Nome é obrigatório e deve ser texto.');
  }

  if (erros.length > 0) {
    return { 
      erro: erros.join(' | '), 
      obs: 'CodigoLancamento será gerado automaticamente (+100 do último).' 
    };
  }

  const payload = {
    CodigoEmpresa: body.CodigoEmpresa ?? 1,
    Nome: body.Nome,
    NomeFantasia: body.NomeFantasia ?? null,
    CPFCNPJ: body.CPFCNPJ ?? null,
    RG: body.RG ?? null,
    RGOrgao: body.RGOrgao ?? null,
    RGOrgaoUF: body.RGOrgaoUF ?? null,
    DataNascimento: body.DataNascimento ?? null,
    Pessoa: body.Pessoa ?? 1,
    Sexo: body.Sexo ?? null,
    DataCadastro: body.DataCadastro ?? new Date().toISOString(),
    SobreNome: body.SobreNome ?? null,
    IE: body.IE ?? null,
    Eliminado: body.Eliminado ?? false,
    TipoDescontoNFe: body.TipoDescontoNFe ?? 1,
    IdentificacaoEstrangeiro: body.IdentificacaoEstrangeiro ?? null,
  };

  const entradas = CAMPOS_CRIACAO
    .filter((campo) => campo in payload && campo !== 'CodigoLancamento')
    .map((campo) => ({ campo, valor: payload[campo] }));

  return { entradas };
}

function statusPainelFromLinha(statusLinha) {
  const existeCadastro = Boolean(statusLinha && statusLinha.existeCadastro);
  const existeCliente = Boolean(statusLinha && statusLinha.existeCliente);
  const clienteAtivo = Boolean(statusLinha && statusLinha.clienteAtivo);
  const clienteEliminado = Boolean(statusLinha && statusLinha.clienteEliminado);

  return {
    existe_em_cadastro: existeCadastro ? 'SIM' : 'NAO',
    existe_em_cliente: existeCliente ? 'SIM' : 'NAO',
    CodigoCliente: statusLinha?.CodigoCliente ?? null,
    APARECE_NA_CONSULTA: existeCliente && clienteAtivo && !clienteEliminado ? 'SIM' : 'NAO',
    regras: {
      cliente_ativo: clienteAtivo ? 'SIM' : 'NAO',
      cliente_eliminado: clienteEliminado ? 'SIM' : 'NAO',
    },
  };
}

function parseBooleanLike(value, fallback = true) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLowerCase();
  if (['1', 'true', 'sim', 's', 'yes', 'y'].includes(raw)) return true;
  if (['0', 'false', 'nao', 'não', 'n', 'no'].includes(raw)) return false;
  return fallback;
}


// GET /cadastro?page=1&limit=20&nome=FRANCISCA&CPFCNPJ=12345678900
router.get('/', async (req, res) => {
  const { page = 1, limit = 50, nome, CPFCNPJ, cpfcnpj } = req.query;
  const cpfCnpjFiltro = String(CPFCNPJ ?? cpfcnpj ?? '').trim();
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const startRow = (pageNumber - 1) * limitNumber + 1;
  const endRow = pageNumber * limitNumber;

  try {
    const pool = await connectDB();

    const request = pool.request()
      .input('startRow', startRow)
      .input('endRow', endRow);

    // Monta o WHERE dinamicamente
    const filtros = [];

    if (nome) {
      request.input('nome', `%${nome}%`);
      filtros.push('LTRIM(RTRIM(cad.Nome)) LIKE LTRIM(RTRIM(@nome))');
    }

    if (cpfCnpjFiltro) {
      request.input('cpfCnpj', cpfCnpjFiltro);
      filtros.push('LTRIM(RTRIM(cad.CPFCNPJ)) = LTRIM(RTRIM(@cpfCnpj))');
    }

    const where = filtros.length > 0
      ? `WHERE ${filtros.join(' AND ')}`
      : '';

    const result = await request.query(`
      ;WITH CadastroPaginado AS (
        SELECT
          cad.*,
          cli.CodigoCliente,
          ROW_NUMBER() OVER (ORDER BY cad.Nome) AS RowNum
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
          ON cli.CodigoCadastro = cad.CodigoCadastro
        ${where}
      )
      SELECT *
      FROM CadastroPaginado
      WHERE RowNum BETWEEN @startRow AND @endRow
      ORDER BY RowNum
    `);

    res.json({
      pagina: pageNumber,
      limite: limitNumber,
      total: result.recordset.length,
      dados: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /cadastro/com-convenio?titulo=FIDELICARD&page=1&limit=50
router.get('/com-convenio', async (req, res) => {
  const titulo = String(req.query.titulo || 'FIDELICARD').trim();
  const pageNumber = Number(req.query.page || 1);
  const limitNumber = Number(req.query.limit || 50);
  const startRow = (pageNumber - 1) * limitNumber + 1;
  const endRow = pageNumber * limitNumber;

  try {
    const pool = await connectDB();
    const request = pool.request()
      .input('titulo', `%${titulo}%`)
      .input('startRow', startRow)
      .input('endRow', endRow);

    const result = await request.query(`
      ;WITH Base AS (
        SELECT
          c.CodigoCliente,
          c.CodigoCadastro,
          cad.Nome AS NomeCliente,
          cad.CPFCNPJ,
          cv.CodigoConvenio,
          cadConv.Nome AS NomeConvenio,
          cc.CodigoClienteID,
          cc.Status AS StatusConvenio,
          cc.DataCadastro AS DataCadastroConvenio,
          ROW_NUMBER() OVER (ORDER BY c.CodigoCliente DESC) AS RowNum
        FROM INOVAFARMA_DPOPPARA.dbo.Cliente c
        JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cad
          ON cad.CodigoCadastro = c.CodigoCadastro
        JOIN INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio cc
          ON cc.CodigoCliente = c.CodigoCliente
        JOIN INOVAFARMA_DPOPPARA.dbo.Convenio cv
          ON cv.CodigoConvenio = cc.CodigoConvenio
        JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cadConv
          ON cadConv.CodigoCadastro = cv.CodigoCadastro
        WHERE UPPER(LTRIM(RTRIM(cadConv.Nome))) LIKE UPPER(LTRIM(RTRIM(@titulo)))
      )
      SELECT *
      FROM Base
      WHERE RowNum BETWEEN @startRow AND @endRow
      ORDER BY RowNum
    `);

    return res.json({
      pagina: pageNumber,
      limite: limitNumber,
      total: result.recordset.length,
      tituloConvenio: titulo,
      dados: result.recordset,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /cadastro — criar novo usuário com CodigoCadastro e CodigoLancamento automáticos
router.post('/', async (req, res) => {
  const criacao = montarCriacao(req.body);
  if (criacao.erro) {
    return res.status(400).json(criacao);
  }

  let transaction;

  try {
    const pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // Obter máximos com lock
    const maxResult = await new sql.Request(transaction).query(`
      SELECT 
        ISNULL(MAX(CodigoCadastro), 0) AS maxCadastro,
        ISNULL(MAX(CAST(CodigoLancamento AS BIGINT)), 0) AS maxLancamento
      FROM INOVAFARMA_DPOPPARA.dbo.Cadastro WITH (UPDLOCK, HOLDLOCK)
    `);

    const maxCadastro = Number(maxResult.recordset[0].maxCadastro || 0);
    const maxLancamento = Number(maxResult.recordset[0].maxLancamento || 0);
    
    const proximoCadastro = maxCadastro === 0 ? 1 : maxCadastro + 100;
    const proximoLancamento = maxLancamento === 0 ? 101 : maxLancamento + 100;

    const request = new sql.Request(transaction)
      .input('CodigoCadastro', proximoCadastro)
      .input('CodigoLancamento', proximoLancamento.toString());
    
    criacao.entradas.forEach(({ campo, valor }) => {
      // Pula CodigoLancamento da entrada pois já foi setado acima
      if (campo !== 'CodigoLancamento') {
        request.input(campo, valor);
      }
    });

    const camposInsert = ['CodigoCadastro', 'CodigoLancamento', ...criacao.entradas
      .filter(e => e.campo !== 'CodigoLancamento')
      .map(({ campo }) => campo)];
    const valoresInsert = camposInsert.map((campo) => `@${campo}`);

    const result = await request.query(`
      INSERT INTO INOVAFARMA_DPOPPARA.dbo.Cadastro (${camposInsert.join(', ')})
      OUTPUT INSERTED.*
      VALUES (${valoresInsert.join(', ')})
    `);

    // Gera CodigoCliente de forma serializada para evitar NULL/duplicidade.
    const maxClienteResult = await new sql.Request(transaction).query(`
      SELECT ISNULL(MAX(CodigoCliente), 0) AS maxCliente
      FROM INOVAFARMA_DPOPPARA.dbo.Cliente WITH (UPDLOCK, HOLDLOCK)
    `);

    const maxCliente = Number(maxClienteResult.recordset[0].maxCliente || 0);
    const proximoCodigoCliente = maxCliente === 0 ? 1 : maxCliente + 1;

    const criarConvenioFidelicard = parseBooleanLike(req.body.vincularConvenioFidelicard, true);
    const tituloConvenio = String(req.body.tituloConvenio || 'FIDELICARD').trim();

    // Garante vinculo em Cliente para o cadastro aparecer no painel.
    const clienteInsert = await new sql.Request(transaction)
      .input('CodigoCliente', proximoCodigoCliente)
      .input('CodigoCadastro', proximoCadastro)
      .query(`
        INSERT INTO INOVAFARMA_DPOPPARA.dbo.Cliente (
          CodigoCliente,
          CodigoCadastro,
          CodigoTipo,
          LimiteCompra,
          Padrao,
          NFPaulista,
          Ativo,
          Eliminado,
          CalculaJuros,
          ConsumidorFinal,
          PermitirVendaPrazoPrecoPromocao,
          QuantidadeMaximaParcelas,
          VencimentoTipo,
          VencimentoDiasPrazo,
          Juros,
          JurosCarencia,
          JurosDiferenciados,
          NuncaBloquear,
          PermitirVendaPrecoPromocao,
          NaoVenderPrazo,
          Desconto,
          SCPC,
          NaoRepassaComissao
        )
        OUTPUT INSERTED.CodigoCliente, INSERTED.CodigoCadastro
        SELECT
          @CodigoCliente,
          @CodigoCadastro,
          1,
          0,
          0,
          0,
          1,
          0,
          1,
          1,
          1,
          0,
          1,
          30,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        WHERE NOT EXISTS (
          SELECT 1
          FROM INOVAFARMA_DPOPPARA.dbo.Cliente
          WHERE CodigoCadastro = @CodigoCadastro
        )
      `);

    let codigoCliente = clienteInsert.recordset[0]?.CodigoCliente ?? null;
    if (codigoCliente == null) {
      const clienteExistente = await new sql.Request(transaction)
        .input('CodigoCadastro', proximoCadastro)
        .query(`
          SELECT TOP 1 CodigoCliente
          FROM INOVAFARMA_DPOPPARA.dbo.Cliente
          WHERE CodigoCadastro = @CodigoCadastro
        `);

      codigoCliente = clienteExistente.recordset[0]?.CodigoCliente ?? null;
    }

    let convenioVinculado = null;

    if (criarConvenioFidelicard && codigoCliente != null) {
      const convenioResult = await new sql.Request(transaction)
        .input('tituloConvenio', `%${tituloConvenio}%`)
        .query(`
          SELECT TOP 1
            cv.CodigoConvenio,
            cadConv.Nome AS NomeConvenio
          FROM INOVAFARMA_DPOPPARA.dbo.Convenio cv
          JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cadConv
            ON cadConv.CodigoCadastro = cv.CodigoCadastro
          WHERE UPPER(LTRIM(RTRIM(cadConv.Nome))) LIKE UPPER(LTRIM(RTRIM(@tituloConvenio)))
            AND ISNULL(cv.Ativo, 0) = 1
          ORDER BY CASE WHEN UPPER(LTRIM(RTRIM(cadConv.Nome))) = UPPER(LTRIM(RTRIM(@tituloConvenio))) THEN 0 ELSE 1 END,
                   cv.CodigoConvenio
        `);

      if (convenioResult.recordset.length > 0) {
        const codigoConvenio = convenioResult.recordset[0].CodigoConvenio;

        const maxClienteConvenioIdResult = await new sql.Request(transaction).query(`
          SELECT ISNULL(MAX(CodigoClienteID), 0) AS maxClienteConvenioID
          FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio WITH (UPDLOCK, HOLDLOCK)
        `);

        const maxClienteConvenioID = Number(maxClienteConvenioIdResult.recordset[0].maxClienteConvenioID || 0);
        const proximoCodigoClienteID = maxClienteConvenioID === 0 ? 1 : maxClienteConvenioID + 1;

        const insertConvenio = await new sql.Request(transaction)
          .input('CodigoClienteID', proximoCodigoClienteID)
          .input('CodigoCliente', codigoCliente)
          .input('CodigoConvenio', codigoConvenio)
          .query(`
            INSERT INTO INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio (
              CodigoClienteID,
              CodigoCliente,
              CodigoConvenio,
              Matricula,
              NumeroCartao,
              LimiteCredito,
              DataCadastro,
              Status,
              InformarPrescritorNasVendas
            )
            OUTPUT INSERTED.CodigoClienteID, INSERTED.CodigoCliente, INSERTED.CodigoConvenio
            SELECT
              @CodigoClienteID,
              @CodigoCliente,
              @CodigoConvenio,
              NULL,
              NULL,
              0,
              GETDATE(),
              0,
              0
            WHERE NOT EXISTS (
              SELECT 1
              FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio
              WHERE CodigoCliente = @CodigoCliente
                AND CodigoConvenio = @CodigoConvenio
            )
          `);

        if (insertConvenio.recordset.length > 0) {
          convenioVinculado = {
            criado: true,
            CodigoClienteID: insertConvenio.recordset[0].CodigoClienteID,
            CodigoCliente: insertConvenio.recordset[0].CodigoCliente,
            CodigoConvenio: insertConvenio.recordset[0].CodigoConvenio,
            NomeConvenio: convenioResult.recordset[0].NomeConvenio,
          };
        } else {
          const convenioExistente = await new sql.Request(transaction)
            .input('CodigoCliente', codigoCliente)
            .input('CodigoConvenio', codigoConvenio)
            .query(`
              SELECT TOP 1 CodigoClienteID, CodigoCliente, CodigoConvenio
              FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio
              WHERE CodigoCliente = @CodigoCliente
                AND CodigoConvenio = @CodigoConvenio
            `);

          convenioVinculado = {
            criado: false,
            CodigoClienteID: convenioExistente.recordset[0]?.CodigoClienteID ?? null,
            CodigoCliente: convenioExistente.recordset[0]?.CodigoCliente ?? codigoCliente,
            CodigoConvenio: convenioExistente.recordset[0]?.CodigoConvenio ?? codigoConvenio,
            NomeConvenio: convenioResult.recordset[0].NomeConvenio,
          };
        }
      }
    }

    const statusResult = await new sql.Request(transaction)
      .input('CodigoCadastro', proximoCadastro)
      .query(`
        SELECT
          CASE WHEN cad.CodigoCadastro IS NOT NULL THEN 1 ELSE 0 END AS existeCadastro,
          CASE WHEN cli.CodigoCliente IS NOT NULL THEN 1 ELSE 0 END AS existeCliente,
          cli.CodigoCliente,
          ISNULL(cli.Ativo, 0) AS clienteAtivo,
          ISNULL(cli.Eliminado, 0) AS clienteEliminado
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
          ON cli.CodigoCadastro = cad.CodigoCadastro
        WHERE cad.CodigoCadastro = @CodigoCadastro
      `);

    const statusPainel = statusPainelFromLinha(statusResult.recordset[0]);

    await transaction.commit();

    return res.status(201).json({
      mensagem: 'Cadastro criado com sucesso e validado para o painel.',
      dados: result.recordset[0],
      cliente: {
        CodigoCliente: codigoCliente,
      },
      cliente_convenio: convenioVinculado,
      validacao_tabelas: statusPainel,
      regra_convenio: {
        titulo: tituloConvenio,
        vincularNoPost: criarConvenioFidelicard,
        vinculado: convenioVinculado != null ? 'SIM' : 'NAO',
      },
      codigos_gerados: {
        CodigoCadastro: proximoCadastro,
        CodigoLancamento: proximoLancamento.toString(),
        maxAnterior: {
          CodigoCadastro: maxCadastro,
          CodigoLancamento: maxLancamento,
        },
      },
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // ignora falha de rollback para preservar erro original
      }
    }

    return res.status(500).json({ error: err.message });
  }
});

// GET /cadastro/duplicados — lista todos os CPF/CNPJ com duplicidade
// Query params:
//   page, limit          — paginação
//   comPontosValidos     — "true" para retornar somente grupos que têm ao menos 1 cadastro com saldo de pontos > 0
//   dataInicio           — filtro de DataCadastro (formato YYYY-MM-DD), ex: 2024-12-05
//   dataFim              — filtro de DataCadastro (formato YYYY-MM-DD), ex: 2025-12-05
//   incluirEliminados    — "true" para incluir cadastros com Eliminado=1 (default: false)
router.get('/duplicados', async (req, res) => {
  const {
    page = 1,
    limit = 50,
    comPontosValidos,
    dataInicio,
    dataFim,
    incluirEliminados,
  } = req.query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const startRow = (pageNumber - 1) * limitNumber + 1;
  const endRow = pageNumber * limitNumber;

  // Valida datas quando fornecidas
  const reData = /^\d{4}-\d{2}-\d{2}$/;
  if (dataInicio && !reData.test(dataInicio)) {
    return res.status(400).json({ error: 'dataInicio deve estar no formato YYYY-MM-DD.' });
  }
  if (dataFim && !reData.test(dataFim)) {
    return res.status(400).json({ error: 'dataFim deve estar no formato YYYY-MM-DD.' });
  }

  const filtroPontos      = parseBooleanLike(comPontosValidos, false);
  const mostrarEliminados = parseBooleanLike(incluirEliminados, false);

  try {
    const pool = await connectDB();

    // ─── Monta filtros de data ──────────────────────────────────────────────
    const filtrosData = [];
    if (dataInicio) filtrosData.push(`CAST(cad.DataCadastro AS DATE) >= @dataInicio`);
    if (dataFim)    filtrosData.push(`CAST(cad.DataCadastro AS DATE) <= @dataFim`);
    // Por padrão exclui cadastros marcados como Eliminado=1
    if (!mostrarEliminados) filtrosData.push(`ISNULL(cad.Eliminado, 0) = 0`);
    const whereData = filtrosData.length > 0 ? `AND ${filtrosData.join(' AND ')}` : '';

    // ─── Filtro de pontos válidos ───────────────────────────────────────────
    // Quando ativo, o grupo só entra no resultado se ao menos um CodigoCadastro
    // do grupo tiver saldo > 0 em Fidelidade_Ponto.
    const joinPontos = filtroPontos
      ? `JOIN (
           SELECT DISTINCT fp.CodigoCadastro
           FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
           WHERE fp.Saldo > 0
             AND CAST(fp.DataVencimento AS DATE) >= CAST(GETDATE() AS DATE)
         ) fp_valido ON fp_valido.CodigoCadastro = cad.CodigoCadastro`
      : '';

    // ─── Total de grupos ───────────────────────────────────────────────────
    const reqTotal = pool.request();
    if (dataInicio) reqTotal.input('dataInicio', dataInicio);
    if (dataFim)    reqTotal.input('dataFim', dataFim);

    const totalResult = await reqTotal.query(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT LTRIM(RTRIM(cad.CPFCNPJ)) AS CPFCNPJ
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        ${joinPontos}
        WHERE LTRIM(RTRIM(ISNULL(cad.CPFCNPJ, ''))) <> ''
          ${whereData}
        GROUP BY LTRIM(RTRIM(cad.CPFCNPJ))
        HAVING COUNT(*) > 1
      ) AS duplicados
    `);

    const totalGrupos = totalResult.recordset[0].total;

    // ─── Detalhes paginados ────────────────────────────────────────────────
    const reqMain = pool.request()
      .input('startRow', startRow)
      .input('endRow', endRow);

    if (dataInicio) reqMain.input('dataInicio', dataInicio);
    if (dataFim)    reqMain.input('dataFim', dataFim);

    const result = await reqMain.query(`
      ;WITH CpfsDuplicados AS (
        SELECT
          LTRIM(RTRIM(cad.CPFCNPJ)) AS CPFCNPJ,
          COUNT(*) AS quantidade,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, LTRIM(RTRIM(cad.CPFCNPJ))) AS RowNum
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        ${joinPontos}
        WHERE LTRIM(RTRIM(ISNULL(cad.CPFCNPJ, ''))) <> ''
          ${whereData}
        GROUP BY LTRIM(RTRIM(cad.CPFCNPJ))
        HAVING COUNT(*) > 1
      ),
      CpfsPaginados AS (
        SELECT * FROM CpfsDuplicados
        WHERE RowNum BETWEEN @startRow AND @endRow
      )
      SELECT
        cad.CodigoCadastro,
        cad.CodigoEmpresa,
        cad.CodigoLancamento,
        LTRIM(RTRIM(cad.Nome))      AS Nome,
        LTRIM(RTRIM(cad.SobreNome)) AS SobreNome,
        LTRIM(RTRIM(cad.CPFCNPJ))  AS CPFCNPJ,
        cad.DataNascimento,
        cad.DataCadastro,
        cad.Eliminado,
        cli.CodigoCliente,
        ISNULL(SUM(fp2.Saldo), 0)   AS SaldoPontosDisponivel,
        MAX(dup.quantidade)         AS TotalDuplicados
      FROM CpfsPaginados dup
      JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        ON LTRIM(RTRIM(cad.CPFCNPJ)) = dup.CPFCNPJ
      LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
        ON cli.CodigoCadastro = cad.CodigoCadastro
      LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp2
        ON fp2.CodigoCadastro = cad.CodigoCadastro
       AND fp2.Saldo > 0
       AND CAST(fp2.DataVencimento AS DATE) >= CAST(GETDATE() AS DATE)
      GROUP BY
        cad.CodigoCadastro, cad.CodigoEmpresa, cad.CodigoLancamento,
        cad.Nome, cad.SobreNome, cad.CPFCNPJ,
        cad.DataNascimento, cad.DataCadastro, cad.Eliminado,
        cli.CodigoCliente
      ORDER BY MAX(dup.quantidade) DESC, LTRIM(RTRIM(cad.CPFCNPJ)), cad.CodigoCadastro
    `);

    // ─── Agrupa por CPFCNPJ ────────────────────────────────────────────────
    const grupos = {};
    for (const linha of result.recordset) {
      const cpf = linha.CPFCNPJ;
      if (!grupos[cpf]) {
        grupos[cpf] = {
          CPFCNPJ: cpf,
          quantidade: linha.TotalDuplicados,
          cadastros: [],
        };
      }
      grupos[cpf].cadastros.push({
        CodigoCadastro: linha.CodigoCadastro,
        CodigoEmpresa: linha.CodigoEmpresa,
        CodigoLancamento: linha.CodigoLancamento,
        Nome: linha.Nome,
        SobreNome: linha.SobreNome,
        DataNascimento: linha.DataNascimento,
        DataCadastro: linha.DataCadastro,
        Eliminado: linha.Eliminado,
        CodigoCliente: linha.CodigoCliente,
        SaldoPontosDisponivel: Number(linha.SaldoPontosDisponivel),
        temPontosValidos: Number(linha.SaldoPontosDisponivel) > 0,
      });
    }

    return res.json({
      pagina: pageNumber,
      limite: limitNumber,
      totalGruposDuplicados: totalGrupos,
      totalNestaPagina: Object.keys(grupos).length,
      filtrosAtivos: {
        comPontosValidos: filtroPontos,
        incluirEliminados: mostrarEliminados,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
      },
      duplicados: Object.values(grupos),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /cadastro/duplicados/excluir-em-massa
// Remove ou inativa em massa cadastros duplicados dentro de um período.
//
// Body (JSON):
//   dataInicio    (obrigatório) — "YYYY-MM-DD"
//   dataFim       (obrigatório) — "YYYY-MM-DD"
//   manter        (opcional)    — "mais_antigo" (default) | "mais_recente"
//   estrategia    (opcional)    — "excluir" (default) | "marcar_eliminado"
//                   "excluir"          → DELETE físico; cadastros com vínculo em Venda/Fiscal/
//                                        Fornecedor/Orcamento são pulados e reportados.
//                   "marcar_eliminado" → SET Eliminado=1; funciona em 100% dos casos pois
//                                        não viola FKs.
//   apenasSimular (opcional)    — true = dry-run, não altera nada
router.delete('/duplicados/excluir-em-massa', async (req, res) => {
  const {
    dataInicio,
    dataFim,
    manter = 'mais_antigo',
    estrategia = 'excluir',
    apenasSimular = false,
  } = req.body || {};

  const reData = /^\d{4}-\d{2}-\d{2}$/;
  if (!dataInicio || !reData.test(dataInicio)) {
    return res.status(400).json({ error: 'dataInicio é obrigatório e deve estar no formato YYYY-MM-DD.' });
  }
  if (!dataFim || !reData.test(dataFim)) {
    return res.status(400).json({ error: 'dataFim é obrigatório e deve estar no formato YYYY-MM-DD.' });
  }
  if (!['mais_antigo', 'mais_recente'].includes(manter)) {
    return res.status(400).json({ error: 'manter deve ser "mais_antigo" ou "mais_recente".' });
  }
  if (!['excluir', 'marcar_eliminado', 'forcar_exclusao'].includes(estrategia)) {
    return res.status(400).json({ error: 'estrategia deve ser "excluir", "marcar_eliminado" ou "forcar_exclusao".' });
  }

  const simular   = parseBooleanLike(apenasSimular, false);
  const rankOrder = manter === 'mais_antigo' ? 'ASC' : 'DESC';

  let transaction;

  try {
    const pool = await connectDB();

    // ─── 1. Levanta candidatos ────────────────────────────────────────────
    const candidatosResult = await pool.request().batch(`
      ;WITH DuplicadosPeriodo AS (
        SELECT
          cad.CodigoCadastro,
          LTRIM(RTRIM(cad.CPFCNPJ)) AS CPFCNPJ,
          LTRIM(RTRIM(cad.Nome))     AS Nome,
          cad.DataCadastro,
          cad.Eliminado,
          cli.CodigoCliente,
          ROW_NUMBER() OVER (
            PARTITION BY LTRIM(RTRIM(cad.CPFCNPJ))
            ORDER BY cad.CodigoCadastro ${rankOrder}
          ) AS rn,
          COUNT(*) OVER (
            PARTITION BY LTRIM(RTRIM(cad.CPFCNPJ))
          ) AS totalNoGrupo
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
          ON cli.CodigoCadastro = cad.CodigoCadastro
        WHERE LTRIM(RTRIM(ISNULL(cad.CPFCNPJ, ''))) <> ''
          AND CAST(cad.DataCadastro AS DATE) BETWEEN '${dataInicio}' AND '${dataFim}'
      )
      SELECT *
      FROM DuplicadosPeriodo
      WHERE totalNoGrupo > 1
      ORDER BY CPFCNPJ, rn
    `);

    const todos      = candidatosResult.recordset;
    const paraAgir   = todos.filter(r => r.rn > 1);
    const paraManter = todos.filter(r => r.rn === 1);

    if (paraAgir.length === 0) {
      return res.json({
        mensagem: 'Nenhum cadastro duplicado encontrado no período informado.',
        periodo: { dataInicio, dataFim },
        criterioManter: manter,
        estrategia,
        totalAfetados: 0,
        simulacao: simular,
      });
    }

    // ─── 2. Verifica vínculos históricos (só para estrategia "excluir") ───
    // "forcar_exclusao" pula esta etapa — deleta tudo inclusive histórico.
    let aptoParaAgir             = paraAgir;
    let naoProcessadosPorVinculo = [];

    if (estrategia === 'excluir') {
      const insertsCadastro = paraAgir
        .map(r => `(${r.CodigoCadastro}, ${r.CodigoCliente ?? 'NULL'})`)
        .join(',');

      await pool.request().batch(`
        IF OBJECT_ID('tempdb..#TempCandidatos') IS NOT NULL DROP TABLE #TempCandidatos;
        CREATE TABLE #TempCandidatos (CodigoCadastro INT, CodigoCliente INT NULL);
        INSERT INTO #TempCandidatos (CodigoCadastro, CodigoCliente) VALUES ${insertsCadastro};
      `);

      const vinculosResult = await pool.request().batch(`
        SELECT DISTINCT t.CodigoCadastro, 'Venda' AS Tabela
          FROM INOVAFARMA_DPOPPARA.dbo.Venda v
          JOIN #TempCandidatos t ON t.CodigoCadastro = v.CodigoCadastro
        UNION ALL
        SELECT DISTINCT t.CodigoCadastro, 'Fiscal' AS Tabela
          FROM INOVAFARMA_DPOPPARA.dbo.Fiscal f
          JOIN #TempCandidatos t ON t.CodigoCadastro = f.CodigoCadastro
        UNION ALL
        SELECT DISTINCT t.CodigoCadastro, 'Fornecedor' AS Tabela
          FROM INOVAFARMA_DPOPPARA.dbo.Fornecedor fn
          JOIN #TempCandidatos t ON t.CodigoCadastro = fn.CodigoCadastro
        UNION ALL
        SELECT DISTINCT t.CodigoCadastro, 'Orcamento' AS Tabela
          FROM INOVAFARMA_DPOPPARA.dbo.Orcamento o
          JOIN #TempCandidatos t ON t.CodigoCliente = o.CodigoCliente
          WHERE t.CodigoCliente IS NOT NULL
      `);

      await pool.request().batch(`
        IF OBJECT_ID('tempdb..#TempCandidatos') IS NOT NULL DROP TABLE #TempCandidatos;
      `);

      const bloqueados = new Map();
      for (const row of (vinculosResult.recordset ?? [])) {
        const cod = row.CodigoCadastro;
        if (!bloqueados.has(cod)) bloqueados.set(cod, []);
        if (!bloqueados.get(cod).includes(row.Tabela)) bloqueados.get(cod).push(row.Tabela);
      }

      aptoParaAgir = paraAgir.filter(r => !bloqueados.has(r.CodigoCadastro));
      naoProcessadosPorVinculo = paraAgir
        .filter(r => bloqueados.has(r.CodigoCadastro))
        .map(r => ({
          CodigoCadastro: r.CodigoCadastro,
          CPFCNPJ: r.CPFCNPJ,
          Nome: r.Nome,
          DataCadastro: r.DataCadastro,
          CodigoCliente: r.CodigoCliente,
          motivoBloqueio: bloqueados.get(r.CodigoCadastro),
          sugestao: 'Use estrategia "marcar_eliminado" para inativar sem violar FKs.',
        }));
    }

    // ─── 3. Simulação ─────────────────────────────────────────────────────
    if (simular) {
      const acaoLabel = estrategia === 'excluir'
        ? 'excluídos'
        : estrategia === 'forcar_exclusao'
          ? 'excluídos forçadamente (com todo o histórico)'
          : 'marcados como Eliminado';
      return res.json({
        mensagem: `SIMULAÇÃO — nenhum dado foi alterado. ${aptoParaAgir.length} registro(s) seria(m) ${acaoLabel}.`,
        periodo: { dataInicio, dataFim },
        criterioManter: manter,
        estrategia,
        simulacao: true,
        totalGruposAfetados: paraManter.length,
        totalQueSeriaAfetado: aptoParaAgir.length,
        totalBloqueadosPorVinculo: naoProcessadosPorVinculo.length,
        registrosQueSeriaAfetados: aptoParaAgir.map(r => ({
          CodigoCadastro: r.CodigoCadastro,
          CPFCNPJ: r.CPFCNPJ,
          Nome: r.Nome,
          DataCadastro: r.DataCadastro,
          Eliminado: r.Eliminado,
          CodigoCliente: r.CodigoCliente,
        })),
        registrosQueSeriaMantiods: paraManter.map(r => ({
          CodigoCadastro: r.CodigoCadastro,
          CPFCNPJ: r.CPFCNPJ,
          Nome: r.Nome,
          DataCadastro: r.DataCadastro,
          CodigoCliente: r.CodigoCliente,
        })),
        naoProcessadosPorVinculo,
      });
    }

    if (aptoParaAgir.length === 0) {
      return res.json({
        mensagem: 'Todos os cadastros duplicados possuem vínculos históricos e não podem ser excluídos fisicamente. Use estrategia "marcar_eliminado" para inativá-los.',
        periodo: { dataInicio, dataFim },
        criterioManter: manter,
        estrategia,
        totalAfetados: 0,
        naoProcessadosPorVinculo,
      });
    }

    // ─── 4. Execução real em transação ────────────────────────────────────
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    let totalCadastrosAfetados  = 0;
    let totalClientesAfetados   = 0;
    let totalConveniosRemovidos = 0;
    let totalContatosRemovidos  = 0;
    let totalPontosRemovidos    = 0;

    for (const reg of aptoParaAgir) {
      if (estrategia === 'marcar_eliminado') {
        // Marca Eliminado = 1 no Cadastro
        const resCad = await new sql.Request(transaction)
          .input('codigoCadastro', reg.CodigoCadastro)
          .query(`UPDATE INOVAFARMA_DPOPPARA.dbo.Cadastro SET Eliminado = 1 WHERE CodigoCadastro = @codigoCadastro`);
        totalCadastrosAfetados += resCad.rowsAffected[0] || 0;

        // Marca Eliminado = 1 no Cliente (se existir)
        if (reg.CodigoCliente != null) {
          const resCli = await new sql.Request(transaction)
            .input('codigoCliente', reg.CodigoCliente)
            .query(`UPDATE INOVAFARMA_DPOPPARA.dbo.Cliente SET Eliminado = 1 WHERE CodigoCliente = @codigoCliente`);
          totalClientesAfetados += resCli.rowsAffected[0] || 0;
        }
      } else {
        // DELETE físico em cascata (excluir ou forcar_exclusao)
        const resContato = await new sql.Request(transaction)
          .input('codigoCadastro', reg.CodigoCadastro)
          .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cadastro_Contato WHERE CodigoCadastro = @codigoCadastro`);
        totalContatosRemovidos += resContato.rowsAffected[0] || 0;

        const resPonto = await new sql.Request(transaction)
          .input('codigoCadastro', reg.CodigoCadastro)
          .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto WHERE CodigoCadastro = @codigoCadastro`);
        totalPontosRemovidos += resPonto.rowsAffected[0] || 0;

        if (reg.CodigoCliente != null) {
          const resCC = await new sql.Request(transaction)
            .input('codigoCliente', reg.CodigoCliente)
            .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio WHERE CodigoCliente = @codigoCliente`);
          totalConveniosRemovidos += resCC.rowsAffected[0] || 0;

          // forcar_exclusao: remove também Venda, Fiscal, Orcamento, Fornecedor
          if (estrategia === 'forcar_exclusao') {
            await new sql.Request(transaction)
              .input('codigoCliente', reg.CodigoCliente)
              .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Orcamento WHERE CodigoCliente = @codigoCliente`);

            await new sql.Request(transaction)
              .input('codigoCadastro', reg.CodigoCadastro)
              .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Venda WHERE CodigoCadastro = @codigoCadastro`);

            await new sql.Request(transaction)
              .input('codigoCadastro', reg.CodigoCadastro)
              .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Fiscal WHERE CodigoCadastro = @codigoCadastro`);

            await new sql.Request(transaction)
              .input('codigoCadastro', reg.CodigoCadastro)
              .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Fornecedor WHERE CodigoCadastro = @codigoCadastro`);
          }

          const resCli = await new sql.Request(transaction)
            .input('codigoCliente', reg.CodigoCliente)
            .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cliente WHERE CodigoCliente = @codigoCliente`);
          totalClientesAfetados += resCli.rowsAffected[0] || 0;
        }

        const resCad = await new sql.Request(transaction)
          .input('codigoCadastro', reg.CodigoCadastro)
          .query(`DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cadastro WHERE CodigoCadastro = @codigoCadastro`);
        totalCadastrosAfetados += resCad.rowsAffected[0] || 0;
      }
    }

    await transaction.commit();

    const mensagemFinal = estrategia === 'marcar_eliminado'
      ? `${totalCadastrosAfetados} cadastro(s) marcado(s) como Eliminado com sucesso.`
      : estrategia === 'forcar_exclusao'
        ? `Exclusão forçada concluída. ${totalCadastrosAfetados} cadastro(s) removido(s) com todo o histórico.`
        : `Exclusão em massa concluída. ${totalCadastrosAfetados} cadastro(s) removido(s).`;

    return res.json({
      mensagem: mensagemFinal,
      periodo: { dataInicio, dataFim },
      criterioManter: manter,
      estrategia,
      simulacao: false,
      resumo: {
        totalGruposAfetados: paraManter.length,
        totalCadastrosAfetados,
        totalClientesAfetados,
        totalVinculosConvenioRemovidos: totalConveniosRemovidos,
        totalContatosRemovidos,
        totalPontosRemovidos,
        totalNaoProcessadosPorVinculo: naoProcessadosPorVinculo.length,
      },
      registrosAfetados: aptoParaAgir.map(r => ({
        CodigoCadastro: r.CodigoCadastro,
        CPFCNPJ: r.CPFCNPJ,
        Nome: r.Nome,
        DataCadastro: r.DataCadastro,
        CodigoCliente: r.CodigoCliente,
      })),
      registrosMantiods: paraManter.map(r => ({
        CodigoCadastro: r.CodigoCadastro,
        CPFCNPJ: r.CPFCNPJ,
        Nome: r.Nome,
        DataCadastro: r.DataCadastro,
        CodigoCliente: r.CodigoCliente,
      })),
      naoProcessadosPorVinculo,
    });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch { /* preserva erro original */ }
    }
    return res.status(500).json({ error: err.message });
  }
});

// GET /cadastro/:codigo — buscar usuário por CodigoCadastro
router.get('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('codigo', codigo)
      .query(`
        SELECT *
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
        WHERE CodigoCadastro = @codigo
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /cadastro/:codigo — atualizar todos os campos editáveis
router.put('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  const atualizacao = montarAtualizacao(req.body, false);
  if (atualizacao.erro) {
    return res.status(400).json(atualizacao);
  }

  try {
    const pool = await connectDB();
    const request = pool.request().input('codigo', codigo);

    atualizacao.params.forEach(({ campo, valor }) => {
      request.input(campo, valor);
    });

    const result = await request.query(`
      UPDATE INOVAFARMA_DPOPPARA.dbo.Cadastro
      SET ${atualizacao.setClause}
      OUTPUT INSERTED.*
      WHERE CodigoCadastro = @codigo
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    return res.json({
      mensagem: 'Cadastro atualizado com PUT.',
      dados: result.recordset[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /cadastro/:codigo — atualizar parcialmente
router.patch('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  const atualizacao = montarAtualizacao(req.body, true);
  if (atualizacao.erro) {
    return res.status(400).json(atualizacao);
  }

  try {
    const pool = await connectDB();
    const request = pool.request().input('codigo', codigo);

    atualizacao.params.forEach(({ campo, valor }) => {
      request.input(campo, valor);
    });

    const result = await request.query(`
      UPDATE INOVAFARMA_DPOPPARA.dbo.Cadastro
      SET ${atualizacao.setClause}
      OUTPUT INSERTED.*
      WHERE CodigoCadastro = @codigo
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    return res.json({
      mensagem: 'Cadastro atualizado com PATCH.',
      dados: result.recordset[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /cadastro/:codigo — deletar cadastro pelo CodigoCadastro
router.delete('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  try {
    const pool = await connectDB();

    // Verifica se o cadastro existe antes de deletar
    const check = await pool.request()
      .input('codigo', codigo)
      .query(`
        SELECT
          cad.CodigoCadastro,
          LTRIM(RTRIM(cad.Nome)) AS Nome,
          LTRIM(RTRIM(cad.CPFCNPJ)) AS CPFCNPJ,
          cli.CodigoCliente
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro cad
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
          ON cli.CodigoCadastro = cad.CodigoCadastro
        WHERE cad.CodigoCadastro = @codigo
      `);

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    const cadastroParaDeletar = check.recordset[0];

    // Deleção em cascata dentro de uma transaction respeitando as FKs:
    // 1. Cliente_Convenio  →  2. Cliente  →  3. Cadastro
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Remove vínculos de convênio do cliente (se existir)
      if (cadastroParaDeletar.CodigoCliente != null) {
        await new sql.Request(transaction)
          .input('codigoCliente', cadastroParaDeletar.CodigoCliente)
          .query(`
            DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio
            WHERE CodigoCliente = @codigoCliente
          `);

        // 2. Remove o registro de Cliente
        await new sql.Request(transaction)
          .input('codigoCliente', cadastroParaDeletar.CodigoCliente)
          .query(`
            DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cliente
            WHERE CodigoCliente = @codigoCliente
          `);
      }

      // 3. Remove o Cadastro
      await new sql.Request(transaction)
        .input('codigo', codigo)
        .query(`
          DELETE FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
          WHERE CodigoCadastro = @codigo
        `);

      await transaction.commit();
    } catch (errTx) {
      await transaction.rollback();
      throw errTx;
    }

    return res.json({
      mensagem: 'Cadastro deletado com sucesso.',
      cadastroDeletado: cadastroParaDeletar,
      dependenciasRemovidas: {
        cliente: cadastroParaDeletar.CodigoCliente != null ? 'SIM' : 'NAO',
        clienteConvenio: cadastroParaDeletar.CodigoCliente != null ? 'SIM' : 'NAO',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;