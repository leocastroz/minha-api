const { connectDB } = require('./db');

async function listarPremios(req, res) {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT CodigoPremio, NomePremio, Pontos, Ativo
    FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio
    ORDER BY NomePremio ASC
  `);

  const premios = result.recordset.map((premio) => ({
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
}

module.exports = { listarPremios };
