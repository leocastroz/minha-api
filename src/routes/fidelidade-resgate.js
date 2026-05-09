const express = require('express');
const { connectDB } = require('../db');

const router = express.Router();

async function localizarClienteResgate(pool, identificador) {
  if (!identificador || identificador.trim().length === 0) {
    const error = new Error('Forneça CodigoCliente (números) ou CPFCNPJ');
    error.status = 400;
    error.codigo = 'Identificador inválido';
    throw error;
  }

  let clienteInfo = null;
  let codigoCadastro = null;
  let codigoCliente = null;

  if (!isNaN(identificador)) {
    const clienteQuery = await pool.request()
      .input('codigoCliente', parseInt(identificador))
      .query(`
        SELECT TOP 1 
          CodigoCadastro,
          CodigoCliente,
          Ativo
        FROM INOVAFARMA_DPOPPARA.dbo.Cliente
        WHERE CodigoCliente = @codigoCliente
      `);

    if (clienteQuery.recordset && clienteQuery.recordset.length > 0) {
      clienteInfo = clienteQuery.recordset[0];
      codigoCadastro = clienteInfo.CodigoCadastro;
      codigoCliente = clienteInfo.CodigoCliente;
    }
  } else {
    const cpfCnpjLimpo = identificador.replace(/[.\/-]/g, '');

    if (!/^\d+$/.test(cpfCnpjLimpo) || (cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14)) {
      const error = new Error('CPFCNPJ deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)');
      error.status = 400;
      error.codigo = 'CPFCNPJ inválido';
      throw error;
    }

    const cadastroQuery = await pool.request()
      .input('cpfCnpj', cpfCnpjLimpo)
      .query(`
        SELECT TOP 1 
          c.CodigoCadastro,
          c.Nome,
          c.CPFCNPJ,
          c.Pessoa,
          cl.CodigoCliente,
          cl.Ativo
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cl
          ON cl.CodigoCadastro = c.CodigoCadastro
        WHERE REPLACE(REPLACE(REPLACE(c.CPFCNPJ, '.', ''), '/', ''), '-', '') = @cpfCnpj
          OR c.CPFCNPJ = @cpfCnpj
      `);

    if (cadastroQuery.recordset && cadastroQuery.recordset.length > 0) {
      clienteInfo = cadastroQuery.recordset[0];
      codigoCadastro = clienteInfo.CodigoCadastro;
      codigoCliente = clienteInfo.CodigoCliente;
    }
  }

  if (!codigoCadastro) {
    const error = new Error('Nenhum cliente encontrado com este identificador');
    error.status = 404;
    error.codigo = 'Cliente não encontrado';
    throw error;
  }

  return {
    codigoCadastro,
    codigoCliente,
    cliente: clienteInfo,
  };
}

async function carregarHistoricoResgates(pool, codigoCadastro, incluirDetalhes) {
  const resgatesQuery = await pool.request()
    .input('codigoCadastro', codigoCadastro)
    .query(`
      SELECT
        r.CodigoResgate,
        r.CodigoLancamento,
        r.Pontos AS PontosResgate,
        r.Observacao,
        l.DataLancamento,
        l.CodigoEstacao AS EstacaoResgate,
        fp.CodigoFidelidade,
        fp.DataVencimento AS DataVencimentoPonto,
        fp.Pontos AS PontosOrigem,
        fp.Saldo AS SaldoOrigem
      FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Ponto fp
      INNER JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate_Ponto rpo
        ON rpo.CodigoFidelidade = fp.CodigoFidelidade
      INNER JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate r
        ON r.CodigoResgate = rpo.CodigoResgate
      LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Lancamento l 
        ON l.CodigoLancamento = r.CodigoLancamento
      WHERE fp.CodigoCadastro = @codigoCadastro
      ORDER BY l.DataLancamento DESC, r.CodigoResgate DESC, fp.CodigoLancamento DESC
    `);

  if (!resgatesQuery.recordset || resgatesQuery.recordset.length === 0) {
    return {
      resgates: [],
      totalResgates: 0,
      totalPontosResgatados: 0,
      totalPremios: 0,
      periodoAnalisado: { inicio: null, fim: null },
    };
  }

  const codigosResgates = [...new Set(resgatesQuery.recordset.map(r => r.CodigoResgate))];
  let premiosQuery = { recordset: [] };

  if (codigosResgates.length > 0) {
    const placeholders = codigosResgates.map((_, i) => `@codigo${i}`).join(',');
    const reqPremios = pool.request();
    codigosResgates.forEach((codigo, i) => {
      reqPremios.input(`codigo${i}`, codigo);
    });
    premiosQuery = await reqPremios.query(`
      SELECT
        rp.CodigoResgate,
        rp.CodigoPremio,
        rp.Pontos,
        rp.Quantidade,
        rp.Total,
        p.NomePremio,
        p.Ativo AS PremioAtivo
      FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate_Premio rp
      LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio p 
        ON p.CodigoPremio = rp.CodigoPremio
      WHERE rp.CodigoResgate IN (${placeholders})
    `);
  }

  let pontosOrigemMap = new Map();
  try {
    if (codigosResgates.length > 0) {
      const placeholders = codigosResgates.map((_, i) => `@codigo${i}`).join(',');
      const reqPontos = pool.request();
      codigosResgates.forEach((codigo, i) => {
        reqPontos.input(`codigo${i}`, codigo);
      });
      const pontosQuery = await reqPontos.query(`
        SELECT
          rp.CodigoResgate,
          rp.CodigoFidelidade,
          f.Descricao AS DescricaoFidelidade,
          rp.DataOrigemPonto,
          SUM(rp.Pontos) AS PontosUtilizados
        FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate_Ponto rp
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade f 
          ON f.CodigoFidelidade = rp.CodigoFidelidade
        WHERE rp.CodigoResgate IN (${placeholders})
          AND rp.CodigoFidelidade IS NOT NULL
        GROUP BY rp.CodigoResgate, rp.CodigoFidelidade, f.Descricao, rp.DataOrigemPonto
      `);

      for (const row of (pontosQuery.recordset || [])) {
        const codigoResgate = row.CodigoResgate;
        if (!pontosOrigemMap.has(codigoResgate)) {
          pontosOrigemMap.set(codigoResgate, []);
        }
        pontosOrigemMap.get(codigoResgate).push({
          codigoFidelidade: row.CodigoFidelidade,
          descricaoFidelidade: row.DescricaoFidelidade,
          pontosUtilizados: row.PontosUtilizados ? Number(row.PontosUtilizados) : 0,
          dataOrigem: row.DataOrigemPonto,
        });
      }
    }
  } catch (err) {
    console.warn('[AVISO] Tabela Fidelidade_Resgate_Ponto não encontrada ou inacessível:', err.message);
  }

  let vinculoComercialMap = new Map();
  try {
    if (codigosResgates.length > 0) {
      const placeholders = codigosResgates.map((_, i) => `@codigo${i}`).join(',');
      const reqVinculo = pool.request();
      codigosResgates.forEach((codigo, i) => {
        reqVinculo.input(`codigo${i}`, codigo);
      });
      const vinculoQuery = await reqVinculo.query(`
        SELECT
          rl.CodigoResgate,
          rl.CodigoVenda,
          v.DataVenda,
          v.TotalVenda,
          v.DescricaoVenda
        FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate_Lancamento rl
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Venda v 
          ON v.CodigoVenda = rl.CodigoVenda
        WHERE rl.CodigoResgate IN (${placeholders})
          AND rl.CodigoVenda IS NOT NULL
      `);

      for (const row of (vinculoQuery.recordset || [])) {
        const codigoResgate = row.CodigoResgate;
        if (!vinculoComercialMap.has(codigoResgate)) {
          vinculoComercialMap.set(codigoResgate, []);
        }
        vinculoComercialMap.get(codigoResgate).push({
          codigoVenda: row.CodigoVenda,
          dataVenda: row.DataVenda,
          totalVenda: row.TotalVenda ? Number(row.TotalVenda) : 0,
          descricaoVenda: row.DescricaoVenda,
        });
      }
    }
  } catch (err) {
    console.warn('[AVISO] Tabela Fidelidade_Resgate_Lancamento não encontrada ou inacessível:', err.message);
  }

  const incluirDetalhesFlag = incluirDetalhes !== 'false';
  const mapResgates = new Map();

  for (const row of resgatesQuery.recordset) {
    const id = row.CodigoResgate;
    if (!mapResgates.has(id)) {
      mapResgates.set(id, {
        codigoResgate: row.CodigoResgate,
        codigoLancamento: row.CodigoLancamento,
        dataLancamento: row.DataLancamento,
        pontosResgate: row.PontosResgate !== undefined ? Number(row.PontosResgate) : 0,
        observacao: row.Observacao || null,
        auditoria: {
          codigoEstacao: row.EstacaoResgate || null,
        },
        premios: [],
        pontosOrigemCliente: [],
        origemPontos: incluirDetalhesFlag ? (pontosOrigemMap.get(id) || []) : undefined,
        vinculoComercial: incluirDetalhesFlag ? (vinculoComercialMap.get(id) || []) : undefined,
      });
    }

    if (row.CodigoFidelidade) {
      const registro = mapResgates.get(id);
      const jaExiste = registro.pontosOrigemCliente.some(
        (item) => item.codigoFidelidade === row.CodigoFidelidade
      );

      if (!jaExiste) {
        registro.pontosOrigemCliente.push({
          codigoFidelidade: row.CodigoFidelidade,
          dataVencimento: row.DataVencimentoPonto,
          pontosOrigem: row.PontosOrigem !== undefined ? Number(row.PontosOrigem) : 0,
          saldoOrigem: row.SaldoOrigem !== undefined ? Number(row.SaldoOrigem) : 0,
        });
      }
    }
  }

  for (const row of (premiosQuery.recordset || [])) {
    if (row.CodigoResgate && mapResgates.has(row.CodigoResgate)) {
      mapResgates.get(row.CodigoResgate).premios.push({
        codigoPremio: row.CodigoPremio,
        nomePremio: row.NomePremio || null,
        pontos: row.Pontos !== undefined ? Number(row.Pontos) : 0,
        quantidade: row.Quantidade !== undefined ? Number(row.Quantidade) : 0,
        total: row.Total !== undefined ? Number(row.Total) : 0,
        premioAtivo: row.PremioAtivo === true,
      });
    }
  }

  const resgates = Array.from(mapResgates.values());

  return {
    resgates,
    totalResgates: resgates.length,
    totalPontosResgatados: resgates.reduce((sum, r) => sum + (r.pontosResgate || 0), 0),
    totalPremios: resgates.reduce((sum, r) => sum + r.premios.length, 0),
    periodoAnalisado: {
      inicio: resgates.length > 0 ? resgates[resgates.length - 1].dataLancamento : null,
      fim: resgates.length > 0 ? resgates[0].dataLancamento : null,
    },
  };
}

/**
 * GET /fidelidade-resgate/cliente/:identificador
 * 
 * Retorna todos os resgates de fidelidade para um cliente
 * Aceita dois tipos de identificador:
 * - CodigoCliente (números)
 * - CPFCNPJ (com ou sem máscara: "12345678901234" ou "12.345.678/0001-23")
 * 
 * Relacionamentos analisados:
 * - Cadastro (código único de pessoa, contém CPFCNPJ)
 * - Cliente (dados específicos do cliente, referencia Cadastro)
 * - Fidelidade (cartão de fidelidade, referencia Cadastro)
 * - Fidelidade_Resgate (fatos de resgate)
 * - Fidelidade_Resgate_Premio (prêmios resgatados)
 * - Fidelidade_Resgate_Ponto (origem dos pontos utilizados)
 * - Fidelidade_Resgate_Lancamento (vínculo com venda/compra)
 * - Lancamento (auditoria: data, estação, usuário)
 * - Venda (se existir vínculo de compra)
 * 
 * @param {string} identificador - CodigoCliente (número) ou CPFCNPJ (com/sem máscara)
 * @param {string} incluirDetalhes - 'true' (padrão) ou 'false' para omitir origemPontos e vinculoComercial
 */
router.get('/cliente/:identificador', async (req, res) => {
  try {
    const { identificador } = req.params;
    const { incluirDetalhes = 'true' } = req.query;

    const pool = await connectDB();
    const { codigoCadastro, codigoCliente, cliente } = await localizarClienteResgate(pool, identificador);
    const incluirDetalhesFlag = incluirDetalhes !== 'false';
    const historico = await carregarHistoricoResgates(pool, codigoCadastro, incluirDetalhesFlag);

    // ==========================================
    // RESPOSTA ESTRUTURADA
    // ==========================================
    return res.json({
      mensagem: 'Resgates de fidelidade consultados com sucesso',
      cliente: {
        codigoCliente: codigoCliente,
        codigoCadastro: codigoCadastro,
        nome: cliente.Nome || null,
        cpfCnpj: cliente.CPFCNPJ || null,
        tipoPessoa: cliente.Pessoa === 1 ? 'Física' : cliente.Pessoa === 2 ? 'Jurídica' : 'Desconhecido',
        ativo: cliente.Ativo === true
      },
      resumo: {
        totalResgates: historico.totalResgates,
        totalPontosResgatados: historico.totalPontosResgatados,
        totalPremios: historico.totalPremios,
        periodoAnalisado: {
          inicio: historico.periodoAnalisado.inicio,
          fim: historico.periodoAnalisado.fim
        }
      },
      resgates: historico.resgates.map(r => {
        const resgate = {
          codigoResgate: r.codigoResgate,
          codigoLancamento: r.codigoLancamento,
          dataLancamento: r.dataLancamento,
          pontosResgate: r.pontosResgate,
          observacao: r.observacao,
          auditoria: r.auditoria,
          premios: r.premios,
          pontosOrigemCliente: r.pontosOrigemCliente,
        };
        
        if (incluirDetalhesFlag) {
          resgate.origemPontos = r.origemPontos;
          resgate.vinculoComercial = r.vinculoComercial;
        }
        
        return resgate;
      })
    });

  } catch (error) {
    console.error('[ERRO] GET /fidelidade-resgate/cliente/:identificador', error.message);
    const status = error.status || 500;
    return res.status(500).json({ 
      erro: error.codigo || 'Erro ao consultar resgates de fidelidade', 
      mensagem: error.message 
    });
  }
});

/**
 * GET /fidelidade-resgate/cliente/:identificador/premios
 *
 * Retorna todos os prêmios resgatados por um cliente em formato achatado para front-end.
 */
router.get('/cliente/:identificador/premios', async (req, res) => {
  try {
    const { identificador } = req.params;
    const { incluirDetalhes = 'true' } = req.query;

    const pool = await connectDB();
    const { codigoCadastro, codigoCliente, cliente } = await localizarClienteResgate(pool, identificador);
    const incluirDetalhesFlag = incluirDetalhes !== 'false';
    const historico = await carregarHistoricoResgates(pool, codigoCadastro, incluirDetalhesFlag);

    const premios = historico.resgates.flatMap((resgate) =>
      resgate.premios.map((premio) => {
        const item = {
          codigoResgate: resgate.codigoResgate,
          codigoLancamento: resgate.codigoLancamento,
          dataLancamento: resgate.dataLancamento,
          pontosResgate: resgate.pontosResgate,
          observacao: resgate.observacao,
          auditoria: resgate.auditoria,
          pontosOrigemCliente: resgate.pontosOrigemCliente,
          codigoPremio: premio.codigoPremio,
          nomePremio: premio.nomePremio,
          pontos: premio.pontos,
          quantidade: premio.quantidade,
          total: premio.total,
          premioAtivo: premio.premioAtivo,
        };

        if (incluirDetalhesFlag) {
          item.origemPontos = resgate.origemPontos;
          item.vinculoComercial = resgate.vinculoComercial;
        }

        return item;
      })
    );

    return res.json({
      mensagem: 'Histórico de prêmios resgatados consultado com sucesso',
      cliente: {
        codigoCliente,
        codigoCadastro,
        nome: cliente.Nome || null,
        cpfCnpj: cliente.CPFCNPJ || null,
        tipoPessoa: cliente.Pessoa === 1 ? 'Física' : cliente.Pessoa === 2 ? 'Jurídica' : 'Desconhecido',
        ativo: cliente.Ativo === true,
      },
      resumo: {
        totalResgates: historico.totalResgates,
        totalPontosResgatados: historico.totalPontosResgatados,
        totalPremios: historico.totalPremios,
        periodoAnalisado: historico.periodoAnalisado,
      },
      premios,
    });
  } catch (error) {
    console.error('[ERRO] GET /fidelidade-resgate/cliente/:identificador/premios', error.message);
    return res.status(error.status || 500).json({
      erro: error.codigo || 'Erro ao consultar histórico de prêmios',
      mensagem: error.message,
    });
  }
});

module.exports = router;
