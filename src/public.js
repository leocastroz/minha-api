const { timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const express = require('express');
const { criarApp } = require('./index');
const { listarPremios } = require('./catalogo-premios');

function lerChave(caminho, opcional = false) {
  let valor;
  try {
    valor = readFileSync(caminho, 'utf8').trim();
  } catch (erro) {
    if (opcional && erro.code === 'ENOENT') return null;
    throw erro;
  }

  if (!/^[0-9a-f]{64}$/.test(valor)) {
    throw new Error('Cada chave da API deve conter 64 caracteres hexadecimais.');
  }
  return Buffer.from(valor, 'hex');
}

const caminhoCatalogo = process.env.MINHA_API_TOKEN_FILE;
if (!caminhoCatalogo) {
  throw new Error('Configure MINHA_API_TOKEN_FILE com o caminho da chave do catálogo.');
}
const pastaChaves = dirname(caminhoCatalogo);
const chaves = {
  catalogo: lerChave(caminhoCatalogo),
  integracao: lerChave(join(pastaChaves, 'integracao.key'), true),
  admin: lerChave(join(pastaChaves, 'administracao.key'), true),
};
const chavesConfiguradas = Object.values(chaves).filter(Boolean).map(chave => chave.toString('hex'));
if (new Set(chavesConfiguradas).size !== chavesConfiguradas.length) {
  throw new Error('As chaves de catálogo, integração e administração devem ser diferentes.');
}

const consultasIntegracao = [
  /^\/fidelidade-ponto\/[0-9]+(?:\/resumo)?$/,
  /^\/fidelidade-ponto\/cliente\/[0-9]+$/,
  /^\/vendas\/cliente\/[^/]+$/,
  /^\/fidelidade-resgate\/cliente\/[^/]+(?:\/premios)?$/,
];

function perfilBearer(req) {
  const match = /^Bearer ([0-9a-f]{64})$/i.exec(req.get('authorization') || '');
  if (!match) return null;

  const chave = Buffer.from(match[1], 'hex');
  return Object.keys(chaves).find(perfil => chaves[perfil] && timingSafeEqual(chave, chaves[perfil])) || null;
}

function autorizarIntegracao(req, res, next) {
  if (req.path === '/cadastro') {
    if (req.method === 'POST') return next();
    if (req.method === 'GET') {
      const documento = req.query.CPFCNPJ ?? req.query.cpfcnpj;
      if (typeof documento !== 'string' || !/^(?:\d{11}|\d{14})$/.test(documento.trim())) {
        return res.status(400).json({ error: 'Forneça cpfcnpj com 11 ou 14 dígitos.' });
      }
      return next();
    }
  }

  if (req.method === 'GET' && consultasIntegracao.some(rota => rota.test(req.path))) return next();

  return res.status(403).json({ error: 'Esta operação exige acesso administrativo.' });
}

const app = express();
app.disable('x-powered-by');
app.enable('case sensitive routing');
app.enable('strict routing');

const appRestrita = criarApp({ interna: false });

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const enviarJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 500) return enviarJson(body);

    const mensagem = req.method === 'GET' && req.path === '/fidelidade-premio'
      ? 'Erro ao consultar prêmios de fidelidade'
      : 'Erro interno da API';
    return enviarJson({ error: mensagem });
  };

  const perfil = perfilBearer(req);
  if (req.method === 'GET' && req.path === '/fidelidade-premio') {
    if (perfil) return next();

    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Credencial inválida ou ausente' });
  }

  if (perfil === 'admin') return appRestrita(req, res, next);
  if (perfil === 'integracao') {
    return autorizarIntegracao(req, res, () => appRestrita(req, res, next));
  }

  return res.status(404).json({ error: 'Rota não encontrada' });
});

app.get('/fidelidade-premio', listarPremios);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error('Falha na API:', error.code || error.name);
  return res.status(500).json({ error: 'Erro interno da API' });
});

if (require.main === module) {
  const host = '127.0.0.1';
  const port = 4001;
  app.listen(port, host, (error) => {
    if (error) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    console.log(`Minha API escutando em http://${host}:${port}`);
  });
}

module.exports = app;
