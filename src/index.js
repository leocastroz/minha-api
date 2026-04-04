const express = require('express');
const { connectDB } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const { swaggerUi, swaggerUiOptions, swaggerSpec } = require('./swagger');

// Rotas
const tabelasRouter = require('./routes/tabelas');
const cadastroRouter = require('./routes/cadastro');
const fidelidadeRouter = require('./routes/fidelidade');
const fidelidadePremioRouter = require('./routes/fidelidade-premio');
const vendasRouter = require('./routes/vendas');

app.use('/tabelas', tabelasRouter);
app.use('/cadastro', cadastroRouter);
app.use('/fidelidade-ponto', fidelidadeRouter);
app.use('/fidelidade-premio', fidelidadePremioRouter);
app.use('/vendas', vendasRouter);

// Documentacao Swagger
app.get('/docs.json', (req, res) => {
  res.json(swaggerSpec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Health check
app.get('/health', async (req, res) => {
  try {
    await connectDB();
    res.json({ status: 'ok', banco: 'conectado' });
  } catch {
    res.status(500).json({ status: 'erro', banco: 'desconectado' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});