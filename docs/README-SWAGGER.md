# 📚 Documentação de APIs - Fidelidade & Vendas

## 🎯 Como Visualizar a Documentação Swagger

### Opção 1: Abrir HTML Localmente (Recomendado)
```bash
# Abra este arquivo no navegador
docs/index.html

# Ou use um servidor HTTP simples
cd docs
python -m http.server 8000
# Depois acesse: http://localhost:8000
```

### Opção 2: Usar Swagger Editor Online
1. Acesse: https://editor.swagger.io/
2. Clique em `File` → `Import File`
3. Selecione o arquivo `docs/swagger-apis.json`

### Opção 3: Integrar com Express (Swagger UI)
Se quiser integrar diretamente na sua aplicação Node.js:

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger-apis.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Acesse: http://localhost:3000/api-docs
```

---

## 📖 Estrutura da Documentação

### Arquivo: `swagger-apis.json`
- Especificação completa em formato OpenAPI 3.0.3
- Define 2 endpoints principais
- Inclui esquemas de requisição/resposta
- Exemplos reais de uso
- Tratamento de erros documentado

### Arquivo: `index.html`
- Interface visual Swagger UI
- Teste interativo dos endpoints
- Documentação em tempo real
- Suporta múltiplos navegadores

---

## 🔌 Endpoints Documentados

### 1️⃣ Resgates de Fidelidade
```
GET /fidelidade-resgate/cliente/{identificador}
```

**Parâmetros:**
- `identificador` (obrigatório): CodigoCliente, CodigoCadastro ou CPFCNPJ

**Exemplos:**
```bash
# Por CodigoCliente
curl http://localhost:3000/fidelidade-resgate/cliente/123

# Por CPFCNPJ com máscara
curl http://localhost:3000/fidelidade-resgate/cliente/123.456.789-00

# Por CPFCNPJ sem máscara
curl http://localhost:3000/fidelidade-resgate/cliente/12345678901
```

**Resposta Esperada:**
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
  "totalPontosResgatados": 2500,
  "resgates": [
    {
      "codigoResgate": 1001,
      "dataResgate": "2026-05-05T14:30:00Z",
      "pontos": 500,
      "premio": {
        "codigoPremio": 50,
        "descricao": "Voucher R$50"
      },
      "status": "Aprovado"
    }
  ]
}
```

---

### 2️⃣ Histórico de Compras
```
GET /vendas/cliente/{identificador}
```

**Parâmetros:**
- `identificador` (obrigatório): CodigoCadastro, CodigoCliente ou CPFCNPJ
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Registros por página (padrão: 50)

**Exemplos:**
```bash
# Por CodigoCadastro
curl http://localhost:3000/vendas/cliente/456

# Por CPFCNPJ formatado
curl http://localhost:3000/vendas/cliente/123.456.789-00

# Com paginação
curl "http://localhost:3000/vendas/cliente/123?page=2&limit=25"
```

**Resposta Esperada:**
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
  "dataPrimeiraCompra": "2023-01-15T08:00:00Z",
  "dataultimaCompra": "2026-05-08T15:45:00Z",
  "totalCompras": 15890.50,
  "quantidadeVendas": 42,
  "totalEmpresas": 3,
  "totalFuncionarios": 5,
  "vendas": [
    {
      "codigoVenda": 9001,
      "dataVenda": "2026-05-08T15:45:00Z",
      "valorTotal": 299.90,
      "vendedor": {
        "codigoFuncionario": 1,
        "nome": "Maria Santos"
      },
      "convenio": {
        "codigoConvenio": 10,
        "nome": "Unimed"
      },
      "formaPagamento": {
        "codigo": 1,
        "descricao": "Dinheiro"
      },
      "auditoria": {
        "dataLancamento": "2026-05-08T15:50:00Z",
        "codigoUsuario": 5,
        "nomeUsuario": "admin",
        "codigoEstacao": 1
      },
      "produtos": [
        {
          "codigoProduto": 100,
          "nome": "Dipirona 500mg",
          "quantidade": 2,
          "valorUnitario": 149.95
        }
      ]
    }
  ]
}
```

---

## ✅ Códigos de Resposta

| Código | Significado | Exemplo |
|--------|------------|---------|
| **200** | Sucesso | Dados retornados corretamente |
| **400** | Erro de validação | Identificador inválido |
| **404** | Não encontrado | Cliente não existe |
| **500** | Erro interno | Falha na conexão com banco |

---

## 🔐 Formatos Aceitos de Identificador

### CPFCNPJ
| Formato | Exemplo | Válido |
|---------|---------|--------|
| CPF com máscara | `123.456.789-00` | ✅ |
| CPF sem máscara | `12345678901` | ✅ |
| CNPJ com máscara | `12.345.678/0001-00` | ✅ |
| CNPJ sem máscara | `12345678901234` | ✅ |

### Códigos
| Tipo | Exemplo | Válido |
|------|---------|--------|
| CodigoCliente | `123` | ✅ |
| CodigoCadastro | `456` | ✅ |

---

## 🧪 Testando com cURL

### Teste Rápido - Fidelidade
```bash
curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/123" \
  -H "accept: application/json"
```

### Teste Rápido - Vendas
```bash
curl -X GET "http://localhost:3000/vendas/cliente/123.456.789-00" \
  -H "accept: application/json"
```

### Teste com jq (formatado)
```bash
curl "http://localhost:3000/vendas/cliente/123" | jq '.cliente'
curl "http://localhost:3000/fidelidade-resgate/cliente/123" | jq '.resgates'
```

---

## 🎨 Testando no Swagger UI

### Via `docs/index.html`
1. Abra `docs/index.html` no navegador
2. Clique no endpoint que quer testar
3. Clique em "Try it out"
4. Preencha o parâmetro `identificador`
5. Clique em "Execute"
6. Veja a resposta completa

### Via Swagger UI Express
Se configurado na aplicação:
1. Acesse `http://localhost:3000/api-docs`
2. Teste interativamente
3. Veja o cURL equivalente
4. Copie e use em produção

---

## 📊 Arquivos de Documentação

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Interface Swagger UI (abra no navegador) |
| `swagger-apis.json` | Especificação OpenAPI 3.0.3 |
| `README.md` | Este arquivo |
| `API-AJUSTADO-RELACIONAMENTOS.md` | Documentação técnica detalhada |
| `EXEMPLOS-PRATICOS.md` | Exemplos em múltiplas linguagens |
| `QUICK-START.md` | Guia rápido |

---

## 🚀 Integração com Aplicação Node.js

```javascript
// src/index.js
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../docs/swagger-apis.json');

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocument));

// Acesse em: http://localhost:3000/api-docs
```

Instale se não tiver:
```bash
npm install swagger-ui-express
```

---

## 💡 Dicas

1. **Teste primeiro via HTML** (não precisa instalar nada)
2. **Use cURL para automação** em scripts
3. **Use Swagger UI para exploração interativa**
4. **Leia API-AJUSTADO-RELACIONAMENTOS.md para detalhes**

---

## 📞 Suporte

- **Erro 400?** Verifique o formato do identificador
- **Erro 404?** Cliente não existe no banco
- **Erro 500?** Verifique conexão com SQL Server
- **Mais dúvidas?** Veja `QUICK-START.md`

---

**Versão:** 2.0.0  
**Última atualização:** Maio 8, 2026  
**Status:** ✅ Pronto para Produção
