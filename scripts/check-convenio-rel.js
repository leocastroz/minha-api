const { connectDB } = require('../src/db');

async function main() {
  const pool = await connectDB();

  function quoteIdentifier(name) {
    return `[${String(name).replace(/]/g, ']]')}]`;
  }

  const colClienteConvenio = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Cliente_Convenio'
    ORDER BY ORDINAL_POSITION
  `);

  const fkClienteConvenio = await pool.request().query(`
    SELECT
      fk.name AS fkName,
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
    WHERE ps.name='dbo' AND pt.name='Cliente_Convenio'
    ORDER BY fk.name
  `);

  const colConvenio = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Convenio'
    ORDER BY ORDINAL_POSITION
  `);

  const textoConvenio = colConvenio.recordset
    .filter((c) => ['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'].includes(String(c.DATA_TYPE).toLowerCase()))
    .map((c) => c.COLUMN_NAME);

  let conveniosFidelicard = { recordset: [] };
  if (textoConvenio.length > 0) {
    const where = textoConvenio
      .map((col) => `UPPER(CAST(${quoteIdentifier(col)} AS VARCHAR(4000))) LIKE '%FIDELICARD%'`)
      .join(' OR ');

    conveniosFidelicard = await pool.request().query(`
      SELECT TOP 20 *
      FROM INOVAFARMA_DPOPPARA.dbo.Convenio
      WHERE ${where}
    `);
  }

  const amostraClienteConvenio = await pool.request().query(`
    SELECT TOP 20 *
    FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio
    ORDER BY 1 DESC
  `);

  console.log(JSON.stringify({
    colunasClienteConvenio: colClienteConvenio.recordset,
    fksClienteConvenio: fkClienteConvenio.recordset,
    colunasConvenio: colConvenio.recordset,
    conveniosFidelicard: conveniosFidelicard.recordset,
    amostraClienteConvenio: amostraClienteConvenio.recordset,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
