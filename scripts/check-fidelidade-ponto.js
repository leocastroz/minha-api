const { connectDB } = require('../src/db');

async function main() {
  const pool = await connectDB();

  const colFidelidade = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INOVAFARMA_DPOPPARA.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Fidelidade_Ponto'
    ORDER BY ORDINAL_POSITION
  `);

  const fkFidelidade = await pool.request().query(`
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
    WHERE ps.name='dbo' AND pt.name='Fidelidade_Ponto'
    ORDER BY fk.name
  `);

  let sampleFidelidade = null;
  try {
    sampleFidelidade = await pool.request().query(`
      SELECT TOP 10 * 
      FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
    `);
  } catch (e) {
    sampleFidelidade = { recordset: [], error: e.message };
  }

  const totalPontosPorCadastro = await pool.request().query(`
    SELECT 'Tabela existe' as resposta
  `);

  console.log(JSON.stringify({
    colunasFidelidade: colFidelidade.recordset,
    fksFidelidade: fkFidelidade.recordset,
    sampleFidelidade: sampleFidelidade.recordset,
    totalPontosPorCadastro: totalPontosPorCadastro.recordset,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
