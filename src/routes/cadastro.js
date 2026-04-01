const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

const CAMPOS_EDITAVEIS = [
  'CodigoEmpresa',
  'CodigoLancamento',
  'Nome',
  'NomeFantasia',
  'CPFCNPJ',
  'RG',
  'RGOrgao',
  'RGOrgaoUF',
  'DataNascimento',
  'Pessoa',
  'Sexo',
  'DataCadastro',
  'SobreNome',
  'IE',
  'Eliminado',
  'TipoDescontoNFe',
  'IdentificacaoEstrangeiro',
];

function montarAtualizacao(body, aceitarParcial) {
  const entradas = Object.entries(body).filter(([chave]) => CAMPOS_EDITAVEIS.includes(chave));

  if (entradas.length === 0) {
    return { erro: 'Envie ao menos um campo editável para atualizar.' };
  }

  if (!aceitarParcial) {
    const faltantes = CAMPOS_EDITAVEIS.filter((campo) => !(campo in body));
    if (faltantes.length > 0) {
      return {
        erro: 'No PUT, envie todos os campos editáveis.',
        faltantes,
      };
    }
  }

  const setClause = entradas.map(([campo]) => `${campo} = @${campo}`).join(', ');
  const params = entradas.map(([campo, valor]) => ({ campo, valor }));

  return { setClause, params };
}

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

// GET /cadastro/:codigo — buscar usuário por CodigoCadastro
router.get('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('codigo', codigo)
      .query(`
        SELECT *
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro
        WHERE CodigoCadastro = @codigo
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /cadastro/:codigo — atualizar todos os campos editáveis
router.put('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  const atualizacao = montarAtualizacao(req.body, false);
  if (atualizacao.erro) {
    return res.status(400).json(atualizacao);
  }

  try {
    const pool = await connectDB();
    const request = pool.request().input('codigo', codigo);

    atualizacao.params.forEach(({ campo, valor }) => {
      request.input(campo, valor);
    });

    const result = await request.query(`
      UPDATE INOVAFARMA_DPOPPARA.dbo.Cadastro
      SET ${atualizacao.setClause}
      OUTPUT INSERTED.*
      WHERE CodigoCadastro = @codigo
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    return res.json({
      mensagem: 'Cadastro atualizado com PUT.',
      dados: result.recordset[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /cadastro/:codigo — atualizar parcialmente
router.patch('/:codigo', async (req, res) => {
  const codigo = Number(req.params.codigo);

  if (Number.isNaN(codigo)) {
    return res.status(400).json({ error: 'CodigoCadastro inválido.' });
  }

  const atualizacao = montarAtualizacao(req.body, true);
  if (atualizacao.erro) {
    return res.status(400).json(atualizacao);
  }

  try {
    const pool = await connectDB();
    const request = pool.request().input('codigo', codigo);

    atualizacao.params.forEach(({ campo, valor }) => {
      request.input(campo, valor);
    });

    const result = await request.query(`
      UPDATE INOVAFARMA_DPOPPARA.dbo.Cadastro
      SET ${atualizacao.setClause}
      OUTPUT INSERTED.*
      WHERE CodigoCadastro = @codigo
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cadastro não encontrado.' });
    }

    return res.json({
      mensagem: 'Cadastro atualizado com PATCH.',
      dados: result.recordset[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;