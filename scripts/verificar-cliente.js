const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'inovafarmaI',
  server: '100.102.124.30',
  port: 1433,
  database: 'INOVAFARMA_DPOPPARA',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
    tdsVersion: '7_1',
  },
};

async function main() {
  const pool = await sql.connect(config);

  // Buscar os 3 cadastros do usuário
  const result = await pool.request().query(`
    SELECT
      CodigoCadastro,
      CodigoLancamento,
      Nome,
      CPFCNPJ,
      Eliminado,
      CodigoEmpresa,
      Pessoa,
      TipoDescontoNFe,
      DataCadastro,
      SobreNome
    FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
    WHERE CodigoCadastro IN (180430901, 180681501, 180682001)
    ORDER BY CodigoCadastro DESC
  `);

  const cadastros = result.recordset;

  // Para cada cadastro, verificar a presença em Cliente
  const clienteStatus = {};
  for (const cad of cadastros) {
    const clienteResult = await pool.request()
      .input('codigoCadastro', cad.CodigoCadastro)
      .query(`
        SELECT TOP 1 * FROM INOVAFARMA_DPOPPARA.dbo.Cliente
        WHERE CodigoCadastro = @codigoCadastro
      `);

    clienteStatus[cad.CodigoCadastro] = {
      existe_em_cliente: clienteResult.recordset.length > 0 ? 'SIM' : 'NÃO',
      dados_cliente: clienteResult.recordset[0] || null,
    };
  }

  const saida = {
    cadastros_analisados: cadastros,
    status_em_cliente: clienteStatus,
    avaliacao: {
      '180430901': 'LEONARDO SILVA CASTRO2 - aparece no painel',
      '180681501': 'USUARIO TESTE POSTMAN - NÃO aparece (falta em Cliente)',
      '180682001': 'USUARIO TESTE POSTMAN 2 - novamente criado, verificar status em Cliente',
    }
  };

  process.stdout.write(JSON.stringify(saida, null, 2));
  process.stdout.write('\n');
  await pool.close();
}

main().catch(err => {
  process.stderr.write(`Erro: ${err.message}\n`);
  process.exit(1);
});
