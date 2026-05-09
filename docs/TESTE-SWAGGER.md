# 🧪 Guia Rápido de Testes - Swagger UI

## 🚀 Como Testar em 30 Segundos

### Passo 1: Abra o Swagger
```bash
# Opção A: Abra no navegador
docs/index.html

# Opção B: Ou acesse via HTTP
http://localhost:3000/api-docs
```

### Passo 2: Clique no Endpoint
- Clique em **"GET /fidelidade-resgate/cliente/{identificador}"** ou
- Clique em **"GET /vendas/cliente/{identificador}"**

### Passo 3: Clique em "Try it out"

### Passo 4: Cole o Identificador

### Passo 5: Clique em "Execute"

---

## 📋 Exemplos para Copiar & Colar

### ✅ Teste 1: Buscar por CPF com Máscara
**Endpoint:** `GET /fidelidade-resgate/cliente/{identificador}`

**Identificador:**
```
123.456.789-00
```

**Resultado esperado:** 
- Status 200 (sucesso) ou 404 (não encontrado)
- Dados do cliente e resgates

---

### ✅ Teste 2: Buscar por CPF sem Máscara
**Endpoint:** `GET /vendas/cliente/{identificador}`

**Identificador:**
```
12345678901
```

**Resultado esperado:**
- Status 200 (sucesso) ou 404 (não encontrado)
- Histórico completo de compras

---

### ✅ Teste 3: Buscar por CodigoCliente
**Endpoint:** `GET /fidelidade-resgate/cliente/{identificador}`

**Identificador:**
```
123
```

**Resultado esperado:**
- Status 200 (sucesso) ou 404 (não encontrado)
- Lista de resgates

---

### ✅ Teste 4: Buscar por CodigoCadastro
**Endpoint:** `GET /vendas/cliente/{identificador}`

**Identificador:**
```
456
```

**Resultado esperado:**
- Status 200 (sucesso) ou 404 (não encontrado)
- Vendas totais e detalhes

---

### ✅ Teste 5: CNPJ com Máscara
**Endpoint:** `GET /vendas/cliente/{identificador}`

**Identificador:**
```
12.345.678/0001-00
```

**Resultado esperado:**
- Status 200 (sucesso) ou 404 (não encontrado)
- Dados da empresa

---

### ✅ Teste 6: Paginação
**Endpoint:** `GET /vendas/cliente/{identificador}`

**Identificador:**
```
123
```

**Query Parameters:**
- `page` = `1`
- `limit` = `10`

**Resultado esperado:**
- 10 vendas por página

---

## 🎯 Respostas Esperadas

### Sucesso (200)
```json
{
  "cliente": {
    "codigoCliente": 123,
    "codigoCadastro": 456,
    "nome": "João da Silva",
    "cpfCnpj": "123.456.789-00",
    "tipoPessoa": "Física",
    "ativo": true
  },
  "totalResgates": 5,
  "resgates": [...]
}
```

### Cliente Não Encontrado (404)
```json
{
  "erro": "Cliente não encontrado",
  "codigo": 404
}
```

### Identificador Inválido (400)
```json
{
  "erro": "Identificador inválido. Deve ser CodigoCliente, CPFCNPJ ou CodigoCadastro",
  "codigo": 400
}
```

---

## 🔍 O Que Procurar na Resposta

### Endpoint: Fidelidade
- ✅ **cliente.nome** - Nome do cliente
- ✅ **cliente.cpfCnpj** - CPF/CNPJ formatado
- ✅ **totalResgates** - Quantos resgates fez
- ✅ **totalPontosResgatados** - Total de pontos
- ✅ **resgates[].dataResgate** - Data do resgate
- ✅ **resgates[].pontos** - Pontos resgatados

### Endpoint: Vendas
- ✅ **cliente.nome** - Nome do cliente
- ✅ **dataPrimeiraCompra** - Primeira compra
- ✅ **dataultimaCompra** - Última compra
- ✅ **totalCompras** - Valor total gasto
- ✅ **quantidadeVendas** - Número de compras
- ✅ **vendas[].vendedor.nome** - Quem vendeu ✨ NOVO
- ✅ **vendas[].convenio.nome** - Plano de saúde ✨ NOVO
- ✅ **vendas[].formaPagamento.descricao** - Como pagou ✨ NOVO
- ✅ **vendas[].auditoria** - Data/hora/usuário ✨ NOVO

---

## 🛠️ Troubleshooting

### Problema: "Identificador inválido"
**Solução:** Verifique o formato
- Números apenas? → CodigoCliente ou CodigoCadastro
- 11 ou 14 dígitos? → CPFCNPJ sem máscara
- Tem pontos/barras? → CPFCNPJ com máscara

### Problema: "Cliente não encontrado"
**Solução:** 
- Verifique se o cliente existe no banco
- Teste com um identificador conhecido
- Consulte `testes-apis-ajustadas.sh`

### Problema: Sem resposta
**Solução:**
- Verifique se servidor está rodando: `npm run dev`
- Verifique se banco SQL Server está conectado
- Verifique logs: `npm run dev` (veja console)

---

## 📱 Testando via cURL (Alternativa)

```bash
# Fidelidade
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/123.456.789-00"

# Vendas
curl -X GET "http://localhost:3000/vendas/cliente/123"

# Com pretty-print (se tiver jq)
curl "http://localhost:3000/vendas/cliente/123" | jq '.'
```

---

## ✨ Dicas Profissionais

1. **Copie o cURL gerado**
   - No Swagger UI, após executar, clique em "Copy cURL"
   - Use em scripts de automação

2. **Teste paginação**
   - Para grandes datasets, use `page` e `limit`
   - Padrão: 50 registros por página

3. **Verifique auditoria**
   - Em vendas, veja quem, quando e onde
   - Campo `auditoria` tem tudo

4. **Salve as respostas**
   - Copie o JSON de resposta
   - Use para análise posterior
   - Compare mudanças ao longo do tempo

---

## 📊 Checklist de Teste

- [ ] Abri o Swagger UI com sucesso
- [ ] Testei busca por CPF com máscara
- [ ] Testei busca por CPF sem máscara
- [ ] Testei busca por CodigoCliente
- [ ] Testei busca por CodigoCadastro
- [ ] Testei paginação
- [ ] Vi dados de vendedor na resposta ✨
- [ ] Vi dados de convênio na resposta ✨
- [ ] Vi dados de auditoria na resposta ✨
- [ ] Copiei um cURL para usar depois
- [ ] Todos os 6 testes passaram ✅

---

## 🎯 Próximo Passo

1. **Testes manuais OK?** → Execute: `bash testes-apis-ajustadas.sh`
2. **Tudo verde?** → APIs prontas para produção ✅
3. **Precisa de mais?** → Veja `EXEMPLOS-PRATICOS.md`

---

**Versão:** 1.0.0  
**Data:** Maio 8, 2026  
**Status:** ✅ Pronto para usar
