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
      validacao_tabelas: statusPainel,
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