#!/bin/bash
# ============================================================================
# TESTES DE API: Fidelidade e Resgate
# ============================================================================
# Objetivo: Exemplos de testes da rota GET /fidelidade-resgate/cliente/:codigoCliente
# Ambiente: http://localhost:3000
# ============================================================================

# Configurações
BASE_URL="http://localhost:3000"
CLIENTE_ID=1
CLIENTE_ID_INVALIDO="xyz"
CLIENTE_ID_NAO_ENCONTRADO=999999

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     TESTES DE API: Fidelidade e Resgate                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# TESTE 1: Cliente Válido - Resposta Completa
# ============================================================================
echo "▶ TESTE 1: GET /fidelidade-resgate/cliente/:codigoCliente (SUCESSO)"
echo "─────────────────────────────────────────────────────────────────"
echo "Requisição:"
echo "  curl -X GET \"$BASE_URL/fidelidade-resgate/cliente/$CLIENTE_ID\""
echo ""
echo "Resposta esperada:"
cat << 'EOF'
{
  "mensagem": "Resgates de fidelidade consultados com sucesso",
  "cliente": {
    "codigoCliente": 1,
    "codigoCadastro": 12345,
    "ativo": true
  },
  "resumo": {
    "totalResgates": 3,
    "totalPontosResgatados": 1250,
    "totalPremios": 5,
    "periodoAnalisado": {
      "inicio": "2025-01-15T10:30:00Z",
      "fim": "2026-05-08T14:45:00Z"
    }
  },
  "resgates": [
    {
      "codigoResgate": 1001,
      "codigoLancamento": 50001,
      "dataLancamento": "2026-05-08T14:45:00Z",
      "pontosResgate": 500,
      "observacao": "Resgate de prêmios diversos",
      "auditoria": {
        "codigoUsuario": "USR_ADMIN_001",
        "codigoEstacao": "EST_PDV_002"
      },
      "premios": [
        {
          "codigoPremio": 10,
          "nomePremio": "Voucher R$ 50",
          "pontos": 300,
          "quantidade": 1,
          "total": 300,
          "premioAtivo": true
        }
      ],
      "origemPontos": [
        {
          "codigoFidelidade": 5,
          "descricaoFidelidade": "Compras acumuladas",
          "pontosUtilizados": 500,
          "dataOrigem": "2025-06-10T00:00:00Z"
        }
      ],
      "vinculoComercial": [
        {
          "codigoVenda": 9001,
          "dataVenda": "2026-05-08T14:45:00Z",
          "totalVenda": 1500.00,
          "descricaoVenda": "Compra com desconto de pontos"
        }
      ]
    }
  ]
}
EOF
echo ""
echo "Status esperado: 200 OK"
echo ""
echo ""

# ============================================================================
# TESTE 2: Sem Detalhes (Query Parameter)
# ============================================================================
echo "▶ TESTE 2: GET /fidelidade-resgate/cliente/:codigoCliente?incluirDetalhes=false"
echo "─────────────────────────────────────────────────────────────────"
echo "Requisição:"
echo "  curl -X GET \"$BASE_URL/fidelidade-resgate/cliente/$CLIENTE_ID?incluirDetalhes=false\""
echo ""
echo "Resposta esperada: (Sem origemPontos e vinculoComercial)"
cat << 'EOF'
{
  "mensagem": "Resgates de fidelidade consultados com sucesso",
  "cliente": {...},
  "resumo": {...},
  "resgates": [
    {
      "codigoResgate": 1001,
      "codigoLancamento": 50001,
      "dataLancamento": "2026-05-08T14:45:00Z",
      "pontosResgate": 500,
      "observacao": "Resgate de prêmios diversos",
      "auditoria": {
        "codigoUsuario": "USR_ADMIN_001",
        "codigoEstacao": "EST_PDV_002"
      },
      "premios": [...]
    }
  ]
}
EOF
echo ""
echo "Status esperado: 200 OK"
echo ""
echo ""

# ============================================================================
# TESTE 3: Parâmetro Inválido
# ============================================================================
echo "▶ TESTE 3: Parâmetro Inválido (Erro 400)"
echo "─────────────────────────────────────────────────────────────────"
echo "Requisição:"
echo "  curl -X GET \"$BASE_URL/fidelidade-resgate/cliente/$CLIENTE_ID_INVALIDO\""
echo ""
echo "Resposta esperada:"
cat << 'EOF'
{
  "erro": "CodigoCliente inválido",
  "mensagem": "CodigoCliente deve ser um número válido"
}
EOF
echo ""
echo "Status esperado: 400 Bad Request"
echo ""
echo ""

# ============================================================================
# TESTE 4: Cliente Não Encontrado
# ============================================================================
echo "▶ TESTE 4: Cliente Não Encontrado (Erro 404)"
echo "─────────────────────────────────────────────────────────────────"
echo "Requisição:"
echo "  curl -X GET \"$BASE_URL/fidelidade-resgate/cliente/$CLIENTE_ID_NAO_ENCONTRADO\""
echo ""
echo "Resposta esperada:"
cat << 'EOF'
{
  "erro": "Cliente não encontrado",
  "codigoCliente": 999999
}
EOF
echo ""
echo "Status esperado: 404 Not Found"
echo ""
echo ""

# ============================================================================
# TESTE 5: Cliente sem Resgates
# ============================================================================
echo "▶ TESTE 5: Cliente sem Resgates (Resposta Vazia)"
echo "─────────────────────────────────────────────────────────────────"
echo "Requisição:"
echo "  curl -X GET \"$BASE_URL/fidelidade-resgate/cliente/123\" # (cliente sem resgates)"
echo ""
echo "Resposta esperada:"
cat << 'EOF'
{
  "mensagem": "Nenhum resgate de fidelidade encontrado",
  "codigoCliente": 123,
  "codigoCadastro": 45678,
  "totalResgates": 0,
  "resgates": []
}
EOF
echo ""
echo "Status esperado: 200 OK"
echo ""
echo ""

# ============================================================================
# TESTES COM CURL (Copia e cola)
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     COMANDOS CURL PRONTOS PARA TESTAR                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "# Teste 1: Cliente válido (substitua 1 pelo CodigoCliente real)"
echo "curl -X GET \"http://localhost:3000/fidelidade-resgate/cliente/1\""
echo ""
echo "# Teste 2: Sem detalhes"
echo "curl -X GET \"http://localhost:3000/fidelidade-resgate/cliente/1?incluirDetalhes=false\""
echo ""
echo "# Teste 3: Parâmetro inválido"
echo "curl -X GET \"http://localhost:3000/fidelidade-resgate/cliente/xyz\""
echo ""
echo "# Teste 4: Cliente não encontrado"
echo "curl -X GET \"http://localhost:3000/fidelidade-resgate/cliente/999999\""
echo ""
echo "# Teste 5: Com formatação JSON (pretty-print)"
echo "curl -X GET \"http://localhost:3000/fidelidade-resgate/cliente/1\" | jq ."
echo ""
echo ""

# ============================================================================
# TESTES COM POSTMAN
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     INSTRUÇÕES PARA TESTAR NO POSTMAN                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Abra o Postman"
echo "2. Clique em 'New' > 'HTTP Request'"
echo "3. Configure:"
echo "   • Método: GET"
echo "   • URL: http://localhost:3000/fidelidade-resgate/cliente/1"
echo "   • Headers: Content-Type: application/json"
echo ""
echo "4. Para testar sem detalhes:"
echo "   • URL: http://localhost:3000/fidelidade-resgate/cliente/1?incluirDetalhes=false"
echo "   • Abra a aba 'Params' e adicione:"
echo "     - Key: incluirDetalhes"
echo "     - Value: false"
echo ""
echo "5. Clique em 'Send'"
echo ""
echo ""

# ============================================================================
# TESTES COM JavaScript/Fetch
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     CÓDIGO JAVASCRIPT PARA TESTAR                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
cat << 'EOF'
// Teste 1: Fetch básico
fetch('/fidelidade-resgate/cliente/1')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));

// Teste 2: Async/await
async function buscarResgates() {
  try {
    const res = await fetch('/fidelidade-resgate/cliente/1');
    const data = await res.json();
    
    console.log(`Cliente ${data.cliente.codigoCliente}`);
    console.log(`Total resgates: ${data.resumo.totalResgates}`);
    console.log(`Total pontos: ${data.resumo.totalPontosResgatados}`);
    
    data.resgates.forEach(resgate => {
      console.log(`\nResgate #${resgate.codigoResgate}`);
      resgate.premios.forEach(premio => {
        console.log(`  - ${premio.nomePremio} (${premio.pontos}pts)`);
      });
    });
  } catch (err) {
    console.error('Erro:', err);
  }
}

buscarResgates();

// Teste 3: Sem detalhes
fetch('/fidelidade-resgate/cliente/1?incluirDetalhes=false')
  .then(res => res.json())
  .then(data => {
    console.log('Resgates (sem origem e vínculo):');
    console.log(data.resgates);
  });
EOF
echo ""
echo ""

# ============================================================================
# VALIDAÇÕES
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     CHECKLIST DE VALIDAÇÃO                                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "[ ] Resposta tem estrutura correta?"
echo "    └─ cliente, resumo, resgates"
echo ""
echo "[ ] Dados de auditoria presentes?"
echo "    └─ codigoUsuario, codigoEstacao em cada resgate"
echo ""
echo "[ ] Prêmios agrupados corretamente?"
echo "    └─ premios array dentro de cada resgate"
echo ""
echo "[ ] Origem de pontos presente (quando incluirDetalhes=true)?"
echo "    └─ origemPontos array"
echo ""
echo "[ ] Vínculo comercial presente (quando incluirDetalhes=true)?"
echo "    └─ vinculoComercial array"
echo ""
echo "[ ] Valores numéricos são números (não strings)?"
echo "    └─ Pontos, Quantidade, Total não devem vir entre aspas"
echo ""
echo "[ ] Datas em formato ISO 8601?"
echo "    └─ YYYY-MM-DDTHH:mm:ssZ"
echo ""
echo "[ ] Resumo com totalizações corretas?"
echo "    └─ totalResgates, totalPontosResgatados, totalPremios"
echo ""
echo ""
