# ✅ Checklist Técnico - Módulo de Fidelidade e Resgate

## 📋 Objetivo
Validar e garantir que a arquitetura do módulo de Fidelidade segue o padrão de **Tabela Fato Centralizada** conforme documentação técnica fornecida.

---

## 🏗️ FASE 1: Validação de Estrutura de Banco de Dados

### A. Tabelas Necessárias
- [ ] **Lancamento** - Registro mestre de movimentação (Livro Caixa/Log)
  - [ ] CodigoLancamento (PK)
  - [ ] CodigoEmpresa (Multi-tenant)
  - [ ] DataLancamento
  - [ ] CodigoUsuario (Auditoria)
  - [ ] CodigoEstacao (Auditoria)
  - Status: **VALIDAR EM BANCO**

- [ ] **Fidelidade_Resgate** - Cabeçalho do resgate (Fato Central)
  - [ ] CodigoResgate (PK)
  - [ ] CodigoLancamento (FK → Lancamento)
  - [ ] CodigoCadastro
  - [ ] Pontos (Total em uso)
  - [ ] Observacao
  - Status: **VALIDAR EM BANCO**

- [ ] **Fidelidade_Resgate_Premio** - O QUE foi resgatado
  - [ ] CodigoResgate (FK → Fidelidade_Resgate)
  - [ ] CodigoPremio (FK → Fidelidade_Premio)
  - [ ] Quantidade
  - [ ] Pontos (Valor histórico no momento da troca)
  - [ ] Total (Quantidade × Pontos)
  - Status: **VALIDAR EM BANCO**

- [ ] **Fidelidade_Resgate_Ponto** - DE ONDE vieram os pontos
  - [ ] CodigoResgate (FK → Fidelidade_Resgate)
  - [ ] CodigoFidelidade (FK → Fidelidade)
  - [ ] Pontos
  - [ ] DataOrigemPonto (Quando foram creditados)
  - Status: **VALIDAR EM BANCO**

- [ ] **Fidelidade_Resgate_Lancamento** - Vínculo Comercial
  - [ ] CodigoResgate (FK → Fidelidade_Resgate)
  - [ ] CodigoVenda (FK → Venda)
  - Status: **VALIDAR EM BANCO**

- [ ] **Fidelidade** - Regras de fidelidade
  - [ ] CodigoFidelidade (PK)
  - [ ] Descricao
  - Status: **JÁ EXISTE**

- [ ] **Fidelidade_Premio** - Catálogo de prêmios
  - [ ] CodigoPremio (PK)
  - [ ] NomePremio
  - [ ] Pontos
  - [ ] Ativo
  - Status: **JÁ EXISTE**

### B. Relacionamentos e Integridade Referencial
```sql
-- Validar relacionamentos
SELECT 
  OBJECT_NAME(fk.parent_object_id) AS Tabela_Filha,
  COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Coluna_FK,
  OBJECT_NAME(fk.referenced_object_id) AS Tabela_Pai,
  COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS Coluna_PK,
  fk.name AS Nome_FK
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fkc 
  ON fk.object_id = fkc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) LIKE 'Fidelidade_Resgate%'
ORDER BY Tabela_Filha, Nome_FK;
```

---

## 🔐 FASE 2: Validação de Integridade

### A. Integridade Referencial

- [ ] **Teste: Exclusão em Cascata**
  ```sql
  -- Verificar se há policy de Cascade Delete
  SELECT 
    OBJECT_NAME(fk.parent_object_id) AS Tabela,
    fk.name AS FK_Name,
    CASE 
      WHEN fk.delete_referential_action = 1 THEN 'Cascade'
      WHEN fk.delete_referential_action = 2 THEN 'Set Null'
      WHEN fk.delete_referential_action = 0 THEN 'No Action'
      ELSE 'Outro'
    END AS Delete_Action
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) LIKE 'Fidelidade_Resgate%';
  ```
  - [ ] Esperado: Cascade Delete ou Soft Delete (recomendado)
  - [ ] Status: **VALIDAR**

- [ ] **Teste: Validar Lançamentos Órfãos**
  ```sql
  -- Procurar resgates sem lançamento associado
  SELECT COUNT(*) AS Resgates_Orfaos
  FROM Fidelidade_Resgate r
  WHERE r.CodigoLancamento IS NULL;
  ```
  - [ ] Esperado: 0
  - [ ] Status: **VALIDAR**

### B. Normalização de Dados

- [ ] **Teste: Pontos em Fato vs. Soma em Prêmios**
  ```sql
  -- Verificar se Fidelidade_Resgate.Pontos = SUM(Fidelidade_Resgate_Premio.Pontos)
  SELECT 
    r.CodigoResgate,
    r.Pontos AS PontosEmFato,
    SUM(rp.Pontos) AS SomaPremios,
    CASE 
      WHEN r.Pontos = SUM(rp.Pontos) THEN '✅ OK'
      ELSE '❌ INCONSISTÊNCIA'
    END AS Status
  FROM Fidelidade_Resgate r
  LEFT JOIN Fidelidade_Resgate_Premio rp 
    ON rp.CodigoResgate = r.CodigoResgate
  GROUP BY r.CodigoResgate, r.Pontos
  HAVING r.Pontos <> SUM(rp.Pontos)
  ORDER BY r.CodigoResgate DESC;
  ```
  - [ ] Esperado: Nenhum registro (0 rows)
  - [ ] Status: **VALIDAR**
  - [ ] Ação se falhar: Corrigir tabela Fidelidade_Resgate_Premio

- [ ] **Teste: Origem de Pontos**
  ```sql
  -- Validar se origens de pontos somam o total do resgate
  SELECT 
    r.CodigoResgate,
    r.Pontos AS PontosResgate,
    SUM(rp.Pontos) AS PontosOrigem,
    CASE 
      WHEN r.Pontos = SUM(rp.Pontos) THEN '✅ OK'
      ELSE '❌ INCONSISTÊNCIA'
    END AS Status
  FROM Fidelidade_Resgate r
  LEFT JOIN Fidelidade_Resgate_Ponto rp 
    ON rp.CodigoResgate = r.CodigoResgate
  GROUP BY r.CodigoResgate, r.Pontos
  HAVING r.Pontos <> SUM(rp.Pontos)
  ORDER BY r.CodigoResgate DESC;
  ```
  - [ ] Esperado: Nenhum registro (0 rows)
  - [ ] Status: **VALIDAR**

---

## 📊 FASE 3: Validação de Auditoria

### A. Campos de Auditoria em Lancamento

- [ ] Teste: Preenchimento de CodigoUsuario
  ```sql
  SELECT COUNT(*) AS Lancamentos_SemUsuario
  FROM Lancamento l
  WHERE l.CodigoUsuario IS NULL;
  ```
  - [ ] Esperado: 0 (todos preenchidos)
  - [ ] Status: **VALIDAR**

- [ ] Teste: Preenchimento de CodigoEstacao
  ```sql
  SELECT COUNT(*) AS Lancamentos_SemEstacao
  FROM Lancamento l
  WHERE l.CodigoEstacao IS NULL;
  ```
  - [ ] Esperado: 0 (todos preenchidos)
  - [ ] Status: **VALIDAR**

### B. Middleware/Contexto de Auditoria

- [ ] **Arquivo**: `src/middleware/auditoria.js` (criar se não existir)
  ```javascript
  // Middleware que injeta contexto de auditoria
  module.exports = (req, res, next) => {
    req.auditoria = {
      codigoUsuario: req.headers['x-usuario-id'] || 'SISTEMA',
      codigoEstacao: req.headers['x-estacao-id'] || 'API',
      dataHora: new Date()
    };
    next();
  };
  ```
  - [ ] Implementado
  - [ ] Registrado em index.js antes das rotas
  - [ ] Testes com curl:
    ```bash
    curl -X POST http://localhost:3000/fidelidade-resgate \
      -H "X-Usuario-ID: USR_001" \
      -H "X-Estacao-ID: PDV_001"
    ```

---

## ⚡ FASE 4: Validação de Performance

### A. Índices Recomendados

- [ ] Índice em Fidelidade_Resgate
  ```sql
  CREATE INDEX IX_FidelidadeResgate_CodigoCadastro_DataLancamento
    ON Fidelidade_Resgate(CodigoCadastro, CodigoLancamento DESC)
    INCLUDE (Pontos, Observacao);
  ```
  - [ ] Criado
  - [ ] Status: **VALIDAR**

- [ ] Índice em Fidelidade_Resgate_Premio
  ```sql
  CREATE INDEX IX_FidelidadeResgatePremio_CodigoResgate
    ON Fidelidade_Resgate_Premio(CodigoResgate)
    INCLUDE (CodigoPremio, Pontos, Quantidade, Total);
  ```
  - [ ] Criado
  - [ ] Status: **VALIDAR**

- [ ] Índice em Fidelidade_Resgate_Ponto
  ```sql
  CREATE INDEX IX_FidelidadeResgatePonto_CodigoResgate
    ON Fidelidade_Resgate_Ponto(CodigoResgate)
    INCLUDE (CodigoFidelidade, Pontos, DataOrigemPonto);
  ```
  - [ ] Criado
  - [ ] Status: **VALIDAR**

- [ ] Índice em Fidelidade_Resgate_Lancamento
  ```sql
  CREATE INDEX IX_FidelidadeResgateLancamento_CodigoResgate
    ON Fidelidade_Resgate_Lancamento(CodigoResgate)
    INCLUDE (CodigoVenda);
  ```
  - [ ] Criado
  - [ ] Status: **VALIDAR**

### B. Teste de Performance

- [ ] Teste: Query principal retorna em < 500ms
  ```sql
  SET STATISTICS TIME ON;
  
  DECLARE @CodigoCadastro INT = 123;
  
  SELECT
    r.CodigoResgate,
    r.CodigoLancamento,
    l.DataLancamento,
    r.Pontos,
    COUNT(rp.CodigoPremio) AS TotalPremios
  FROM Fidelidade_Resgate r
  LEFT JOIN Lancamento l ON l.CodigoLancamento = r.CodigoLancamento
  LEFT JOIN Fidelidade_Resgate_Premio rp ON rp.CodigoResgate = r.CodigoResgate
  WHERE r.CodigoCadastro = @CodigoCadastro
  GROUP BY r.CodigoResgate, r.CodigoLancamento, l.DataLancamento, r.Pontos
  ORDER BY l.DataLancamento DESC;
  
  SET STATISTICS TIME OFF;
  ```
  - [ ] Tempo de execução: **VALIDAR**

---

## 🔧 FASE 5: Validação de Implementação Back-end

### A. Rota GET /fidelidade-resgate/cliente/:codigoCliente

- [ ] Implementada em: `src/routes/fidelidade-resgate.js`
- [ ] Funcionalidades:
  - [ ] Busca CodigoCadastro a partir de CodigoCliente
  - [ ] Retorna resgates com prêmios associados
  - [ ] Inclui dados de auditoria (CodigoUsuario, CodigoEstacao)
  - [ ] Agrupa prêmios por resgate
  - [ ] Normaliza valores numéricos
  - [ ] Query parameter incluirDetalhes para origem e vínculo comercial
  - [ ] Tratamento de erros (400, 404, 500)

- [ ] Testes:
  ```bash
  # Teste 1: Cliente válido
  curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/123"
  
  # Teste 2: Cliente inválido
  curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/xyz"
  
  # Teste 3: Cliente não encontrado
  curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/999999"
  
  # Teste 4: Sem detalhes
  curl -X GET "http://localhost:3000/fidelidade-resgate/cliente/123?incluirDetalhes=false"
  ```

### B. Rota para Criar Resgate (POST /fidelidade-resgate)

- [ ] Deve existir? (Verificar arquitetura)
- [ ] Se sim, validar:
  - [ ] Validação de campos obrigatórios
  - [ ] Cálculo de checksum de pontos (Prêmios = Origem)
  - [ ] Criação de lançamento (Lancamento) com contexto de auditoria
  - [ ] Transação ACID (BEGIN TRAN, COMMIT, ROLLBACK)
  - [ ] Teste de erro: tentar resgatar pontos do cliente que não tem saldo

---

## 📝 FASE 6: Testes de Cenários

### A. Teste 1: Resgate com Múltiplos Prêmios
```sql
-- Cenário: Cliente resgata 2 prêmios diferentes em um resgate
INSERT INTO Fidelidade_Resgate (CodigoLancamento, CodigoCadastro, Pontos, Observacao)
VALUES (50001, 123456, 500, 'Resgate múltiplo');

-- Deve retornar 1 resgate com 2 prêmios
```
- [ ] API retorna estrutura correta
- [ ] Status: **VALIDAR**

### B. Teste 2: Resgate com Origem Múltipla
```sql
-- Cenário: Pontos de 2 origens diferentes são usados em um resgate
-- Fidelidade_Resgate_Ponto deve ter 2 registros
```
- [ ] API agrupa corretamente em origemPontos
- [ ] Status: **VALIDAR**

### C. Teste 3: Resgate Vinculado a Venda
```sql
-- Cenário: Pontos usados como desconto em nova compra
-- Fidelidade_Resgate_Lancamento vincula a CodigoVenda
```
- [ ] API retorna vinculoComercial com detalhes da venda
- [ ] Status: **VALIDAR**

---

## 🚀 FASE 7: Deploymentandização

- [ ] Script de atualização de índices executado
- [ ] Migrations (se usar) aplicadas
- [ ] Documentação de API (Swagger) atualizada
- [ ] Testes de integração passando
- [ ] Monitoramento de performance ativado

---

## 📋 Sumário de Ações

| Fase | Descrição | Status | Responsável |
|------|-----------|--------|-------------|
| 1 | Estrutura BD | ⏳ PENDENTE | Dev Backend |
| 2 | Integridade | ⏳ PENDENTE | DBA |
| 3 | Auditoria | ⏳ PENDENTE | Dev Backend |
| 4 | Performance | ⏳ PENDENTE | DBA |
| 5 | Implementação | ✅ COMPLETO | Dev Backend |
| 6 | Testes | ⏳ PENDENTE | QA |
| 7 | Deployment | ⏳ PENDENTE | DevOps |

---

## 📞 Contato

Em caso de dúvidas sobre esta checklist, consulte:
- Documentação Técnica: [API-FIDELIDADE-RESGATE.md](API-FIDELIDADE-RESGATE.md)
- Arquivo de rotas: [src/routes/fidelidade-resgate.js](src/routes/fidelidade-resgate.js)
