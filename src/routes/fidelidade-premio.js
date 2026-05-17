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

/**
 * POST /fidelidade-premio
 * Cria um novo prêmio na tabela Fidelidade_Premio
 * Body: { nomePremio: string, pontos: number, ativo?: boolean }
 */
router.post('/', async (req, res) => {
  try {
    const { nomePremio, pontos, ativo = true } = req.body || {};

    if (!nomePremio || typeof nomePremio !== 'string' || nomePremio.trim().length === 0) {
      return res.status(400).json({ erro: 'Nome do prêmio é obrigatório', mensagem: 'Informe o campo nomePremio' });
    }

    const pontosNum = Number.isFinite(Number(pontos)) ? Number(pontos) : 0;

    const pool = await connectDB();

    // Tenta inserir assumindo que CodigoPremio é IDENTITY; se a tabela não
    // possuir identity, gera manualmente o próximo CodigoPremio (lock mínimo)
    // para evitar erro 'Cannot insert the value NULL into column CodigoPremio'.
    // Primeiro, verificar se existe uma coluna identity (opcional) — como
    // não garantimos acesso a metadata em todos os ambientes, calculamos
    // um nextId defensivo.
    const nextIdQuery = await pool.request().query(`
      SELECT ISNULL(MAX(CodigoPremio), 0) + 1 AS NextId
      FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio
    `);
    const nextId = (nextIdQuery.recordset && nextIdQuery.recordset[0] && nextIdQuery.recordset[0].NextId) || 1;

    const insertQuery = await pool.request()
      .input('codigoPremio', nextId)
      .input('nomePremio', nomePremio.trim())
      .input('pontos', pontosNum)
      .input('ativo', ativo === true || ativo === 'true' ? 1 : 0)
      .query(`
        INSERT INTO INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio (CodigoPremio, NomePremio, Pontos, Ativo)
        OUTPUT INSERTED.CodigoPremio, INSERTED.NomePremio, INSERTED.Pontos, INSERTED.Ativo
        VALUES (@codigoPremio, @nomePremio, @pontos, @ativo)
      `);

    const created = (insertQuery.recordset && insertQuery.recordset[0]) || null;
    if (!created) {
      return res.status(500).json({ erro: 'Erro ao criar prêmio', mensagem: 'Nenhum registro criado' });
    }

    return res.status(201).json({
      mensagem: 'Prêmio criado com sucesso',
      premio: {
        codigoPremio: created.CodigoPremio,
        nomePremio: created.NomePremio,
        pontos: Number(created.Pontos) || 0,
        ativo: created.Ativo === true || created.Ativo === 1,
      },
    });
  } catch (error) {
    console.error('[ERRO] POST /fidelidade-premio', error.message);
    return res.status(500).json({ erro: 'Erro ao criar prêmio de fidelidade', mensagem: error.message });
  }
});

module.exports = router;