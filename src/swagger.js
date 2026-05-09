const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Minha API - Documentacao',
    version: '1.0.0',
    description:
      'Documentacao dos endpoints disponiveis: metodos HTTP, parametros, payloads e formatos de resposta, pensada para consumo por front-end.',
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Servidor local',
    },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Tabelas' },
    { name: 'Cadastro' },
    { name: 'Fidelidade Ponto' },
    { name: 'Fidelidade Premio' },
    { name: 'Fidelidade Resgate' },
    { name: 'Vendas' },
  ],
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Mensagem de erro' },
          erro: { type: 'string', example: 'Mensagem de erro' },
          mensagem: { type: 'string', example: 'Detalhes do erro' },
        },
      },
      CadastroCreateRequest: {
        type: 'object',
        required: ['Nome'],
        properties: {
          CodigoEmpresa: { type: 'integer', example: 1 },
          Nome: { type: 'string', example: 'LEONARDO' },
          NomeFantasia: { type: 'string', nullable: true, example: 'LEO' },
          CPFCNPJ: { type: 'string', nullable: true, example: '12345678901' },
          RG: { type: 'string', nullable: true, example: '1234567' },
          RGOrgao: { type: 'string', nullable: true, example: 'SSP' },
          RGOrgaoUF: { type: 'string', nullable: true, example: 'SP' },
          DataNascimento: { type: 'string', format: 'date-time', nullable: true },
          Pessoa: { type: 'integer', example: 1 },
          Sexo: { type: 'string', nullable: true, example: 'M' },
          DataCadastro: { type: 'string', format: 'date-time', nullable: true },
          SobreNome: { type: 'string', nullable: true, example: 'CASTRO' },
          IE: { type: 'string', nullable: true, example: 'ISENTO' },
          Eliminado: { type: 'boolean', example: false },
          TipoDescontoNFe: { type: 'integer', example: 1 },
          IdentificacaoEstrangeiro: { type: 'string', nullable: true },
          vincularConvenioFidelicard: { type: 'boolean', example: true },
          tituloConvenio: { type: 'string', example: 'FIDELICARD' },
        },
      },
      CadastroUpdateRequest: {
        type: 'object',
        properties: {
          CodigoEmpresa: { type: 'integer' },
          CodigoLancamento: { type: 'string' },
          Nome: { type: 'string' },
          NomeFantasia: { type: 'string', nullable: true },
          CPFCNPJ: { type: 'string', nullable: true },
          RG: { type: 'string', nullable: true },
          RGOrgao: { type: 'string', nullable: true },
          RGOrgaoUF: { type: 'string', nullable: true },
          DataNascimento: { type: 'string', format: 'date-time', nullable: true },
          Pessoa: { type: 'integer' },
          Sexo: { type: 'string', nullable: true },
          DataCadastro: { type: 'string', format: 'date-time', nullable: true },
          SobreNome: { type: 'string', nullable: true },
          IE: { type: 'string', nullable: true },
          Eliminado: { type: 'boolean' },
          TipoDescontoNFe: { type: 'integer' },
          IdentificacaoEstrangeiro: { type: 'string', nullable: true },
        },
      },
      PagedResponse: {
        type: 'object',
        properties: {
          pagina: { type: 'integer', example: 1 },
          limite: { type: 'integer', example: 50 },
          total: { type: 'integer', example: 10 },
          dados: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
        },
      },
      ClienteMini: {
        type: 'object',
        properties: {
          codigoCliente: { type: 'integer', nullable: true, example: 18027401 },
          codigoCadastro: { type: 'integer', example: 180430901 },
          nomeCompleto: { type: 'string', example: 'LEONARDO SILVA CASTRO' },
          cpfCnpj: { type: 'string', nullable: true, example: '04563315222' },
          tipoPessoa: { type: 'string', example: 'Física' },
          ativo: { type: 'boolean', example: true },
        },
      },
      ErroPadrao: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Erro ao consultar dados' },
          mensagem: { type: 'string', example: 'Detalhes do erro' },
        },
      },
      FidelidadePremioItem: {
        type: 'object',
        properties: {
          codigoPremio: { type: 'integer', example: 1 },
          nomePremio: { type: 'string', example: 'Desconto na próxima compra' },
          pontos: { type: 'integer', example: 1000 },
          ativo: { type: 'boolean', example: true },
        },
      },
      FidelidadePremioListResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Prêmios consultados com sucesso' },
          total: { type: 'integer', example: 3 },
          premios: {
            type: 'array',
            items: { $ref: '#/components/schemas/FidelidadePremioItem' },
          },
        },
      },
      FidelidadePontoItem: {
        type: 'object',
        properties: {
          codigoFidelidade: { type: 'integer', example: 123 },
          codigoLancamento: { type: 'integer', example: 456 },
          pontos: { type: 'integer', example: 250 },
          saldo: { type: 'integer', example: 150 },
          status: { type: 'string', example: 'DISPONÍVEL' },
          diasParaExpirar: { type: 'integer', example: 30 },
          dataVencimento: { type: 'string', format: 'date-time' },
        },
      },
      FidelidadePontoResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Pontos de fidelidade consultados com sucesso' },
          cadastro: { $ref: '#/components/schemas/ClienteMini' },
          resumoPontos: {
            type: 'object',
            properties: {
              totalPontosAcumulados: { type: 'integer', example: 1500 },
              totalSaldoDisponivel: { type: 'integer', example: 700 },
              totalSaldoAtivo: { type: 'integer', example: 700 },
              totalPontosUtilizados: { type: 'integer', example: 800 },
              totalTransacoes: { type: 'integer', example: 12 },
              transacoesAtivas: { type: 'integer', example: 5 },
              transacoesExpiradas: { type: 'integer', example: 2 },
            },
          },
          pontos: {
            type: 'array',
            items: { $ref: '#/components/schemas/FidelidadePontoItem' },
          },
          filtros: {
            type: 'object',
            properties: {
              incluirExpirados: { type: 'string', example: 'SIM' },
              ordenarPor: { type: 'string', example: 'data' },
              limite: { type: 'integer', example: 100 },
            },
          },
        },
      },
      FidelidadePontoResumoResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Resumo de pontos consultado com sucesso' },
          cliente: { type: 'string', example: 'LEONARDO SILVA CASTRO' },
          resumo: {
            type: 'object',
            properties: {
              totalPontosAcumulados: { type: 'integer', example: 1500 },
              totalSaldoDisponivel: { type: 'integer', example: 700 },
              totalTransacoes: { type: 'integer', example: 12 },
            },
          },
        },
      },
      VendasClienteItem: {
        type: 'object',
        properties: {
          codigoVenda: { type: 'string', example: '12484001' },
          dataVenda: { type: 'string', format: 'date-time' },
          status: { type: 'integer', example: 0 },
          eliminado: { type: 'boolean', example: false },
          totalBruto: { type: 'number', format: 'float', example: 385.87 },
          totalDesconto: { type: 'number', format: 'float', example: 0 },
          totalLiquido: { type: 'number', format: 'float', example: 385.87 },
          vendedor: {
            type: 'object',
            properties: {
              codigoFuncionario: { type: 'integer', nullable: true, example: 1101 },
              nomeFuncionario: { type: 'string', nullable: true, example: 'EZEQUIAS' },
            },
          },
          convenio: {
            type: 'object',
            properties: {
              codigoConvenio: { type: 'integer', nullable: true, example: 301 },
              nomeConvenio: { type: 'string', nullable: true, example: 'FIDELICARD' },
            },
          },
          formaPagamento: {
            type: 'object',
            properties: {
              codigoFormaPagamento: { type: 'integer', nullable: true, example: 4 },
              nomeFormaPagamento: { type: 'string', nullable: true, example: 'Prazo' },
            },
          },
          auditoria: {
            type: 'object',
            properties: {
              codigoLancamento: { type: 'string', nullable: true, example: '227354701' },
              dataLancamento: { type: 'string', format: 'date-time', nullable: true },
              codigoUsuario: { type: 'integer', nullable: true, example: 101 },
              nomeUsuario: { type: 'string', nullable: true, example: 'VENDAS' },
              codigoEstacao: { type: 'string', nullable: true, example: '4101' },
            },
          },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigoVendaID: { type: 'string', example: '36112601' },
                codigoProduto: { type: 'integer', example: 1883001 },
                nomeProduto: { type: 'string', example: 'NEOSALDINA C/10 DRG' },
                quantidade: { type: 'number', example: 1 },
                precoUnitario: { type: 'number', example: 18.9 },
                descontoUnitario: { type: 'number', example: 0 },
                totalItem: { type: 'number', example: 18.9 },
                totalDescontoItem: { type: 'number', example: 0 },
                estoqueAtual: { type: 'number', example: 31 },
                precoTabelaAtual: { type: 'number', example: 17.04 },
                precoPromocionalAtual: { type: 'number', example: 0 },
                produtoAtivoNoEstoque: { type: 'boolean', nullable: true, example: true },
              },
            },
          },
        },
      },
      VendasClienteResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Compras do cliente consultadas com sucesso' },
          cliente: {
            type: 'object',
            properties: {
              codigoCliente: { type: 'integer', nullable: true, example: 18027401 },
              codigoCadastro: { type: 'integer', example: 180430901 },
              nomeCompleto: { type: 'string', example: 'LEONARDO SILVA CASTRO' },
              cpfCnpj: { type: 'string', example: '04563315222' },
              tipoPessoa: { type: 'string', example: 'Física' },
              clienteAtivo: { type: 'boolean', example: true },
            },
          },
          relacionamentosUtilizados: {
            type: 'array',
            items: { type: 'string' },
          },
          resumo: {
            type: 'object',
            properties: {
              totalVendas: { type: 'integer', example: 2 },
              totalBruto: { type: 'number', example: 754.77 },
              totalDesconto: { type: 'number', example: 0 },
              totalLiquido: { type: 'number', example: 754.77 },
              dataUltimaCompra: { type: 'string', format: 'date-time' },
              dataPrimeiraCompra: { type: 'string', format: 'date-time' },
              totalEmpresas: { type: 'integer', example: 1 },
              totalFuncionarios: { type: 'integer', example: 2 },
            },
          },
          paginacao: {
            type: 'object',
            properties: {
              pagina: { type: 'integer', example: 1 },
              limite: { type: 'integer', example: 20 },
              vendasNaPagina: { type: 'integer', example: 2 },
              incluirEliminadas: { type: 'boolean', example: false },
            },
          },
          vendas: {
            type: 'array',
            items: { $ref: '#/components/schemas/VendasClienteItem' },
          },
        },
      },
      FidelidadeResgatePremioItem: {
        type: 'object',
        properties: {
          codigoPremio: { type: 'integer', example: 1 },
          nomePremio: { type: 'string', example: 'Desconto na próxima compra' },
          pontos: { type: 'integer', example: 100 },
          quantidade: { type: 'integer', example: 1 },
          total: { type: 'integer', example: 100 },
          premioAtivo: { type: 'boolean', example: true },
        },
      },
      FidelidadeResgateItem: {
        type: 'object',
        properties: {
          codigoResgate: { type: 'integer', example: 10 },
          codigoLancamento: { type: 'integer', example: 50001 },
          dataLancamento: { type: 'string', format: 'date-time' },
          pontosResgate: { type: 'integer', example: 200 },
          observacao: { type: 'string', nullable: true, example: 'Resgate parcial' },
          auditoria: {
            type: 'object',
            properties: {
              codigoEstacao: { type: 'integer', nullable: true, example: 1 },
            },
          },
          premios: {
            type: 'array',
            items: { $ref: '#/components/schemas/FidelidadeResgatePremioItem' },
          },
          origemPontos: {
            type: 'array',
            nullable: true,
            items: {
              type: 'object',
              properties: {
                codigoFidelidade: { type: 'integer', example: 99 },
                descricaoFidelidade: { type: 'string', example: 'Fidelidade Cliente' },
                pontosUtilizados: { type: 'integer', example: 200 },
                dataOrigem: { type: 'string', format: 'date-time' },
              },
            },
          },
          vinculoComercial: {
            type: 'array',
            nullable: true,
            items: {
              type: 'object',
              properties: {
                codigoVenda: { type: 'string', example: '9001' },
                dataVenda: { type: 'string', format: 'date-time' },
                totalVenda: { type: 'number', example: 299.9 },
                descricaoVenda: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      FidelidadeResgateResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Resgates de fidelidade consultados com sucesso' },
          cliente: {
            type: 'object',
            properties: {
              codigoCliente: { type: 'integer', nullable: true, example: 18027401 },
              codigoCadastro: { type: 'integer', example: 180430901 },
              nome: { type: 'string', example: 'LEONARDO SILVA CASTRO' },
              cpfCnpj: { type: 'string', nullable: true, example: '04563315222' },
              tipoPessoa: { type: 'string', example: 'Física' },
              ativo: { type: 'boolean', example: true },
            },
          },
          resumo: {
            type: 'object',
            properties: {
              totalResgates: { type: 'integer', example: 2 },
              totalPontosResgatados: { type: 'integer', example: 450 },
              totalPremios: { type: 'integer', example: 3 },
              periodoAnalisado: {
                type: 'object',
                properties: {
                  inicio: { type: 'string', format: 'date-time' },
                  fim: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          resgates: {
            type: 'array',
            items: { $ref: '#/components/schemas/FidelidadeResgateItem' },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check da API e banco',
        responses: {
          200: {
            description: 'API e banco conectados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    banco: { type: 'string', example: 'conectado' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Falha de conexao com banco',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'erro' },
                    banco: { type: 'string', example: 'desconectado' },
                  },
                },
              },
            },
          },
          pontosOrigemCliente: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigoFidelidade: { type: 'integer', example: 1912601 },
                dataVencimento: { type: 'string', format: 'date-time' },
                pontosOrigem: { type: 'integer', example: 2000 },
                saldoOrigem: { type: 'integer', example: 24 },
              },
            },
          },
        },
      },
    },
    '/tabelas': {
      get: {
        tags: ['Tabelas'],
        summary: 'Lista todas as tabelas do banco',
        responses: {
          200: {
            description: 'Lista de tabelas',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      esquema: { type: 'string', example: 'dbo' },
                      tabela: { type: 'string', example: 'Cadastro' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/tabelas/{nome}/colunas': {
      get: {
        tags: ['Tabelas'],
        summary: 'Lista colunas de uma tabela',
        parameters: [
          {
            name: 'nome',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Lista de colunas',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      coluna: { type: 'string', example: 'CodigoCadastro' },
                      tipo: { type: 'string', example: 'int' },
                      nulo: { type: 'string', example: 'NO' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/tabelas/{nome}/dados': {
      get: {
        tags: ['Tabelas'],
        summary: 'Consulta dados de uma tabela com paginacao',
        parameters: [
          {
            name: 'nome',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: {
            description: 'Dados paginados',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PagedResponse' },
              },
            },
          },
          404: {
            description: 'Tabela nao encontrada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/tabelas/cadastro/diagnostico': {
      get: {
        tags: ['Tabelas'],
        summary: 'Diagnostico de relacionamentos por cadastro',
        parameters: [
          { name: 'codigoCadastro', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'compararCodigoCadastro', in: 'query', schema: { type: 'integer' } },
          { name: 'sample', in: 'query', schema: { type: 'integer', default: 5 } },
          { name: 'scanLimit', in: 'query', schema: { type: 'integer', default: 200 } },
        ],
        responses: {
          200: {
            description: 'Diagnostico concluido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          400: {
            description: 'Parametro invalido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/tabelas/cadastro/varredura-geral': {
      get: {
        tags: ['Tabelas'],
        summary: 'Varredura geral de ocorrencias de dados do cadastro',
        parameters: [
          { name: 'codigoCadastro', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'sample', in: 'query', schema: { type: 'integer', default: 3 } },
          { name: 'tableLimit', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Varredura concluida',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    '/cadastro': {
      get: {
        tags: ['Cadastro'],
        summary: 'Lista cadastros com paginacao',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'nome', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Cadastros paginados',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PagedResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cadastro'],
        summary: 'Cria novo cadastro',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CadastroCreateRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Cadastro criado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          400: {
            description: 'Payload invalido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/cadastro/com-convenio': {
      get: {
        tags: ['Cadastro'],
        summary: 'Lista clientes com convenio por titulo',
        parameters: [
          { name: 'titulo', in: 'query', schema: { type: 'string', default: 'FIDELICARD' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: {
            description: 'Clientes com convenio paginados',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PagedResponse' },
              },
            },
          },
        },
      },
    },
    '/cadastro/{codigo}': {
      get: {
        tags: ['Cadastro'],
        summary: 'Busca cadastro por CodigoCadastro',
        parameters: [
          {
            name: 'codigo',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: {
            description: 'Cadastro encontrado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          404: {
            description: 'Cadastro nao encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Cadastro'],
        summary: 'Atualiza todos os campos editaveis do cadastro',
        parameters: [
          {
            name: 'codigo',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CadastroUpdateRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Cadastro atualizado com PUT',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mensagem: { type: 'string' },
                    dados: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
          400: {
            description: 'Payload invalido no PUT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Cadastro'],
        summary: 'Atualiza parcialmente campos do cadastro',
        parameters: [
          {
            name: 'codigo',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CadastroUpdateRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Cadastro atualizado com PATCH',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mensagem: { type: 'string' },
                    dados: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/fidelidade-ponto/{codigoCadastro}': {
      get: {
        tags: ['Fidelidade Ponto'],
        summary: 'Consulta pontos de fidelidade por CodigoCadastro',
        parameters: [
          { name: 'codigoCadastro', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'incluirExpirados', in: 'query', schema: { type: 'boolean', default: true } },
          { name: 'orderBy', in: 'query', schema: { type: 'string', enum: ['data', 'saldo'], default: 'data' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: {
          200: {
            description: 'Pontos consultados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    '/fidelidade-ponto/{codigoCadastro}/resumo': {
      get: {
        tags: ['Fidelidade Ponto'],
        summary: 'Resumo de pontos por CodigoCadastro',
        parameters: [
          { name: 'codigoCadastro', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Resumo retornado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mensagem: { type: 'string' },
                    cliente: { type: 'string' },
                    resumo: {
                      type: 'object',
                      properties: {
                        totalPontosAcumulados: { type: 'integer' },
                        totalSaldoDisponivel: { type: 'integer' },
                        totalTransacoes: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/fidelidade-ponto/cliente/{codigoCliente}': {
      get: {
        tags: ['Fidelidade Ponto'],
        summary: 'Consulta pontos por CodigoCliente',
        parameters: [
          { name: 'codigoCliente', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Pontos consultados via codigo cliente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    '/fidelidade-premio': {
      get: {
        tags: ['Fidelidade Premio'],
        summary: 'Lista premios de fidelidade',
        responses: {
          200: {
            description: 'Premios listados',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FidelidadePremioListResponse' },
              },
            },
          },
        },
      },
    },
    '/fidelidade-resgate/cliente/{identificador}': {
      get: {
        tags: ['Fidelidade Resgate'],
        summary: 'Lista resgates e premios de fidelidade por cliente',
        parameters: [
          { name: 'identificador', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'incluirDetalhes', in: 'query', schema: { type: 'boolean', default: true } },
        ],
        responses: {
          200: {
            description: 'Resgates retornados com premios e detalhes',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FidelidadeResgateResponse' },
              },
            },
          },
          400: {
            description: 'Identificador invalido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Cliente nao encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/fidelidade-resgate/cliente/{identificador}/premios': {
      get: {
        tags: ['Fidelidade Resgate'],
        summary: 'Lista achatada de todos os premios resgatados por cliente',
        parameters: [
          { name: 'identificador', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'incluirDetalhes', in: 'query', schema: { type: 'boolean', default: true } },
        ],
        responses: {
          200: {
            description: 'Lista achatada de prêmios retornada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mensagem: { type: 'string' },
                    cliente: { $ref: '#/components/schemas/ClienteMini' },
                    resumo: {
                      type: 'object',
                      properties: {
                        totalResgates: { type: 'integer' },
                        totalPontosResgatados: { type: 'integer' },
                        totalPremios: { type: 'integer' },
                        periodoAnalisado: {
                          type: 'object',
                          properties: {
                            inicio: { type: 'string', format: 'date-time' },
                            fim: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                    premios: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          codigoResgate: { type: 'integer' },
                          codigoLancamento: { type: 'integer' },
                          dataLancamento: { type: 'string', format: 'date-time' },
                          pontosResgate: { type: 'integer' },
                          codigoPremio: { type: 'integer' },
                          nomePremio: { type: 'string' },
                          pontos: { type: 'integer' },
                          quantidade: { type: 'integer' },
                          total: { type: 'integer' },
                          premioAtivo: { type: 'boolean' },
                          origemPontos: { type: 'array', items: { type: 'object', additionalProperties: true } },
                          vinculoComercial: { type: 'array', items: { type: 'object', additionalProperties: true } },
                          pontosOrigemCliente: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                codigoFidelidade: { type: 'integer' },
                                dataVencimento: { type: 'string', format: 'date-time' },
                                pontosOrigem: { type: 'integer' },
                                saldoOrigem: { type: 'integer' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/vendas/cliente/{codigoCadastro}': {
      get: {
        tags: ['Vendas'],
        summary: 'Lista compras e itens por cliente (CodigoCadastro)',
        parameters: [
          { name: 'codigoCadastro', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'incluirEliminadas', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          200: {
            description: 'Compras retornadas com resumo e detalhes',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VendasClienteResponse' },
              },
            },
          },
        },
      },
    },
  },
};

const swaggerUiOptions = {
  customSiteTitle: 'Minha API - Swagger',
};

module.exports = {
  swaggerUi,
  swaggerUiOptions,
  swaggerSpec,
};
