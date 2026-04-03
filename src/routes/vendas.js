const express = require('express');
const { connectDB } = require('../db');

const router = express.Router();

function toNumber(value) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// GET /vendas/cliente/:codigoCadastro?page=1&limit=20&incluirEliminadas=false
router.get('/cliente/:codigoCadastro', async (req, res) => {
  try {
    const codigoCadastro = Number(req.params.codigoCadastro);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const incluirEliminadas = String(req.query.incluirEliminadas || 'false').toLowerCase() === 'true';
    const startRow = (page - 1) * limit + 1;
    const endRow = page * limit;

    if (!codigoCadastro || Number.isNaN(codigoCadastro)) {
      return res.status(400).json({
        erro: 'CodigoCadastro inválido',
        mensagem: 'Informe um CodigoCadastro numérico válido.',
      });
    }

    const pool = await connectDB();

    const cadastroQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .query(`
        SELECT TOP 1
          c.CodigoCadastro,
          c.Nome,
          c.SobreNome,
          c.CPFCNPJ,
          cli.CodigoCliente,
          cli.Ativo AS ClienteAtivo
        FROM INOVAFARMA_DPOPPARA.dbo.Cadastro c
        LEFT JOIN INOVAFARMA_DPOPPARA.dbo.Cliente cli
          ON cli.CodigoCadastro = c.CodigoCadastro
        WHERE c.CodigoCadastro = @codigoCadastro
      `);

    if (!cadastroQuery.recordset.length) {
      return res.status(404).json({
        erro: 'Cadastro não encontrado',
        codigoCadastro,
      });
    }

    const cliente = cadastroQuery.recordset[0];

    const resumoQuery = await pool.request()
      .input('codigoCadastro', codigoCadastro)
      .input('incluirEliminadas', incluirEliminadas ? 1 : 0)
      .query(`
        SELECT
          COUNT(*) AS totalVendas,
          ISNULL(SUM(CAST(v.TotalBruto AS DECIMAL(18,2))), 0) AS totalBruto,
          ISNULL(SUM(CAST(v.TotalDesconto AS DECIMAL(18,2))), 0) AS totalDesconto,
          ISNULL(SUM(CAST(v.TotalLiquido AS DECIMAL(18,2))), 0) AS totalLiquido,
          MAX(v.DataVenda) AS dataUltimaCompra
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
          vpag.DataVenda,
          vpag.TotalBruto,
          vpag.TotalDesconto,
          vpag.TotalLiquido,
          vpag.Status,
          vpag.Eliminado,
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
        codigoCadastro: cliente.CodigoCadastro,
        codigoCliente: cliente.CodigoCliente || null,
        nomeCompleto: `${cliente.Nome || ''} ${cliente.SobreNome || ''}`.trim(),
        CPFCNPJ: cliente.CPFCNPJ || null,
        clienteAtivo: cliente.ClienteAtivo == null ? null : Boolean(cliente.ClienteAtivo),
      },
      relacionamentosUtilizados: [
        'Venda.CodigoCadastro -> Cadastro.CodigoCadastro',
        'Venda_Produto.CodigoVenda -> Venda.CodigoVenda',
        'Venda_Produto.CodigoProduto -> Produto.CodigoProduto',
        'Produto_Estoque.CodigoProduto -> Produto.CodigoProduto',
      ],
      resumo: {
        totalVendas: toNumber(resumo.totalVendas),
        totalBruto: toNumber(resumo.totalBruto),
        totalDesconto: toNumber(resumo.totalDesconto),
        totalLiquido: toNumber(resumo.totalLiquido),
        dataUltimaCompra: resumo.dataUltimaCompra || null,
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
    console.error('[ERRO] GET /vendas/cliente/:codigoCadastro', error.message);
    return res.status(500).json({
      erro: 'Erro ao consultar compras do cliente',
      mensagem: error.message,
    });
  }
});

module.exports = router;