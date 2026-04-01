const { connectDB } = require('../src/db');

async function main() {
  const pool = await connectDB();

  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Cliente'
    ORDER BY ORDINAL_POSITION
  `);

  const fk = await pool.request().query(`
    SELECT
      fk.name AS fkName,
      pc.name AS parentColumn,
      rc.name AS referencedColumn
    FROM INOVAFARMA_DPOPPARA.sys.foreign_key_columns fkc
    JOIN INOVAFARMA_DPOPPARA.sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
    JOIN INOVAFARMA_DPOPPARA.sys.tables pt ON pt.object_id = fkc.parent_object_id
    JOIN INOVAFARMA_DPOPPARA.sys.schemas ps ON ps.schema_id = pt.schema_id
    JOIN INOVAFARMA_DPOPPARA.sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
    JOIN INOVAFARMA_DPOPPARA.sys.tables rt ON rt.object_id = fkc.referenced_object_id
    JOIN INOVAFARMA_DPOPPARA.sys.schemas rs ON rs.schema_id = rt.schema_id
    JOIN INOVAFARMA_DPOPPARA.sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
    WHERE ps.name='dbo' AND pt.name='Cliente'
    ORDER BY fk.name
  `);

  const amostra = await pool.request().query(`
    SELECT TOP 5 CodigoCliente, CodigoCadastro
    FROM INOVAFARMA_DPOPPARA.dbo.Cliente
    ORDER BY CodigoCliente DESC
  `);

  console.log(
    JSON.stringify(
      {
        colunas: cols.recordset,
        fksCliente: fk.recordset,
        amostraCodigo: amostra.recordset,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
