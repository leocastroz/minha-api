# Exemplos Práticos - APIs Ajustadas

## 📚 Cenários de Uso Reais

### Cenário 1: Validar se um cliente é ativo no programa de fidelidade

**Situação:** Um cliente vem à farmácia e diz seu CPF. Você precisa saber se ele tem pontos de fidelidade pendentes.

**Solução:**

```bash
#!/bin/bash
CPF="123.456.789-00"

curl -s "http://localhost:3000/fidelidade-resgate/cliente/$CPF" | jq '{
  cliente: .cliente,
  totalPontosDisponíveis: .resumo.totalPontosResgatados,
  totalResgates: .resumo.totalResgates,
  ultimoResgate: .resgates[0].dataLancamento
}'
```

**Resposta esperada:**
```json
{
  "cliente": {
    "codigoCliente": 456,
    "nome": "João Silva",
    "cpfCnpj": "123.456.789-00",
    "tipoPessoa": "Física",
    "ativo": true
  },
  "totalPontosDisponíveis": 2500,
  "totalResgates": 5,
  "ultimoResgate": "2026-05-08T14:45:00.000Z"
}
```

---

### Cenário 2: Auditar histórico de compras de um cliente para fins fiscais

**Situação:** A receita federal quer saber o histórico de compras de um cliente específico nos últimos 6 meses.

**Solução (Node.js):**

```javascript
const axios = require('axios');

async function auditarComprasCliente(identificador, dataInicio, dataFim) {
  try {
    // Buscar todas as compras
    const response = await axios.get(
      `http://localhost:3000/vendas/cliente/${identificador}?limit=200`
    );

    const { cliente, vendas } = response.data;

    // Filtrar por período
    const vendasPeriodo = vendas.filter(v => {
      const data = new Date(v.dataVenda);
      return data >= new Date(dataInicio) && data <= new Date(dataFim);
    });

    // Gerar relatório de auditoria
    const relatorio = {
      cliente: {
        nome: cliente.nomeCompleto,
        cpfCnpj: cliente.cpfCnpj,
        codigoCadastro: cliente.codigoCadastro
      },
      periodo: { dataInicio, dataFim },
      resumo: {
        totalCompras: vendasPeriodo.length,
        valorBruto: vendasPeriodo.reduce((sum, v) => sum + v.totalBruto, 0),
        totalDesconto: vendasPeriodo.reduce((sum, v) => sum + v.totalDesconto, 0),
        valorLiquido: vendasPeriodo.reduce((sum, v) => sum + v.totalLiquido, 0),
      },
      compras: vendasPeriodo.map(v => ({
        data: v.dataVenda,
        vendedor: v.vendedor.nomeFuncionario,
        valor: v.totalLiquido,
        quantidade_itens: v.itens.length,
        auditoria: v.auditoria
      }))
    };

    return relatorio;
  } catch (error) {
    console.error('Erro ao auditar compras:', error.message);
  }
}

// Usar função
auditarComprasCliente('123.456.789-00', '2025-11-01', '2026-05-08')
  .then(relatorio => console.log(JSON.stringify(relatorio, null, 2)));
```

---

### Cenário 3: Gerar estatística de compra por vendedor

**Situação:** Gerente quer saber quais vendedores têm mais recorrência com um cliente específico.

**Solução (Python):**

```python
import requests
from collections import Counter
from datetime import datetime

def analisar_vendedores(cpf):
    """Analisa quais vendedores mais vendem para um cliente"""
    
    response = requests.get(f'http://localhost:3000/vendas/cliente/{cpf}?limit=200')
    data = response.json()
    
    vendas = data.get('vendas', [])
    
    # Contar compras por vendedor
    vendedores = Counter()
    total_por_vendedor = {}
    
    for venda in vendas:
        vendedor = venda['vendedor']['nomeFuncionario']
        vendedores[vendedor] += 1
        
        if vendedor not in total_por_vendedor:
            total_por_vendedor[vendedor] = 0
        total_por_vendedor[vendedor] += venda['totalLiquido']
    
    # Ordenar por quantidade de vendas
    ranking = sorted(
        vendedores.items(), 
        key=lambda x: x[1], 
        reverse=True
    )
    
    # Imprimir resultado
    print(f"\n{'='*60}")
    print(f"ANÁLISE DE VENDEDORES - Cliente: {data['cliente']['nomeCompleto']}")
    print(f"{'='*60}\n")
    
    for pos, (vendedor, qtd) in enumerate(ranking, 1):
        percentual = (qtd / len(vendas)) * 100
        valor_total = total_por_vendedor[vendedor]
        valor_medio = valor_total / qtd
        
        print(f"{pos}º lugar: {vendedor}")
        print(f"   Compras: {qtd} ({percentual:.1f}%)")
        print(f"   Total: R$ {valor_total:.2f}")
        print(f"   Ticket médio: R$ {valor_medio:.2f}\n")

# Usar função
analisar_vendedores('123.456.789-00')
```

---

### Cenário 4: Buscar histórico completo de um cliente (JSON estruturado)

**Situação:** Sistema de CRM precisa sincronizar dados de um cliente com histórico completo.

**Solução (cURL com jq):**

```bash
#!/bin/bash

CLIENTE="123.456.789-00"

# Buscar dados de fidelidade
echo "Obtendo dados de fidelidade..."
fidelidade=$(curl -s "http://localhost:3000/fidelidade-resgate/cliente/$CLIENTE")

# Buscar dados de compras
echo "Obtendo histórico de compras..."
compras=$(curl -s "http://localhost:3000/vendas/cliente/$CLIENTE?limit=100")

# Consolidar em um único JSON
echo "{
  \"cliente\": $(echo "$compras" | jq '.cliente'),
  \"fidelidade\": $(echo "$fidelidade" | jq '{
    resumo: .resumo,
    resgates: .resgates
  }'),
  \"compras\": $(echo "$compras" | jq '{
    resumo: .resumo,
    paginacao: .paginacao,
    vendas: .vendas
  }')
}" | jq '.' > cliente_completo.json

echo "✓ Dados consolidados em cliente_completo.json"
```

---

### Cenário 5: Alertar sobre clientes inativos

**Situação:** Você quer saber quais clientes não fazem compras há mais de 6 meses.

**Solução (Node.js):**

```javascript
const axios = require('axios');

async function alertarClientesInativos(listaClientesCPFs) {
  const clientesInativos = [];
  const agora = new Date();
  const seisMesesAtras = new Date(agora.setMonth(agora.getMonth() - 6));

  for (const cpf of listaClientesCPFs) {
    try {
      const response = await axios.get(
        `http://localhost:3000/vendas/cliente/${cpf}?limit=1`
      );

      const { cliente, resumo } = response.data;
      const ultimaCompra = new Date(resumo.dataUltimaCompra);

      if (ultimaCompra < seisMesesAtras) {
        clientesInativos.push({
          nome: cliente.nomeCompleto,
          cpf: cliente.cpfCnpj,
          ultimaCompra: resumo.dataUltimaCompra,
          diasInativo: Math.floor((agora - ultimaCompra) / (1000 * 60 * 60 * 24)),
          totalCompras: resumo.totalVendas
        });
      }
    } catch (error) {
      console.warn(`Erro ao buscar cliente ${cpf}:`, error.message);
    }
  }

  return clientesInativos;
}

// Usar função com lista de clientes
const clientes = ['123.456.789-00', '987.654.321-00', '111.222.333-44'];
alertarClientesInativos(clientes).then(inativos => {
  console.log('\n📊 CLIENTES INATIVOS (> 6 meses):\n');
  inativos.forEach(c => {
    console.log(`${c.nome}`);
    console.log(`  CPF: ${c.cpf}`);
    console.log(`  Última compra: ${c.ultimaCompra}`);
    console.log(`  Dias inativo: ${c.diasInativo}`);
    console.log(`  Total de compras: ${c.totalCompras}\n`);
  });
});
```

---

### Cenário 6: Validar histórico de fidelidade antes de resgate

**Situação:** Um cliente quer resgatar 1000 pontos. Você precisa validar se ele tem essa quantidade disponível.

**Solução (TypeScript):**

```typescript
import axios from 'axios';

interface ResgateRequest {
  cliente: string; // CPFCNPJ ou CodigoCliente
  pontosDesejados: number;
}

interface ResgateValidacao {
  permitido: boolean;
  pontosDisponiveis: number;
  mensagem: string;
}

async function validarResgateCliente(
  request: ResgateRequest
): Promise<ResgateValidacao> {
  try {
    const response = await axios.get(
      `http://localhost:3000/fidelidade-resgate/cliente/${request.cliente}`
    );

    const { resumo, cliente } = response.data;
    const pontosDisponiveis = resumo.totalPontosResgatados;

    if (!cliente.ativo) {
      return {
        permitido: false,
        pontosDisponiveis: 0,
        mensagem: `Cliente ${cliente.nomeCompleto} está inativo`
      };
    }

    if (request.pontosDesejados > pontosDisponiveis) {
      return {
        permitido: false,
        pontosDisponiveis,
        mensagem: `Saldo insuficiente. Disponível: ${pontosDisponiveis} pontos, 
                   Solicitado: ${request.pontosDesejados} pontos`
      };
    }

    return {
      permitido: true,
      pontosDisponiveis,
      mensagem: `Resgate autorizado. Após resgate: ${pontosDisponiveis - request.pontosDesejados} pontos`
    };
  } catch (error) {
    return {
      permitido: false,
      pontosDisponiveis: 0,
      mensagem: `Erro ao validar fidelidade: ${error.message}`
    };
  }
}

// Usar função
const validacao = await validarResgateCliente({
  cliente: '123.456.789-00',
  pontosDesejados: 1000
});

console.log(`✓ ${validacao.permitido ? 'APROVADO' : 'NEGADO'}`);
console.log(`  ${validacao.mensagem}`);
console.log(`  Pontos disponíveis: ${validacao.pontosDisponiveis}`);
```

---

### Cenário 7: Exportar data para Excel (CSV)

**Situação:** Gerente quer exportar compras de um cliente para análise em Excel.

**Solução (Node.js com csv writer):**

```javascript
const axios = require('axios');
const csv = require('csv-stringify');
const fs = require('fs');

async function exportarComprasCSV(cpf, arquivo) {
  const response = await axios.get(
    `http://localhost:3000/vendas/cliente/${cpf}?limit=500`
  );

  const { cliente, vendas } = response.data;

  // Preparar dados para CSV
  const registros = [];

  vendas.forEach((venda, idx) => {
    venda.itens.forEach((item, itemIdx) => {
      registros.push({
        'Seq': idx + 1,
        'Data Venda': venda.dataVenda,
        'Produto': item.nomeProduto,
        'Quantidade': item.quantidade,
        'Preço Unitário': item.precoUnitario.toFixed(2),
        'Desconto': item.descontoUnitario.toFixed(2),
        'Total': item.totalItem.toFixed(2),
        'Vendedor': venda.vendedor.nomeFuncionario,
        'Convênio': venda.convenio.nomeConvenio || 'N/A',
        'Forma Pagto': venda.formaPagamento.nomeFormaPagamento || 'N/A'
      });
    });
  });

  // Gerar CSV
  csv.stringify(
    registros,
    {
      header: true,
      columns: [
        'Seq', 'Data Venda', 'Produto', 'Quantidade', 
        'Preço Unitário', 'Desconto', 'Total', 'Vendedor', 
        'Convênio', 'Forma Pagto'
      ]
    },
    (err, output) => {
      if (err) {
        console.error('Erro ao gerar CSV:', err);
        return;
      }

      fs.writeFileSync(arquivo, output);
      console.log(`✓ Arquivo exportado: ${arquivo}`);
      console.log(`  ${registros.length} registros`);
      console.log(`  Cliente: ${cliente.nomeCompleto}`);
    }
  );
}

// Usar função
exportarComprasCSV('123.456.789-00', 'compras_cliente.csv');
```

---

### Cenário 8: Dashboard em tempo real (HTML)

**Situação:** Criar um dashboard que mostra informações do cliente em tempo real.

**Solução (HTML + JavaScript):**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Cliente</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 20px auto; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-number { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .stat-label { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f9f9f9; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dashboard do Cliente</h1>
    
    <div class="card">
      <h2>Informações do Cliente</h2>
      <div id="cliente-info"></div>
    </div>

    <div class="card">
      <h2>Estatísticas de Compra</h2>
      <div id="compras-stats"></div>
    </div>

    <div class="card">
      <h2>Últimas Compras</h2>
      <table id="compras-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Vendedor</th>
            <th>Total</th>
            <th>Itens</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Programa de Fidelidade</h2>
      <div id="fidelidade-info"></div>
    </div>
  </div>

  <script>
    async function carregarDados(cpf) {
      // Buscar dados de compras
      const comprasResp = await fetch(`/vendas/cliente/${cpf}`);
      const comprasData = await comprasResp.json();

      // Buscar dados de fidelidade
      const fidelidadeResp = await fetch(`/fidelidade-resgate/cliente/${cpf}`);
      const fidelidadeData = await fidelidadeResp.json();

      // Renderizar cliente
      document.getElementById('cliente-info').innerHTML = `
        <p><strong>Nome:</strong> ${comprasData.cliente.nomeCompleto}</p>
        <p><strong>CPF/CNPJ:</strong> ${comprasData.cliente.cpfCnpj}</p>
        <p><strong>Tipo:</strong> ${comprasData.cliente.tipoPessoa}</p>
        <p><strong>Status:</strong> ${comprasData.cliente.clienteAtivo ? '✓ Ativo' : '✗ Inativo'}</p>
      `;

      // Renderizar estatísticas
      const resumo = comprasData.resumo;
      document.getElementById('compras-stats').innerHTML = `
        <div class="stat">
          <div class="stat-number">${resumo.totalVendas}</div>
          <div class="stat-label">Total de Compras</div>
        </div>
        <div class="stat">
          <div class="stat-number">R$ ${resumo.totalLiquido.toFixed(2)}</div>
          <div class="stat-label">Valor Total</div>
        </div>
        <div class="stat">
          <div class="stat-number">R$ ${(resumo.totalLiquido / resumo.totalVendas).toFixed(2)}</div>
          <div class="stat-label">Ticket Médio</div>
        </div>
      `;

      // Renderizar tabela de compras
      const tbody = document.querySelector('#compras-table tbody');
      tbody.innerHTML = '';
      comprasData.vendas.slice(0, 10).forEach(venda => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${new Date(venda.dataVenda).toLocaleDateString('pt-BR')}</td>
          <td>${venda.vendedor.nomeFuncionario}</td>
          <td>R$ ${venda.totalLiquido.toFixed(2)}</td>
          <td>${venda.itens.length}</td>
        `;
        tbody.appendChild(tr);
      });

      // Renderizar fidelidade
      document.getElementById('fidelidade-info').innerHTML = `
        <div class="stat">
          <div class="stat-number">${fidelidadeData.resumo.totalResgates}</div>
          <div class="stat-label">Total de Resgates</div>
        </div>
        <div class="stat">
          <div class="stat-number">${fidelidadeData.resumo.totalPontosResgatados}</div>
          <div class="stat-label">Pontos Resgatados</div>
        </div>
      `;
    }

    // Carregar dados ao entrar na página
    const cpf = new URLSearchParams(window.location.search).get('cpf') || '123.456.789-00';
    carregarDados(cpf);
  </script>
</body>
</html>
```

---

## ✅ Checklist de Implementação

- [x] API aceita múltiplos identificadores (CodigoCadastro, CodigoCliente, CPFCNPJ)
- [x] Relacionamentos com tabelas de auditoria (Lancamento, Usuario)
- [x] Relacionamentos com Funcionario (quem vendeu)
- [x] Relacionamentos com Convenio (plano de saúde)
- [x] Relacionamentos com Venda_FP (forma de pagamento)
- [x] Documentação de relacionamentos na resposta
- [x] Testes de validação incluídos
- [x] Exemplos práticos de uso
- [x] Tratamento de erros adequado
- [x] Paginação suportada

---

## 🚀 Próximas Melhorias Sugeridas

1. **Filtro por período:** Adicionar `dataInicio` e `dataFim` como query params
2. **Filtro por forma pagamento:** `?formaPagamento=cartao`
3. **Cache Redis:** Para clientes sem movimentação recente
4. **Webhook:** Notificar quando cliente resgate pontos
5. **Relatório PDF:** Exportar história de cliente em PDF
6. **Validação de duplicatas:** Detectar possíveis clientes duplicados

---

*Exemplos atualizados em Maio/2026*
