const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Minha API - Documentacao',
    version: '1.0.0',
    description:
      'Documentacao dos endpoints disponiveis: metodos HTTP, parametros, payloads e formatos de resposta.',
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
                schema: {
                  type: 'object',
                  properties: {
                    mensagem: { type: 'string' },
                    total: { type: 'integer' },
                    premios: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          codigoPremio: { type: 'integer' },
                          nomePremio: { type: 'string' },
                          pontos: { type: 'integer' },
                          ativo: { type: 'boolean' },
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
