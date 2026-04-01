const { connectDB } = require('../src/db');

function quoteIdentifier(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function isNumericType(dataType) {
  const t = String(dataType || '').toLowerCase();
  return ['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric'].includes(t);
}

function isTextType(dataType) {
  const t = String(dataType || '').toLowerCase();
  return ['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'].includes(t);
}

async function main() {
  const pool = await connectDB();

  const codigoA = Number(process.argv[2] || 180430901);
  const codigoB = Number(process.argv[3] || 180681501);

  const cadastroResult = await pool.request()
    .input('codigoA', codigoA)
    .input('codigoB', codigoB)
    .query(`
      SELECT *
      FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
      WHERE CodigoCadastro IN (@codigoA, @codigoB)
      ORDER BY CodigoCadastro
    `);

  const cadastroA = cadastroResult.recordset.find((r) => Number(r.CodigoCadastro) === codigoA) || null;
  const cadastroB = cadastroResult.recordset.find((r) => Number(r.CodigoCadastro) === codigoB) || null;

  const tableCountResult = await pool.request().query(`
    SELECT COUNT(1) AS total
    FROM INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
  `);

  const allFkResult = await pool.request().query(`
    SELECT
      fk.name AS fkName,
      ps.name AS parentSchema,
      pt.name AS parentTable,
      pc.name AS parentColumn,
      rs.name AS refSchema,
      rt.name AS refTable,
      rc.name AS refColumn
    FROM INOVAFARMA_DPOPPARA.sys.foreign_key_columns fkc
    JOIN INOVAFARMA_DPOPPARA.sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
    JOIN INOVAFARMA_DPOPPARA.sys.tables pt ON pt.object_id = fkc.parent_object_id
    JOIN INOVAFARMA_DPOPPARA.sys.schemas ps ON ps.schema_id = pt.schema_id
    JOIN INOVAFARMA_DPOPPARA.sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
    JOIN INOVAFARMA_DPOPPARA.sys.tables rt ON rt.object_id = fkc.referenced_object_id
    JOIN INOVAFARMA_DPOPPARA.sys.schemas rs ON rs.schema_id = rt.schema_id
    JOIN INOVAFARMA_DPOPPARA.sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
    ORDER BY ps.name, pt.name, fk.name, fkc.constraint_column_id
  `);

  const fkToCadastro = allFkResult.recordset.filter((r) => r.refSchema === 'dbo' && r.refTable === 'Cadastro');

  const fkGroups = new Map();
  for (const fk of fkToCadastro) {
    const key = `${fk.parentSchema}.${fk.parentTable}.${fk.fkName}`;
    if (!fkGroups.has(key)) {
      fkGroups.set(key, {
        fkName: fk.fkName,
        parentSchema: fk.parentSchema,
        parentTable: fk.parentTable,
        mappings: [],
      });
    }

    fkGroups.get(key).mappings.push({
      parentColumn: fk.parentColumn,
      refColumn: fk.refColumn,
    });
  }

  const fkContagemPorCadastro = [];

  for (const grupo of fkGroups.values()) {
    const request = pool.request();
    const whereA = [];
    const whereB = [];

    grupo.mappings.forEach((mapeamento, idx) => {
      if (mapeamento.refColumn === 'CodigoCadastro') {
        request.input(`a${idx}`, codigoA);
        request.input(`b${idx}`, codigoB);
        whereA.push(`${quoteIdentifier(mapeamento.parentColumn)} = @a${idx}`);
        whereB.push(`${quoteIdentifier(mapeamento.parentColumn)} = @b${idx}`);
      }
    });

    if (whereA.length === 0 || whereB.length === 0) {
      continue;
    }

    const tabelaCompleta = `INOVAFARMA_DPOPPARA.${quoteIdentifier(grupo.parentSchema)}.${quoteIdentifier(grupo.parentTable)}`;

    const result = await request.query(`
      SELECT
        (SELECT COUNT(1) FROM ${tabelaCompleta} WHERE ${whereA.join(' AND ')}) AS totalA,
        (SELECT COUNT(1) FROM ${tabelaCompleta} WHERE ${whereB.join(' AND ')}) AS totalB
    `);

    fkContagemPorCadastro.push({
      schema: grupo.parentSchema,
      tabela: grupo.parentTable,
      fkName: grupo.fkName,
      totalCadastroA: Number(result.recordset[0]?.totalA || 0),
      totalCadastroB: Number(result.recordset[0]?.totalB || 0),
    });
  }

  const candidateColumnsResult = await pool.request().query(`
    SELECT
      c.TABLE_SCHEMA AS schemaName,
      c.TABLE_NAME AS tableName,
      c.COLUMN_NAME AS columnName,
      c.DATA_TYPE AS dataType
    FROM INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.COLUMNS c
    JOIN INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.TABLES t
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
    WHERE t.TABLE_TYPE = 'BASE TABLE'
      AND c.COLUMN_NAME IN (
        'CodigoCadastro', 'CodigoLancamento', 'CPFCNPJ', 'CPF', 'CNPJ',
        'Nome', 'SobreNome', 'CodigoEmpresa', 'CodCadastro',
        'CodCliente', 'CodigoCliente'
      )
    ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
  `);

  const valoresA = cadastroA ? [
    String(cadastroA.CodigoCadastro),
    String(cadastroA.CodigoLancamento || ''),
    String(cadastroA.CPFCNPJ || ''),
    String(cadastroA.Nome || ''),
    String(cadastroA.SobreNome || ''),
    String(cadastroA.CodigoEmpresa || ''),
  ].filter(Boolean) : [];

  const valoresB = cadastroB ? [
    String(cadastroB.CodigoCadastro),
    String(cadastroB.CodigoLancamento || ''),
    String(cadastroB.CPFCNPJ || ''),
    String(cadastroB.Nome || ''),
    String(cadastroB.SobreNome || ''),
    String(cadastroB.CodigoEmpresa || ''),
  ].filter(Boolean) : [];

  const hits = [];

  for (const col of candidateColumnsResult.recordset) {
    const schema = quoteIdentifier(col.schemaName);
    const table = quoteIdentifier(col.tableName);
    const column = quoteIdentifier(col.columnName);

    const request = pool.request();
    const whereParts = [];

    if (isNumericType(col.dataType)) {
      const numericos = [...new Set([...valoresA, ...valoresB])]
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v));

      if (numericos.length === 0) continue;

      numericos.forEach((v, index) => {
        const p = `n${index}`;
        request.input(p, v);
        whereParts.push(`${column} = @${p}`);
      });
    } else if (isTextType(col.dataType)) {
      const textos = [...new Set([...valoresA, ...valoresB])].filter((v) => String(v).trim() !== '');
      if (textos.length === 0) continue;

      textos.forEach((v, index) => {
        const p = `t${index}`;
        request.input(p, v);
        whereParts.push(`${column} = @${p}`);
      });
    } else {
      continue;
    }

    try {
      const result = await request.query(`
        SELECT ${column} AS valor, COUNT(1) AS total
        FROM INOVAFARMA_DPOPPARA.${schema}.${table}
        WHERE ${whereParts.join(' OR ')}
        GROUP BY ${column}
      `);

      if (result.recordset.length > 0) {
        hits.push({
          schema: col.schemaName,
          tabela: col.tableName,
          coluna: col.columnName,
          tipo: col.dataType,
          ocorrencias: result.recordset,
        });
      }
    } catch {
      // Ignora incompatibilidades de tipo/conversao pontuais.
    }
  }

  const totalsA = [];
  const totalsB = [];

  for (const hit of hits) {
    const totalA = hit.ocorrencias
      .filter((o) => valoresA.includes(String(o.valor)))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalB = hit.ocorrencias
      .filter((o) => valoresB.includes(String(o.valor)))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    if (totalA > 0) {
      totalsA.push({
        schema: hit.schema,
        tabela: hit.tabela,
        coluna: hit.coluna,
        total: totalA,
      });
    }

    if (totalB > 0) {
      totalsB.push({
        schema: hit.schema,
        tabela: hit.tabela,
        coluna: hit.coluna,
        total: totalB,
      });
    }
  }

  const apenasA = totalsA.filter(
    (a) => !totalsB.some((b) => b.schema === a.schema && b.tabela === a.tabela && b.coluna === a.coluna),
  );

  const apenasB = totalsB.filter(
    (b) => !totalsA.some((a) => a.schema === b.schema && a.tabela === b.tabela && a.coluna === b.coluna),
  );

  const output = {
    banco: 'INOVAFARMA_DPOPPARA',
    totalTabelas: Number(tableCountResult.recordset[0]?.total || 0),
    totalRelacionamentosFK: allFkResult.recordset.length,
    totalFKsApontandoParaCadastro: fkToCadastro.length,
    cadastroA,
    cadastroB,
    relacionamentosFKParaCadastro: fkToCadastro,
    contagemRelacionamentosFKPorCadastro: fkContagemPorCadastro,
    ocorrenciasEmTabelasCandidatas: hits,
    comparativo: {
      entradasRelacionadasA: totalsA.length,
      entradasRelacionadasB: totalsB.length,
      apenasA,
      apenasB,
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2));
  process.stdout.write('\n');
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
