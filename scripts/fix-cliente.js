const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
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

  try {
    // Encontrar o próximo código de cliente
    const maxRes = await pool.request().query(`
      SELECT MAX(CodigoCliente) AS maxCliente
      FROM dbo.Cliente
    `);

    const proximoCliente = Number(maxRes.recordset[0]?.maxCliente || 18200000) + 1;

    console.log(`Próximo CodigoCliente disponível: ${proximoCliente}`);

    // Verificar se 180681501 já existe em Cliente
    const existeRes = await pool.request()
      .input('codigoCadastro', 180681501)
      .query(`
        SELECT COUNT(1) AS total
        FROM dbo.Cliente
        WHERE CodigoCadastro = @codigoCadastro
      `);

    if (Number(existeRes.recordset[0]?.total || 0) > 0) {
      console.log('✅ Cliente 180681501 já existe em dbo.Cliente.');
      process.exit(0);
    }

    // Inserir o cliente
    console.log('\n=== Inserindo Cliente 180681501 ===');

    const insertRes = await pool.request()
      .input('codigoCliente', proximoCliente)
      .input('codigoCadastro', 180681501)
      .query(`
        INSERT INTO dbo.Cliente (
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
        VALUES (
          @codigoCliente,
          @codigoCadastro,
          1, 0, 0, 0, 1, 0, 1, 1, 1,
          0, 1, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0
        );
        
        SELECT @codigoCliente AS inserted_codigoCliente
      `);

    const inserted = insertRes.recordset[0];
    console.log(
      `✅ Cliente inserido com sucesso! CodigoCliente=${inserted.inserted_codigoCliente}`
    );

    // Verificação final
    const verifyRes = await pool.request()
      .input('codigoCadastro', 180681501)
      .query(`
        SELECT TOP 1
          c.CodigoCliente,
          c.CodigoCadastro,
          cad.Nome,
          c.Ativo,
          c.Eliminado
        FROM dbo.Cliente c
        JOIN dbo.Cadastro cad ON c.CodigoCadastro = cad.CodigoCadastro
        WHERE c.CodigoCadastro = @codigoCadastro
      `);

    const cliente = verifyRes.recordset[0];
    console.log('\n=== Verificação Pós-Inserção ===');
    console.log(`  CodigoCliente: ${cliente.CodigoCliente}`);
    console.log(`  CodigoCadastro: ${cliente.CodigoCadastro}`);
    console.log(`  Nome: ${cliente.Nome}`);
    console.log(`  Ativo: ${cliente.Ativo ? 'SIM' : 'NÃO'}`);
    console.log(`  Eliminado: ${cliente.Eliminado ? 'SIM' : 'NÃO'}`);

    console.log('\n🎉 O USUARIO TESTE POSTMAN (180681501) deve agora aparecer no painel!');

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
    await pool.close();
    process.exit(1);
  }
}

main();
