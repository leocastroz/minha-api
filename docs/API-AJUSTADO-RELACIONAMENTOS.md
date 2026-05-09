# APIs Ajustadas com Análise Completa de Relacionamentos

## Documentação das Rotas Otimizadas - INOVAFARMA_DPOPPARA

**Data:** Maio 2026  
**Status:** Implementação Completa  
**Análise Baseada:** Documentação técnica do banco INOVAFARMA_DPOPPARA com 551 tabelas

---

## 1. API de RESGATES DE FIDELIDADE

### Endpoint
```
GET /fidelidade-resgate/cliente/:identificador
```

### Descrição
Retorna todos os resgates de pontos de fidelidade para um cliente, com histórico completo, prêmios resgatados, origem dos pontos e relacionamentos comerciais.

### Parâmetros

#### Path Parameter
- **`identificador`** (required) - Múltiplas formas de identificação:
  - `CodigoCliente` (número inteiro) - Ex: `123`
  - `CPFCNPJ` (com ou sem máscara) - Ex: `12345678901234` ou `12.345.678/0001-23`

#### Query Parameters
- **`incluirDetalhes`** (optional, default: `true`)
  - `true` - Inclui campos detalhados (origemPontos, vinculoComercial)
  - `false` - Retorna apenas informações resumidas

### Relacionamentos Utilizados

```
Cadastro ◄─────── Cliente
   │                │
   │ (CodigoCadastro)
   │                └──► CodigoCliente
   │
   ├─ CPFCNPJ ◄──────────── (busca inicial)
   │
   └──► Fidelidade ◄──────────────────────────────┐
        (cartão de cliente)                       │
         │                                        │
         └──► Fidelidade_Ponto                    │
         │    (acúmulo de pontos)                 │
         │                                        │
         └──► Fidelidade_Resgate ◄────────────────┘
              (fatos de resgate)                  
               │
               ├──► Fidelidade_Resgate_Premio
               │    (prêmios resgatados)
               │    └──► Fidelidade_Premio (catálogo)
               │
               ├──► Fidelidade_Resgate_Ponto
               │    (origem dos pontos utilizados)
               │
               ├──► Fidelidade_Resgate_Lancamento
               │    (vínculo com transação comercial)
               │    └──► Venda (compra original)
               │
               └──► Lancamento
                    (auditoria: DataLancamento, CodigoEstacao, CodigoUsuario)
```

### Exemplo de Requisição

```bash
# Buscar resgates usando CodigoCliente
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/456" \
  -H "Content-Type: application/json"

# Buscar resgates usando CPFCNPJ (sem máscara)
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/12345678901234"

# Buscar resgates usando CPFCNPJ (com máscara)
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/12.345.678/0001-23"

# Buscar apenas resumo (sem detalhes de origem)
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/456?incluirDetalhes=false"
```

### Exemplo de Resposta

```json
{
  "mensagem": "Resgates de fidelidade consultados com sucesso",
  "cliente": {
    "codigoCliente": 456,
    "codigoCadastro": 789,
    "nome": "João Silva",
    "cpfCnpj": "123.456.789-00",
    "tipoPessoa": "Física",
    "ativo": true
  },
  "resumo": {
    "totalResgates": 5,
    "totalPontosResgatados": 2500,
    "totalPremios": 8,
    "periodoAnalisado": {
      "inicio": "2025-01-15T10:30:00.000Z",
      "fim": "2026-05-08T14:45:00.000Z"
    }
  },
  "resgates": [
    {
      "codigoResgate": 1001,
      "codigoLancamento": 50001,
      "dataLancamento": "2026-05-08T14:45:00.000Z",
      "pontosResgate": 500,
      "observacao": "Resgate de brinde promocional",
      "auditoria": {
        "codigoEstacao": 1
      },
      "premios": [
        {
          "codigoPremio": 201,
          "nomePremio": "Brinde Farmácia",
          "pontos": 500,
          "quantidade": 1,
          "total": 500,
          "premioAtivo": true
        }
      ],
      "origemPontos": [
        {
          "codigoFidelidade": 111,
          "descricaoFidelidade": "Pontos de compras normais",
          "pontosUtilizados": 500,
          "dataOrigem": "2025-05-15T08:00:00.000Z"
        }
      ],
      "vinculoComercial": [
        {
          "codigoVenda": 9001,
          "dataVenda": "2025-05-15T08:00:00.000Z",
          "totalVenda": 150.50,
          "descricaoVenda": "Compra de medicamentos"
        }
      ]
    }
  ]
}
```

---

## 2. API DE COMPRAS/VENDAS DO CLIENTE

### Endpoint
```
GET /vendas/cliente/:identificador
```

### Descrição
Retorna histórico completo de compras/vendas de um cliente com detalhes de produtos, formas de pagamento, vendedor, convênio e informações de auditoria.

### Parâmetros

#### Path Parameter
- **`identificador`** (required) - Múltiplas formas de identificação:
  - `CodigoCadastro` (número inteiro) - Ex: `789`
  - `CodigoCliente` (número inteiro) - Ex: `456`
  - `CPFCNPJ` (com ou sem máscara) - Ex: `12345678901234` ou `12.345.678/0001-23`

#### Query Parameters
- **`page`** (optional, default: `1`) - Página de resultados
- **`limit`** (optional, default: `20`, máx: `200`) - Itens por página
- **`incluirEliminadas`** (optional, default: `false`) - Incluir compras marcadas como eliminadas

### Relacionamentos Utilizados

```
Cadastro ◄─────────────────── Cliente
   │                            │
   │ (CodigoCadastro)           │
   │                            └──► CodigoCliente
   │
   ├─ CPFCNPJ ◄──────────────────────────── (busca inicial)
   │
   └──► Venda ◄────────────────────────────────────────────┐
        (cabeçalho de venda/compra)                       │
         │                                               │
         ├──► CodigoFuncionario ──► Funcionario          │
         │    (quem fez a venda)    (dados do vendedor)  │
         │                                               │
         ├──► CodigoConvenio ──────► Convenio            │
         │    (plano de saúde)      (dados do convênio)  │
         │                                               │
         ├──► CodigoLancamento ──► Lancamento            │
         │    (identificador único) ├─ DataLancamento    │
         │                         ├─ CodigoUsuario      │
         │                         ├─ CodigoEstacao      │
         │                         └─► Usuario           │
         │                             (quem lançou)    │
         │                                               │
         └──► Venda_Produto ◄──────────────────────────┐ │
         │    (itens da compra)                       │ │
         │     │                                      │ │
         │     ├──► CodigoProduto ──► Produto        │ │
         │     │    (qual produto)    (descr., marca)│ │
         │     │                                      │ │
         │     └──► Produto_Estoque                  │ │
         │          (preço tabela, promoção, estoque)│ │
         │                                            │ │
         └──► Venda_FP (Venda_FormaPagamento)        │
              (como foi pago)  ◄─────────────────────┘
               │
               ├─ Espécie (dinheiro)
               ├─ Cartão de débito/crédito
               ├─ Cheque
               ├─ Convênio/Plano
               └─ Outros
```

### Exemplo de Requisição

```bash
# Buscar compras usando CodigoCadastro
curl -X GET "http://localhost:3000/vendas/cliente/789" \
  -H "Content-Type: application/json"

# Buscar compras usando CodigoCliente
curl -X GET "http://localhost:3000/vendas/cliente/456"

# Buscar compras usando CPFCNPJ (sem máscara)
curl -X GET "http://localhost:3000/vendas/cliente/12345678901234"

# Buscar página 2, com 50 itens por página, incluindo eliminadas
curl -X GET "http://localhost:3000/vendas/cliente/789?page=2&limit=50&incluirEliminadas=true"
```

### Exemplo de Resposta

```json
{
  "mensagem": "Compras do cliente consultadas com sucesso",
  "cliente": {
    "codigoCadastro": 789,
    "codigoCliente": 456,
    "nomeCompleto": "João Silva Santos",
    "cpfCnpj": "123.456.789-00",
    "tipoPessoa": "Física",
    "clienteAtivo": true
  },
  "relacionamentosUtilizados": [
    "Venda.CodigoCadastro → Cadastro.CodigoCadastro (cliente)",
    "Venda.CodigoFuncionario → Funcionario.CodigoFuncionario (vendedor)",
    "Venda.CodigoConvenio → Convenio.CodigoConvenio (convênio)",
    "Venda.CodigoLancamento → Lancamento.CodigoLancamento (auditoria)",
    "Venda_Produto.CodigoVenda → Venda.CodigoVenda (itens)",
    "Venda_Produto.CodigoProduto → Produto.CodigoProduto (produto)",
    "Venda_FP.CodigoVenda → Venda.CodigoVenda (forma pagamento)",
    "Produto_Estoque.CodigoProduto → Produto.CodigoProduto (estoque atual)"
  ],
  "resumo": {
    "totalVendas": 45,
    "totalBruto": 5432.50,
    "totalDesconto": 234.10,
    "totalLiquido": 5198.40,
    "dataUltimaCompra": "2026-05-08T14:30:00.000Z",
    "dataPrimeiraCompra": "2023-01-15T09:00:00.000Z",
    "totalEmpresas": 2,
    "totalFuncionarios": 3
  },
  "paginacao": {
    "pagina": 1,
    "limite": 20,
    "vendasNaPagina": 20,
    "incluirEliminadas": false
  },
  "vendas": [
    {
      "codigoVenda": 9001,
      "dataVenda": "2026-05-08T14:30:00.000Z",
      "status": "Finalizada",
      "eliminado": false,
      "totalBruto": 350.00,
      "totalDesconto": 17.50,
      "totalLiquido": 332.50,
      "vendedor": {
        "codigoFuncionario": 5,
        "nomeFuncionario": "Maria Oliveira"
      },
      "convenio": {
        "codigoConvenio": 12,
        "nomeConvenio": "Unimed"
      },
      "formaPagamento": {
        "codigoFormaPagamento": 2,
        "nomeFormaPagamento": "Cartão de Crédito"
      },
      "auditoria": {
        "codigoLancamento": 50001,
        "dataLancamento": "2026-05-08T14:30:00.000Z",
        "codigoUsuario": 1,
        "nomeUsuario": "Sistema",
        "codigoEstacao": 1
      },
      "itens": [
        {
          "codigoVendaID": 1001,
          "codigoProduto": 2001,
          "nomeProduto": "Dipirona 500mg",
          "quantidade": 2,
          "precoUnitario": 150.00,
          "descontoUnitario": 7.50,
          "totalItem": 300.00,
          "totalDescontoItem": 15.00,
          "estoqueAtual": 45,
          "precoTabelaAtual": 155.00,
          "precoPromocionalAtual": 148.00,
          "produtoAtivoNoEstoque": true
        },
        {
          "codigoVendaID": 1002,
          "codigoProduto": 2002,
          "nomeProduto": "Complexo B",
          "quantidade": 1,
          "precoUnitario": 50.00,
          "descontoUnitario": 2.50,
          "totalItem": 50.00,
          "totalDescontoItem": 2.50,
          "estoqueAtual": 120,
          "precoTabelaAtual": 52.00,
          "precoPromocionalAtual": 49.50,
          "produtoAtivoNoEstoque": true
        }
      ]
    }
  ]
}
```

---

## 3. Análise de Relacionamentos - Tabelas Principais

### Tabela: `Cadastro` (Entidade Raiz)
**Descrição:** Registro único de todas as pessoas (físicas/jurídicas) do sistema

| Campo | Relaciona com | Tipo |
|-------|---------------|------|
| `CodigoCadastro` | PK - Identificador único | PK |
| `CodigoEmpresa` | Config | FK |
| `CPFCNPJ` | Identificação (CPF ou CNPJ) | Campo |
| `Nome` | Nome da pessoa/empresa | Campo |
| `Pessoa` | 1=Física, 2=Jurídica | Campo |
| `Eliminado` | Marcação de exclusão lógica | Campo |

**Especialições:**
- Cliente (CodigoCadastro → Cliente)
- Funcionario (CodigoCadastro → Funcionario)
- Fornecedor (CodigoCadastro → Fornecedor)

### Tabela: `Venda` (Fato Central de Vendas)
**Descrição:** Cabeçalho de cada transação de venda/compra

| Campo | Relaciona com | Tipo | Descrição |
|-------|---------------|------|-----------|
| `CodigoVenda` | PK | PK | Identificador único |
| `CodigoCadastro` | Cadastro | FK | Quem comprou |
| `CodigoFuncionario` | Funcionario | FK | Quem vendeu |
| `CodigoConvenio` | Convenio | FK | Plano/convênio (opcional) |
| `CodigoLancamento` | Lancamento | FK | Auditoria |
| `DataVenda` | Campo | - | Quando vendeu |
| `TotalBruto` | Cálculo | - | Valor sem desconto |
| `TotalDesconto` | Cálculo | - | Desconto aplicado |
| `TotalLiquido` | Cálculo | - | Valor final |
| `Eliminado` | Flag | - | 0=Ativa, 1=Cancelada |

### Tabela: `Venda_Produto` (Detalhamento)
**Descrição:** Itens (linhas) da venda

| Campo | Relaciona com | Tipo |
|-------|---------------|------|
| `CodigoVenda` | Venda | FK |
| `CodigoProduto` | Produto | FK |
| `Quantidade` | Número | - |
| `PrecoUnitario` | Preço | - |
| `DescontoUnitario` | Desconto | - |
| `Total` | Cálculo | - |

### Tabela: `Lancamento` (Auditoria)
**Descrição:** Registro de toda ação/transação no sistema

| Campo | Relaciona com | Tipo | Descrição |
|-------|---------------|------|-----------|
| `CodigoLancamento` | PK | PK | Identificador único |
| `CodigoEmpresa` | Config | FK | Qual empresa |
| `DataLancamento` | DateTime | - | Quando aconteceu |
| `CodigoUsuario` | Usuario | FK | Quem fez |
| `CodigoEstacao` | Config_Estacao | FK | Onde fez |

### Tabela: `Produto` (Catálogo)
**Descrição:** Produtos (medicamentos, cosméticos, correlatos)

| Campo | Descrição |
|-------|-----------|
| `CodigoProduto` | Identificador único |
| `NomeProduto` | Nome comercial |
| `CodigoGrupo` | Categoria (remédio, cosmético...) |
| `Fabricante` | Laboratório |
| `NCM` | Classificação fiscal |
| `CodigoBarras` | EAN/GTIN |

### Tabela: `Fidelidade` (Programa de Pontos)
**Descrição:** Cartão/conta de cliente no programa de fidelidade

| Campo | Relaciona com | Descrição |
|-------|---------------|-----------|
| `CodigoFidelidade` | PK | Identificador único |
| `CodigoCadastro` | Cadastro | Qual cliente |
| `Ativo` | Flag | Se ainda vale |

### Tabela: `Fidelidade_Resgate` (Fatos de Resgate)
**Descrição:** Eventos de resgate de pontos

| Campo | Relaciona com | Descrição |
|-------|---------------|-----------|
| `CodigoResgate` | PK | Identificador único |
| `CodigoFidelidade` | Fidelidade | Qual cliente |
| `CodigoLancamento` | Lancamento | Quando/quem fez |
| `Pontos` | Campo | Quantos pontos usados |

---

## 4. Fluxos de Consulta

### Fluxo 1: Localizar Cliente por CPFCNPJ
```
ENTRADA: CPFCNPJ (com ou sem máscara)
   ↓
LIMPEZA: Remove máscara (pontos, barras, hífens)
   ↓
VALIDAÇÃO: Verifica se tem 11 (CPF) ou 14 (CNPJ) dígitos
   ↓
BUSCA: SELECT FROM Cadastro WHERE CPFCNPJ = X
   ↓
JOIN: LEFT JOIN Cliente ON Cliente.CodigoCadastro = Cadastro.CodigoCadastro
   ↓
RETORNO: CodigoCadastro, CodigoCliente, Nome, CPFCNPJ, Pessoa, Ativo
```

### Fluxo 2: Buscar Resgates do Cliente
```
ENTRADA: CodigoCadastro do cliente
   ↓
BUSCA: SELECT FROM Fidelidade WHERE CodigoCadastro = X
   ↓
BUSCA: SELECT FROM Fidelidade_Resgate WHERE CodigoFidelidade IN (...)
   ↓
BUSCA: SELECT FROM Fidelidade_Resgate_Premio WHERE CodigoResgate IN (...)
   ↓
BUSCA: SELECT FROM Fidelidade_Resgate_Ponto WHERE CodigoResgate IN (...)
   ↓
JOIN: Lancamento para auditoria (DataLancamento, CodigoEstacao)
   ↓
CONSOLIDAÇÃO: Agrupa resgates com prêmios e origem
   ↓
RETORNO: Estrutura hierárquica
```

### Fluxo 3: Buscar Compras do Cliente
```
ENTRADA: CodigoCadastro do cliente
   ↓
BUSCA: SELECT FROM Venda WHERE CodigoCadastro = X
   ↓
BUSCA: SELECT FROM Venda_Produto WHERE CodigoVenda IN (...)
   ↓
BUSCA: SELECT FROM Venda_FP WHERE CodigoVenda IN (...) [forma pagamento]
   ↓
JOINS:
  ├─ Produto: Detalhes do produto
  ├─ Funcionario: Quem vendeu
  ├─ Convenio: Plano de saúde
  ├─ Lancamento: Auditoria
  └─ Usuario: Quem lançou
   ↓
PAGINAÇÃO: Aplica LIMIT/OFFSET
   ↓
CONSOLIDAÇÃO: Agrupa vendas com itens
   ↓
RETORNO: Estrutura com paginação
```

---

## 5. Tratamento de Erros

### 400 - Bad Request (Identificador inválido)
```json
{
  "erro": "Identificador inválido",
  "mensagem": "Forneça CodigoCadastro, CodigoCliente ou CPFCNPJ"
}
```

### 404 - Not Found (Cliente não encontrado)
```json
{
  "erro": "Cliente não encontrado",
  "identificador": "valor_fornecido",
  "mensagem": "Nenhum cliente encontrado com este identificador"
}
```

### 500 - Internal Server Error
```json
{
  "erro": "Erro ao consultar resgates de fidelidade",
  "mensagem": "[detalhes técnicos do erro]"
}
```

---

## 6. Informações Técnicas

### Performance
- **Índices utilizados:**
  - `Venda.CodigoCadastro` (filtragem primária)
  - `Venda.DataVenda DESC` (ordenação)
  - `Lancamento.DataLancamento` (ordenação de auditoria)
  - `Fidelidade.CodigoCadastro` (busca de fidelidade)

- **Paginação:**
  - Implementada via `ROW_NUMBER() OVER (ORDER BY ...)`
  - Limite máximo de 200 itens por página
  - Padrão: 20 itens por página

### Segurança de Dados
- Remoção de máscara de CPFCNPJ ocorre no servidor (não confiar no cliente)
- Validação de comprimento de dígitos (11 para CPF, 14 para CNPJ)
- Soft delete: campo `Eliminado` preserva histórico

### Padrão de Resposta
Todas as respostas seguem a estrutura:
```json
{
  "mensagem": "Descrição do sucesso",
  "cliente": { ... },
  "resumo": { ... },
  "relacionamentosUtilizados": [ ... ],
  "dados": { ... }
}
```

---

## 7. Exemplos de Casos de Uso

### Caso 1: Auditar um cliente
**Pergunta:** "Quem é o cliente 123? Qual seu CPF?"
**Solução:**
```bash
curl "http://localhost:3000/vendas/cliente/123?limit=1"
# Retorna CodigoCadastro, Nome, CPFCNPJ, TipoPessoa
```

### Caso 2: Verificar histórico de resgates
**Pergunta:** "Quantos pontos o cliente XXX.XXX.XXX-XX resgatou nos últimos 6 meses?"
**Solução:**
```bash
curl "http://localhost:3000/fidelidade-resgate/cliente/XXX.XXX.XXX-XX"
# Retorna totalPontosResgatados no resumo
```

### Caso 3: Listar todas as compras
**Pergunta:** "Listar 50 últimas compras do cliente em páginas de 25 itens"
**Solução:**
```bash
# Página 1
curl "http://localhost:3000/vendas/cliente/789?page=1&limit=25"

# Página 2
curl "http://localhost:3000/vendas/cliente/789?page=2&limit=25"
```

### Caso 4: Buscar itens de uma compra específica
**Pergunta:** "Quais produtos o cliente comprou em 2026?"
**Solução:**
```bash
curl "http://localhost:3000/vendas/cliente/XXX.XXX.XXX-XX?limit=100"
# Filtra response.vendas[*].dataVenda para período desejado
# Retorna array completo de itens em vendas[*].itens[*]
```

---

## 8. Conclusão

As APIs foram ajustadas para:

✅ **Aceitar múltiplos identificadores** (CodigoCadastro, CodigoCliente, CPFCNPJ)  
✅ **Retornar dados estruturados** com relacionamentos explícitos  
✅ **Incluir auditoria completa** (quem fez, quando, em qual estação)  
✅ **Suportar paginação** para grandes volumes de dados  
✅ **Documentar relacionamentos** conforme análise do banco  

**Próximas ações sugeridas:**
- Adicionar filtros por data (periodoInicio, periodoFim)
- Criar endpoint de resumo por período (mês, trimestre, ano)
- Implementar cache para cliente anônimo (sem relação comercial)
- Adicionar ordenação customizável (por data, valor, produto, vendedor)

---

*Documento gerado em Maio/2026*  
*Análise baseada em documentação técnica INOVAFARMA_DPOPPARA*
