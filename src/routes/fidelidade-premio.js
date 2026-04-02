const express = require('express');
const { connectDB } = require('../db');

const router = express.Router();

/**
 * GET /fidelidade-premio
 * Retorna a lista de prêmios da tabela Fidelidade_Premio.
 */
router.get('/', async (req, res) => {
  try {
    const pool = await connectDB();

    const premiosQuery = await pool.request().query(`
      SELECT
        fp.CodigoPremio,
        fp.NomePremio,
        fp.Pontos,
        fp.Ativo
      FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio fp
      ORDER BY fp.NomePremio ASC
    `);

    const premios = premiosQuery.recordset.map((premio) => ({
      codigoPremio: premio.CodigoPremio,
      nomePremio: premio.NomePremio,
      pontos: Number(premio.Pontos) || 0,
      ativo: premio.Ativo === true,
    }));

    return res.json({
      mensagem: 'Prêmios consultados com sucesso',
      total: premios.length,
      premios,
    });
  } catch (error) {
    console.error('[ERRO] GET /fidelidade-premio', error.message);
    return res.status(500).json({
      erro: 'Erro ao consultar prêmios de fidelidade',
      mensagem: error.message,
    });
  }
});

module.exports = router;