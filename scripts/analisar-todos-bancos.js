const sql = require('mssql');

const config = {
  user: process.argv[2] || 'sa',
  password: process.argv[3] || 'inovafarmaI',
  server: process.argv[4] || '100.102.124.30',
  port: Number(process.argv[5] || 1433),
  database: 'master',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
    tdsVersion: '7_1',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

function quoteIdentifier(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

async function main() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.error('✅ Conectado ao servidor SQL Server');

    // Listar todos os bancos de dados
    const dbListResult = await pool.request().query(`
      SELECT name AS database_name
      FROM sys.databases
      WHERE database_id > 4
      ORDER BY name
    `);

    const databases = dbListResult.recordset.map((r) => r.database_name);
    console.error(`📊 Bancos de dados encontrados: ${databases.length}`);

    const analysis = {
      servidor: config.server,
      porta: config.port,
      data_analise: new Date().toISOString(),
      total_bancos: databases.length,
      bancos: [],
    };

    for (const dbName of databases) {
      console.error(`\n📂 Analisando banco: ${dbName}`);

      // Conectar ao banco específico
      const dbConfig = { ...config, database: dbName };
      let dbPool;
      try {
        dbPool = await sql.connect(dbConfig);
      } catch (err) {
        console.error(`   ❌ Erro ao conectar: ${err.message}`);
        continue;
      }

      // Verificar se Cadastro existe
      const cadastroExistsResult = await dbPool.request().query(`
        SELECT COUNT(1) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'Cadastro'
      `);

      const cadastroExists = Number(cadastroExistsResult.recordset[0]?.total || 0) > 0;

      const dbInfo = {
        nome: dbName,
        tabela_cadastro_existe: cadastroExists,
        structure: null,
        amostra_dados: null,
      };

      if (cadastroExists) {
        // Estrutura da tabela Cadastro
        const colunaResult = await dbPool.request().query(`
          SELECT
            COLUMN_NAME AS coluna,
            DATA_TYPE AS tipo,
            IS_NULLABLE AS anulavel,
            COLUMN_DEFAULT AS valor_padrao,
            CHARACTER_MAXIMUM_LENGTH AS tamanho_max
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'Cadastro'
          ORDER BY ORDINAL_POSITION
        `);

        dbInfo.structure = {
          total_colunas: colunaResult.recordset.length,
          colunas: colunaResult.recordset,
        };

        // Contar registros
        const countResult = await dbPool.request().query(`
          SELECT COUNT(1) AS total, COUNT(DISTINCT CodigoEmpresa) AS empresas
          FROM [${dbName}].dbo.Cadastro
        `);

        dbInfo.amostra_dados = {
          total_registros: Number(countResult.recordset[0]?.total || 0),
          total_empresas: Number(countResult.recordset[0]?.empresas || 0),
        };

        // Procurar por tabelas com FK para Cadastro e colunas flags
        const fkResult = await dbPool.request().query(`
          SELECT
            fk.name AS fkName,
            ps.name AS parentSchema,
            pt.name AS parentTable,
            pc.name AS parentColumn,
            rs.name AS refSchema,
            rt.name AS refTable,
            rc.name AS refColumn
          FROM sys.foreign_key_columns fkc
          JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
          JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
          JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
          JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
          JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
          JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
          JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
          WHERE rt.name = 'Cadastro' AND rs.name = 'dbo'
          ORDER BY ps.name, pt.name
        `);

        // Procurar por colunas flag/booleanas em Cadastro
        const flagColumnsResult = await dbPool.request().query(`
          SELECT
            c.COLUMN_NAME AS coluna,
            c.DATA_TYPE AS tipo
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_NAME = 'Cadastro'
            AND c.DATA_TYPE IN ('bit', 'tinyint', 'smallint')
          ORDER BY c.COLUMN_NAME
        `);

        const flagColumns = [];
        for (const flagCol of flagColumnsResult.recordset) {
          const valuesResult = await dbPool.request().query(`
            SELECT DISTINCT [${flagCol.coluna}] AS valor, COUNT(1) AS total
            FROM [${dbName}].dbo.Cadastro
            GROUP BY [${flagCol.coluna}]
            ORDER BY valor
          `);

          flagColumns.push({
            coluna: flagCol.coluna,
            tipo: flagCol.tipo,
            valores_unicos: valuesResult.recordset,
          });
        }

        dbInfo.relacionamentos_fk = {
          total: fkResult.recordset.length,
          tabelas_com_fk: fkResult.recordset.map((r) => ({
            schema: r.parentSchema,
            tabela: r.parentTable,
            coluna_fk: r.parentColumn,
            fk_name: r.fkName,
          })),
        };

        dbInfo.colunas_flags_booleanas = flagColumns;

        // Buscar possíveis colunas de status/filtro
        const statusColumnsResult = await dbPool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'Cadastro'
            AND (
              COLUMN_NAME LIKE '%Ativo%'
              OR COLUMN_NAME LIKE '%Status%'
              OR COLUMN_NAME LIKE '%Eliminado%'
              OR COLUMN_NAME LIKE '%Aprovado%'
              OR COLUMN_NAME LIKE '%Validado%'
              OR COLUMN_NAME LIKE '%Ativo%'
              OR COLUMN_NAME LIKE '%SituacaoCadastro%'
              OR COLUMN_NAME LIKE '%Flag%'
              OR COLUMN_NAME LIKE '%Bloqueado%'
            )
          ORDER BY COLUMN_NAME
        `);

        dbInfo.colunas_status_encontradas = statusColumnsResult.recordset;
      }

      analysis.bancos.push(dbInfo);
      await dbPool.close();
    }

    // Saída JSON
    process.stdout.write(JSON.stringify(analysis, null, 2));
    process.stdout.write('\n');
  } catch (err) {
    process.stderr.write(`❌ Erro: ${err.message}\n`);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
