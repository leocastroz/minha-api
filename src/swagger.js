const swaggerUi = require('swagger-ui-express');

const apiPort = process.env.PORT || 4000;

const objectAny = {
  type: 'object',
  additionalProperties: true,
};

const arrayOfObjects = {
  type: 'array',
  items: objectAny,
};

function jsonResponse(description, schema = objectAny) {
  return {
    description,
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

function htmlResponse(description) {
  return {
    description,
    content: {
      'text/html': {
        schema: { type: 'string' },
      },
    },
  };
}

function errorResponse(description = 'Erro') {
  return jsonResponse(description, { $ref: '#/components/schemas/ErrorResponse' });
}

function pathParam(name, schema, description) {
  return {
    name,
    in: 'path',
    required: true,
    schema,
    description,
  };
}

function queryParam(name, schema, description, required = false) {
  return {
    name,
    in: 'query',
    required,
    schema,
    description,
  };
}

function requestBody(schema, required = true) {
  return {
    required,
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

const paginationParams = [
  queryParam('page', { type: 'integer', default: 1, minimum: 1 }, 'Pagina do resultado.'),
  queryParam('limit', { type: 'integer', default: 50, minimum: 1 }, 'Quantidade de registros por pagina.'),
];

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Minha API - Documentacao',
    version: '1.0.0',
    description:
      'Documentacao das rotas Express disponiveis neste projeto. A interface Swagger fica em /docs/ e o JSON bruto fica em /docs.json.',
  },
  servers: [
    {
      url: `http://localhost:${apiPort}`,
      description: 'Servidor local',
    },
  ],
  tags: [
    { name: 'Docs', description: 'Documentacao interativa e spec OpenAPI.' },
    { name: 'Health', description: 'Status da API e conexao com banco.' },
    { name: 'Tabelas', description: 'Inspecao de tabelas, colunas e dados.' },
    { name: 'Cadastro', description: 'Cadastro de pessoas/clientes e rotinas de duplicidade.' },
    { name: 'Fidelidade Ponto', description: 'Consulta de pontos de fidelidade.' },
    { name: 'Fidelidade Premio', description: 'CRUD de premios de fidelidade.' },
    { name: 'Fidelidade Resgate', description: 'Historico de resgates e premios resgatados.' },
    { name: 'Vendas', description: 'Historico de compras por cliente.' },
  ],
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        additionalProperties: true,
        properties: {
          error: { type: 'string', example: 'Mensagem de erro' },
          erro: { type: 'string', example: 'Mensagem de erro' },
          mensagem: { type: 'string', example: 'Detalhes do erro' },
        },
      },
      TableItem: {
        type: 'object',
        properties: {
          esquema: { type: 'string', example: 'dbo' },
          tabela: { type: 'string', example: 'Cadastro' },
        },
      },
      TableColumn: {
        type: 'object',
        properties: {
          coluna: { type: 'string', example: 'CodigoCadastro' },
          tipo: { type: 'string', example: 'int' },
          nulo: { type: 'string', example: 'NO' },
        },
      },
      PagedResponse: {
        type: 'object',
        properties: {
          pagina: { type: 'integer', example: 1 },
          limite: { type: 'integer', example: 50 },
          total: { type: 'integer', example: 10 },
          dados: arrayOfObjects,
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
          vincularConvenioFidelicard: { type: 'boolean', default: true },
          tituloConvenio: { type: 'string', default: 'FIDELICARD' },
        },
      },
      CadastroUpdateRequest: {
        type: 'object',
        properties: {
          CodigoEmpresa: { type: 'integer', example: 1 },
          CodigoLancamento: { type: 'string', example: '1001' },
          Nome: { type: 'string', example: 'LEONARDO' },
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
      CadastroDuplicadosDeleteRequest: {
        type: 'object',
        required: ['dataInicio', 'dataFim'],
        properties: {
          dataInicio: { type: 'string', format: 'date', example: '2025-01-01' },
          dataFim: { type: 'string', format: 'date', example: '2025-12-31' },
          manter: {
            type: 'string',
            enum: ['mais_antigo', 'mais_recente'],
            default: 'mais_antigo',
          },
          estrategia: {
            type: 'string',
            enum: ['excluir', 'marcar_eliminado', 'forcar_exclusao'],
            default: 'excluir',
          },
          apenasSimular: { type: 'boolean', default: false },
        },
      },
      FidelidadePremioItem: {
        type: 'object',
        properties: {
          codigoPremio: { type: 'integer', example: 1 },
          nomePremio: { type: 'string', example: 'Desconto na proxima compra' },
          pontos: { type: 'integer', example: 1000 },
          ativo: { type: 'boolean', example: true },
        },
      },
      FidelidadePremioCreateRequest: {
        type: 'object',
        required: ['nomePremio'],
        properties: {
          nomePremio: { type: 'string', example: 'Desconto na proxima compra' },
          pontos: { type: 'number', example: 1000 },
          ativo: { type: 'boolean', default: true },
        },
      },
      FidelidadePremioUpdateRequest: {
        type: 'object',
        properties: {
          nomePremio: { type: 'string', example: 'Desconto na proxima compra' },
          pontos: { type: 'number', example: 1000 },
          ativo: { type: 'boolean', example: true },
        },
      },
      FidelidadePremioListResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Premios consultados com sucesso' },
          total: { type: 'integer', example: 3 },
          premios: {
            type: 'array',
            items: { $ref: '#/components/schemas/FidelidadePremioItem' },
          },
        },
      },
      ClienteMini: {
        type: 'object',
        properties: {
          codigoCliente: { type: 'integer', nullable: true, example: 123 },
          codigoCadastro: { type: 'integer', example: 456 },
          nomeCompleto: { type: 'string', example: 'LEONARDO SILVA' },
          cpfCnpj: { type: 'string', nullable: true, example: '12345678901' },
          tipoPessoa: { type: 'string', example: 'Fisica' },
          ativo: { type: 'boolean', nullable: true, example: true },
        },
      },
      FidelidadePontoResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string' },
          cadastro: objectAny,
          resumoPontos: objectAny,
          pontos: arrayOfObjects,
          filtros: objectAny,
        },
      },
      FidelidadeResgateResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string' },
          cliente: objectAny,
          resumo: objectAny,
          resgates: arrayOfObjects,
        },
      },
      FidelidadeResgatePremiosResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string' },
          cliente: objectAny,
          resumo: objectAny,
          premios: arrayOfObjects,
        },
      },
      VendasClienteResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string' },
          cliente: objectAny,
          relacionamentosUtilizados: {
            type: 'array',
            items: { type: 'string' },
          },
          resumo: objectAny,
          paginacao: objectAny,
          vendas: arrayOfObjects,
        },
      },
    },
  },
  paths: {
    '/docs/': {
      get: {
        tags: ['Docs'],
        summary: 'Exibe a interface Swagger UI',
        responses: {
          200: htmlResponse('HTML da documentacao Swagger.'),
        },
      },
    },
    '/docs.json': {
      get: {
        tags: ['Docs'],
        summary: 'Retorna o spec OpenAPI em JSON',
        responses: {
          200: jsonResponse('Spec OpenAPI utilizado pelo Swagger UI.', objectAny),
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica status da API e conexao com banco',
        responses: {
          200: jsonResponse('API e banco conectados.', {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              banco: { type: 'string', example: 'conectado' },
            },
          }),
          500: jsonResponse('Falha de conexao com banco.', {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'erro' },
              banco: { type: 'string', example: 'desconectado' },
            },
          }),
        },
      },
    },
    '/tabelas': {
      get: {
        tags: ['Tabelas'],
        summary: 'Lista todas as tabelas do banco',
        responses: {
          200: jsonResponse('Lista de tabelas.', {
            type: 'array',
            items: { $ref: '#/components/schemas/TableItem' },
          }),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/tabelas/{nome}/colunas': {
      get: {
        tags: ['Tabelas'],
        summary: 'Lista colunas de uma tabela',
        parameters: [
          pathParam('nome', { type: 'string', example: 'Cadastro' }, 'Nome da tabela.'),
        ],
        responses: {
          200: jsonResponse('Lista de colunas.', {
            type: 'array',
            items: { $ref: '#/components/schemas/TableColumn' },
          }),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/tabelas/{nome}/dados': {
      get: {
        tags: ['Tabelas'],
        summary: 'Lista dados de uma tabela com paginacao',
        parameters: [
          pathParam('nome', { type: 'string', example: 'Cadastro' }, 'Nome da tabela.'),
          ...paginationParams,
        ],
        responses: {
          200: jsonResponse('Dados paginados da tabela.', { $ref: '#/components/schemas/PagedResponse' }),
          404: errorResponse('Tabela nao encontrada.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/tabelas/cadastro/diagnostico': {
      get: {
        tags: ['Tabelas'],
        summary: 'Diagnostica relacionamentos de um cadastro',
        parameters: [
          queryParam('codigoCadastro', { type: 'integer', example: 180681501 }, 'CodigoCadastro analisado.', true),
          queryParam('compararCodigoCadastro', { type: 'integer', example: 180681601 }, 'Cadastro opcional para comparacao.'),
          queryParam('sample', { type: 'integer', default: 5 }, 'Quantidade de exemplos por ocorrencia.'),
          queryParam('scanLimit', { type: 'integer', default: 200 }, 'Limite de colunas/tabelas inspecionadas.'),
        ],
        responses: {
          200: jsonResponse('Diagnostico concluido.', objectAny),
          400: errorResponse('Parametro invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/tabelas/cadastro/varredura-geral': {
      get: {
        tags: ['Tabelas'],
        summary: 'Faz varredura geral por ocorrencias de um cadastro',
        parameters: [
          queryParam('codigoCadastro', { type: 'integer', example: 180430901 }, 'CodigoCadastro analisado.', true),
          queryParam('sample', { type: 'integer', default: 3 }, 'Quantidade de exemplos por ocorrencia.'),
          queryParam('tableLimit', { type: 'integer', default: 0 }, 'Limite de tabelas; 0 analisa todas.'),
        ],
        responses: {
          200: jsonResponse('Varredura concluida.', objectAny),
          400: errorResponse('Parametro invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/cadastro': {
      get: {
        tags: ['Cadastro'],
        summary: 'Lista cadastros com filtros opcionais',
        parameters: [
          ...paginationParams,
          queryParam('nome', { type: 'string', example: 'FRANCISCA' }, 'Filtro por nome.'),
          queryParam('CPFCNPJ', { type: 'string', example: '12345678900' }, 'Filtro por CPF/CNPJ.'),
          queryParam('cpfcnpj', { type: 'string', example: '12345678900' }, 'Alias minusculo para CPF/CNPJ.'),
        ],
        responses: {
          200: jsonResponse('Cadastros paginados.', { $ref: '#/components/schemas/PagedResponse' }),
          500: errorResponse('Erro interno.'),
        },
      },
      post: {
        tags: ['Cadastro'],
        summary: 'Cria cadastro e vincula cliente/convenio quando solicitado',
        requestBody: requestBody({ $ref: '#/components/schemas/CadastroCreateRequest' }),
        responses: {
          201: jsonResponse('Cadastro criado com sucesso.', objectAny),
          400: errorResponse('Payload invalido.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/cadastro/com-convenio': {
      get: {
        tags: ['Cadastro'],
        summary: 'Lista clientes vinculados a um convenio por titulo',
        parameters: [
          queryParam('titulo', { type: 'string', default: 'FIDELICARD' }, 'Titulo ou parte do nome do convenio.'),
          ...paginationParams,
        ],
        responses: {
          200: jsonResponse('Clientes com convenio paginados.', { $ref: '#/components/schemas/PagedResponse' }),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/cadastro/duplicados': {
      get: {
        tags: ['Cadastro'],
        summary: 'Lista CPF/CNPJ duplicados',
        parameters: [
          ...paginationParams,
          queryParam('comPontosValidos', { type: 'boolean', default: false }, 'Retorna somente grupos com saldo de pontos valido.'),
          queryParam('dataInicio', { type: 'string', format: 'date', example: '2025-01-01' }, 'Data inicial de DataCadastro.'),
          queryParam('dataFim', { type: 'string', format: 'date', example: '2025-12-31' }, 'Data final de DataCadastro.'),
          queryParam('incluirEliminados', { type: 'boolean', default: false }, 'Inclui registros com Eliminado=1.'),
        ],
        responses: {
          200: jsonResponse('Grupos duplicados retornados.', objectAny),
          400: errorResponse('Filtro invalido.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/cadastro/duplicados/excluir-em-massa': {
      delete: {
        tags: ['Cadastro'],
        summary: 'Exclui ou marca como eliminado cadastros duplicados em massa',
        description:
          'Use apenasSimular=true para fazer dry-run. A estrategia forcar_exclusao remove tambem historico relacionado previsto no codigo.',
        requestBody: requestBody({ $ref: '#/components/schemas/CadastroDuplicadosDeleteRequest' }),
        responses: {
          200: jsonResponse('Operacao executada ou simulada.', objectAny),
          400: errorResponse('Payload invalido.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/cadastro/{codigo}': {
      get: {
        tags: ['Cadastro'],
        summary: 'Busca cadastro por CodigoCadastro',
        parameters: [
          pathParam('codigo', { type: 'integer', example: 180430901 }, 'CodigoCadastro.'),
        ],
        responses: {
          200: jsonResponse('Cadastro encontrado.', objectAny),
          400: errorResponse('CodigoCadastro invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
      put: {
        tags: ['Cadastro'],
        summary: 'Atualiza todos os campos editaveis de um cadastro',
        description: 'No PUT, o codigo exige todos os campos editaveis definidos em CAMPOS_EDITAVEIS.',
        parameters: [
          pathParam('codigo', { type: 'integer', example: 180430901 }, 'CodigoCadastro.'),
        ],
        requestBody: requestBody({ $ref: '#/components/schemas/CadastroUpdateRequest' }),
        responses: {
          200: jsonResponse('Cadastro atualizado com PUT.', objectAny),
          400: errorResponse('Payload ou codigo invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
      patch: {
        tags: ['Cadastro'],
        summary: 'Atualiza parcialmente campos editaveis de um cadastro',
        parameters: [
          pathParam('codigo', { type: 'integer', example: 180430901 }, 'CodigoCadastro.'),
        ],
        requestBody: requestBody({ $ref: '#/components/schemas/CadastroUpdateRequest' }),
        responses: {
          200: jsonResponse('Cadastro atualizado com PATCH.', objectAny),
          400: errorResponse('Payload ou codigo invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
      delete: {
        tags: ['Cadastro'],
        summary: 'Deleta cadastro por CodigoCadastro',
        description:
          'Remove vinculos de Cliente_Convenio e Cliente antes de remover o Cadastro, conforme implementado na rota.',
        parameters: [
          pathParam('codigo', { type: 'integer', example: 180430901 }, 'CodigoCadastro.'),
        ],
        responses: {
          200: jsonResponse('Cadastro deletado com sucesso.', objectAny),
          400: errorResponse('CodigoCadastro invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-ponto/{codigoCadastro}': {
      get: {
        tags: ['Fidelidade Ponto'],
        summary: 'Consulta pontos por CodigoCadastro',
        parameters: [
          pathParam('codigoCadastro', { type: 'integer', example: 180430901 }, 'CodigoCadastro.'),
          queryParam('incluirExpirados', { type: 'boolean', default: true }, 'Inclui pontos com saldo 0/expirados.'),
          queryParam('orderBy', { type: 'string', enum: ['data', 'saldo'], default: 'data' }, 'Campo usado na ordenacao.'),
          queryParam('limit', { type: 'integer', default: 100, maximum: 1000 }, 'Limite de registros.'),
        ],
        responses: {
          200: jsonResponse('Pontos consultados.', { $ref: '#/components/schemas/FidelidadePontoResponse' }),
          400: errorResponse('CodigoCadastro invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-ponto/{codigoCadastro}/resumo': {
      get: {
        tags: ['Fidelidade Ponto'],
        summary: 'Consulta resumo de pontos por CodigoCadastro',
        parameters: [
          pathParam('codigoCadastro', { type: 'integer', example: 180430901 }, 'CodigoCadastro.'),
        ],
        responses: {
          200: jsonResponse('Resumo consultado.', objectAny),
          400: errorResponse('CodigoCadastro invalido.'),
          404: errorResponse('Cadastro nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-ponto/cliente/{codigoCliente}': {
      get: {
        tags: ['Fidelidade Ponto'],
        summary: 'Consulta pontos por CodigoCliente',
        parameters: [
          pathParam('codigoCliente', { type: 'integer', example: 123 }, 'CodigoCliente.'),
        ],
        responses: {
          200: jsonResponse('Pontos consultados via CodigoCliente.', { $ref: '#/components/schemas/FidelidadePontoResponse' }),
          400: errorResponse('CodigoCliente invalido.'),
          404: errorResponse('Cliente nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-premio': {
      get: {
        tags: ['Fidelidade Premio'],
        summary: 'Lista premios de fidelidade',
        responses: {
          200: jsonResponse('Premios listados.', { $ref: '#/components/schemas/FidelidadePremioListResponse' }),
          500: errorResponse('Erro interno.'),
        },
      },
      post: {
        tags: ['Fidelidade Premio'],
        summary: 'Cria premio de fidelidade',
        requestBody: requestBody({ $ref: '#/components/schemas/FidelidadePremioCreateRequest' }),
        responses: {
          201: jsonResponse('Premio criado.', objectAny),
          400: errorResponse('Payload invalido.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-premio/{codigo}': {
      put: {
        tags: ['Fidelidade Premio'],
        summary: 'Atualiza premio de fidelidade',
        parameters: [
          pathParam('codigo', { type: 'integer', example: 1 }, 'CodigoPremio.'),
        ],
        requestBody: requestBody({ $ref: '#/components/schemas/FidelidadePremioUpdateRequest' }),
        responses: {
          200: jsonResponse('Premio atualizado.', objectAny),
          400: errorResponse('Payload ou codigo invalido.'),
          404: errorResponse('Premio nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
      delete: {
        tags: ['Fidelidade Premio'],
        summary: 'Desativa ou remove premio de fidelidade',
        parameters: [
          pathParam('codigo', { type: 'integer', example: 1 }, 'CodigoPremio.'),
          queryParam('force', { type: 'boolean', default: false }, 'true faz exclusao fisica; padrao faz soft-delete.'),
        ],
        responses: {
          200: jsonResponse('Premio removido/desativado.', objectAny),
          400: errorResponse('Codigo invalido.'),
          404: errorResponse('Premio nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-resgate/cliente/{identificador}': {
      get: {
        tags: ['Fidelidade Resgate'],
        summary: 'Lista resgates de fidelidade por cliente',
        description:
          'O identificador aceita CodigoCliente numerico ou CPFCNPJ. Quando usar CPF/CNPJ com barra, envie a barra URL-encoded.',
        parameters: [
          pathParam('identificador', { type: 'string', example: '12345678901' }, 'CodigoCliente ou CPFCNPJ.'),
          queryParam('incluirDetalhes', { type: 'boolean', default: true }, 'Inclui origem dos pontos e vinculo comercial.'),
        ],
        responses: {
          200: jsonResponse('Resgates retornados.', { $ref: '#/components/schemas/FidelidadeResgateResponse' }),
          400: errorResponse('Identificador invalido.'),
          404: errorResponse('Cliente nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/fidelidade-resgate/cliente/{identificador}/premios': {
      get: {
        tags: ['Fidelidade Resgate'],
        summary: 'Lista premios resgatados por cliente',
        description:
          'Retorna os premios de resgates em formato achatado para consumo pelo front-end.',
        parameters: [
          pathParam('identificador', { type: 'string', example: '12345678901' }, 'CodigoCliente ou CPFCNPJ.'),
          queryParam('incluirDetalhes', { type: 'boolean', default: true }, 'Inclui origem dos pontos e vinculo comercial.'),
        ],
        responses: {
          200: jsonResponse('Premios resgatados retornados.', { $ref: '#/components/schemas/FidelidadeResgatePremiosResponse' }),
          400: errorResponse('Identificador invalido.'),
          404: errorResponse('Cliente nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
    '/vendas/cliente/{identificador}': {
      get: {
        tags: ['Vendas'],
        summary: 'Lista compras de um cliente',
        description:
          'Aceita CodigoCadastro, CodigoCliente ou CPFCNPJ. Quando usar CPF/CNPJ com barra, envie a barra URL-encoded.',
        parameters: [
          pathParam('identificador', { type: 'string', example: '12345678901' }, 'CodigoCadastro, CodigoCliente ou CPFCNPJ.'),
          queryParam('page', { type: 'integer', default: 1, minimum: 1 }, 'Pagina do resultado.'),
          queryParam('limit', { type: 'integer', default: 20, minimum: 1, maximum: 200 }, 'Quantidade de vendas por pagina.'),
          queryParam('incluirEliminadas', { type: 'boolean', default: false }, 'Inclui vendas eliminadas.'),
        ],
        responses: {
          200: jsonResponse('Compras retornadas com resumo e itens.', { $ref: '#/components/schemas/VendasClienteResponse' }),
          400: errorResponse('Identificador invalido.'),
          404: errorResponse('Cliente nao encontrado.'),
          500: errorResponse('Erro interno.'),
        },
      },
    },
  },
};

const swaggerUiOptions = {
  customSiteTitle: 'Minha API - Swagger',
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    operationsSorter: 'alpha',
    tagsSorter: 'alpha',
    persistAuthorization: true,
  },
};

module.exports = {
  swaggerUi,
  swaggerUiOptions,
  swaggerSpec,
};
