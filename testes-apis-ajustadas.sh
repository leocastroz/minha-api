#!/bin/bash

# ========================================================
# TESTES DE VALIDAÇÃO - APIs Ajustadas
# ========================================================
# Este script valida as APIs de FIDELIDADE-RESGATE e VENDAS
# após as otimizações de relacionamentos
#
# Uso: bash testes-apis-ajustadas.sh
# ========================================================

set -e

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração
BASE_URL="http://localhost:3000"
TESTS_PASSED=0
TESTS_FAILED=0

# Função para imprimir resultado
print_test() {
  local test_name=$1
  local result=$2
  local details=$3

  if [ "$result" = "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC} - $test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - $test_name"
    if [ -n "$details" ]; then
      echo -e "  ${YELLOW}Detalhes:${NC} $details"
    fi
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Função para fazer requisição e validar resposta
validate_endpoint() {
  local method=$1
  local endpoint=$2
  local test_name=$3
  local expected_field=$4

  echo -e "\n${BLUE}Testando:${NC} $endpoint"
  
  response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" != "200" ] && [ "$http_code" != "404" ]; then
    print_test "$test_name" "FAIL" "HTTP $http_code - $body"
    return 1
  fi

  if [ -n "$expected_field" ]; then
    if echo "$body" | grep -q "$expected_field"; then
      print_test "$test_name" "PASS"
      return 0
    else
      print_test "$test_name" "FAIL" "Campo '$expected_field' não encontrado na resposta"
      return 1
    fi
  else
    print_test "$test_name" "PASS"
    return 0
  fi
}

# ========================================================
# TESTES - API FIDELIDADE-RESGATE
# ========================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}TESTES - API FIDELIDADE-RESGATE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

# Teste 1: Buscar por CodigoCliente (comportamento original)
echo -e "\n${YELLOW}Grupo 1: Busca por CodigoCliente${NC}"
validate_endpoint "GET" "/fidelidade-resgate/cliente/456" \
  "Busca por CodigoCliente" \
  "\"codigoCliente\""

# Teste 2: Buscar por CPFCNPJ com máscara
echo -e "\n${YELLOW}Grupo 2: Busca por CPFCNPJ${NC}"
validate_endpoint "GET" "/fidelidade-resgate/cliente/123.456.789-00" \
  "Busca por CPFCNPJ com máscara" \
  "\"cpfCnpj\""

# Teste 3: Buscar por CPFCNPJ sem máscara
validate_endpoint "GET" "/fidelidade-resgate/cliente/12345678901234" \
  "Busca por CPFCNPJ sem máscara" \
  "\"cpfCnpj\""

# Teste 4: Campos retornados melhorados
echo -e "\n${YELLOW}Grupo 3: Validação de Campos Retornados${NC}"
validate_endpoint "GET" "/fidelidade-resgate/cliente/456" \
  "Retorna nome do cliente" \
  "\"nome\""

validate_endpoint "GET" "/fidelidade-resgate/cliente/456" \
  "Retorna tipo pessoa (Física/Jurídica)" \
  "\"tipoPessoa\""

validate_endpoint "GET" "/fidelidade-resgate/cliente/456?incluirDetalhes=false" \
  "Suporta flag incluirDetalhes=false" \
  "\"resgates\""

# ========================================================
# TESTES - API VENDAS
# ========================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}TESTES - API VENDAS/COMPRAS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

# Teste 5: Buscar por CodigoCadastro
echo -e "\n${YELLOW}Grupo 4: Busca por CodigoCadastro${NC}"
validate_endpoint "GET" "/vendas/cliente/789" \
  "Busca por CodigoCadastro" \
  "\"codigoCadastro\""

# Teste 6: Buscar por CodigoCliente
echo -e "\n${YELLOW}Grupo 5: Busca por CodigoCliente${NC}"
validate_endpoint "GET" "/vendas/cliente/456" \
  "Busca por CodigoCliente" \
  "\"codigoCliente\""

# Teste 7: Buscar por CPFCNPJ
echo -e "\n${YELLOW}Grupo 6: Busca por CPFCNPJ${NC}"
validate_endpoint "GET" "/vendas/cliente/123.456.789-00" \
  "Busca por CPFCNPJ com máscara" \
  "\"vendas\""

# Teste 8: Novos campos de relacionamento
echo -e "\n${YELLOW}Grupo 7: Validação de Campos Novos${NC}"
validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna informações do vendedor" \
  "\"vendedor\""

validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna informações de convênio" \
  "\"convenio\""

validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna forma de pagamento" \
  "\"formaPagamento\""

validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna dados de auditoria" \
  "\"auditoria\""

validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna relacionamentos utilizados" \
  "\"relacionamentosUtilizados\""

# Teste 9: Campos de resumo expandido
echo -e "\n${YELLOW}Grupo 8: Campos de Resumo Expandido${NC}"
validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna data primeira compra" \
  "\"dataPrimeiraCompra\""

validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna total de empresas" \
  "\"totalEmpresas\""

validate_endpoint "GET" "/vendas/cliente/789" \
  "Retorna total de funcionários" \
  "\"totalFuncionarios\""

# Teste 10: Paginação
echo -e "\n${YELLOW}Grupo 9: Paginação${NC}"
validate_endpoint "GET" "/vendas/cliente/789?page=1&limit=10" \
  "Suporta paginação com limit" \
  "\"paginacao\""

validate_endpoint "GET" "/vendas/cliente/789?page=2&limit=25" \
  "Suporta múltiplas páginas" \
  "\"vendas\""

# Teste 11: Flags opcionais
echo -e "\n${YELLOW}Grupo 10: Flags Opcionais${NC}"
validate_endpoint "GET" "/vendas/cliente/789?incluirEliminadas=true" \
  "Suporta flag incluirEliminadas" \
  "\"vendas\""

# ========================================================
# TESTES - TRATAMENTO DE ERROS
# ========================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}TESTES - TRATAMENTO DE ERROS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

# Teste 12: Identificador inválido
echo -e "\n${YELLOW}Grupo 11: Validação de Erros${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/fidelidade-resgate/cliente/")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "400" ] || [ "$http_code" = "404" ]; then
  print_test "Rejeita identificador vazio" "PASS"
else
  print_test "Rejeita identificador vazio" "FAIL" "HTTP $http_code"
fi

# Teste 13: CPFCNPJ com comprimento inválido
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/fidelidade-resgate/cliente/12345")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "400" ] || [ "$http_code" = "404" ]; then
  print_test "Rejeita CPFCNPJ com comprimento inválido" "PASS"
else
  print_test "Rejeita CPFCNPJ com comprimento inválido" "FAIL" "HTTP $http_code"
fi

# ========================================================
# RELATÓRIO FINAL
# ========================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}RELATÓRIO FINAL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

TOTAL=$((TESTS_PASSED + TESTS_FAILED))
PERCENTAGE=$((TESTS_PASSED * 100 / TOTAL))

echo -e "\n${GREEN}Testes Passados:${NC} $TESTS_PASSED"
echo -e "${RED}Testes Falhados:${NC} $TESTS_FAILED"
echo -e "${BLUE}Total:${NC} $TOTAL"
echo -e "${YELLOW}Percentual de Sucesso:${NC} ${PERCENTAGE}%"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ TODOS OS TESTES PASSARAM!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Alguns testes falharam. Verifique os detalhes acima.${NC}"
  exit 1
fi
