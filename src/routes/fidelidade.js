const express = require('express');
const { connectDB } = require('../db');

const router = express.Router();

/**
 * GET /fidelidade-ponto/:codigoCadastro
 * Retorna pontos de fidelidade do cliente baseado no CodigoCadastro
 * Query params: 
 *   - incluirExpirados: incluir pontos com saldo 0 (default: true)
 *   - orderBy: 'data' ou 'saldo' (default: 'data')
 *   - limit: quantidade de registros (default: 100)
 */
router.get('/:codigoCadastro', async (req, res) => {
  try {
    const { codigoCadastro } = req.params;
    const { 
      incluirExpirados = 'true',
      orderBy = 'data',
      limit = 100
    } = req.query;

    // Validar parâmetros
    if (!codigoCadastro || isNaN(codigoCadastro)) {
      return res.status(400).json({
        erro: 'CodigoCadastro inválido',
        mensagem: 'CodigoCadastro deve ser um número válido'
      });
    }

    const pool = await connectDB();

    // Buscar dados do cadastro
    const cadastroQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT TOP 1
          c.CodigoCadastro,
          c.Nome,
          c.SobreNome,
          c.CPFCNPJ,
          cli.CodigoCliente,
          cli.Ativo AS ClienteAtivo
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
          ON cli.CodigoCadastro = c.CodigoCadastro
        WHERE c.CodigoCadastro = @codigoCadastro
      `);

    if (!cadastroQuery.recordset || cadastroQuery.recordset.length === 0) {
      return res.status(404).json({
        erro: 'Cadastro não encontrado',
        codigoCadastro: parseInt(codigoCadastro)
      });
    }

    const cadastro = cadastroQuery.recordset[0];

    // Montar query base para pontos
    let orderClause = `ORDER BY fp.DataVencimento DESC`;
    if (orderBy === 'saldo') {
      orderClause = `ORDER BY fp.Saldo DESC, fp.DataVencimento ASC`;
    }

    let queryPontos = `
      SELECT TOP ${Math.min(parseInt(limit) || 100, 1000)}
        fp.CodigoFidelidade,
        fp.CodigoLancamento,
        fp.CodigoCadastro,
        fp.DataVencimento,
        fp.Pontos,
        fp.Saldo,
        CASE 
          WHEN CAST(fp.DataVencimento AS DATE) < CAST(GETDATE() AS DATE) THEN 'EXPIRADO'
          WHEN fp.Saldo = 0 THEN 'UTILIZADO'
          ELSE 'DISPONÍVEL'
        END AS Status,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(fp.DataVencimento AS DATE)) AS DiasParaExpirar
      FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
      WHERE fp.CodigoCadastro = @codigoCadastro
    `;

    // Filtrar por expirados se necessário
    if (incluirExpirados === 'false') {
      queryPontos += `
        AND fp.Saldo > 0
      `;
    }

    // Ordenar resultados
    queryPontos += ` ${orderClause}`;

    const pontosQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(queryPontos);

    // Calcular totais
    const totalQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT
          SUM(CAST(fp.Pontos AS BIGINT)) AS totalPontosAcumulados,
          SUM(CAST(fp.Saldo AS BIGINT)) AS totalSaldoDisponivel,
          SUM(CASE WHEN fp.Saldo > 0 AND CAST(fp.DataVencimento AS DATE) >= CAST(GETDATE() AS DATE) THEN CAST(fp.Saldo AS BIGINT) ELSE 0 END) AS totalSaldoValido,
          SUM(CASE WHEN fp.Saldo > 0 THEN CAST(fp.Saldo AS BIGINT) ELSE 0 END) AS totalSaldoAtivo,
          SUM(CASE WHEN fp.Saldo = 0 THEN CAST(fp.Pontos AS BIGINT) ELSE 0 END) AS totalPontosUtilizados,
          COUNT(*) AS totalTransacoes,
          COUNT(CASE WHEN fp.Saldo > 0 THEN 1 END) AS transacoesAtivas,
          COUNT(CASE WHEN CAST(fp.DataVencimento AS DATE) <= CAST(GETDATE() AS DATE) THEN 1 END) AS transacoesExpiradas
        FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
        WHERE fp.CodigoCadastro = @codigoCadastro
      `);

    const totais = totalQuery.recordset[0];

    res.json({
      mensagem: 'Pontos de fidelidade consultados com sucesso',
      cadastro: {
        codigoCadastro: cadastro.CodigoCadastro,
        nomeCompleto: `${cadastro.Nome || ''} ${cadastro.SobreNome || ''}`.trim(),
        CPFCNPJ: cadastro.CPFCNPJ,
        clienteAtivo: cadastro.ClienteAtivo === 1 ? 'SIM' : 'NÃO'
      },
      resumoPontos: {
        totalPontosAcumulados: parseInt(totais.totalPontosAcumulados) || 0,
        totalSaldoDisponivel: parseInt(totais.totalSaldoDisponivel) || 0,
        totalSaldoValido: parseInt(totais.totalSaldoValido) || 0,
        totalSaldoAtivo: parseInt(totais.totalSaldoAtivo) || 0,
        totalPontosUtilizados: parseInt(totais.totalPontosUtilizados) || 0,
        totalTransacoes: totais.totalTransacoes || 0,
        transacoesAtivas: totais.transacoesAtivas || 0,
        transacoesExpiradas: totais.transacoesExpiradas || 0
      },
      pontos: pontosQuery.recordset.map(ponto => ({
        codigoFidelidade: ponto.CodigoFidelidade,
        codigoLancamento: ponto.CodigoLancamento,
        pontos: parseInt(ponto.Pontos),
        saldo: parseInt(ponto.Saldo),
        status: ponto.Status,
        diasParaExpirar: ponto.DiasParaExpirar,
        dataVencimento: ponto.DataVencimento
      })),
      filtros: {
        incluirExpirados: incluirExpirados === 'true' ? 'SIM' : 'NÃO',
        ordenarPor: orderBy,
        limite: Math.min(parseInt(limit) || 100, 1000)
      }
    });

  } catch (error) {
    console.error('[ERRO] GET /fidelidade-ponto/:codigoCadastro', error.message);
    res.status(500).json({
      erro: 'Erro ao consultar pontos de fidelidade',
      mensagem: error.message
    });
  }
});

/**
 * GET /fidelidade-ponto/:codigoCadastro/resumo
 * Retorna apenas resumo de pontos sem detalhe de transações
 */
router.get('/:codigoCadastro/resumo', async (req, res) => {
  try {
    const { codigoCadastro } = req.params;

    if (!codigoCadastro || isNaN(codigoCadastro)) {
      return res.status(400).json({
        erro: 'CodigoCadastro inválido',
        mensagem: 'CodigoCadastro deve ser um número válido'
      });
    }

    const pool = await connectDB();

    const query = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT TOP 1
          c.CodigoCadastro,
          c.Nome,
          c.SobreNome,
          ISNULL(SUM(CAST(fp.Pontos AS BIGINT)), 0) AS totalPontosAcumulados,
          ISNULL(SUM(CAST(fp.Saldo AS BIGINT)), 0) AS totalSaldoDisponivel,
          SUM(CASE WHEN fp.Saldo > 0 AND CAST(fp.DataVencimento AS DATE) >= CAST(GETDATE() AS DATE) THEN CAST(fp.Saldo AS BIGINT) ELSE 0 END) AS totalSaldoValido,
          COUNT(*) AS totalTransacoes
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
          ON fp.CodigoCadastro = c.CodigoCadastro
        WHERE c.CodigoCadastro = @codigoCadastro
        GROUP BY c.CodigoCadastro, c.Nome, c.SobreNome
      `);

    if (!query.recordset || query.recordset.length === 0) {
      return res.status(404).json({
        erro: 'Cadastro não encontrado',
        codigoCadastro: parseInt(codigoCadastro)
      });
    }

    const resultado = query.recordset[0];

    res.json({
      mensagem: 'Resumo de pontos consultado com sucesso',
      cliente: `${resultado.Nome || ''} ${resultado.SobreNome || ''}`.trim(),
      resumo: {
        totalPontosAcumulados: parseInt(resultado.totalPontosAcumulados),
        totalSaldoDisponivel: parseInt(resultado.totalSaldoDisponivel),
        totalSaldoValido: parseInt(resultado.totalSaldoValido) || 0,
        totalTransacoes: resultado.totalTransacoes
      }
    });

  } catch (error) {
    console.error('[ERRO] GET /fidelidade-ponto/:codigoCadastro/resumo', error.message);
    res.status(500).json({
      erro: 'Erro ao consultar resumo de pontos',
      mensagem: error.message
    });
  }
});

/**
 * GET /fidelidade-ponto/cliente/:codigoCliente
 * Retorna pontos de fidelidade usando CodigoCliente em vez de CodigoCadastro
 */
router.get('/cliente/:codigoCliente', async (req, res) => {
  try {
    const { codigoCliente } = req.params;

    if (!codigoCliente || isNaN(codigoCliente)) {
      return res.status(400).json({
        erro: 'CodigoCliente inválido',
        mensagem: 'CodigoCliente deve ser um número válido'
      });
    }

    const pool = await connectDB();

    // Buscar CodigoCadastro usando CodigoCliente
    const cadastroQuery = await pool.request()
      .input('codigoCliente', codigoCliente)
      .query(`
        SELECT TOP 1 CodigoCadastro
        FROM INOVAFARMA_DPOPPARA.dbo.Cliente
        WHERE CodigoCliente = @codigoCliente
      `);

    if (!cadastroQuery.recordset || cadastroQuery.recordset.length === 0) {
      return res.status(404).json({
        erro: 'Cliente não encontrado',
        codigoCliente: parseInt(codigoCliente)
      });
    }

    const codigoCadastro = cadastroQuery.recordset[0].CodigoCadastro;

    // Redirecionar para rota de CodigoCadastro
    const pontosQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT
          fp.CodigoFidelidade,
          fp.CodigoLancamento,
          fp.CodigoCadastro,
          fp.DataVencimento,
          fp.Pontos,
          fp.Saldo,
          CASE 
            WHEN CAST(fp.DataVencimento AS DATE) < CAST(GETDATE() AS DATE) THEN 'EXPIRADO'
            WHEN fp.Saldo = 0 THEN 'UTILIZADO'
            ELSE 'DISPONÍVEL'
          END AS Status,
          DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(fp.DataVencimento AS DATE)) AS DiasParaExpirar
        FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
        WHERE fp.CodigoCadastro = @codigoCadastro
        ORDER BY fp.DataVencimento DESC
      `);

    const totalQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT
          SUM(CAST(fp.Pontos AS BIGINT)) AS totalPontosAcumulados,
          SUM(CAST(fp.Saldo AS BIGINT)) AS totalSaldoDisponivel,
          SUM(CASE WHEN fp.Saldo > 0 AND CAST(fp.DataVencimento AS DATE) >= CAST(GETDATE() AS DATE) THEN CAST(fp.Saldo AS BIGINT) ELSE 0 END) AS totalSaldoValido,
          COUNT(*) AS totalTransacoes
        FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
        WHERE fp.CodigoCadastro = @codigoCadastro
      `);

    const totais = totalQuery.recordset[0];

    res.json({
      mensagem: 'Pontos de fidelidade consultados com sucesso (via CodigoCliente)',
      codigoCliente: parseInt(codigoCliente),
      codigoCadastro: codigoCadastro,
      resumoPontos: {
        totalPontosAcumulados: parseInt(totais.totalPontosAcumulados) || 0,
        totalSaldoDisponivel: parseInt(totais.totalSaldoDisponivel) || 0,
        totalSaldoValido: parseInt(totais.totalSaldoValido) || 0,
        totalTransacoes: totais.totalTransacoes || 0
      },
      pontos: pontosQuery.recordset.map(ponto => ({
        codigoFidelidade: ponto.CodigoFidelidade,
        codigoLancamento: ponto.CodigoLancamento,
        pontos: parseInt(ponto.Pontos),
        saldo: parseInt(ponto.Saldo),
        status: ponto.Status,
        diasParaExpirar: ponto.DiasParaExpirar,
        dataVencimento: ponto.DataVencimento
      }))
    });

  } catch (error) {
    console.error('[ERRO] GET /fidelidade-ponto/cliente/:codigoCliente', error.message);
    res.status(500).json({
      erro: 'Erro ao consultar pontos de fidelidade',
      mensagem: error.message
    });
  }
});

module.exports = router;
