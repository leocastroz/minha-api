const express = require('express');
const { connectDB } = require('../db');

const router = express.Router();

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

    if (!identificador || identificador.trim().length === 0) {
      return res.status(400).json({ 
        erro: 'Identificador inválido', 
        mensagem: 'Forneça CodigoCliente (números) ou CPFCNPJ' 
      });
    }

    const pool = await connectDB();
    let codigoCadastro = null;
    let codigoCliente = null;
    let clienteInfo = null;

    // ==========================================
    // PASSO 1: Localizar o cliente
    // ==========================================
    
    if (!isNaN(identificador)) {
      // Identificador é um número (CodigoCliente)
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
      // Identificador é CPFCNPJ (pode estar com ou sem máscara)
      // Remover máscara: pontos, barras, hífens
      const cpfCnpjLimpo = identificador.replace(/[.\/-]/g, '');
      
      if (!/^\d+$/.test(cpfCnpjLimpo) || (cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14)) {
        return res.status(400).json({ 
          erro: 'CPFCNPJ inválido', 
          mensagem: 'CPFCNPJ deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)' 
        });
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

    // Validar se cliente foi encontrado
    if (!codigoCadastro) {
      return res.status(404).json({ 
        erro: 'Cliente não encontrado', 
        identificador: identificador,
        mensagem: 'Nenhum cliente encontrado com este identificador' 
      });
    }

    const cliente = clienteInfo;

    // ==========================================
    // CAMADA 1: Consultar Resgates (Fato Central)
    // Vínculo do cliente: Venda.CodigoCadastro = @codigoCadastro
    // ==========================================
    const resgatesQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT
          r.CodigoResgate,
          r.CodigoLancamento,
          r.Pontos AS PontosResgate,
          r.Observacao,
          l.DataLancamento,
          l.CodigoEstacao AS EstacaoResgate
        FROM INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate r
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Fidelidade_Resgate_Lancamento rl
          ON rl.CodigoResgate = r.CodigoResgate
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Venda v
          ON v.CodigoVenda = rl.CodigoVenda
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Lancamento l 
          ON l.CodigoLancamento = r.CodigoLancamento
        WHERE v.CodigoCadastro = @codigoCadastro
        ORDER BY l.DataLancamento DESC, r.CodigoResgate DESC
      `);

    if (!resgatesQuery.recordset || resgatesQuery.recordset.length === 0) {
      return res.json({
        mensagem: 'Nenhum resgate de fidelidade encontrado',
        codigoCliente: parseInt(codigoCliente),
        codigoCadastro,
        totalResgates: 0,
        resgates: [],
      });
    }

    // ==========================================
    // CAMADA 2: Consultar Prêmios (Sub-tabela)
    // Buscar por lista de CodigosResgates da camada anterior
    // ==========================================
    const codigosResgates = resgatesQuery.recordset.map(r => r.CodigoResgate);
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
          rp.Pontos AS PontosPremio,
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

    // ==========================================
    // CAMADA 3: Consultar Origem dos Pontos (Se existir tabela)
    // ==========================================
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
      
        // Mapear origem dos pontos por CodigoResgate
        for (const row of (pontosQuery.recordset || [])) {
          const codigoResgate = row.CodigoResgate;
          if (!pontosOrigemMap.has(codigoResgate)) {
            pontosOrigemMap.set(codigoResgate, []);
          }
          pontosOrigemMap.get(codigoResgate).push({
            codigoFidelidade: row.CodigoFidelidade,
            descricaoFidelidade: row.DescricaoFidelidade,
            pontosUtilizados: row.PontosUtilizados ? Number(row.PontosUtilizados) : 0,
            dataOrigem: row.DataOrigemPonto
          });
        }
      }
    } catch (err) {
      // Tabela Fidelidade_Resgate_Ponto pode não existir, continuar sem ela
      console.warn('[AVISO] Tabela Fidelidade_Resgate_Ponto não encontrada ou inacessível:', err.message);
    }

    // ==========================================
    // CAMADA 4: Consultar Vínculo Comercial (Se existir tabela)
    // ==========================================
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
      
        // Mapear vínculo comercial por CodigoResgate
        for (const row of (vinculoQuery.recordset || [])) {
          const codigoResgate = row.CodigoResgate;
          if (!vinculoComercialMap.has(codigoResgate)) {
            vinculoComercialMap.set(codigoResgate, []);
          }
          vinculoComercialMap.get(codigoResgate).push({
            codigoVenda: row.CodigoVenda,
            dataVenda: row.DataVenda,
            totalVenda: row.TotalVenda ? Number(row.TotalVenda) : 0,
            descricaoVenda: row.DescricaoVenda
          });
        }
      }
    } catch (err) {
      // Tabela Fidelidade_Resgate_Lancamento pode não existir, continuar sem ela
      console.warn('[AVISO] Tabela Fidelidade_Resgate_Lancamento não encontrada ou inacessível:', err.message);
    }

    // ==========================================
    // CONSOLIDAÇÃO: Agrupar resgates com seus detalhes
    // ==========================================
    const mapResgates = new Map();
    const incluirDetalhesFlag = incluirDetalhes !== 'false';

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
            codigoEstacao: row.EstacaoResgate || null
          },
          premios: [],
          origemPontos: incluirDetalhesFlag ? (pontosOrigemMap.get(id) || []) : undefined,
          vinculoComercial: incluirDetalhesFlag ? (vinculoComercialMap.get(id) || []) : undefined
        });
      }
    }

    // Adicionar prêmios aos resgates
    for (const row of (premiosQuery.recordset || [])) {
      if (row.CodigoResgate && mapResgates.has(row.CodigoResgate)) {
        mapResgates.get(row.CodigoResgate).premios.push({
          codigoPremio: row.CodigoPremio,
          nomePremio: row.NomePremio || null,
          pontos: row.PontosPremio !== undefined ? Number(row.PontosPremio) : 0,
          quantidade: row.Quantidade !== undefined ? Number(row.Quantidade) : 0,
          total: row.Total !== undefined ? Number(row.Total) : 0,
          premioAtivo: row.PremioAtivo === true
        });
      }
    }

    const resgates = Array.from(mapResgates.values());

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
        totalResgates: resgates.length,
        totalPontosResgatados: resgates.reduce((sum, r) => sum + (r.pontosResgate || 0), 0),
        totalPremios: resgates.reduce((sum, r) => sum + r.premios.length, 0),
        periodoAnalisado: {
          inicio: resgates.length > 0 ? resgates[resgates.length - 1].dataLancamento : null,
          fim: resgates.length > 0 ? resgates[0].dataLancamento : null
        }
      },
      resgates: resgates.map(r => {
        const resgate = {
          codigoResgate: r.codigoResgate,
          codigoLancamento: r.codigoLancamento,
          dataLancamento: r.dataLancamento,
          pontosResgate: r.pontosResgate,
          observacao: r.observacao,
          auditoria: r.auditoria,
          premios: r.premios
        };
        
        if (incluirDetalhesFlag) {
          resgate.origemPontos = r.origemPontos;
          resgate.vinculoComercial = r.vinculoComercial;
        }
        
        return resgate;
      })
    });

  } catch (error) {
    console.error('[ERRO] GET /fidelidade-resgate/cliente/:codigoCliente', error.message);
    return res.status(500).json({ 
      erro: 'Erro ao consultar resgates de fidelidade', 
      mensagem: error.message 
    });
  }
});

module.exports = router;
