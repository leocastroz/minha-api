# Análise Completa: Por que o USUARIO TESTE POSTMAN não aparece no Painel de Clientes

## Diagnóstico

### Servidor SQL Server: 100.102.124.30:1433
- **Banco principal**: INOVAFARMA_DPOPPARA
- **Total de tabelas**: 547
- **Relacionamentos FK**: 852
- **Relacionamentos para Cadastro**: 19

---

## Achados Principais

### 1. Tabela Cadastro (Estrutura)
- **Total de colunas**: 18
- **Colunas críticas**:
  - `CodigoCadastro` (int, PK)
  - `CodigoLancamento` (bigint)
  - `Nome` (varchar 80)
  - `CPFCNPJ` (varchar 18)
  - `Eliminado` (bit) — valores encontrados: false (23.325), true (2)
  - `Pessoa` (tinyint) — valores: 1 (20.927), 2 (2.400)

### 2. Relação com dbo.Cliente (ACHADO CRÍTICO)

| Cadastro | Nome | Existe em Cliente? | Aparece no Painel? |
|----------|------|-------------------|-------------------|
| 180430901 | LEONARDO SILVA CASTRO2 | ✅ SIM | ✅ ✅ SIM |
| 180681501 | USUARIO TESTE POSTMAN | ❌ NÃO | ❌ ❌ NÃO |
| 180682001 | USUARIO TESTE POSTMAN 2 | ✅ SIM | ✅ ✅ SIM |

---

## CAUSA RAIZ

**O painel de clientes lista apenas registros presentes em `dbo.Cliente`, não apenas `dbo.Cadastro`.**

Quando um cadastro é criado no formulário que você usou, ele é inserido em `dbo.Cadastro`, mas **nem sempre** um registro correspondente é criado automaticamente em `dbo.Cliente`.

### O que aconteceu:
- **Primeiro cadastro**: USUARIO TESTE POSTMAN (180681501) foi criado em Cadastro, mas **não foi vinculado em Cliente**.
- **Segundo cadastro**: USUARIO TESTE POSTMAN 2 (180682001) foi criado em Cadastro E automaticamente registrado em Cliente (por isso aparece).
- **LEONARDO**: Existe em ambas as tabelas (por isso aparece).

---

## Estrutura de Cliente

A tabela `dbo.Cliente` possui os seguintes campos principais:

```
CodigoCliente (INT, PK)
CodigoCadastro (INT, FK → Cadastro)
CodigoTipo (INT)
Ativo (BIT) → {true, false}
Eliminado (BIT) → {true, false}
[... outros campos de configuração comercial ...]
```

---

## SOLUÇÃO

Para fazer o USUARIO TESTE POSTMAN (180681501) aparecer no painel, você precisa:

### Opção 1: Inserir registro automático em Cliente via Trigger ou Aplicação

Criar um trigger que, ao inserir em Cadastro, automatically insira em Cliente:

```sql
CREATE TRIGGER trg_auto_cliente_on_cadastro
ON INOVAFARMA_DPOPPARA.dbo.Cadastro
AFTER INSERT
AS
BEGIN
  INSERT INTO INOVAFARMA_DPOPPARA.dbo.Cliente (
    CodigoCadastro,
    CodigoTipo,
    LimiteCompra,
    Padrao,
    NFPaulista,
    Ativo,
    Eliminado,
    CalculaJuros,
    ConsumidorFinal,
    PermitirVendaPrazoPrecoPromocao,
    QuantidadeMaximaParcelas,
    VencimentoTipo,
    VencimentoDiasPrazo
  )
  SELECT
    inserted.CodigoCadastro,
    1,                    -- CodigoTipo = 1 (padrão)
    0,                    -- LimiteCompra padrão
    0,                    -- Padrao = false
    0,                    -- NFPaulista = false
    1,                    -- Ativo = true
    0,                    -- Eliminado = false
    1,                    -- CalculaJuros = true
    1,                    -- ConsumidorFinal = true
    1,                    -- PermitirVendaPrazoPrecoPromocao = true
    0,                    -- QuantidadeMaximaParcelas = 0
    1,                    -- VencimentoTipo = 1
    30                    -- VencimentoDiasPrazo = 30
  FROM inserted
  WHERE NOT EXISTS (
    SELECT 1 FROM INOVAFARMA_DPOPPARA.dbo.Cliente c
    WHERE c.CodigoCadastro = inserted.CodigoCadastro
  );
END
```

### Opção 2: Inserção Manual Imediata (Para 180681501)

Copiar os padrões do LEONARDO (180430901) e criar entrada para o usuario faltante:

```sql
INSERT INTO INOVAFARMA_DPOPPARA.dbo.Cliente (
  CodigoCadastro,
  CodigoTipo,
  LimiteCompra,
  Padrao,
  NFPaulista,
  Ativo,
  Eliminado,
  CalculaJuros,
  ConsumidorFinal,
  PermitirVendaPrazoPrecoPromocao,
  QuantidadeMaximaParcelas,
  VencimentoTipo,
  VencimentoDiasPrazo
)
VALUES (
  180681501,            -- USUARIO TESTE POSTMAN
  1,                    -- Tipo = Pessoa Física
  0,                    -- Limite = sem limite inicial
  0,                    -- Não é padrão
  0,                    -- Não é NFPaulista
  1,                    -- ATIVO = true (crítico para aparecer!)
  0,                    -- Não eliminado
  1,                    -- Calcula juros
  1,                    -- Consumidor final
  1,                    -- Permite venda prazo com preço promoção
  0,                    -- Sem limite de parcelas
  1,                    -- Tipo de vencimento = 1 (final)
  30                    -- Prazo de 30 dias
)
```

### Opção 3: Ajustar seu Endpoint de Cadastro (Recomendado)

Modificar a rota POST de cadastro para criar automaticamente o registro em Cliente após criar em Cadastro.

---

## Campos Críticos em Cliente para Aparecer no Painel

1. **CodigoCadastro**: Referência obrigatória
2. **Ativo = true**: Se estiver false, pode não aparecer (depende do filtro do painel)
3. **Eliminado = false**: Se true, será ocultado

---

## Checklist Para Validação

```sql
-- Confirmar que 180681501 apareça após aplicar a solução
SELECT
  c.CodigoCadastro,
  cad.Nome,
  c.CodigoCliente,
  c.Ativo,
  c.Eliminado
FROM INOVAFARMA_DPOPPARA.dbo.Cliente c
JOIN INOVAFARMA_DPOPPARA.dbo.Cadastro cad ON c.CodigoCadastro = cad.CodigoCadastro
WHERE c.CodigoCadastro IN (180430901, 180681501, 180682001)
ORDER BY c.CodigoCadastro
```

---

## Resumo Final

| Problema | Causa | Solução |
|----------|-------|---------|
| Cadastro existe em Cadastro mas não aparece no painel | Não existe registro correspondente em dbo.Cliente | Criar registro em Cliente com CodigoCadastro = 180681501 e Ativo = true |
| Inconsistência entre cadastros | Criação de Cadastro não dispara criação automática em Cliente | Implementar Trigger ou modificar endpoint POST para criar ambos automaticamente |

