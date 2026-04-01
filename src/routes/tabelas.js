const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

// GET /tabelas — listar todas as tabelas do banco
router.get('/', async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA AS esquema,
        TABLE_NAME   AS tabela
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tabelas/:nome — listar colunas de uma tabela específica
router.get('/:nome/colunas', async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('tabela', req.params.nome)
      .query(`
        SELECT 
          COLUMN_NAME   AS coluna,
          DATA_TYPE     AS tipo,
          IS_NULLABLE   AS nulo
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tabela
        ORDER BY ORDINAL_POSITION
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tabelas/:nome/dados — SELECT com paginação
router.get('/:nome/dados', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const pool = await connectDB();

    // Valida nome da tabela para evitar SQL injection
    const tabelaValida = await pool.request()
      .input('tabela', req.params.nome)
      .query(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = @tabela
      `);

    if (tabelaValida.recordset[0].total === 0) {
      return res.status(404).json({ error: 'Tabela não encontrada' });
    }

    const result = await pool.request()
      .input('limit', Number(limit))
      .input('offset', Number(offset))
      .query(`
        SELECT * FROM ${req.params.nome}
        ORDER BY (SELECT NULL)
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    res.json({
      pagina: Number(page),
      limite: Number(limit),
      total: result.recordset.length,
      dados: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;