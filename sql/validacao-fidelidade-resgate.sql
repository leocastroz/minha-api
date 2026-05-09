-- ============================================================================
-- SCRIPT SQL: Validação e Testes da Arquitetura de Fidelidade e Resgate
-- ============================================================================
-- Objetivo: Validar dados conforme o padrão de Tabela Fato Centralizada
-- Banco: INOVAFARMA_DPOPPARA
-- Data: 2026-05-08
-- ============================================================================

USE INOVAFARMA_DPOPPARA;
GO

-- ============================================================================
-- SEÇÃO 1: VALIDAÇÕES ESTRUTURAIS
-- ============================================================================

-- 1.1 Verificar existência de tabelas críticas
PRINT '=== 1.1 VERIFICAR EXISTÊNCIA DE TABELAS ==='
SELECT 
  OBJECT_NAME(object_id) AS Tabela,
  CASE 
    WHEN OBJECT_NAME(object_id) LIKE '%Resgate%' THEN 'FIDELIDADE'
    ELSE 'SUPORTE'
  END AS Categoria,
  COUNT(*) AS TotalRegistros
FROM sys.dm_db_partition_stats
WHERE object_id IN (
  SELECT object_id FROM sys.objects 
  WHERE name IN (
    'Lancamento',
    'Fidelidade_Resgate',
    'Fidelidade_Resgate_Premio',
    'Fidelidade_Resgate_Ponto',
    'Fidelidade_Resgate_Lancamento',
    'Fidelidade',
    'Fidelidade_Premio'
  )
)
GROUP BY OBJECT_NAME(object_id)
ORDER BY Tabela;

-- ============================================================================
-- SEÇÃO 2: VALIDAÇÕES DE INTEGRIDADE
-- ============================================================================

-- 2.1 Verificar relacionamentos e Foreign Keys
PRINT '=== 2.1 VALIDAR RELACIONAMENTOS (Foreign Keys) ==='
SELECT 
  OBJECT_NAME(fk.parent_object_id) AS [Tabela Filha],
  COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS [Coluna FK],
  OBJECT_NAME(fk.referenced_object_id) AS [Tabela Pai],
  COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS [Coluna PK],
  fk.name AS [Nome da FK],
  CASE 
    WHEN fk.delete_referential_action = 1 THEN 'CASCADE'
    WHEN fk.delete_referential_action = 2 THEN 'SET NULL'
    WHEN fk.delete_referential_action = 0 THEN 'NO ACTION'
    ELSE 'OUTRO'
  END AS [Ação Delete]
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fkc 
  ON fk.object_id = fkc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) LIKE 'Fidelidade_Resgate%'
  OR OBJECT_NAME(fk.parent_object_id) = 'Lancamento'
ORDER BY [Tabela Filha], [Nome da FK];

-- 2.2 Procurar Resgates Órfãos (sem Lancamento)
PRINT '=== 2.2 PROCURAR RESGATES ÓRFÃOS ==='
SELECT 
  COUNT(*) AS [Resgates sem Lancamento],
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ OK - Sem órfãos'
    ELSE '⚠️ ATENÇÃO - Existem órfãos'
  END AS Status
FROM Fidelidade_Resgate r
WHERE r.CodigoLancamento IS NULL;

-- 2.3 Procurar Prêmios sem Resgate
PRINT '=== 2.3 PROCURAR PRÊMIOS SEM RESGATE ==='
SELECT 
  COUNT(*) AS [Prêmios sem Resgate],
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ OK'
    ELSE '⚠️ ATENÇÃO'
  END AS Status
FROM Fidelidade_Resgate_Premio rp
WHERE rp.CodigoResgate NOT IN (SELECT CodigoResgate FROM Fidelidade_Resgate);

-- ============================================================================
-- SEÇÃO 3: VALIDAÇÕES DE NORMALIZAÇÃO
-- ============================================================================

-- 3.1 Verificar normalização: Pontos em Fato vs. Soma em Prêmios
PRINT '=== 3.1 VALIDAR NORMALIZAÇÃO: PONTOS FATO vs PRÊMIOS ==='
SELECT 
  r.CodigoResgate,
  r.CodigoLancamento,
  r.Pontos AS [Pontos em Fato],
  ISNULL(SUM(rp.Pontos), 0) AS [Soma Prêmios],
  CASE 
    WHEN r.Pontos = ISNULL(SUM(rp.Pontos), 0) THEN '✅ OK'
    ELSE '❌ INCONSISTÊNCIA'
  END AS Status,
  ABS(r.Pontos - ISNULL(SUM(rp.Pontos), 0)) AS Diferenca
FROM Fidelidade_Resgate r
LEFT JOIN Fidelidade_Resgate_Premio rp 
  ON rp.CodigoResgate = r.CodigoResgate
GROUP BY r.CodigoResgate, r.CodigoLancamento, r.Pontos
HAVING r.Pontos <> ISNULL(SUM(rp.Pontos), 0)
ORDER BY r.CodigoResgate DESC;

-- 3.2 Verificar normalização: Pontos Resgate vs. Origem
PRINT '=== 3.2 VALIDAR NORMALIZAÇÃO: PONTOS RESGATE vs ORIGEM ==='
SELECT 
  r.CodigoResgate,
  r.CodigoLancamento,
  r.Pontos AS [Pontos Resgatados],
  ISNULL(SUM(rpo.Pontos), 0) AS [Soma Origem Pontos],
  CASE 
    WHEN r.Pontos = ISNULL(SUM(rpo.Pontos), 0) THEN '✅ OK'
    ELSE '❌ INCONSISTÊNCIA'
  END AS Status,
  ABS(r.Pontos - ISNULL(SUM(rpo.Pontos), 0)) AS Diferenca
FROM Fidelidade_Resgate r
LEFT JOIN Fidelidade_Resgate_Ponto rpo 
  ON rpo.CodigoResgate = r.CodigoResgate
GROUP BY r.CodigoResgate, r.CodigoLancamento, r.Pontos
HAVING r.Pontos <> ISNULL(SUM(rpo.Pontos), 0)
ORDER BY r.CodigoResgate DESC;

-- ============================================================================
-- SEÇÃO 4: VALIDAÇÕES DE AUDITORIA
-- ============================================================================

-- 4.1 Verificar preenchimento de CodigoUsuario
PRINT '=== 4.1 AUDITORIA: Verificar CodigoUsuario em Lancamento ==='
SELECT 
  COUNT(*) AS [Lançamentos sem Usuário],
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ OK - Todos preenchidos'
    ELSE '❌ ATENÇÃO - Existem vazios'
  END AS Status
FROM Lancamento l
WHERE l.CodigoUsuario IS NULL
  AND l.CodigoLancamento IN (SELECT DISTINCT CodigoLancamento FROM Fidelidade_Resgate);

-- 4.2 Verificar preenchimento de CodigoEstacao
PRINT '=== 4.2 AUDITORIA: Verificar CodigoEstacao em Lancamento ==='
SELECT 
  COUNT(*) AS [Lançamentos sem Estação],
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ OK - Todos preenchidos'
    ELSE '⚠️ ATENÇÃO - Existem vazios'
  END AS Status
FROM Lancamento l
WHERE l.CodigoEstacao IS NULL
  AND l.CodigoLancamento IN (SELECT DISTINCT CodigoLancamento FROM Fidelidade_Resgate);

-- ============================================================================
-- SEÇÃO 5: ESTATÍSTICAS DE DADOS
-- ============================================================================

-- 5.1 Resumo de Resgates por Cliente
PRINT '=== 5.1 RESUMO DE RESGATES POR CLIENTE ==='
SELECT TOP 20
  r.CodigoCadastro,
  c.Nome,
  COUNT(DISTINCT r.CodigoResgate) AS [Total Resgates],
  SUM(r.Pontos) AS [Total Pontos Resgatados],
  COUNT(DISTINCT rp.CodigoPremio) AS [Total Prêmios Únicos],
  MIN(l.DataLancamento) AS [Primeiro Resgate],
  MAX(l.DataLancamento) AS [Último Resgate],
  DATEDIFF(DAY, MIN(l.DataLancamento), MAX(l.DataLancamento)) AS [Dias de Atividade]
FROM Fidelidade_Resgate r
LEFT JOIN Cadastro c ON c.CodigoCadastro = r.CodigoCadastro
LEFT JOIN Fidelidade_Resgate_Premio rp ON rp.CodigoResgate = r.CodigoResgate
LEFT JOIN Lancamento l ON l.CodigoLancamento = r.CodigoLancamento
GROUP BY r.CodigoCadastro, c.Nome
ORDER BY [Total Resgates] DESC;

-- 5.2 Prêmios Mais Resgatados
PRINT '=== 5.2 PRÊMIOS MAIS RESGATADOS ==='
SELECT TOP 10
  p.CodigoPremio,
  p.NomePremio,
  COUNT(DISTINCT rp.CodigoResgate) AS [Vezes Resgatado],
  SUM(rp.Quantidade) AS [Quantidade Total],
  AVG(rp.Pontos) AS [Custo Médio em Pontos],
  p.Ativo
FROM Fidelidade_Resgate_Premio rp
LEFT JOIN Fidelidade_Premio p ON p.CodigoPremio = rp.CodigoPremio
GROUP BY p.CodigoPremio, p.NomePremio, p.Ativo
ORDER BY [Vezes Resgatado] DESC;

-- 5.3 Origem de Pontos Mais Utilizados
PRINT '=== 5.3 ORIGEM DE PONTOS MAIS UTILIZADOS ==='
SELECT TOP 10
  f.CodigoFidelidade,
  f.Descricao,
  COUNT(DISTINCT rpo.CodigoResgate) AS [Resgates Relacionados],
  SUM(rpo.Pontos) AS [Total Pontos Utilizados],
  MIN(rpo.DataOrigemPonto) AS [Data Primeira Origem],
  MAX(rpo.DataOrigemPonto) AS [Data Última Origem]
FROM Fidelidade_Resgate_Ponto rpo
LEFT JOIN Fidelidade f ON f.CodigoFidelidade = rpo.CodigoFidelidade
GROUP BY f.CodigoFidelidade, f.Descricao
ORDER BY [Total Pontos Utilizados] DESC;

-- ============================================================================
-- SEÇÃO 6: PERFORMANCE (Índices)
-- ============================================================================

-- 6.1 Verificar índices existentes
PRINT '=== 6.1 ÍNDICES EXISTENTES ==='
SELECT 
  OBJECT_NAME(i.object_id) AS [Tabela],
  i.name AS [Nome Índice],
  CASE i.type 
    WHEN 1 THEN 'Clustered'
    WHEN 2 THEN 'Non-clustered'
    ELSE 'Outro'
  END AS [Tipo],
  (SELECT COUNT(*) FROM sys.index_columns ic 
   WHERE ic.index_id = i.index_id AND ic.object_id = i.object_id) AS [Colunas]
FROM sys.indexes i
WHERE OBJECT_NAME(i.object_id) LIKE 'Fidelidade_Resgate%'
  OR OBJECT_NAME(i.object_id) = 'Lancamento'
ORDER BY OBJECT_NAME(i.object_id), i.name;

-- 6.2 Fragmentação de Índices
PRINT '=== 6.2 FRAGMENTAÇÃO DE ÍNDICES ==='
SELECT 
  OBJECT_NAME(ips.object_id) AS [Tabela],
  i.name AS [Índice],
  ips.avg_fragmentation_in_percent AS [Fragmentação %],
  CASE 
    WHEN ips.avg_fragmentation_in_percent < 10 THEN '✅ OK'
    WHEN ips.avg_fragmentation_in_percent < 30 THEN '⚠️ REORGANIZAR'
    ELSE '❌ RECONSTRUIR'
  END AS [Ação Recomendada]
FROM sys.dm_db_index_physical_stats(
  DB_ID('INOVAFARMA_DPOPPARA'), NULL, NULL, NULL, 'LIMITED'
) ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id 
  AND ips.index_id = i.index_id
WHERE OBJECT_NAME(ips.object_id) LIKE 'Fidelidade_Resgate%'
  OR OBJECT_NAME(ips.object_id) = 'Lancamento'
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- ============================================================================
-- SEÇÃO 7: TESTES DE EXEMPLO (Consultas que a API executará)
-- ============================================================================

-- 7.1 Simular consulta GET /fidelidade-resgate/cliente/:codigoCliente
PRINT '=== 7.1 SIMULAR GET /fidelidade-resgate/cliente/:codigoCliente ==='
DECLARE @CodigoCliente INT = 1; -- Ajuste para um cliente real

SELECT 
  r.CodigoResgate,
  r.CodigoLancamento,
  l.DataLancamento,
  l.CodigoUsuario,
  l.CodigoEstacao,
  r.Pontos AS PontosResgate,
  r.Observacao,
  p.CodigoPremio,
  p.NomePremio,
  rp.Pontos AS PontosPremio,
  rp.Quantidade,
  rp.Total
FROM Cliente c
LEFT JOIN Fidelidade_Resgate r ON r.CodigoCadastro = c.CodigoCadastro
LEFT JOIN Lancamento l ON l.CodigoLancamento = r.CodigoLancamento
LEFT JOIN Fidelidade_Resgate_Premio rp ON rp.CodigoResgate = r.CodigoResgate
LEFT JOIN Fidelidade_Premio p ON p.CodigoPremio = rp.CodigoPremio
WHERE c.CodigoCliente = @CodigoCliente
ORDER BY l.DataLancamento DESC, r.CodigoResgate DESC;

-- 7.2 Simular origem de pontos
PRINT '=== 7.2 SIMULAR ORIGEM DE PONTOS ==='
DECLARE @CodigoCliente INT = 1; -- Ajuste para um cliente real

SELECT 
  r.CodigoResgate,
  f.CodigoFidelidade,
  f.Descricao,
  rpo.Pontos,
  rpo.DataOrigemPonto
FROM Cliente c
LEFT JOIN Fidelidade_Resgate r ON r.CodigoCadastro = c.CodigoCadastro
LEFT JOIN Fidelidade_Resgate_Ponto rpo ON rpo.CodigoResgate = r.CodigoResgate
LEFT JOIN Fidelidade f ON f.CodigoFidelidade = rpo.CodigoFidelidade
WHERE c.CodigoCliente = @CodigoCliente
  AND rpo.CodigoFidelidade IS NOT NULL
ORDER BY r.CodigoResgate DESC;

-- 7.3 Simular vínculo comercial
PRINT '=== 7.3 SIMULAR VÍNCULO COMERCIAL ==='
DECLARE @CodigoCliente INT = 1; -- Ajuste para um cliente real

SELECT 
  r.CodigoResgate,
  rl.CodigoVenda,
  v.DataVenda,
  v.TotalVenda
FROM Cliente c
LEFT JOIN Fidelidade_Resgate r ON r.CodigoCadastro = c.CodigoCadastro
LEFT JOIN Fidelidade_Resgate_Lancamento rl ON rl.CodigoResgate = r.CodigoResgate
LEFT JOIN Venda v ON v.CodigoVenda = rl.CodigoVenda
WHERE c.CodigoCliente = @CodigoCliente
  AND rl.CodigoVenda IS NOT NULL
ORDER BY r.CodigoResgate DESC;

-- ============================================================================
-- SEÇÃO 8: SCRIPTS DE CRIAÇÃO DE ÍNDICES (Se necessário)
-- ============================================================================

PRINT '=== 8.1 SCRIPTS DE CRIAÇÃO DE ÍNDICES (Execute se necessário) ==='

-- Índice em Fidelidade_Resgate para busca por CodigoCadastro
IF NOT EXISTS (SELECT 1 FROM sys.indexes 
              WHERE name = 'IX_FidelidadeResgate_CodigoCadastro_DataLancamento'
              AND object_id = OBJECT_ID('Fidelidade_Resgate'))
BEGIN
  CREATE INDEX IX_FidelidadeResgate_CodigoCadastro_DataLancamento
    ON Fidelidade_Resgate(CodigoCadastro, CodigoLancamento DESC)
    INCLUDE (Pontos, Observacao);
  PRINT '✅ Índice IX_FidelidadeResgate_CodigoCadastro_DataLancamento criado';
END

-- Índice em Fidelidade_Resgate_Premio
IF NOT EXISTS (SELECT 1 FROM sys.indexes 
              WHERE name = 'IX_FidelidadeResgatePremio_CodigoResgate'
              AND object_id = OBJECT_ID('Fidelidade_Resgate_Premio'))
BEGIN
  CREATE INDEX IX_FidelidadeResgatePremio_CodigoResgate
    ON Fidelidade_Resgate_Premio(CodigoResgate)
    INCLUDE (CodigoPremio, Pontos, Quantidade, Total);
  PRINT '✅ Índice IX_FidelidadeResgatePremio_CodigoResgate criado';
END

-- Índice em Fidelidade_Resgate_Ponto
IF NOT EXISTS (SELECT 1 FROM sys.indexes 
              WHERE name = 'IX_FidelidadeResgatePonto_CodigoResgate'
              AND object_id = OBJECT_ID('Fidelidade_Resgate_Ponto'))
BEGIN
  CREATE INDEX IX_FidelidadeResgatePonto_CodigoResgate
    ON Fidelidade_Resgate_Ponto(CodigoResgate)
    INCLUDE (CodigoFidelidade, Pontos, DataOrigemPonto);
  PRINT '✅ Índice IX_FidelidadeResgatePonto_CodigoResgate criado';
END

PRINT '=== FIM DOS TESTES ==='
