const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

function quoteIdentifier(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function buildNomeCompleto(cadastro) {
  const nome = String(cadastro.Nome || '').trim();
  const sobreNome = String(cadastro.SobreNome || '').trim();
  return [nome, sobreNome].filter(Boolean).join(' ').trim();
}

function valueForColumn(cadastro, columnName) {
  const campo = String(columnName || '').toLowerCase();
  if (campo === 'codigocadastro') return cadastro.CodigoCadastro;
  if (campo === 'codigolancamento') return cadastro.CodigoLancamento;
  if (campo === 'cpfcnpj') return cadastro.CPFCNPJ;
  if (campo === 'nome') return cadastro.Nome;
  if (campo === 'sobrenome') return cadastro.SobreNome;
  if (campo === 'codigoempresa') return cadastro.CodigoEmpresa;
  return null;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function isTextType(dataType) {
  const t = String(dataType || '').toLowerCase();
  return ['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'].includes(t);
}

function isNumericType(dataType) {
  const t = String(dataType || '').toLowerCase();
  return ['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric'].includes(t);
}

// GET /tabelas — listar todas as tabelas do banco
router.get('/', async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA AS esquema,
        TABLE_NAME   AS tabela
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tabelas/:nome — listar colunas de uma tabela específica
router.get('/:nome/colunas', async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('tabela', req.params.nome)
      .query(`
        SELECT 
          COLUMN_NAME   AS coluna,
          DATA_TYPE     AS tipo,
          IS_NULLABLE   AS nulo
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tabela
        ORDER BY ORDINAL_POSITION
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tabelas/:nome/dados — SELECT com paginação
router.get('/:nome/dados', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const pool = await connectDB();

    // Valida nome da tabela para evitar SQL injection
    const tabelaValida = await pool.request()
      .input('tabela', req.params.nome)
      .query(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = @tabela
      `);

    if (tabelaValida.recordset[0].total === 0) {
      return res.status(404).json({ error: 'Tabela não encontrada' });
    }

    const result = await pool.request()
      .input('limit', Number(limit))
      .input('offset', Number(offset))
      .query(`
        SELECT * FROM ${req.params.nome}
        ORDER BY (SELECT NULL)
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    res.json({
      pagina: Number(page),
      limite: Number(limit),
      total: result.recordset.length,
      dados: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tabelas/cadastro/diagnostico?codigoCadastro=123&compararCodigoCadastro=456&sample=5&scanLimit=200
router.get('/cadastro/diagnostico', async (req, res) => {
  const codigoCadastro = Number(req.query.codigoCadastro);
  const compararCodigoCadastro = req.query.compararCodigoCadastro != null
    ? Number(req.query.compararCodigoCadastro)
    : null;
  const sample = parsePositiveInt(req.query.sample, 5);
  const scanLimit = parsePositiveInt(req.query.scanLimit, 200);

  if (Number.isNaN(codigoCadastro)) {
    return res.status(400).json({
      error: 'Informe codigoCadastro válido. Exemplo: /tabelas/cadastro/diagnostico?codigoCadastro=180681501',
    });
  }

  if (compararCodigoCadastro != null && Number.isNaN(compararCodigoCadastro)) {
    return res.status(400).json({
      error: 'compararCodigoCadastro inválido.',
    });
  }

  try {
    const pool = await connectDB();

    const cadastrosResult = await pool.request()
      .input('codigoA', codigoCadastro)
      .input('codigoB', compararCodigoCadastro)
      .query(`
        SELECT *
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
        WHERE CodigoCadastro = @codigoA
           OR (@codigoB IS NOT NULL AND CodigoCadastro = @codigoB)
      `);

    const cadastroA = cadastrosResult.recordset.find((c) => Number(c.CodigoCadastro) === codigoCadastro);
    const cadastroB = compararCodigoCadastro != null
      ? cadastrosResult.recordset.find((c) => Number(c.CodigoCadastro) === compararCodigoCadastro)
      : null;

    if (!cadastroA) {
      return res.status(404).json({
        error: `Cadastro ${codigoCadastro} não encontrado em INOVAFARMA_DPOPPARA.dbo.Cadastro.`,
      });
    }

    if (compararCodigoCadastro != null && !cadastroB) {
      return res.status(404).json({
        error: `Cadastro ${compararCodigoCadastro} não encontrado em INOVAFARMA_DPOPPARA.dbo.Cadastro.`,
      });
    }

    const fkResult = await pool.request().query(`
      SELECT
        ps.name AS schemaName,
        pt.name AS tableName,
        pc.name AS parentColumn,
        rs.name AS referencedSchema,
        rt.name AS referencedTable,
        rc.name AS referencedColumn,
        fk.name AS fkName
      FROM sys.foreign_key_columns fkc
      JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
      JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
      JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
      JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
      JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
      JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
      WHERE rt.name = 'Cadastro' AND rs.name = 'dbo'
      ORDER BY ps.name, pt.name, fk.name
    `);

    const fkGroups = new Map();
    fkResult.recordset.forEach((row) => {
      const key = `${row.schemaName}.${row.tableName}.${row.fkName}`;
      if (!fkGroups.has(key)) {
        fkGroups.set(key, {
          schemaName: row.schemaName,
          tableName: row.tableName,
          fkName: row.fkName,
          mappings: [],
        });
      }
      fkGroups.get(key).mappings.push({
        parentColumn: row.parentColumn,
        referencedColumn: row.referencedColumn,
      });
    });

    async function countRowsByFkGroup(cadastro, group) {
      const whereParts = [];
      const request = pool.request();

      group.mappings.forEach((mapping, index) => {
        const valor = valueForColumn(cadastro, mapping.referencedColumn);
        const param = `p${index}`;

        if (valor == null) {
          whereParts.push(`${quoteIdentifier(mapping.parentColumn)} IS NULL`);
        } else {
          whereParts.push(`${quoteIdentifier(mapping.parentColumn)} = @${param}`);
          request.input(param, valor);
        }
      });

      const schema = quoteIdentifier(group.schemaName);
      const tabela = quoteIdentifier(group.tableName);
      const where = whereParts.join(' AND ');

      const countResult = await request.query(`
        SELECT COUNT(1) AS total
        FROM ${schema}.${tabela}
        WHERE ${where}
      `);

      return Number(countResult.recordset[0].total || 0);
    }

    async function scanColumns(cadastro, apelido) {
      const colunasResult = await pool.request()
        .input('scanLimit', scanLimit)
        .query(`
          SELECT TOP (@scanLimit)
            c.TABLE_SCHEMA AS schemaName,
            c.TABLE_NAME AS tableName,
            c.COLUMN_NAME AS columnName,
            c.DATA_TYPE AS dataType
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_NAME <> 'Cadastro'
            AND c.COLUMN_NAME IN ('CodigoCadastro', 'CodigoLancamento', 'CPFCNPJ', 'Nome', 'SobreNome', 'CodigoEmpresa')
          ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.COLUMN_NAME
        `);

      const hits = [];

      for (const coluna of colunasResult.recordset) {
        const valor = valueForColumn(cadastro, coluna.columnName);
        if (valor == null || valor === '') continue;

        const request = pool.request().input('valor', valor).input('sample', sample);

        const schema = quoteIdentifier(coluna.schemaName);
        const table = quoteIdentifier(coluna.tableName);
        const column = quoteIdentifier(coluna.columnName);

        const query = `
          SELECT COUNT(1) AS total
          FROM ${schema}.${table}
          WHERE ${column} = @valor;

          SELECT TOP (@sample) *
          FROM ${schema}.${table}
          WHERE ${column} = @valor;
        `;

        const found = await request.query(query);
        const total = Number(found.recordsets[0][0].total || 0);
        if (total > 0) {
          hits.push({
            schema: coluna.schemaName,
            tabela: coluna.tableName,
            coluna: coluna.columnName,
            valor,
            total,
            exemplos: found.recordsets[1],
            origem: apelido,
          });
        }
      }

      return hits;
    }

    const relacionamentosFkA = [];
    for (const group of fkGroups.values()) {
      const total = await countRowsByFkGroup(cadastroA, group);
      relacionamentosFkA.push({
        schema: group.schemaName,
        tabela: group.tableName,
        fk: group.fkName,
        mapeamento: group.mappings,
        total,
      });
    }

    let relacionamentosFkB = [];
    if (cadastroB) {
      for (const group of fkGroups.values()) {
        const total = await countRowsByFkGroup(cadastroB, group);
        relacionamentosFkB.push({
          schema: group.schemaName,
          tabela: group.tableName,
          fk: group.fkName,
          mapeamento: group.mappings,
          total,
        });
      }
    }

    const scansA = await scanColumns(cadastroA, 'cadastroA');
    const scansB = cadastroB ? await scanColumns(cadastroB, 'cadastroB') : [];

    const nomeCompletoA = buildNomeCompleto(cadastroA);
    const nomeCompletoB = cadastroB ? buildNomeCompleto(cadastroB) : null;

    return res.json({
      mensagem: 'Diagnóstico de relacionamento concluído.',
      parametros: {
        codigoCadastro,
        compararCodigoCadastro,
        sample,
        scanLimit,
      },
      cadastroA: {
        CodigoCadastro: cadastroA.CodigoCadastro,
        CodigoLancamento: cadastroA.CodigoLancamento,
        Nome: cadastroA.Nome,
        SobreNome: cadastroA.SobreNome,
        NomeCompleto: nomeCompletoA,
        CPFCNPJ: cadastroA.CPFCNPJ,
        CodigoEmpresa: cadastroA.CodigoEmpresa,
      },
      cadastroB: cadastroB
        ? {
            CodigoCadastro: cadastroB.CodigoCadastro,
            CodigoLancamento: cadastroB.CodigoLancamento,
            Nome: cadastroB.Nome,
            SobreNome: cadastroB.SobreNome,
            NomeCompleto: nomeCompletoB,
            CPFCNPJ: cadastroB.CPFCNPJ,
            CodigoEmpresa: cadastroB.CodigoEmpresa,
          }
        : null,
      relacionamentosPorFK: {
        cadastroA: relacionamentosFkA,
        cadastroB: relacionamentosFkB,
      },
      ocorrenciasPorCampo: {
        cadastroA: scansA,
        cadastroB: scansB,
      },
      diferencas: cadastroB
        ? {
            fkComDadosApenasNoCadastroA: relacionamentosFkA.filter((a) => {
              const b = relacionamentosFkB.find((x) => x.schema === a.schema && x.tabela === a.tabela && x.fk === a.fk);
              return a.total > 0 && (!b || b.total === 0);
            }),
            fkComDadosApenasNoCadastroB: relacionamentosFkB.filter((b) => {
              const a = relacionamentosFkA.find((x) => x.schema === b.schema && x.tabela === b.tabela && x.fk === b.fk);
              return b.total > 0 && (!a || a.total === 0);
            }),
            tabelasComOcorrenciasApenasNoCadastroA: scansA.filter((a) => {
              return !scansB.some((b) => b.schema === a.schema && b.tabela === a.tabela && b.coluna === a.coluna && String(b.valor) === String(a.valor));
            }),
            tabelasComOcorrenciasApenasNoCadastroB: scansB.filter((b) => {
              return !scansA.some((a) => a.schema === b.schema && a.tabela === b.tabela && a.coluna === b.coluna && String(a.valor) === String(b.valor));
            }),
          }
        : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /tabelas/cadastro/varredura-geral?codigoCadastro=123&sample=3&tableLimit=0
router.get('/cadastro/varredura-geral', async (req, res) => {
  const codigoCadastro = Number(req.query.codigoCadastro);
  const sample = parsePositiveInt(req.query.sample, 3);
  const tableLimit = Number(req.query.tableLimit || 0);

  if (Number.isNaN(codigoCadastro)) {
    return res.status(400).json({
      error: 'Informe codigoCadastro válido. Exemplo: /tabelas/cadastro/varredura-geral?codigoCadastro=180430901',
    });
  }

  try {
    const pool = await connectDB();

    const cadastroResult = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT *
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
        WHERE CodigoCadastro = @codigoCadastro
      `);

    if (cadastroResult.recordset.length === 0) {
      return res.status(404).json({
        error: `Cadastro ${codigoCadastro} não encontrado.`,
      });
    }

    const cadastro = cadastroResult.recordset[0];
    const nomeCompleto = buildNomeCompleto(cadastro);

    const valoresTexto = [
      cadastro.CodigoLancamento,
      cadastro.CPFCNPJ,
      cadastro.Nome,
      cadastro.SobreNome,
      nomeCompleto,
    ]
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean);

    const valoresNumero = [Number(cadastro.CodigoCadastro), Number(cadastro.CodigoEmpresa)]
      .filter((v) => !Number.isNaN(v));

    const tablesResult = await pool.request()
      .input('tableLimit', tableLimit)
      .query(`
        SELECT
          t.TABLE_SCHEMA AS schemaName,
          t.TABLE_NAME AS tableName
        FROM INFORMATION_SCHEMA.TABLES t
        WHERE t.TABLE_TYPE = 'BASE TABLE'
          AND NOT (t.TABLE_SCHEMA = 'dbo' AND t.TABLE_NAME = 'Cadastro')
        ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
      `);

    const tabelas = tableLimit > 0
      ? tablesResult.recordset.slice(0, tableLimit)
      : tablesResult.recordset;

    const hits = [];
    let colunasAnalisadas = 0;

    for (const tabela of tabelas) {
      const columnsResult = await pool.request()
        .input('schemaName', tabela.schemaName)
        .input('tableName', tabela.tableName)
        .query(`
          SELECT
            c.COLUMN_NAME AS columnName,
            c.DATA_TYPE AS dataType
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_SCHEMA = @schemaName
            AND c.TABLE_NAME = @tableName
        `);

      for (const coluna of columnsResult.recordset) {
        const schema = quoteIdentifier(tabela.schemaName);
        const table = quoteIdentifier(tabela.tableName);
        const column = quoteIdentifier(coluna.columnName);
        colunasAnalisadas += 1;

        if (isNumericType(coluna.dataType) && valoresNumero.length > 0) {
          const params = [];
          const request = pool.request().input('sample', sample);
          valoresNumero.forEach((valor, index) => {
            const p = `n${index}`;
            request.input(p, valor);
            params.push(`@${p}`);
          });

          const query = `
            SELECT COUNT(1) AS total
            FROM ${schema}.${table}
            WHERE ${column} IN (${params.join(', ')});

            SELECT TOP (@sample) *
            FROM ${schema}.${table}
            WHERE ${column} IN (${params.join(', ')});
          `;

          const result = await request.query(query);
          const total = Number(result.recordsets[0][0].total || 0);
          if (total > 0) {
            hits.push({
              schema: tabela.schemaName,
              tabela: tabela.tableName,
              coluna: coluna.columnName,
              tipo: coluna.dataType,
              estrategia: 'numeric_exact_match',
              valoresPesquisados: valoresNumero,
              total,
              exemplos: result.recordsets[1],
            });
          }
        }

        if (isTextType(coluna.dataType) && valoresTexto.length > 0) {
          const whereParts = [];
          const request = pool.request().input('sample', sample);

          valoresTexto.forEach((valor, index) => {
            const pEq = `teq${index}`;
            const pLike = `tlike${index}`;
            request.input(pEq, valor);
            request.input(pLike, `%${valor}%`);
            whereParts.push(`${column} = @${pEq}`);
            whereParts.push(`${column} LIKE @${pLike}`);
          });

          const where = whereParts.join(' OR ');
          const query = `
            SELECT COUNT(1) AS total
            FROM ${schema}.${table}
            WHERE ${where};

            SELECT TOP (@sample) *
            FROM ${schema}.${table}
            WHERE ${where};
          `;

          const result = await request.query(query);
          const total = Number(result.recordsets[0][0].total || 0);
          if (total > 0) {
            hits.push({
              schema: tabela.schemaName,
              tabela: tabela.tableName,
              coluna: coluna.columnName,
              tipo: coluna.dataType,
              estrategia: 'text_exact_or_like_match',
              valoresPesquisados: valoresTexto,
              total,
              exemplos: result.recordsets[1],
            });
          }
        }
      }
    }

    return res.json({
      mensagem: 'Varredura geral concluída.',
      cadastro: {
        CodigoCadastro: cadastro.CodigoCadastro,
        CodigoLancamento: cadastro.CodigoLancamento,
        Nome: cadastro.Nome,
        SobreNome: cadastro.SobreNome,
        NomeCompleto: nomeCompleto,
        CPFCNPJ: cadastro.CPFCNPJ,
        CodigoEmpresa: cadastro.CodigoEmpresa,
      },
      metricas: {
        totalTabelasAnalisadas: tabelas.length,
        totalColunasAnalisadas: colunasAnalisadas,
        totalOcorrenciasEncontradas: hits.length,
      },
      ocorrencias: hits,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;