const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { swaggerUi, swaggerUiOptions, swaggerSpec } = require('./swagger');

// Rotas
const tabelasRouter = require('./routes/tabelas');
const cadastroRouter = require('./routes/cadastro');
const fidelidadeRouter = require('./routes/fidelidade');
const fidelidadePremioRouter = require('./routes/fidelidade-premio');
const fidelidadeResgateRouter = require('./routes/fidelidade-resgate');
const vendasRouter = require('./routes/vendas');

app.use('/tabelas', tabelasRouter);
app.use('/cadastro', cadastroRouter);
app.use('/fidelidade-ponto', fidelidadeRouter);
app.use('/fidelidade-premio', fidelidadePremioRouter);
app.use('/fidelidade-resgate', fidelidadeResgateRouter);
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

app.use((req, res) => {
  res.status(404).json({
    error: 'Rota nao encontrada',
    erro: 'Rota nao encontrada',
    mensagem: `Nao existe endpoint para ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error('[ERRO GLOBAL]', err);

  const status = err.status || 500;
  const mensagem = err.message || 'Erro interno do servidor';

  res.status(status).json({
    error: mensagem,
    erro: mensagem,
    mensagem,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});