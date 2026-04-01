const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

// GET /cadastro?page=1&limit=20&nome=FRANCISCA
router.get('/', async (req, res) => {
  const { page = 1, limit = 50, nome } = req.query;
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const startRow = (pageNumber - 1) * limitNumber + 1;
  const endRow = pageNumber * limitNumber;

  try {
    const pool = await connectDB();

    const request = pool.request()
      .input('startRow', startRow)
      .input('endRow', endRow);

    // Monta o WHERE dinamicamente
    let where = '';
    if (nome) {
      request.input('nome', `%${nome}%`);
      where = `WHERE LTRIM(RTRIM(Nome)) LIKE LTRIM(RTRIM(@nome))`;
    }

    const result = await request.query(`
      ;WITH CadastroPaginado AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY Nome) AS RowNum
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
        ${where}
      )
      SELECT *
      FROM CadastroPaginado
      WHERE RowNum BETWEEN @startRow AND @endRow
      ORDER BY RowNum
    `);

    res.json({
      pagina: pageNumber,
      limite: limitNumber,
      total: result.recordset.length,
      dados: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;