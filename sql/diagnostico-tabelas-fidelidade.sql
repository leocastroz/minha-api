-- ============================================================================
-- DIAGNÓSTICO RÁPIDO: Estrutura das Tabelas de Fidelidade
-- ============================================================================

USE INOVAFARMA_DPOPPARA;
GO

-- 1. Colunas de Fidelidade_Resgate
PRINT '=== COLUNAS DE Fidelidade_Resgate ===';
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMNPROPERTY(OBJECT_ID('Fidelidade_Resgate'), COLUMN_NAME, 'IsIdentity') AS IsIdentity
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Fidelidade_Resgate'
ORDER BY ORDINAL_POSITION;

-- 2. Foreign Keys de Fidelidade_Resgate
PRINT '=== FOREIGN KEYS DE Fidelidade_Resgate ===';
SELECT 
  fk.name AS FK_Name,
  COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Local_Column,
  OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
  COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS Referenced_Column
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fkc.parent_object_id = OBJECT_ID('Fidelidade_Resgate')
ORDER BY fk.name;

-- 3. Amostra de dados de Fidelidade_Resgate
PRINT '=== AMOSTRA DE DADOS (TOP 5) ===';
SELECT TOP 5 *
FROM Fidelidade_Resgate
ORDER BY CodigoResgate DESC;

-- 4. Verificar se há alguma ligação com Cliente
PRINT '=== PROCURAR COLUNA COM "Cliente" EM FIDELIDADE_RESGATE ===';
SELECT 
  COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Fidelidade_Resgate'
  AND COLUMN_NAME LIKE '%Cliente%' OR COLUMN_NAME LIKE '%Cadastro%'
ORDER BY ORDINAL_POSITION;

-- 5. Checar relacionamentos entre Cliente e Fidelidade_Resgate
PRINT '=== PROCURAR FOREIGN KEY PARA Cliente OU Cadastro ===';
SELECT 
  c.COLUMN_NAME,
  kcu.TABLE_NAME,
  kcu.COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN INFORMATION_SCHEMA.COLUMNS c 
  ON c.TABLE_NAME = kcu.TABLE_NAME AND c.COLUMN_NAME = kcu.COLUMN_NAME
WHERE kcu.TABLE_NAME = 'Fidelidade_Resgate'
  AND (kcu.REFERENCED_TABLE_NAME = 'Cliente' OR kcu.REFERENCED_TABLE_NAME = 'Cadastro')
ORDER BY ORDINAL_POSITION;
