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


// GET /cadastro?page=1&limit=20&nome=FRANCISCA
router.get('/', async (req, res) => {
  const { page = 1, limit = 50, nome } = req.query;
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
    let where = '';
    if (nome) {
      request.input('nome', `%${nome}%`);
      where = `WHERE LTRIM(RTRIM(Nome)) LIKE LTRIM(RTRIM(@nome))`;
    }

    const result = await request.query(`
      ;WITH CadastroPaginado AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY Nome) AS RowNum
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
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

module.exports = router;