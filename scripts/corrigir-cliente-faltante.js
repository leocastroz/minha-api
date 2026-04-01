const sql = require('mssql');

const config = {
  user: process.argv[2] || 'sa',
  password: process.argv[3] || 'inovafarmaI',
  server: process.argv[4] || '100.102.124.30',
  port: Number(process.argv[5] || 1433),
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
    console.log('=== Verificação Pré-Correção ===');

    // Verificar estado atual
    const checkResult = await pool.request().query(`
      SELECT 
        cad.CodigoCadastro,
        cad.Nome,
        CASE WHEN c.CodigoCliente IS NOT NULL THEN 'SIM' ELSE 'NÃO' END AS existe_em_cliente,
        CASE WHEN c.Ativo = 1 THEN 'SIM (true)' WHEN c.Ativo = 0 THEN 'SIM (false)' ELSE 'N/A' END AS ativo_em_cliente
      FROM dbo.Cadastro cad
      LEFT JOIN dbo.Cliente c ON cad.CodigoCadastro = c.CodigoCadastro
      WHERE cad.CodigoCadastro IN (180430901, 180681501, 180682001)
      ORDER BY cad.CodigoCadastro
    `);

    console.log('Cadastros analisados:');
    checkResult.recordset.forEach((row) => {
      console.log(
        `  ${row.CodigoCadastro} - ${row.Nome}: existe_cliente=${row.existe_em_cliente}, ativo=${row.ativo_em_cliente}`
      );
    });

    // Verificar se 180681501 precisa ser inserido
    const needsInsert = checkResult.recordset.find((r) => r.CodigoCadastro === 180681501)?.existe_em_cliente === 'NÃO';

    if (!needsInsert) {
      console.log('\n✅ Cadastro 180681501 já existe em Cliente. Nenhuma ação necessária.');
      await pool.close();
      return;
    }

    console.log('\n=== Inserindo Cliente Faltante ===');

    const insertResult = await pool.request().query(`
      INSERT INTO dbo.Cliente (
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
        180681501,
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
        SELECT 1 FROM dbo.Cliente WHERE CodigoCadastro = 180681501
      )
    `);

    if (insertResult.recordset.length > 0) {
      const inserted = insertResult.recordset[0];
      console.log(
        `✅ Cliente criado com sucesso! CodigoCliente=${inserted.CodigoCliente}, CodigoCadastro=${inserted.CodigoCadastro}`
      );
    } else {
      console.log('⚠️  Cliente 180681501 já existe em dbo.Cliente');
    }

    // Verificação pós-correção
    console.log('\n=== Verificação Pós-Correção ===');

    const verifyResult = await pool.request().query(`
      SELECT 
        cad.CodigoCadastro,
        cad.Nome,
        CASE WHEN c.CodigoCliente IS NOT NULL THEN 'SIM' ELSE 'NÃO' END AS existe_em_cliente,
        CASE WHEN c.Ativo = 1 THEN 'ATIVO (true)' WHEN c.Ativo = 0 THEN 'INATIVO (false)' ELSE 'N/A' END AS status_em_cliente,
        c.CodigoCliente
      FROM dbo.Cadastro cad
      LEFT JOIN dbo.Cliente c ON cad.CodigoCadastro = c.CodigoCadastro
      WHERE cad.CodigoCadastro IN (180430901, 180681501, 180682001)
      ORDER BY cad.CodigoCadastro
    `);

    console.log('Cadastros após correção:');
    verifyResult.recordset.forEach((row) => {
      const icon =
        row.existe_em_cliente === 'SIM' && row.status_em_cliente.includes('ATIVO')
          ? '✅'
          : row.existe_em_cliente === 'NÃO'
            ? '❌'
            : '⚠️';
      console.log(
        `  ${icon} ${row.CodigoCadastro} - ${row.Nome}: cliente=${row.existe_em_cliente}, status=${row.status_em_cliente}`
      );
    });

    console.log('\n✅ Processo concluído! O USUARIO TESTE POSTMAN (180681501) deve agora aparecer no painel.');
  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

main();
