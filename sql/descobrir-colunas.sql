-- ============================================================================
-- DESCOBRIR COLUNAS REAIS DAS TABELAS
-- ============================================================================

USE INOVAFARMA_DPOPPARA;
GO

PRINT '=== COLUNAS DE Fidelidade_Resgate ==='
EXEC sp_columns 'Fidelidade_Resgate';
GO

PRINT '=== COLUNAS DE Lancamento ==='
EXEC sp_columns 'Lancamento';
GO

PRINT '=== COLUNAS DE Cliente ==='
EXEC sp_columns 'Cliente';
GO

PRINT '=== COLUNAS DE Cadastro ==='
EXEC sp_columns 'Cadastro';
GO

-- Teste rápido: Buscar todas as colunas via sys.columns
PRINT '=== ESTRUTURA DETALHADA ==='

-- Fidelidade_Resgate
SELECT 
  'Fidelidade_Resgate' AS Tabela,
  c.name AS Coluna,
  t.name AS Tipo,
  c.max_length AS Tamanho,
  c.is_nullable AS Nullable,
  c.is_identity AS Identity
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE OBJECT_ID('Fidelidade_Resgate') = c.object_id
ORDER BY c.column_id;

PRINT '---';

-- Lancamento
SELECT 
  'Lancamento' AS Tabela,
  c.name AS Coluna,
  t.name AS Tipo,
  c.max_length AS Tamanho,
  c.is_nullable AS Nullable,
  c.is_identity AS Identity
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE OBJECT_ID('Lancamento') = c.object_id
ORDER BY c.column_id;

PRINT '---';

-- Cliente
SELECT 
  'Cliente' AS Tabela,
  c.name AS Coluna,
  t.name AS Tipo,
  c.max_length AS Tamanho,
  c.is_nullable AS Nullable,
  c.is_identity AS Identity
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE OBJECT_ID('Cliente') = c.object_id
ORDER BY c.column_id;

PRINT '---';

-- Cadastro
SELECT 
  'Cadastro' AS Tabela,
  c.name AS Coluna,
  t.name AS Tipo,
  c.max_length AS Tamanho,
  c.is_nullable AS Nullable,
  c.is_identity AS Identity
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE OBJECT_ID('Cadastro') = c.object_id
ORDER BY c.column_id;

PRINT '=== FIM ==='
