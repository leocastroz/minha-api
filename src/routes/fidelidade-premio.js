const express = require('express');
const { connectDB } = require('../db');
const { listarPremios } = require('../catalogo-premios');

const router = express.Router();

/**
 * GET /fidelidade-premio
 * Retorna a lista de prêmios da tabela Fidelidade_Premio.
 */
router.get('/', async (req, res) => {
  try {
    return await listarPremios(req, res);
  } catch (err) {
    console.error('[ERRO] GET /fidelidade-premio', err.message);
    return res.status(500).json({
      erro: 'Erro ao consultar prêmios de fidelidade',
      mensagem: err.message,
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

/**
 * PUT /fidelidade-premio/:codigo
 * Atualiza um prêmio existente (parcialmente suportado)
 * Body: { nomePremio?: string, pontos?: number, ativo?: boolean }
 */
router.put('/:codigo', async (req, res) => {
  try {
    const codigo = parseInt(req.params.codigo, 10);
    if (isNaN(codigo)) {
      return res.status(400).json({ erro: 'CodigoPremio inválido', mensagem: 'O parâmetro codigo deve ser um número' });
    }

    const { nomePremio, pontos, ativo } = req.body || {};
    if (nomePremio === undefined && pontos === undefined && ativo === undefined) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar', mensagem: 'Forneça ao menos um dos campos: nomePremio, pontos, ativo' });
    }

    const pool = await connectDB();
    const pontosNum = pontos !== undefined ? Number(pontos) : null;
    const ativoVal = ativo === undefined ? null : (ativo === true || ativo === 'true' ? 1 : 0);

    const updateQuery = await pool.request()
      .input('codigo', codigo)
      .input('nomePremio', nomePremio !== undefined ? String(nomePremio).trim() : null)
      .input('pontos', pontosNum)
      .input('ativo', ativoVal)
      .query(`
        UPDATE INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio
        SET
          NomePremio = COALESCE(NULLIF(@nomePremio, ''), NomePremio),
          Pontos = COALESCE(@pontos, Pontos),
          Ativo = COALESCE(@ativo, Ativo)
        OUTPUT INSERTED.CodigoPremio, INSERTED.NomePremio, INSERTED.Pontos, INSERTED.Ativo
        WHERE CodigoPremio = @codigo
      `);

    const updated = (updateQuery.recordset && updateQuery.recordset[0]) || null;
    if (!updated) {
      return res.status(404).json({ erro: 'Prêmio não encontrado', mensagem: 'CodigoPremio não existe' });
    }

    return res.json({
      mensagem: 'Prêmio atualizado com sucesso',
      premio: {
        codigoPremio: updated.CodigoPremio,
        nomePremio: updated.NomePremio,
        pontos: Number(updated.Pontos) || 0,
        ativo: updated.Ativo === true || updated.Ativo === 1,
      },
    });
  } catch (error) {
    console.error('[ERRO] PUT /fidelidade-premio/:codigo', error.message);
    return res.status(500).json({ erro: 'Erro ao atualizar prêmio de fidelidade', mensagem: error.message });
  }
});

/**
 * DELETE /fidelidade-premio/:codigo
 * Soft-delete por padrão (Ativo = 0). Use ?force=true para exclusão física.
 */
router.delete('/:codigo', async (req, res) => {
  try {
    const codigo = parseInt(req.params.codigo, 10);
    if (isNaN(codigo)) {
      return res.status(400).json({ erro: 'CodigoPremio inválido', mensagem: 'O parâmetro codigo deve ser um número' });
    }

    const { force } = req.query;
    const pool = await connectDB();

    if (force === 'true') {
      const del = await pool.request()
        .input('codigo', codigo)
        .query(`
          DELETE FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio
          OUTPUT DELETED.CodigoPremio
          WHERE CodigoPremio = @codigo
        `);

      const removed = del.recordset && del.recordset[0];
      if (!removed) return res.status(404).json({ erro: 'Prêmio não encontrado', mensagem: 'CodigoPremio não existe' });
      return res.json({ mensagem: 'Prêmio removido fisicamente', codigoPremio: removed.CodigoPremio });
    }

    const soft = await pool.request()
      .input('codigo', codigo)
      .query(`
        UPDATE INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio
        SET Ativo = 0
        OUTPUT INSERTED.CodigoPremio, INSERTED.NomePremio, INSERTED.Pontos, INSERTED.Ativo
        WHERE CodigoPremio = @codigo
      `);

    const removed = soft.recordset && soft.recordset[0];
    if (!removed) return res.status(404).json({ erro: 'Prêmio não encontrado', mensagem: 'CodigoPremio não existe' });
    return res.json({ mensagem: 'Prêmio desativado (soft-delete) com sucesso', premio: { codigoPremio: removed.CodigoPremio } });
  } catch (error) {
    console.error('[ERRO] DELETE /fidelidade-premio/:codigo', error.message);
    return res.status(500).json({ erro: 'Erro ao deletar prêmio de fidelidade', mensagem: error.message });
  }
});

module.exports = router;