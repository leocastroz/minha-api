const express = require('express');
const { connectDB } = require('../db');

const router = express.Router();

function toNumber(value) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// GET /vendas/cliente/:identificador
// Aceita: CodigoCadastro, CodigoCliente ou CPFCNPJ (com/sem máscara)
// Exemplo: /vendas/cliente/123 ou /vendas/cliente/12345678901 ou /vendas/cliente/12.345.678/0001-23
router.get('/cliente/:identificador', async (req, res) => {
  try {
    const { identificador } = req.params;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const incluirEliminadas = String(req.query.incluirEliminadas || 'false').toLowerCase() === 'true';
    const startRow = (page - 1) * limit + 1;
    const endRow = page * limit;

    if (!identificador || identificador.trim().length === 0) {
      return res.status(400).json({
        erro: 'Identificador inválido',
        mensagem: 'Forneça CodigoCadastro, CodigoCliente ou CPFCNPJ',
      });
    }

    const pool = await connectDB();
    let codigoCadastro = null;
    let clienteInfo = null;

    // ==========================================
    // PASSO 1: Localizar o cliente
    // ==========================================
    
    if (!isNaN(identificador) && identificador.length < 15) {
      // Pode ser CodigoCadastro ou CodigoCliente (números pequenos)
      // Tentar primeiro CodigoCadastro
      let cadastroQuery = await pool.request()
        .input('codigoCadastro', parseInt(identificador))
        .query(`
          SELECT TOP 1
            c.CodigoCadastro,
            c.Nome,
            c.SobreNome,
            c.CPFCNPJ,
            c.Pessoa,
            cli.CodigoCliente,
            cli.Ativo AS ClienteAtivo
          FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
          LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
            ON cli.CodigoCadastro = c.CodigoCadastro
          WHERE c.CodigoCadastro = @codigoCadastro
        `);

      if (cadastroQuery.recordset && cadastroQuery.recordset.length > 0) {
        clienteInfo = cadastroQuery.recordset[0];
        codigoCadastro = clienteInfo.CodigoCadastro;
      } else {
        // Tentar como CodigoCliente
        let clienteQuery = await pool.request()
          .input('codigoCliente', parseInt(identificador))
          .query(`
            SELECT TOP 1
              c.CodigoCadastro,
              c.Nome,
              c.SobreNome,
              c.CPFCNPJ,
              c.Pessoa,
              cli.CodigoCliente,
              cli.Ativo AS ClienteAtivo
            FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
            LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
              ON cli.CodigoCadastro = c.CodigoCadastro
            WHERE cli.CodigoCliente = @codigoCliente
          `);

        if (clienteQuery.recordset && clienteQuery.recordset.length > 0) {
          clienteInfo = clienteQuery.recordset[0];
          codigoCadastro = clienteInfo.CodigoCadastro;
        }
      }
    } else {
      // Identificador é CPFCNPJ (pode estar com ou sem máscara)
      const cpfCnpjLimpo = identificador.replace(/[.\/-]/g, '');
      
      if (!/^\d+$/.test(cpfCnpjLimpo) || (cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14)) {
        return res.status(400).json({ 
          erro: 'Identificador inválido', 
          mensagem: 'Forneça CPFCNPJ válido (11 ou 14 dígitos) ou CodigoCadastro/CodigoCliente numérico' 
        });
      }

      let cadastroQuery = await pool.request()
        .input('cpfCnpj', cpfCnpjLimpo)
        .query(`
          SELECT TOP 1
            c.CodigoCadastro,
            c.Nome,
            c.SobreNome,
            c.CPFCNPJ,
            c.Pessoa,
            cli.CodigoCliente,
            cli.Ativo AS ClienteAtivo
          FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
          LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
            ON cli.CodigoCadastro = c.CodigoCadastro
          WHERE REPLACE(REPLACE(REPLACE(c.CPFCNPJ, '.', ''), '/', ''), '-', '') = @cpfCnpj
            OR c.CPFCNPJ = @cpfCnpj
        `);

      if (cadastroQuery.recordset && cadastroQuery.recordset.length > 0) {
        clienteInfo = cadastroQuery.recordset[0];
        codigoCadastro = clienteInfo.CodigoCadastro;
      }
    }

    // Validar se cliente foi encontrado
    if (!codigoCadastro || !clienteInfo) {
      return res.status(404).json({
        erro: 'Cliente não encontrado',
        identificador: identificador,
        mensagem: 'Nenhum cliente encontrado com este identificador'
      });
    }

    const resumoQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .input('incluirEliminadas', incluirEliminadas ? 1 : 0)
      .query(`
        SELECT
          COUNT(*) AS totalVendas,
          ISNULL(SUM(CAST(v.TotalBruto AS DECIMAL(18,2))), 0) AS totalBruto,
          ISNULL(SUM(CAST(v.TotalDesconto AS DECIMAL(18,2))), 0) AS totalDesconto,
          ISNULL(SUM(CAST(v.TotalLiquido AS DECIMAL(18,2))), 0) AS totalLiquido,
          MAX(v.DataVenda) AS dataUltimaCompra,
          MIN(v.DataVenda) AS dataPrimeiraCompra,
          COUNT(DISTINCT v.CodigoEmpresa) AS totalEmpresas,
          COUNT(DISTINCT v.CodigoFuncionario) AS totalFuncionarios
        FROM INOVAFARMA_DPOPPARA.dbo.Venda v
        WHERE v.CodigoCadastro = @codigoCadastro
          AND (@incluirEliminadas = 1 OR ISNULL(v.Eliminado, 0) = 0)
      `);

    const vendasDetalheQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .input('incluirEliminadas', incluirEliminadas ? 1 : 0)
      .input('startRow', startRow)
      .input('endRow', endRow)
      .query(`
        ;WITH VendasPaginadas AS (
          SELECT
            v.CodigoVenda,
            v.CodigoEmpresa,
            v.CodigoLancamento,
            v.CodigoFuncionario,
            v.CodigoConvenio,
            v.DataVenda,
            v.TotalBruto,
            v.TotalDesconto,
            v.TotalLiquido,
            v.Status,
            v.Eliminado,
            ROW_NUMBER() OVER (ORDER BY v.DataVenda DESC, v.CodigoVenda DESC) AS RowNum
          FROM INOVAFARMA_DPOPPARA.dbo.Venda v
          WHERE v.CodigoCadastro = @codigoCadastro
            AND (@incluirEliminadas = 1 OR ISNULL(v.Eliminado, 0) = 0)
        )
        SELECT
          vpag.RowNum,
          vpag.CodigoVenda,
          vpag.CodigoEmpresa,
          vpag.CodigoLancamento,
          vpag.DataVenda,
          vpag.TotalBruto,
          vpag.TotalDesconto,
          vpag.TotalLiquido,
          vpag.Status,
          vpag.Eliminado,
          -- Funcionário (vendedor)
          vpag.CodigoFuncionario,
          cf.Nome AS NomeFuncionario,
          -- Convênio
          vpag.CodigoConvenio,
          cc.Nome AS NomeConvenio,
          -- Forma de pagamento
          pag.CodigoPagamento AS CodigoFormaPagamento,
          pagg.NomePagamento AS NomeFormaPagamento,
          -- Auditoria
          l.DataLancamento,
          l.CodigoUsuario,
          COALESCE(NULLIF(LTRIM(RTRIM(u.Nome)), ''), u.Login) AS NomeUsuario,
          l.CodigoEstacao,
          -- Itens da venda
          vp.CodigoVendaID,
          vp.CodigoProduto,
          vp.Quantidade,
          vp.PrecoUnitario,
          vp.DescontoUnitario,
          vp.Total AS TotalItem,
          vp.TotalDesconto AS TotalDescontoItem,
          p.NomeProduto,
          pe.Estoque AS EstoqueAtual,
          pe.PrecoVenda AS PrecoTabelaAtual,
          pe.PrecoPromocao AS PrecoPromocionalAtual,
          pe.Ativo AS ProdutoAtivoNoEstoque
        FROM VendasPaginadas vpag
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Funcionario f
          ON f.CodigoFuncionario = vpag.CodigoFuncionario
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cf
          ON cf.CodigoCadastro = f.CodigoCadastro
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Convenio conv
          ON conv.CodigoConvenio = vpag.CodigoConvenio
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cc
          ON cc.CodigoCadastro = conv.CodigoCadastro
        OUTER APPLY (
          SELECT TOP 1
            vpagto.CodigoPagamento
          FROM INOVAFARMA_DPOPPARA.dbo.Venda_Pagamento vpagto
          WHERE vpagto.CodigoVenda = vpag.CodigoVenda
          ORDER BY vpagto.CodigoVendaID
        ) pag
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Plano_Pagamento pagg
          ON pagg.CodigoPagamento = pag.CodigoPagamento
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Lancamento l
          ON l.CodigoLancamento = vpag.CodigoLancamento
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Usuario u
          ON u.CodigoUsuario = l.CodigoUsuario
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Venda_Produto vp
          ON vp.CodigoVenda = vpag.CodigoVenda
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Produto p
          ON p.CodigoProduto = vp.CodigoProduto
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Produto_Estoque pe
          ON pe.CodigoProduto = vp.CodigoProduto
          AND pe.CodigoEmpresa = vpag.CodigoEmpresa
        WHERE vpag.RowNum BETWEEN @startRow AND @endRow
        ORDER BY vpag.RowNum, vp.CodigoVendaID
      `);

    const resumo = resumoQuery.recordset[0] || {};
    const linhas = vendasDetalheQuery.recordset || [];

    const vendasMap = new Map();
    for (const row of linhas) {
      const key = String(row.CodigoVenda);
      if (!vendasMap.has(key)) {
        vendasMap.set(key, {
          codigoVenda: row.CodigoVenda,
          dataVenda: row.DataVenda,
          status: row.Status,
          eliminado: Boolean(row.Eliminado),
          totalBruto: toNumber(row.TotalBruto),
          totalDesconto: toNumber(row.TotalDesconto),
          totalLiquido: toNumber(row.TotalLiquido),
          // Detalhes do vendedor
          vendedor: {
            codigoFuncionario: row.CodigoFuncionario || null,
            nomeFuncionario: row.NomeFuncionario || null
          },
          // Detalhes do convênio (se houver)
          convenio: {
            codigoConvenio: row.CodigoConvenio || null,
            nomeConvenio: row.NomeConvenio || null
          },
          // Forma de pagamento
          formaPagamento: {
            codigoFormaPagamento: row.CodigoFormaPagamento || null,
            nomeFormaPagamento: row.NomeFormaPagamento || null
          },
          // Auditoria
          auditoria: {
            codigoLancamento: row.CodigoLancamento || null,
            dataLancamento: row.DataLancamento || null,
            codigoUsuario: row.CodigoUsuario || null,
            nomeUsuario: row.NomeUsuario || null,
            codigoEstacao: row.CodigoEstacao || null
          },
          itens: [],
        });
      }

      if (row.CodigoVendaID != null) {
        vendasMap.get(key).itens.push({
          codigoVendaID: row.CodigoVendaID,
          codigoProduto: row.CodigoProduto,
          nomeProduto: row.NomeProduto,
          quantidade: toNumber(row.Quantidade),
          precoUnitario: toNumber(row.PrecoUnitario),
          descontoUnitario: toNumber(row.DescontoUnitario),
          totalItem: toNumber(row.TotalItem),
          totalDescontoItem: toNumber(row.TotalDescontoItem),
          estoqueAtual: toNumber(row.EstoqueAtual),
          precoTabelaAtual: toNumber(row.PrecoTabelaAtual),
          precoPromocionalAtual: toNumber(row.PrecoPromocionalAtual),
          produtoAtivoNoEstoque: row.ProdutoAtivoNoEstoque == null ? null : Boolean(row.ProdutoAtivoNoEstoque),
        });
      }
    }

    return res.json({
      mensagem: 'Compras do cliente consultadas com sucesso',
      cliente: {
        codigoCadastro: clienteInfo.CodigoCadastro,
        codigoCliente: clienteInfo.CodigoCliente || null,
        nomeCompleto: `${clienteInfo.Nome || ''} ${clienteInfo.SobreNome || ''}`.trim(),
        cpfCnpj: clienteInfo.CPFCNPJ || null,
        tipoPessoa: clienteInfo.Pessoa === 1 ? 'Física' : clienteInfo.Pessoa === 2 ? 'Jurídica' : 'Desconhecido',
        clienteAtivo: clienteInfo.ClienteAtivo == null ? null : Boolean(clienteInfo.ClienteAtivo),
      },
      relacionamentosUtilizados: [
        'Venda.CodigoCadastro → Cadastro.CodigoCadastro (cliente)',
        'Venda.CodigoFuncionario → Funcionario.CodigoFuncionario (vendedor)',
        'Venda.CodigoConvenio → Convenio.CodigoConvenio (convênio)',
        'Venda.CodigoLancamento → Lancamento.CodigoLancamento (auditoria)',
        'Venda_Produto.CodigoVenda → Venda.CodigoVenda (itens)',
        'Venda_Produto.CodigoProduto → Produto.CodigoProduto (produto)',
        'Venda_Pagamento.CodigoVenda → Venda.CodigoVenda (forma pagamento)',
        'Venda_Pagamento.CodigoPagamento → Plano_Pagamento.CodigoPagamento',
        'Produto_Estoque.CodigoProduto → Produto.CodigoProduto (estoque atual)',
      ],
      resumo: {
        totalVendas: toNumber(resumo.totalVendas),
        totalBruto: toNumber(resumo.totalBruto),
        totalDesconto: toNumber(resumo.totalDesconto),
        totalLiquido: toNumber(resumo.totalLiquido),
        dataUltimaCompra: resumo.dataUltimaCompra || null,
        dataPrimeiraCompra: resumo.dataPrimeiraCompra || null,
        totalEmpresas: toNumber(resumo.totalEmpresas),
        totalFuncionarios: toNumber(resumo.totalFuncionarios),
      },
      paginacao: {
        pagina: page,
        limite: limit,
        vendasNaPagina: vendasMap.size,
        incluirEliminadas,
      },
      vendas: Array.from(vendasMap.values()),
    });
  } catch (error) {
    console.error('[ERRO] GET /vendas/cliente/:identificador', error.message);
    return res.status(500).json({
      erro: 'Erro ao consultar compras do cliente',
      mensagem: error.message,
    });
  }
});

module.exports = router;