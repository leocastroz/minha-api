-- ========================================
-- SCRIPT DE CORREÇÃO: Inserir Cliente Faltante
-- ========================================
-- Banco: INOVAFARMA_DPOPPARA
-- Problema: Cadastro 180681501 (USUARIO TESTE POSTMAN) não aparece no painel
-- Causa: Não existe registro em dbo.Cliente
-- Solução: Inserir registro em Cliente com valores padrão
-- ========================================

USE INOVAFARMA_DPOPPARA;
GO

-- Verificação prévia
PRINT '=== VERIFICAÇÃO PRÉ-CORREÇÃO ==='
SELECT 
  'LEONARDO SILVA CASTRO2' AS usuario,
  180430901 AS CodigoCadastro,
  CASE WHEN EXISTS(SELECT 1 FROM dbo.Cliente WHERE CodigoCadastro = 180430901) THEN 'SIM' ELSE 'NÃO' END AS existe_em_cliente
UNION ALL
SELECT 
  'USUARIO TESTE POSTMAN',
  180681501,
  CASE WHEN EXISTS(SELECT 1 FROM dbo.Cliente WHERE CodigoCadastro = 180681501) THEN 'SIM' ELSE 'NÃO' END
UNION ALL
SELECT 
  'USUARIO TESTE POSTMAN 2',
  180682001,
  CASE WHEN EXISTS(SELECT 1 FROM dbo.Cliente WHERE CodigoCadastro = 180682001) THEN 'SIM' ELSE 'NÃO' END
GO

-- INSERÇÃO DO CLIENTE FALTANTE
PRINT '=== INSERINDO CLIENTE FALTANTE ==='

INSERT INTO dbo.Cliente (
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
  VencimentoDiasPrazo,
  Juros,
  JurosCarencia,
  JurosDiferenciados,
  NuncaBloquear,
  PermitirVendaPrecoPromocao,
  NaoVenderPrazo,
  Desconto,
  SCPC,
  NaoRepassaComissao
)
SELECT
  180681501,            -- CodigoCadastro do USUARIO TESTE POSTMAN
  1,                    -- CodigoTipo = 1
  0,                    -- LimiteCompra = 0
  0,                    -- Padrao = false
  0,                    -- NFPaulista = false
  1,                    -- Ativo = TRUE (CRÍTICO!)
  0,                    -- Eliminado = false
  1,                    -- CalculaJuros = true
  1,                    -- ConsumidorFinal = true
  1,                    -- PermitirVendaPrazoPrecoPromocao = true
  0,                    -- QuantidadeMaximaParcelas = 0
  1,                    -- VencimentoTipo = 1
  30,                   -- VencimentoDiasPrazo = 30
  0,                    -- Juros = 0
  0,                    -- JurosCarencia = 0
  0,                    -- JurosDiferenciados = false
  0,                    -- NuncaBloquear = false
  0,                    -- PermitirVendaPrecoPromocao = false
  0,                    -- NaoVenderPrazo = false
  0,                    -- Desconto = 0
  0,                    -- SCPC = false
  0                     -- NaoRepassaComissao = false
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.Cliente WHERE CodigoCadastro = 180681501
)
GO

-- Verificação pós-correção
PRINT '=== VERIFICAÇÃO PÓS-CORREÇÃO ==='
SELECT 
  c.CodigoCliente,
  c.CodigoCadastro,
  cad.Nome,
  c.Ativo,
  c.Eliminado,
  c.VencimentoDiasPrazo,
  'Cliente criado com sucesso!' AS status
FROM dbo.Cliente c
JOIN dbo.Cadastro cad ON c.CodigoCadastro = cad.CodigoCadastro
WHERE c.CodigoCadastro = 180681501
GO

-- Comparação final
PRINT '=== COMPARAÇÃO FINAL ==='
SELECT 
  cad.CodigoCadastro,
  cad.Nome,
  CASE WHEN c.CodigoCliente IS NOT NULL THEN 'SIM' ELSE 'NÃO' END AS existe_em_cliente,
  CASE WHEN c.Ativo = 1 THEN 'SIM' ELSE 'NÃO' END AS ativo_em_cliente
FROM dbo.Cadastro cad
LEFT JOIN dbo.Cliente c ON cad.CodigoCadastro = c.CodigoCadastro
WHERE cad.CodigoCadastro IN (180430901, 180681501, 180682001)
ORDER BY cad.CodigoCadastro
GO

PRINT '✅ Processo concluído. O USUARIO TESTE POSTMAN (180681501) deve agora aparecer no painel de clientes.'
GO
