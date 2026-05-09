# 📋 API de Resgates de Fidelidade - Documentação Técnica

## Visão Geral

A API de resgates de fidelidade retorna todos os prêmios resgatados por um cliente, seguindo o padrão arquitetônico de **Tabela Fato Centralizada** com relacionamentos completos entre as camadas operacionais e transacionais.

---

## 🔗 Arquitetura de Relacionamentos

```
┌─────────────────────────────────────────────────────────────┐
│ CAMADA OPERACIONAL (Âncora)                                 │
│ Tabela: Lancamento                                          │
│ ├─ CodigoLancamento (PK)                                    │
│ ├─ DataLancamento                                           │
│ ├─ CodigoUsuario (Auditoria)                                │
│ ├─ CodigoEstacao (Auditoria)                                │
│ └─ CodigoEmpresa (Multi-tenant)                             │
└─────────────────────────────────────────────────────────────┘
                           ↓ 1:1 ou N:1
┌─────────────────────────────────────────────────────────────┐
│ CAMADA TRANSACIONAL (Fato Central)                          │
│ Tabela: Fidelidade_Resgate                                 │
│ ├─ CodigoResgate (PK)                                       │
│ ├─ CodigoLancamento (FK) ────→ Lancamento                  │
│ ├─ CodigoCadastro                                           │
│ ├─ Pontos (Total resgatado)                                 │
│ └─ Observacao                                               │
└─────────────────────────────────────────────────────────────┘
    ├────────────────────┬────────────────────┬───────────────┐
    ↓ N:1               ↓ N:1               ↓ N:1            ↓ N:1
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐
│Fidelidade_   │ │Fidelidade_   │ │Fidelidade_   │ │Fidelidade_Resgate │
│Resgate_      │ │Resgate_      │ │Resgate_      │ │_Lancamento        │
│Premio        │ │Ponto         │ │Lancamento    │ │                   │
│              │ │              │ │              │ │                   │
│ CodigoPremio │ │ CodigoFidel. │ │CodigoVenda   │ │ CodigoVenda (FK) │
│ Quantidade   │ │ Pontos       │ │              │ │ → Venda           │
│ Pontos (hist)│ │ DataOrigem   │ │              │ │                   │
└──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘
```

---

## 📍 Endpoint

### GET /fidelidade-resgate/cliente/:codigoCliente

Retorna todos os resgates de prêmios de um cliente específico.

#### Parâmetros

| Parâmetro | Tipo | Localização | Obrigatório | Descrição |
|-----------|------|-------------|-------------|-----------|
| `codigoCliente` | integer | Path | ✅ Sim | Identificador único do cliente |
| `incluirDetalhes` | boolean | Query | ❌ Não | Incluir origemPontos e vinculoComercial (default: true) |

#### Query Parameters

```bash
# Incluir detalhes completos (default)
GET /fidelidade-resgate/cliente/123

# Apenas informações principais
GET /fidelidade-resgate/cliente/123?incluirDetalhes=false
```

---

## 📤 Resposta de Sucesso (200 OK)

```json
{
  "mensagem": "Resgates de fidelidade consultados com sucesso",
  "cliente": {
    "codigoCliente": 123,
    "codigoCadastro": 456789,
    "ativo": true
  },
  "resumo": {
    "totalResgates": 5,
    "totalPontosResgatados": 1250,
    "totalPremios": 8,
    "periodoAnalisado": {
      "inicio": "2025-01-15T10:30:00Z",
      "fim": "2026-05-08T14:45:00Z"
    }
  },
  "resgates": [
    {
      "codigoResgate": 1001,
      "codigoLancamento": 50001,
      "dataLancamento": "2026-05-08T14:45:00Z",
      "pontosResgate": 500,
      "observacao": "Resgate de prêmios diversos",
      "auditoria": {
        "codigoUsuario": "USR_ADMIN_001",
        "codigoEstacao": "EST_PDV_002"
      },
      "premios": [
        {
          "codigoPremio": 10,
          "nomePremio": "Voucher R$ 50",
          "pontos": 300,
          "quantidade": 1,
          "total": 300,
          "premioAtivo": true
        },
        {
          "codigoPremio": 20,
          "nomePremio": "Brinde Especial",
          "pontos": 200,
          "quantidade": 2,
          "total": 400,
          "premioAtivo": true
        }
      ],
      "origemPontos": [
        {
          "codigoFidelidade": 5,
          "descricaoFidelidade": "Compras acumuladas",
          "pontosUtilizados": 250,
          "dataOrigem": "2025-06-10T00:00:00Z"
        },
        {
          "codigoFidelidade": 8,
          "descricaoFidelidade": "Programa referência",
          "pontosUtilizados": 250,
          "dataOrigem": "2025-08-22T00:00:00Z"
        }
      ],
      "vinculoComercial": [
        {
          "codigoVenda": 9001,
          "dataVenda": "2026-05-08T14:45:00Z",
          "totalVenda": 1500.00,
          "descricaoVenda": "Compra utilizando desconto em pontos"
        }
      ]
    }
  ]
}
```

### Estrutura de Dados Detalhada

#### Cliente
- `codigoCliente`: ID do cliente (from Cliente table)
- `codigoCadastro`: ID do cadastro vinculado (from Cadastro table)
- `ativo`: Status do cliente

#### Resumo
- `totalResgates`: Quantidade de resgates realizados
- `totalPontosResgatados`: Soma de todos os pontos utilizados
- `totalPremios`: Quantidade total de prêmios resgatados
- `periodoAnalisado`: Data do primeiro e último resgate

#### Resgate (N registros)
- `codigoResgate`: ID único do resgate (FK para Fidelidade_Resgate)
- `codigoLancamento`: ID do lançamento (FK para Lancamento - Âncora)
- `dataLancamento`: Data/hora do resgate
- `pontosResgate`: Total de pontos utilizados neste resgate
- `observacao`: Campo livre para notas

**Auditoria** (from Lancamento)
- `codigoUsuario`: Usuário que realizou o resgate
- `codigoEstacao`: Terminal/PDV onde foi realizado

**Prêmios** (from Fidelidade_Resgate_Premio)
- `codigoPremio`: ID do prêmio
- `nomePremio`: Nome descritivo
- `pontos`: Custo em pontos (histórico)
- `quantidade`: Unidades resgatadas
- `total`: Pontos × Quantidade
- `premioAtivo`: Status do prêmio no catálogo

**Origem dos Pontos** (from Fidelidade_Resgate_Ponto)
- `codigoFidelidade`: Regra de fidelidade que gerou os pontos
- `descricaoFidelidade`: Descrição da origem
- `pontosUtilizados`: Pontos desta origem que foram gastos
- `dataOrigem`: Quando os pontos foram creditados

**Vínculo Comercial** (from Fidelidade_Resgate_Lancamento)
- `codigoVenda`: Venda onde os pontos foram aplicados como desconto
- `dataVenda`: Data da compra
- `totalVenda`: Valor da transação
- `descricaoVenda`: Descrição da venda

---

## ❌ Respostas de Erro

### 400 - Parâmetro Inválido
```json
{
  "erro": "CodigoCliente inválido",
  "mensagem": "CodigoCliente deve ser um número válido"
}
```

### 404 - Cliente Não Encontrado
```json
{
  "erro": "Cliente não encontrado",
  "codigoCliente": 999
}
```

### 500 - Erro do Servidor
```json
{
  "erro": "Erro ao consultar resgates de fidelidade",
  "mensagem": "Descrição do erro técnico"
}
```

---

## 📝 Exemplos de Uso

### cURL
```bash
# Request básico
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/123"

# Com query parameters
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/123?incluirDetalhes=true"
```

### JavaScript/Fetch
```javascript
// Fetch com detalhes completos
const response = await fetch('/fidelidade-resgate/cliente/123');
const data = await response.json();

console.log(`Cliente tem ${data.resumo.totalResgates} resgates`);
console.log(`Total de pontos utilizados: ${data.resumo.totalPontosResgatados}`);

// Listar todos os prêmios resgatados
data.resgates.forEach(resgate => {
  console.log(`Resgate #${resgate.codigoResgate} (${resgate.dataLancamento})`);
  resgate.premios.forEach(premio => {
    console.log(`  - ${premio.nomePremio} (${premio.pontos} pontos)`);
  });
});
```

### Postman
1. Método: `GET`
2. URL: `{{BASE_URL}}/fidelidade-resgate/cliente/123`
3. Headers:
   - `Content-Type: application/json`
4. Params (opcional):
   - `incluirDetalhes=true`

---

## 🔄 Fluxo de Dados

1. **Validação**: Verifica se codigoCliente é um inteiro válido
2. **Lookup**: Busca CodigoCadastro a partir do CodigoCliente
3. **Fato Central**: Consulta Fidelidade_Resgate (com dados de Lancamento)
4. **Prêmios**: Consulta Fidelidade_Resgate_Premio
5. **Origem**: Consulta Fidelidade_Resgate_Ponto (com fallback se não existir)
6. **Vínculo**: Consulta Fidelidade_Resgate_Lancamento (com fallback se não existir)
7. **Consolidação**: Agrupa dados em estrutura hierárquica
8. **Resposta**: Retorna JSON estruturado

---

## ⚙️ Considerações de Performance

### Índices Recomendados
```sql
-- Índices para otimizar as consultas
CREATE INDEX IX_FidelidadeResgate_CodigoCadastro 
  ON Fidelidade_Resgate(CodigoCadastro, DataLancamento DESC);

CREATE INDEX IX_FidelidadeResgatePremio_CodigoResgate 
  ON Fidelidade_Resgate_Premio(CodigoResgate);

CREATE INDEX IX_FidelidadeResgatePonto_CodigoResgate 
  ON Fidelidade_Resgate_Ponto(CodigoResgate);

CREATE INDEX IX_FidelidadeResgateLancamento_CodigoResgate 
  ON Fidelidade_Resgate_Lancamento(CodigoResgate);

CREATE INDEX IX_Cliente_CodigoCliente 
  ON Cliente(CodigoCliente);
```

### Query Parameters para Otimização
- Use `incluirDetalhes=false` para respostas mais rápidas (omite origemPontos e vinculoComercial)
- Implementar paginação em grandes volumes de dados é recomendado (futuro enhancement)

---

## 🔐 Validações de Integridade

### Checklist Implementado
- ✅ Validação de tipo do parâmetro codigoCliente
- ✅ Busca de CodigoCadastro vinculado
- ✅ Campos de auditoria (CodigoUsuario, CodigoEstacao) capturados
- ✅ Normalização de valores numéricos para Number
- ✅ Tratamento de NULL values em relacionamentos

### Checklist Recomendado (Backend)
- [ ] Garantir integridade referencial (Cascade ou Soft Delete)
- [ ] Verificar se Pontos em Fidelidade_Resgate = SUM(Pontos em Fidelidade_Resgate_Premio)
- [ ] Confirmar preenchimento automático de auditoria via Middleware
- [ ] Validar permissões de acesso ao cliente (multi-tenant)

---

## 🚀 Melhorias Futuras

1. **Paginação**: Adicionar limit/offset para grandes volumes
2. **Filtros**: Período de data, status de prêmio, etc.
3. **Agregações**: Totais por período, categorias de prêmios, etc.
4. **Export**: CSV/PDF dos resgates
5. **Analytics**: Dashboard com trends de resgates

---

## 📞 Suporte Técnico

- Verificar logs em `[ERRO] GET /fidelidade-resgate/cliente/:codigoCliente`
- Validar conectividade com SQL Server (INOVAFARMA_DPOPPARA)
- Confirmar permissões de acesso às tabelas do banco de dados
