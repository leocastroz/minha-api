const { connectDB } = require('../src/db');

async function main() {
  const pool = await connectDB();

  const fkConvenio = await pool.request().query(`
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
    WHERE ps.name='dbo' AND pt.name='Convenio'
    ORDER BY fk.name
  `);

  const sample = await pool.request().query(`
    SELECT TOP 20
      cv.CodigoConvenio,
      cv.CodigoCadastro,
      cad.Nome,
      cad.CPFCNPJ,
      cv.Ativo,
      cv.ProgramaFidelidade
    FROM INOVAFARMA_DPOPPARA.dbo.Convenio cv
    LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cad
      ON cad.CodigoCadastro = cv.CodigoCadastro
    ORDER BY cv.CodigoConvenio
  `);

  const byName = await pool.request().query(`
    SELECT TOP 20
      cv.CodigoConvenio,
      cv.CodigoCadastro,
      cad.Nome,
      cv.Ativo,
      cv.ProgramaFidelidade
    FROM INOVAFARMA_DPOPPARA.dbo.Convenio cv
    JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cad
      ON cad.CodigoCadastro = cv.CodigoCadastro
    WHERE UPPER(cad.Nome) LIKE '%FIDELICARD%'
    ORDER BY cv.CodigoConvenio
  `);

  const topClienteConvenio = await pool.request().query(`
    SELECT TOP 20
      cc.CodigoClienteID,
      cc.CodigoCliente,
      cc.CodigoConvenio,
      cadCli.Nome AS NomeCliente,
      cadConv.Nome AS NomeConvenio,
      cc.Status,
      cc.DataCadastro
    FROM INOVAFARMA_DPOPPARA.dbo.Cliente_Convenio cc
    LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
      ON cli.CodigoCliente = cc.CodigoCliente
    LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cadCli
      ON cadCli.CodigoCadastro = cli.CodigoCadastro
    LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Convenio cv
      ON cv.CodigoConvenio = cc.CodigoConvenio
    LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cadConv
      ON cadConv.CodigoCadastro = cv.CodigoCadastro
    ORDER BY cc.CodigoClienteID DESC
  `);

  console.log(JSON.stringify({
    fkConvenio: fkConvenio.recordset,
    sampleConvenio: sample.recordset,
    conveniosComNomeFidelicard: byName.recordset,
    sampleClienteConvenioComNomes: topClienteConvenio.recordset,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
