# ⚡ GUIA RÁPIDO - Comece em 5 minutos

## 1️⃣ Verifique se a API está rodando

```bash
curl -s http://localhost:3000/vendas/cliente/1 | head -c 100
```

**Se receber JSON:** ✅ API está rodando  
**Se receber "Connection refused":** ❌ Inicie a API primeiro

---

## 2️⃣ Teste a busca por CPFCNPJ (NOVO)

### Teste A: Com máscara
```bash
curl -s "http://localhost:3000/fidelidade-resgate/cliente/123.456.789-00" | jq '.cliente'
```

### Teste B: Sem máscara
```bash
curl -s "http://localhost:3000/fidelidade-resgate/cliente/12345678901234" | jq '.cliente'
```

### Teste C: Número (compatível)
```bash
curl -s "http://localhost:3000/fidelidade-resgate/cliente/456" | jq '.cliente'
```

---

## 3️⃣ Teste as COMPRAS com novos relacionamentos

```bash
# Listar compras com detalhes de vendedor, convênio, forma pagto, auditoria
curl -s "http://localhost:3000/vendas/cliente/789?limit=5" | jq '.vendas[0]'
```

**Você deve ver:**
- ✅ vendedor { codigoFuncionario, nomeFuncionario }
- ✅ convenio { codigoConvenio, nomeConvenio }
- ✅ formaPagamento { codigoFormaPagamento, nomeFormaPagamento }
- ✅ auditoria { codigoLancamento, dataLancamento, codigoUsuario, nomeUsuario, codigoEstacao }

---

## 4️⃣ Rode a suite de testes (recomendado)

```bash
# Executar testes automatizados
bash testes-apis-ajustadas.sh
```

**Resultado esperado:**
```
✓ PASS - Busca por CodigoCliente
✓ PASS - Busca por CPFCNPJ com máscara
✓ PASS - Retorna informações do vendedor
✓ PASS - Retorna dados de auditoria
...
Testes Passados: 25
Testes Falhados: 0
Percentual de Sucesso: 100%
✓ TODOS OS TESTES PASSARAM!
```

---

## 5️⃣ Exemplos Reais (copie e cole)

### Exemplo 1: Auditar cliente por CPF

```bash
#!/bin/bash
CPF="123.456.789-00"

echo "Buscando cliente por CPF: $CPF"
curl -s "http://localhost:3000/vendas/cliente/$CPF" | jq '{
  cliente: .cliente,
  totalCompras: .resumo.totalVendas,
  valorTotal: .resumo.totalLiquido,
  ultimaCompra: .resumo.dataUltimaCompra
}'
```

### Exemplo 2: Validar resgates de fidelidade

```bash
#!/bin/bash
CPF="123.456.789-00"

echo "Consultando fidelidade..."
curl -s "http://localhost:3000/fidelidade-resgate/cliente/$CPF" | jq '{
  cliente: .cliente.nome,
  totalResgates: .resumo.totalResgates,
  pontosResgatados: .resumo.totalPontosResgatados,
  ultimoResgate: .resgates[0].dataLancamento
}'
```

### Exemplo 3: Listar vendedores com mais vendas

```bash
#!/bin/bash
CPF="123.456.789-00"

echo "Analisando vendedores..."
curl -s "http://localhost:3000/vendas/cliente/$CPF?limit=100" | jq '
  .vendas 
  | map(.vendedor.nomeFuncionario) 
  | group_by(.) 
  | map({vendedor: .[0], vendas: length}) 
  | sort_by(.vendas) 
  | reverse
'
```

---

## 🎯 Checklist de Validação

- [ ] API responde em http://localhost:3000
- [ ] Busca por CPFCNPJ com máscara funciona
- [ ] Busca por CPFCNPJ sem máscara funciona
- [ ] Retorna dados de vendedor (funcionário)
- [ ] Retorna dados de convênio
- [ ] Retorna forma de pagamento
- [ ] Retorna dados de auditoria
- [ ] Testes passam sem erros
- [ ] Documentação foi consultada

---

## 📖 Documentação

Se precisar de mais detalhes, consulte:

| Situação | Arquivo | Linha |
|----------|---------|-------|
| "Como funciona a API?" | `API-AJUSTADO-RELACIONAMENTOS.md` | ⭐ Comece aqui |
| "Quais foram as mudanças?" | `RESUMO-IMPLEMENTACOES.md` | Mudanças técnicas |
| "Me mostra exemplos práticos" | `EXEMPLOS-PRATICOS.md` | 8 cenários reais |
| "Como testar?" | `testes-apis-ajustadas.sh` | Script pronto |
| "Resumo geral" | `ENTREGA-FINAL.md` | Visão executiva |

---

## ❓ Problemas Comuns

### "404 - Cliente não encontrado"
```bash
# Verifique se o CPFCNPJ existe no banco
# Tente com um CodigoCliente conhecido
curl "http://localhost:3000/vendas/cliente/1"
```

### "400 - CPFCNPJ inválido"
```bash
# CPFCNPJ deve ter:
# - 11 dígitos (CPF)
# - 14 dígitos (CNPJ)
# Remova máscara se não funcionar

# ❌ Errado: 123.456.789-0 (10 dígitos)
# ✅ Correto: 123.456.789-00 (11 dígitos)
```

### "500 - Erro interno"
```bash
# Verifique logs da API:
# 1. Banco de dados está rodando?
# 2. Variáveis de ambiente estão definidas?
# 3. Índices do banco estão atualizados?
```

---

## 💻 Uma Linha de Teste

```bash
# Teste rápido - retorna cliente ou erro
curl -s "http://localhost:3000/vendas/cliente/123.456.789-00" | jq '.cliente.nome'
```

---

## 🚀 Próximos Passos

1. **Rode os testes:** `bash testes-apis-ajustadas.sh`
2. **Leia a documentação:** `API-AJUSTADO-RELACIONAMENTOS.md`
3. **Experimente os exemplos:** Copie do `EXEMPLOS-PRATICOS.md`
4. **Integre em seu sistema:** Use a API com confiança!

---

## 📞 Dúvidas?

Consulte `API-AJUSTADO-RELACIONAMENTOS.md` seção **7. Tratamento de Erros** para respostas em JSON.

---

**Bon Appétit! 🎉**

*Suas APIs estão prontas para usar com 4 formas diferentes de buscar cliente e com todos os relacionamentos documentados!*
