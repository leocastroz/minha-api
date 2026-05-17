# Documentação Técnica — Banco de Dados INOVAFARMA_DPOPPARA

**Sistema:** INOVAFARMA (ERP Farmácia)
**Banco:** SQL Server · Schema: `dbo`
**Data da análise:** Maio/2026
**Analista:** Gerado por análise automatizada do script `dbo.sql`

---

## Sumário

1. [Resumo Arquitetural](#1-resumo-arquitetural)
2. [Estatísticas Gerais](#2-estatísticas-gerais)
3. [Tabelas Críticas do Sistema](#3-tabelas-críticas-do-sistema)
4. [Separação por Módulos de Negócio](#4-separação-por-módulos-de-negócio)
5. [Relacionamentos Explícitos (FK Declaradas)](#5-relacionamentos-explícitos-fk-declaradas)
6. [Relacionamentos Implícitos por Nomenclatura](#6-relacionamentos-implícitos-por-nomenclatura)
7. [Diagrama Textual de Dependências](#7-diagrama-textual-de-dependências)
8. [Tabelas Órfãs e Isoladas](#8-tabelas-órfãs-e-isoladas)
9. [Problemas Estruturais Identificados](#9-problemas-estruturais-identificados)
10. [Sugestões de Foreign Keys Faltantes](#10-sugestões-de-foreign-keys-faltantes)
11. [Índices Relevantes](#11-índices-relevantes)
12. [Fluxo de Dependência entre Tabelas](#12-fluxo-de-dependência-entre-tabelas)

---

## 1. Resumo Arquitetural

O banco **INOVAFARMA_DPOPPARA** é um ERP completo voltado para o segmento farmacêutico, estruturado no SQL Server com schema único `dbo`. A arquitetura segue o padrão ERP legado, caracterizado por:

- **Entidade central de rastreabilidade:** A tabela `Lancamento` é o pivô de toda operação — toda transação relevante (venda, compra, financeiro, caixa, boleto, cobrança) possui um `CodigoLancamento` que registra empresa, usuário, data e estação de origem.

- **Entidade central de pessoas/empresas:** A tabela `Cadastro` concentra todos os cadastros de pessoas físicas e jurídicas (clientes, fornecedores, funcionários). Especializações são feitas via tabelas satélite (`Cliente`, `Funcionario`, `Fornecedor`) que referenciam `Cadastro`.

- **Entidade central de configuração:** A tabela `Config` é o registro mestre de cada filial/empresa do sistema. Toda entidade operacional referencia `Config.CodigoEmpresa`, possibilitando multi-empresa.

- **Padrão ERP legado:** A maioria dos relacionamentos entre módulos é feita via colunas de nomenclatura semântica (ex: `CodigoProduto`, `CodigoCliente`) sem Foreign Key explícita declarada — prática comum em sistemas legados para evitar travamentos em operações em lote.

- **Módulos identificados:** Vendas, Compras, Fiscal/NF-e, Financeiro, Estoque, Caixa, Convênio/Plano, PBM (Farmácia Popular/Benefício de Medicamento), SNGPC (Anvisa), Fidelidade, Recarga, Entrega/TeleEntrega, E-Commerce, Auditoria/Log, Sincronismo e Integrações externas.

---

## 2. Estatísticas Gerais

| Métrica | Valor |
|---|---|
| Total de tabelas | **551** |
| Foreign Keys explícitas declaradas | **777** |
| Tabelas referenciadas por ao menos 1 FK | **209** |
| Tabelas sem nenhuma FK (entrada ou saída) | **170** |
| Tabelas mais referenciadas (top 5) | `Lancamento` (89x), `Config` (86x), `Produto` (51x), `Fiscal` (25x), `Funcionario` (24x) |

---

## 3. Tabelas Críticas do Sistema

As tabelas a seguir são o núcleo do sistema. Qualquer operação de manutenção, migração ou alteração estrutural deve começar por elas.

### 3.1 `Lancamento` — Pivô Transacional Central

```sql
CREATE TABLE dbo.Lancamento (
    CodigoLancamento bigint NOT NULL PRIMARY KEY,
    CodigoEmpresa    smallint NOT NULL,  -- → Config
    DataLancamento   smalldatetime DEFAULT getdate(),
    CodigoUsuario    int NOT NULL,       -- → Usuario
    Operacao         smallint NULL,
    CodigoEstacao    bigint NULL         -- → Config_Estacao
)
```

**Criticidade:** MÁXIMA. É referenciada por 89 tabelas diferentes. Representa o registro de toda ação no sistema: cada venda, compra, caixa aberto/fechado, financeiro, boleto, etc. possui exatamente um `CodigoLancamento`. É o audit trail básico do sistema.

**Índices:** `IX_EX_Lancamento_CodigoEmpresa_CodigoLancamento` (composto) e `IX_EX_Lancamento_DataLancamento` — ambos cobrem os filtros mais comuns.

---

### 3.2 `Config` — Mestre de Empresas/Filiais

Tabela de configuração de cada empresa cadastrada no sistema. É referenciada por 86 tabelas. Contém centenas de parâmetros operacionais, fiscais, de integração e comportamentais do ERP. Suporta multi-empresa e multi-filial via `CodigoEmpresa`.

**Campos-chave internos:** `CodigoEmpresaMatriz` (hierarquia), `SimplesNacional`, `NFe`, `SNGPC`, `TEF`, `FarmaciaRegime`, entre centenas de configurações booleanas.

---

### 3.3 `Cadastro` — Entidade Pessoas/Empresas

```sql
CREATE TABLE dbo.Cadastro (
    CodigoCadastro int NOT NULL PRIMARY KEY,
    CodigoEmpresa  smallint NOT NULL,  -- → Config
    CodigoLancamento bigint NOT NULL,  -- → Lancamento
    Nome           varchar(80) NOT NULL,
    CPFCNPJ        varchar(18),
    Pessoa         tinyint,            -- 1=PF, 2=PJ
    Sexo           char(1),
    DataNascimento smalldatetime,
    Eliminado      bit DEFAULT 0
)
```

Tabela raiz de cadastro único. Clientes, fornecedores e funcionários são especializações que referenciam `CodigoCadastro`. Referenciada por 19 tabelas.

---

### 3.4 `Produto` — Catálogo de Produtos

Referenciada por 51 tabelas. Contém NCM, código de barras, grupo, fórmula, fabricante, classe terapêutica, dados fiscais (PIS/COFINS CST), CEST, controle SNGPC, registro MS, e dezenas de atributos. É o produto do sistema farmacêutico — medicamentos, cosméticos, correlatos.

---

### 3.5 `Venda` — Cabeçalho de Venda

```sql
CREATE TABLE dbo.Venda (
    CodigoVenda    bigint NOT NULL PRIMARY KEY,
    CodigoEmpresa  smallint NOT NULL,
    CodigoLancamento bigint NOT NULL,   -- → Lancamento
    CodigoFuncionario int NOT NULL,     -- → Funcionario
    CodigoConvenio int NULL,            -- → Convenio (implícito)
    CodigoCadastro int NOT NULL,        -- → Cadastro
    TotalBruto     money,
    TotalDesconto  money,
    TotalLiquido   money,
    Eliminado      bit DEFAULT 0
)
```

Referenciada por 17 tabelas. Cabeçalho de cada venda realizada. O detalhamento dos itens fica em `Venda_Produto`. Pagamentos em `Venda_FP` e `Venda_Pagamento`. Documentos fiscais associados via `Lancamento`.

---

### 3.6 `Fiscal` — Documentos Fiscais (NF-e / NFC-e)

```sql
CREATE TABLE dbo.Fiscal (
    CodigoFiscal   bigint NOT NULL PRIMARY KEY,
    CodigoLancamento bigint NOT NULL,   -- → Lancamento
    NumeroNota     char(6),
    ChaveAcesso    varchar(44),
    CodigoNatureza smallint NOT NULL,   -- → Fiscal_Natureza
    CodigoCadastro int NOT NULL,        -- → Cadastro
    CodigoEmpresa  smallint NOT NULL,   -- → Config
    Modelo         varchar(2),          -- 55=NF-e, 65=NFC-e
    Cancelada      bit,
    Situacao       varchar(2)
)
```

Referenciada por 25 tabelas. Registra toda nota fiscal emitida ou importada (NF-e, NFC-e, SAT). Suporta NF-e (modelo 55) e NFC-e (modelo 65).

---

### 3.7 `Financeiro` e `Financeiro_Valor` — Módulo Financeiro

`Financeiro` é o cabeçalho de cada movimento financeiro. `Financeiro_Valor` é o coração das parcelas/recebimentos — referenciada por 23 tabelas. Todo boleto, cartão, cheque, espécie e compensação aponta para um `CodigoValor` em `Financeiro_Valor`.

---

### 3.8 `Compra` — Cabeçalho de Compra/Entrada

Referenciada por 8 tabelas. Registra entradas de mercadoria. Itens em `Compra_Produto`. XML de NF-e de entrada em `Compra_NFe`. Diferenças de conferência em `Compra_Produto_Diferenca`.

---

### 3.9 `Caixa_Abertura` — Controle de Caixa

Referenciada por 7 tabelas. Representa um turno de caixa aberto. `Caixa_Fechamento` registra o encerramento. `Caixa_Fechamento_Especie`, `Caixa_Fechamento_Troco` e `Caixa_Fechamento_Conferido` são os detalhes do fechamento.

---

### 3.10 `Funcionario` — Funcionários e Vendedores

Referenciada por 24 tabelas. Especialização de `Cadastro`. Todo operador de caixa, vendedor e farmacêutico é um `Funcionario`. Cada venda, caixa, log e comissão aponta para `CodigoFuncionario`.

---

## 4. Separação por Módulos de Negócio

### Módulo 1 — PRODUTO / CATÁLOGO

Tabelas de domínio e configuração do produto farmacêutico:

| Tabela | Tipo | Descrição |
|---|---|---|
| `Produto` | Transacional | Catálogo principal de produtos |
| `Produto_Grupo` | Domínio | Grupos/categorias de produto |
| `Produto_ClasseTerapeutica` | Domínio | Classes terapêuticas (Anvisa) |
| `Produto_Fabricante` | Domínio | Fabricantes |
| `Produto_Substancia` | Domínio | Substâncias ativas (SNGPC) |
| `Produto_Substancia_Lista` | Domínio | Listas de controle especial (A1, B1, C1...) |
| `Produto_Formula` | Domínio | Fórmulas magistrais |
| `Produto_Formula_Substancia` | Rel. N:N | Substâncias por fórmula |
| `Produto_Unidade` | Domínio | Unidades de medida (CX, CP, FR...) |
| `Produto_Sessao` | Domínio | Sessões de gôndola |
| `Produto_NCM` | Domínio | Tabela NCM |
| `Produto_NCM_Tributo` | Domínio | Tributação por NCM |
| `Produto_NCM_UF` | Domínio | ICMS por NCM e UF |
| `Produto_NCM_CEST` | Domínio | CEST por NCM |
| `Produto_NCM_Decreto` | Domínio | Decretos estaduais |
| `Produto_Fiscal_UF` | Transacional | Tributação específica por produto e UF |
| `Produto_Fiscal_UF_Interestadual` | Transacional | ICMS interestadual por produto |
| `Produto_Fiscal_Empresa` | Transacional | Parâmetros fiscais por empresa |
| `Produto_Estoque` | Transacional | Saldo de estoque por produto/empresa/lote |
| `Produto_Estoque_Lote` | Transacional | Detalhamento por lote |
| `Produto_Estoque_Oferta` | Auxiliar | Estoque em oferta |
| `Produto_CodigoBarra` | Auxiliar | Códigos de barra adicionais |
| `Produto_Alternativo` | Auxiliar | Produtos alternativos/substitutos |
| `Produto_Fornecedor` | Rel. N:N | Fornecedores por produto |
| `Produto_Lista` / `Produto_Lista_Produto` | Domínio | Listas de preço externas |
| `Produto_Kit` | Auxiliar | Kits de produto |
| `Produto_Localizacao` | Auxiliar | Localização física na gôndola |
| `Produto_Etiqueta` | Auxiliar | Etiquetas pendentes |
| `Produto_Atualizacao` | Log | Atualizações de preço importadas |
| `Produto_ECommerce` | Integração | Dados de produto para e-commerce |
| `Produto_Imposto_Estadual` / `Federal` | Fiscal | Impostos calculados |
| `Produto_RegistroMS` | Domínio | Registros Ministério da Saúde |
| `ProdutoGrupo` | Legado | Grupo antigo (duplicata de `Produto_Grupo`?) |
| `Produto_Inventario_Grupo` / `Analitica` / `Sintetica` | Domínio | Grupos de inventário |
| `Produto_Status` | Auxiliar | Status de produto |
| `IBPTax` / `IBPTax_Versao` | Domínio | Tabela IBPT (carga tributária aproximada) |
| `NCM_Valido` | Domínio | Valida NCM SEFAZ |

---

### Módulo 2 — VENDA / PDV

| Tabela | Tipo | Descrição |
|---|---|---|
| `Venda` | Transacional | Cabeçalho de venda |
| `Venda_Produto` | Transacional | Itens da venda |
| `Venda_Produto_Lote` | Transacional | Lote do item vendido |
| `Venda_Produto_Desconto` | Transacional | Descontos por item |
| `Venda_Produto_Descricao` | Transacional | Descrição livre do item |
| `Venda_Produto_PBM` | Transacional | Benefício PBM no item |
| `Venda_Produto_Prescritor` | Transacional | Prescritor do item (SNGPC) |
| `Venda_FP` | Transacional | Forma de pagamento da venda |
| `Venda_Pagamento` | Transacional | Pagamentos (parcelas) |
| `Venda_Identificacao` | Transacional | Identificação do cliente na venda |
| `Venda_PBM` / `Venda_PBM_Baixa` | Transacional | Processamento PBM na venda |
| `Venda_Devolucao` | Transacional | Devoluções de venda |
| `Venda_Operacao` | Domínio | Tipos de operação de venda |
| `Venda_Autorizado` | Auxiliar | Autorizações de venda (senha) |
| `Venda_ECommerce` | Integração | Venda originada de e-commerce |
| `Venda_Entrega` | Transacional | Entrega vinculada à venda |
| `Venda_WebConvenio` | Integração | Venda por convênio web |
| `Venda_Programa_Fidelidade` | Transacional | Pontos de fidelidade na venda |
| `Venda_Produto_Oferecer` | Auxiliar | Produtos oferecidos na venda |
| `Orcamento` | Transacional | Orçamentos (pré-venda) |
| `Orcamento_Produto` | Transacional | Itens do orçamento |
| `Orcamento_Produto_Lote` | Transacional | Lote do item do orçamento |
| `Orcamento_Cupom` / `DAV` / `PV` / `Venda` | Transacional | Subtipagens de orçamento |
| `Plano_Venda` | Domínio | Planos de venda (à vista, prazo, cartão) |
| `Plano_Pagamento` | Domínio | Formas de pagamento disponíveis |
| `Plano_Venda_Periodo` | Domínio | Prazos por plano de venda |

---

### Módulo 3 — COMPRA / ESTOQUE / TRANSFERÊNCIA

| Tabela | Tipo | Descrição |
|---|---|---|
| `Compra` | Transacional | Cabeçalho de entrada/compra |
| `Compra_Produto` | Transacional | Itens da compra |
| `Compra_Produto_Diferenca` | Transacional | Divergências na conferência |
| `Compra_Produto_Extensao` | Transacional | Dados adicionais do item |
| `Compra_Produto_Fiscal` | Transacional | Dados fiscais do item de compra |
| `Compra_Produto_Reajuste` | Transacional | Reajuste de preço na compra |
| `Compra_NFe` | Transacional | XML/chave da NF-e de entrada |
| `Compra_Pedido` | Transacional | Pedidos eletrônicos a fornecedor |
| `Compra_Pedido_Produto` | Transacional | Itens do pedido |
| `Compra_Pedido_Conexao` | Config | Configuração de conexão para pedido |
| `Compra_Pedido_Conexao_Empresa` | Config | Empresas por conexão |
| `Compra_Pedido_Conexao_Fornecedor` | Config | Fornecedores por conexão |
| `Compra_Falta` / `Falta_Compra` / `Falta_Entrega` / `Falta_Pedido` | Transacional | Controle de faltas |
| `Compra_Dotacao` / `Dotacao_Produto` | Transacional | Dotação orçamentária de compras |
| `Compra_Tip` / `Tip_Condicao` / `Tip_Produto` | Transacional | TIP — transferência interna de produto |
| `Compra_Vinculo` | Transacional | Vínculo compra ↔ pedido ↔ fiscal |
| `Estoque_Movimentacao` | Transacional | Movimentos de estoque |
| `Estoque_Movimentacao_Produto` | Transacional | Itens do movimento |
| `Estoque_Movimentacao_Produto_Lote` | Transacional | Lote do item movimentado |
| `Estoque_Movimentacao_Fiscal` | Transacional | Fiscal vinculado ao movimento |
| `Estoque_Movimentacao_Grupo` | Domínio | Grupos de movimentação |
| `Estoque_Transferencia` | Transacional | Transferências entre filiais |
| `Estoque_Transferencia_Produto` | Transacional | Itens da transferência |
| `Estoque_Transferencia_Produto_Lote` | Transacional | Lote transferido |
| `Estoque_Transferencia_Fiscal` | Transacional | NF de transferência |
| `Estoque_Transferencia_Operacao` | Domínio | Tipos de operação de transferência |
| `Estoque_Balanco` | Transacional | Balanço/inventário de estoque |
| `Estoque_Balanco_Produto` | Transacional | Produtos no balanço |
| `Estoque_Balanco_Fechamento` | Transacional | Fechamento do balanço |
| `Estoque_Balanco_Fechamento_Produto` | Transacional | Produto fechado no balanço |
| `Estoque_Precificacao` | Transacional | Precificação de produtos |
| `Estoque_Movimentacao_Emprestimo` | Transacional | Empréstimos de estoque |

---

### Módulo 4 — FISCAL / NF-e / NFC-e

| Tabela | Tipo | Descrição |
|---|---|---|
| `Fiscal` | Transacional | Nota fiscal emitida/importada |
| `Fiscal_Produto` | Transacional | Itens da nota fiscal |
| `Fiscal_Produto_Extensao` | Transacional | Dados adicionais do item |
| `Fiscal_Produto_Reducao` | Transacional | Reduções (devoluções/ST) |
| `Fiscal_Pagamento` | Transacional | Formas de pagamento na nota |
| `Fiscal_Pagamento_Cartao` | Transacional | Detalhe cartão na nota |
| `Fiscal_NFe` | Transacional | XML e protocolo de autorização da NF-e |
| `Fiscal_NFe_Cancelado` | Transacional | NF-e canceladas |
| `Fiscal_Evento` | Transacional | Eventos da NF-e (CCe, cancelamento) |
| `Fiscal_Evento_Cancelado` | Transacional | Cancelamento de evento |
| `Fiscal_Natureza` | Domínio | CFOP e natureza de operação |
| `Fiscal_Natureza_BaseICMS` | Domínio | Base de cálculo ICMS por natureza |
| `Fiscal_Natureza_CSTCSOSN_ICMS` | Domínio | CST/CSOSN por natureza |
| `Fiscal_Natureza_IBS_CBS` | Domínio | Reforma tributária — IBS/CBS |
| `Fiscal_Natureza_Codigo_Beneficio` | Domínio | Código de benefício fiscal |
| `Fiscal_PISCofins` | Domínio | Situações tributárias PIS/COFINS |
| `Fiscal_PISCofins_Natureza` | Domínio | CST PIS/COFINS por natureza |
| `Fiscal_CSTCSOSN_ICMS` | Domínio | Tabela de CST/CSOSN ICMS |
| `Fiscal_Correlacao_CFOPCST_Novo` | Domínio | Correlação CFOP ↔ CST |
| `Fiscal_Correlacao_CFOPCST_Regra_Novo` | Domínio | Regras de correlação |
| `Fiscal_Aliquota` | Domínio | Alíquotas por UF |
| `Fiscal_Inventario` / `Fiscal_Inventario_Produto` | Transacional | Inventário fiscal (SPED) |
| `Fiscal_Contingencia_Inutilizar` | Auxiliar | Inutilização de numeração |
| `Fiscal_Inutilizacao` | Auxiliar | Inutilizações executadas |
| `Fiscal_Identificacao_DFe` | Auxiliar | Identificação de documentos fiscais |
| `Fiscal_Retencoes` | Transacional | Retenções de impostos |
| `Fiscal_Ressarcimento` | Transacional | Ressarcimento ICMS-ST |
| `Classificacao_Tributaria_IBSCBS` | Domínio | Classificação IBS/CBS — Reforma tributária |
| `ECF_*` (11 tabelas) | Legado | Emissor de Cupom Fiscal (ECF — hardware legado) |
| `Sped` / `Sped_Config` / `Sped_Configuracao` / `Sped_Inventario` | Auxiliar | SPED Fiscal/Contribuições |
| `Manifestacao` / `Manifestacao_CCe` / `Manifestacao_Evento` / `Manifestacao_NFe` | Transacional | Manifestação do destinatário (NF-e) |
| `Transmissao` / `Transmissao_Tipo` / `Transmissao_Venda` | Auxiliar | Transmissão de documentos |
| `Gestor_Tributario_Envio` | Integração | Envio para gestor tributário externo |
| ` Imendes_Envio` / `Omendes_*` | Integração | Integração iMendes (tabela de preços) |

---

### Módulo 5 — FINANCEIRO / CONTAS A PAGAR E RECEBER

| Tabela | Tipo | Descrição |
|---|---|---|
| `Financeiro` | Transacional | Cabeçalho do movimento financeiro |
| `Financeiro_Valor` | Transacional | Parcela/título financeiro (núcleo) |
| `Financeiro_Valor_Especie` | Transacional | Recebimento em espécie |
| `Financeiro_Valor_Cartao` | Transacional | Recebimento em cartão |
| `Financeiro_Valor_Cheque` | Transacional | Recebimento em cheque |
| `Financeiro_Valor_Banco` | Transacional | Transferência bancária |
| `Financeiro_Valor_Carteira_Digital` | Transacional | Recebimento em carteira digital |
| `Financeiro_Valor_Duplicata` | Transacional | Duplicata mercantil |
| `Financeiro_Valor_Desconto` | Transacional | Desconto financeiro |
| `Financeiro_Valor_Encargo` | Transacional | Encargos/juros |
| `Financeiro_Valor_Juro` | Transacional | Juros individuais |
| `Financeiro_Valor_Grupo` | Transacional | Grupo contábil do valor |
| `Financeiro_Valor_Fluxo` | Transacional | Fluxo de caixa |
| `Financeiro_Valor_Agendado` | Transacional | Valores agendados |
| `Financeiro_Valor_Compensacao` | Transacional | Compensações |
| `Financeiro_Valor_Renegociacao` | Transacional | Renegociações de dívida |
| `Financeiro_Valor_Vinculo` | Transacional | Vínculo entre valores |
| `Financeiro_Valor_Historico` | Log | Histórico de alterações |
| `Financeiro_Pendente` | Transacional | Títulos em aberto |
| `Financeiro_Pendente_Parcela` | Transacional | Parcelas pendentes |
| `Financeiro_Pendente_Operacao` | Transacional | Operações pendentes |
| `Financeiro_Serie` | Transacional | Série financeira (agrupamento) |
| `Financeiro_Operacao` | Domínio | Tipos de operação financeira |
| `Conta` | Transacional | Plano de contas simplificado |
| `Conta_Grupo` | Domínio | Grupos do plano de contas (DRE) |
| `Conta_Banco` | Transacional | Conta bancária cadastrada |
| `Conta_Banco_Carteira` | Domínio | Carteiras bancárias |
| `Boleto` | Transacional | Boletos gerados |
| `Boleto_Remessa` | Transacional | Arquivo de remessa bancária |
| `Boleto_Remessa_Boleto` | Rel. N:N | Boletos na remessa |
| `Boleto_Retorno` | Transacional | Arquivo de retorno bancário |
| `Boleto_Retorno_Baixa` | Transacional | Baixas do retorno |
| `Cobranca` | Transacional | Cobranças a clientes |
| `Cobranca_Valor` | Transacional | Valores cobrados |
| `Cobranca_Baixa` | Transacional | Baixas de cobrança |
| `Extrato` | Log | Extrato financeiro |
| `Concil_*` (6 tabelas) | Integração | Conciliação bancária automática |
| `Lancamento` | Núcleo | Log de toda transação |

---

### Módulo 6 — CAIXA / PDV FÍSICO

| Tabela | Tipo | Descrição |
|---|---|---|
| `Caixa_Config` | Domínio | Configuração dos caixas físicos |
| `Caixa_Abertura` | Transacional | Abertura de turno de caixa |
| `Caixa_Fechamento` | Transacional | Fechamento de turno |
| `Caixa_Fechamento_Especie` | Transacional | Conferência de espécie no fechamento |
| `Caixa_Fechamento_Troco` | Transacional | Troco do fechamento |
| `Caixa_Fechamento_Conferido` | Transacional | Conferência do fechamento |
| `Caixa` | Transacional | Movimentos do caixa |
| `TEF` / `TEF_Empresa` | Config | Configuração de TEF (pagamento eletrônico) |
| `Adquirente` | Config | Adquirentes de cartão cadastrados |
| `Adquirente_Bandeira` | Config | Bandeiras por adquirente |
| `Adquirente_Bandeira_Tarifa` | Config | Tarifas por bandeira/plano |
| `Adquirente_Meio` | Config | Meios de pagamento do adquirente |
| `Adquirente_Meio_Pagamento` | Config | Formas de pagamento |
| `Adquirente_Plano` | Domínio | Planos de pagamento do adquirente |
| `Adquirente_Rede_Tef` | Config | Rede TEF por adquirente |
| `Cartao_Operadora` | Domínio | Operadoras de cartão |
| `Cartao_Operadora_Plano` | Domínio | Planos por operadora |
| `Cartao_Rede` | Domínio | Redes de cartão |
| `Carteira_Digital_Pagamento` | Transacional | Pagamentos via carteira digital |
| `Carteira_Digital_Transferencia` | Transacional | Transferências via carteira digital |

---

### Módulo 7 — CLIENTE / CONVÊNIO / PLANO

| Tabela | Tipo | Descrição |
|---|---|---|
| `Cadastro` | Núcleo | Pessoas físicas/jurídicas |
| `Cliente` | Transacional | Dados específicos do cliente |
| `Cliente_Tipo` | Domínio | Tipos de cliente |
| `Cliente_Convenio` | Rel. N:N | Convênios do cliente |
| `Cliente_Continuo` | Transacional | Medicamentos de uso contínuo |
| `Cliente_Bloqueio` | Auxiliar | Bloqueios do cliente |
| `Cliente_Autorizacao` | Auxiliar | Autorizações especiais |
| `Cliente_Desconto` | Config | Descontos por produto para o cliente |
| `Cliente_Trabalho` | Auxiliar | Empresa/trabalho do cliente |
| `Convenio` | Domínio | Convênios/planos cadastrados |
| `Convenio_Desconto` | Config | Descontos por convênio |
| `Convenio_Fechamento` | Transacional | Fechamento de conta do convênio |
| `Convenio_Fechamento_Fiscal` | Transacional | NF do fechamento de convênio |
| `Convenio_Fechamento_Valor` | Transacional | Valores do fechamento |
| `Convenio_Permissao` | Config | Permissões de convênio |
| `Convenio_Promocao` | Config | Promoções do convênio |
| `Convenio_Layout_Planilha` | Config | Layout de exportação do convênio |
| `ClienteConvenioTemp` | Auxiliar | Tabela temporária de importação |
| `Desconto_Regra` | Config | Regras de desconto automático |
| `Desconto_Regra_Condicao` | Config | Condições das regras |
| `Desconto_Regra_Cliente` / `Convenio` | Config | Regras específicas por cliente/convênio |
| `Cobranca` | Transacional | Cobrança do cliente (conta a receber) |
| `Cadastro_LGPD` / `Cadastro_LGPD_Termo` / `LGPD_Termo` | Compliance | Consentimento LGPD |

---

### Módulo 8 — PBM (Programa de Benefício de Medicamentos)

| Tabela | Tipo | Descrição |
|---|---|---|
| `PBM` | Domínio | PBMs cadastrados (Farmácia Popular, Orizon, etc.) |
| `PBM_Config` | Config | Configuração por PBM |
| `PBM_Config_FP` | Config | Config específica Farmácia Popular |
| `PBM_Config_Comissao` | Config | Comissão do PBM |
| `PBM_Convenio` | Domínio | Convênios PBM |
| `PBM_Grupo` | Config | Grupos de produto para o PBM |
| `PBM_Linkedfarma` | Integração | Integração LinkedFarma |
| `PBM_ObjectPro` | Integração | Integração ObjectPro |
| `PBM_Orizon` | Integração | Integração Orizon |
| `Convcard` | Integração | Integração Convcard |
| `Comissao_Regra` | Config | Regras de comissão |
| `Comissao_Regra_Tipo` | Domínio | Tipos de regra de comissão |
| `Comissao_Regra_PBM` | Config | Comissão específica por PBM |
| `Comissao_Regra_Plano` | Config | Comissão por plano de venda |

---

### Módulo 9 — SNGPC (Anvisa — Medicamentos Controlados)

| Tabela | Tipo | Descrição |
|---|---|---|
| `SNGPC_Receita` | Transacional | Receituários registrados |
| `SNGPC_Receita_Produto` | Transacional | Produtos da receita |
| `SNGPC_Receita_Paciente` | Transacional | Paciente da receita |
| `SNGPC_Comprador` | Transacional | Comprador (não necessariamente o paciente) |
| `SNGPC_Prescritor` | Domínio | Médicos/prescritores cadastrados |
| `SNGPC_Entrada` | Transacional | Entrada de medicamento controlado |
| `SNGPC_Entrada_Produto` | Transacional | Produtos da entrada |
| `SNGPC_Entrada_Operacao` | Domínio | Tipos de operação de entrada |
| `SNGPC_Perda` | Transacional | Perdas de medicamento controlado |
| `SNGPC_Perda_Motivo` | Domínio | Motivos de perda |
| `SNGPC_Inventario` | Transacional | Inventário de controlados |
| `SNGPC_Inventario_Produto` | Transacional | Produtos no inventário |
| `SNGPC_Inventario_Finalizado` | Transacional | Inventários fechados |
| `SNGPC_Estoque` | Auxiliar | Posição de estoque de controlados |
| `SNGPC_Livro` | Auxiliar | Livro de registro (mapa) |
| `SNGPC_Envio` | Transacional | Envio ao SNGPC/Anvisa |
| `SNGPC_Envio_Receita` / `Entrada` / `Inventario` / `Perda` | Transacional | Detalhes do envio |
| `ExportarReceita` / `ExportarReceita_Produto` | Auxiliar | Exportação de receitas |

---

### Módulo 10 — FIDELIDADE / PONTOS

| Tabela | Tipo | Descrição |
|---|---|---|
| `Fidelidade` | Transacional | Cartão/conta de fidelidade do cliente |
| `Fidelidade_Ponto` | Transacional | Pontos acumulados |
| `Fidelidade_Regra` | Config | Regras de acúmulo |
| `Fidelidade_Regra_Empresa` | Config | Regra por empresa |
| `Fidelidade_Regra_Grupo` | Config | Regra por grupo de produto |
| `Fidelidade_Regra_Pagamento` | Config | Regra por forma de pagamento |
| `Fidelidade_Resgate` | Transacional | Resgate de pontos |
| `Fidelidade_Resgate_Lancamento` | Transacional | Lançamento do resgate |
| `Fidelidade_Resgate_Ponto` | Transacional | Pontos usados no resgate |
| `Fidelidade_Resgate_Premio` | Transacional | Prêmio do resgate |
| `Fidelidade_Premio` | Domínio | Catálogo de prêmios |

---

### Módulo 11 — RECARGA DE CELULAR / TV

| Tabela | Tipo | Descrição |
|---|---|---|
| `Recarga` | Transacional | Recargas realizadas |
| `Recarga_Operadora` | Domínio | Operadoras (Vivo, Claro...) |
| `Recarga_Produto` | Domínio | Produtos de recarga |
| `Recarga_Produto_DDD` | Config | DDD por produto de recarga |
| `Recarga_Distribuidora` | Domínio | Distribuidoras de recarga |
| `Recarga_OnLine` | Transacional | Recargas online processadas |
| `Recarga_Cancelada` | Transacional | Recargas canceladas |
| `Recarga_PIN` | Transacional | PINs de recarga |
| `Recarga_TV` | Transacional | Recargas de TV (Sky, Claro TV) |
| `Recarga_Operadora_Campo` | Config | Campos dinâmicos por operadora |

---

### Módulo 12 — ENTREGA / TELE-ENTREGA

| Tabela | Tipo | Descrição |
|---|---|---|
| `Entrega` | Transacional | Entregas agendadas/realizadas |
| `Entrega_Despacho` | Transacional | Despachos de entrega |
| `Entrega_Despacho_Finaliza` | Transacional | Finalização do despacho |
| `Venda_Entrega` | Transacional | Vínculo venda ↔ entrega |
| `Venda_Entrega_Efetivada` | Transacional | Entrega efetivada |
| `Venda_Entrega_Endereco` | Transacional | Endereço de entrega da venda |
| `Venda_Entrega_Saida` | Transacional | Saída da entrega |
| `TeleEntrega_Regra` | Config | Regras de tele-entrega |
| `TeleEntrega_Regra_Condicao` | Config | Condições da regra |
| `TeleEntrega_Regra_Condicao_Horario` | Config | Horários por regra |
| `TeleEntrega_Regra_Condicao_Total` | Config | Valor mínimo de entrega |
| `TeleEntrega_Regra_Empresa` | Config | Empresa por regra |

---

### Módulo 13 — PROMOÇÃO / PRECIFICAÇÃO

| Tabela | Tipo | Descrição |
|---|---|---|
| `Promocao` | Config | Promoções cadastradas |
| `Promocao_Produto` | Config | Produtos em promoção |
| `Promocao_DiaSemana` | Config | Dias da semana da promoção |
| `Promocao_Empresa` | Config | Empresa da promoção |
| `Promocao_Ecommerce` | Config | Promoção no e-commerce |
| `Oferta_Agrupamento` | Config | Agrupamento de ofertas |
| `Scanntech_Promocao` | Integração | Promoções via Scanntech |
| `Scanntech_Promocao_Condicao` | Integração | Condições Scanntech |
| `Scanntech_Promocao_Produto` | Integração | Produtos Scanntech |
| `Scanntech_Promocao_Pagamento` | Integração | Pagamentos Scanntech |
| `Scanntech_Promocao_Empresa` | Integração | Empresas Scanntech |
| `Config_CurvaABC` / `CurvaABC` | Auxiliar | Curva ABC de produtos |
| `Produto_Grupo_Preco` | Config | Preço por grupo de produto |

---

### Módulo 14 — AUDITORIA / LOG / SINCRONISMO

| Tabela | Tipo | Descrição |
|---|---|---|
| `Auditoria` | Log | Registro de toda alteração de dados |
| `Auditoria_Campo` | Log | Campos alterados por evento |
| `Auditoria_Sincronismo` | Log | Sincronismo de auditoria entre filiais |
| `Log` | Log | Log de operações do sistema |
| `Log_Campos` | Log | Campos do log |
| `Log_Tipo` | Domínio | Tipos de log |
| `Log_Leitura` | Log | Log de leituras de tela |
| `Log_Leitura_Tipo` | Domínio | Tipos de leitura |
| `Log_Historico` | Log | Histórico consolidado de log |
| `Log_Destino_Empresa` / `Log_Destino_Usuario` | Config | Destino de logs |
| `Log_Liberacao` | Log | Liberações por senha |
| `Log_Funcao_Usuario_Destino` | Config | Funções de destino por usuário |
| `Sincronismo_Grupo` | Config | Grupos de sincronismo entre filiais |
| `Sincronismo_Sequencia` | Config | Sequência de sincronismo |
| `Config_Tabela` | Config | Tabelas do sistema (metadados) |
| `Config_Tabela_Requerido` | Config | Campos obrigatórios por tabela |
| `Config_Integracao` | Config | Estado da integração por tabela |
| `Agendamento_Service` | Config | Jobs/agendamentos de serviço |
| `Agendamento_Service_Empresa` | Config | Empresa por agendamento |
| `Agendamento_Service_Historico` | Log | Histórico de execução do agendamento |
| `SchemaVersions` | Infraestrutura | Versões do schema (FluentMigrator ou similar) |
| `Versao` | Config | Versão do sistema |

---

### Módulo 15 — USUÁRIOS / ACESSO / SEGURANÇA

| Tabela | Tipo | Descrição |
|---|---|---|
| `Usuario` | Domínio | Usuários do sistema |
| `Usuario_Funcao` | Domínio | Funções/permissões disponíveis |
| `Usuario_Funcao_Grupo` | Domínio | Grupos de funções |
| `Usuario_Conta` | Config | Perfis de acesso |
| `Usuario_Conta_Funcao` | Rel. N:N | Permissões do perfil |
| `Usuario_Definicao` | Config | Definições personalizadas por usuário |
| `Usuario_Descarta_Aviso` | Auxiliar | Avisos descartados pelo usuário |
| `Acesso_Usuario` | Log | Log de acesso ao sistema |
| `Funcionario` | Transacional | Funcionários (especializa Cadastro) |
| `Funcionario_Tipo` | Domínio | Tipos de funcionário |
| `Funcionario_Comissao` | Transacional | Comissões calculadas |
| `Funcionario_Meta` | Config | Metas por funcionário |
| `Configuracao_Grid` | Config | Configuração de grids por usuário |
| `Preferencia` | Config | Preferências por usuário |
| `Parametros` | Config | Parâmetros globais do sistema |

---

### Módulo 16 — NOTIFICAÇÕES / POSTAGENS / EVENTOS

| Tabela | Tipo | Descrição |
|---|---|---|
| `Notificacao` | Domínio | Templates de notificação |
| `Notificacao_API` | Transacional | Notificações enviadas via API |
| `Notificacao_API_Destinatario` | Config | Destinatários da notificação |
| `Notificacao_API_Destinatario_Visualizacao` | Log | Visualizações das notificações |
| `Notificacao_Empresa` | Config | Notificações por empresa |
| `Notificacao_Evento` | Config | Eventos que disparam notificações |
| `Notificacao_Tipo` | Domínio | Tipos de notificação |
| `Notificacao_Notificar` | Transacional | Notificações pendentes |
| `Postagem` | Transacional | Postagens internas (mural/chat) |
| `Postagem_Destinatario` | Config | Destinatários da postagem |
| `Postagem_Leitura` | Log | Confirmações de leitura |
| `Evento` | Domínio | Eventos do sistema |
| `Evento_Tipo` | Domínio | Tipos de evento |
| `Evento_Destino` | Config | Destino do evento |
| `Evento_ID` | Transacional | Instâncias de eventos |
| `Evento_Operacao` | Config | Operações do evento |
| `Evento_Visualizado` | Log | Eventos visualizados |
| `Config_Whatsapp_Modelo` | Config | Templates WhatsApp |
| `Negociacao` / `Negociacao_Empresa` / `Negociacao_Item` | Transacional | Negociações comerciais |

---

## 5. Relacionamentos Explícitos (FK Declaradas)

Abaixo estão os relacionamentos principais declarados via `FOREIGN KEY` (amostra representativa dos 777 existentes):

### 5.1 Relacionamentos da tabela `Lancamento` (hub central)

```
Acesso_Usuario.CodigoEmpresa       → Config(CodigoEmpresa)
Acesso_Usuario.CodigoEstacao       → Config_Estacao(CodigoEstacao)
Acesso_Usuario.CodigoUsuario       → Usuario(CodigoUsuario)
Agendamento.CodigoLancamento       → Lancamento(CodigoLancamento)
Boleto_Remessa.CodigoLancamento    → Lancamento(CodigoLancamento)
Caixa_Abertura.CodigoLancamento    → Lancamento(CodigoLancamento)
Caixa_Fechamento.CodigoLancamento  → Lancamento(CodigoLancamento)
Cadastro.CodigoLancamento          → Lancamento(CodigoLancamento)
Cliente_Continuo.CodigoLancamento  → Lancamento(CodigoLancamento)
Cobranca.CodigoLancamento          → Lancamento(CodigoLancamento)
Comissao_Regra.CodigoLancamento    → Lancamento(CodigoLancamento)
```

### 5.2 Relacionamentos do módulo Produto

```
Produto.CodigoGrupo                → Produto_Grupo(CodigoGrupo)
Produto.CodigoFabricante           → Produto_Fabricante(CodigoFabricante)
Produto.CodigoFormula              → Produto_Formula(CodigoFormula)
Produto.CodigoClasseTerapeutica    → Produto_ClasseTerapeutica(CodigoClasseTerapeutica)
Produto.CodigoSessao               → Produto_Sessao(CodigoSessao)
Produto.CodigoGrupoInventario      → Produto_Inventario_Grupo(CodigoGrupoInventario)
Produto.PisCofinsCST               → Fiscal_PISCofins(CodigoCST)
Produto.UnidadeCompra              → Produto_Unidade(Sigla)
Produto.UnidadeVenda               → Produto_Unidade(Sigla)
Produto.UnidadeEmbalagem           → Produto_Unidade(Sigla)
Produto_Formula_Substancia.CodigoFormula → Produto_Formula(CodigoFormula)
Produto_Formula_Substancia.CodigoSubstancia → Produto_Substancia(CodigoSubstancia)
Produto_Substancia.CodigoClasseTerapeutica → Produto_ClasseTerapeutica(CodigoClasseTerapeutica)
Produto_Substancia.Lista           → Produto_Substancia_Lista(Lista)
Produto_NCM_UF.NCM                 → Produto_NCM(NCM)
Produto_NCM_UF.CodigoDecreto       → Produto_NCM_Decreto(CodigoDecreto)
Produto_NCM_UF.CodigoTributo       → Produto_NCM_Tributo(CodigoTributo)
Produto_Fiscal_UF.CodigoProduto    → Produto(CodigoProduto)
Produto_Fiscal_UF.CodigoTributo    → Produto_NCM_Tributo(CodigoTributo)
Produto_CodigoBarra.CodigoProduto  → Produto(CodigoProduto)
Produto_Alternativo.CodigoProduto  → Produto(CodigoProduto)
Produto_Lista_Produto.CodigoProduto → Produto(CodigoProduto)
Produto_Lista_Produto.CodigoLista  → Produto_Lista(CodigoLista)
Produto_Oferecer.CodigoProduto     → Produto(CodigoProduto)
Produto_Oferecer.CodigoProdutoOferecer → Produto(CodigoProduto)
Promocao_Produto.CodigoProduto     → Produto(CodigoProduto)
Promocao_Produto.CodigoPromocao    → Promocao(CodigoPromocao)
```

### 5.3 Relacionamentos do módulo Fiscal/NF-e

```
Fiscal_Natureza.CodigoGrupoMovimentacao → Estoque_Movimentacao_Grupo(CodigoGrupo)
Fiscal_Natureza.CodigoCorrelacao    → Fiscal_Correlacao_CFOPCST_Novo(CodigoCorrelacao)
Fiscal_Natureza.CodigoCST           → Fiscal_PISCofins(CodigoCST)
Fiscal_Natureza_BaseICMS.CodigoNatureza → Fiscal_Natureza(CodigoNatureza)
Fiscal_Natureza_CSTCSOSN_ICMS.CodigoNatureza → Fiscal_Natureza(CodigoNatureza)
Fiscal_Natureza_IBS_CBS.CodigoNatureza → Fiscal_Natureza(CodigoNatureza)
Fiscal_Natureza_Codigo_Beneficio.CodigoNatureza → Fiscal_Natureza(CodigoNatureza)
Fiscal_Natureza_Devolucao.CodigoNatureza → Fiscal_Natureza(CodigoNatureza)
IBPTax.UF                           → IBPTax_Versao(UF)
```

### 5.4 Relacionamentos do módulo Financeiro

```
Boleto.CodigoContaBanco            → Conta_Banco(CodigoContaBanco)
Boleto.CodigoValor                 → Financeiro_Valor(CodigoValor)
Cobranca_Valor.CodigoValor         → Financeiro_Valor(CodigoValor)
PBM_Config_FP.CodigoGrupo          → Conta_Grupo(CodigoGrupo)
Plano_Venda.CodigoGrupo            → Conta_Grupo(CodigoGrupo)
Plano_Venda.CodigoPagamento        → Plano_Pagamento(CodigoPagamento)
Plano_Venda_Periodo.CodigoPlano    → Plano_Venda(CodigoPlano)
```

### 5.5 Relacionamentos do módulo PBM

```
PBM_Convenio.CodigoPBM             → PBM(CodigoPBM)
PBM_Grupo.CodigoPBM                → PBM(CodigoPBM)
PBM_Grupo.CodigoGrupo              → Produto_Grupo(CodigoGrupo)
PBM_Config_FP.CodigoPBM            → PBM(CodigoPBM)
```

### 5.6 Relacionamentos Cadastro/Endereço

```
Cadastro_Cidade.UF                 → Cadastro_Cidade_UF(UF)
Cadastro_Bairro.CodigoCidade       → Cadastro_Cidade(CodigoCidade)
Cadastro_Endereco.CodigoCadastro   → Cadastro(CodigoCadastro)
Cadastro_Endereco.CodigoCidade     → Cadastro_Cidade(CodigoCidade)
Cadastro_Endereco.CodigoBairro     → Cadastro_Bairro(CodigoBairro)
Cadastro_Contato_Tipo.CodigoEspecie → Cadastro_Contato_Tipo_Especie(CodigoEspecie)
Agenda_Contato.CodigoContato       → Agenda(CodigoContato)
Agenda_Contato.CodigoTipo          → Cadastro_Contato_Tipo(CodigoTipo)
```

---

## 6. Relacionamentos Implícitos por Nomenclatura

Relacionamentos detectados por padrão de nomenclatura de coluna, **sem FK explícita**. São relacionamentos reais de negócio que o sistema resolve em código de aplicação.

### 6.1 `CodigoEmpresa` — presente em quase todas as tabelas

Toda tabela transacional possui `CodigoEmpresa smallint` que se relaciona implicitamente com `Config(CodigoEmpresa)`. Exemplos de tabelas sem FK explícita para `Config`:

```sql
-- Relacionamento implícito esperado:
Venda.CodigoEmpresa              → Config(CodigoEmpresa)
Compra.CodigoEmpresa             → Config(CodigoEmpresa)
Produto_Estoque.CodigoEmpresa    → Config(CodigoEmpresa)
SNGPC_Receita.CodigoEmpresa      → Config(CodigoEmpresa)
Fidelidade.CodigoEmpresa         → Config(CodigoEmpresa)
```

### 6.2 `CodigoProduto` — relacionamentos sem FK

```sql
Venda_Produto.CodigoProduto      → Produto(CodigoProduto)
Compra_Produto.CodigoProduto     → Produto(CodigoProduto)
SNGPC_Receita_Produto.CodigoProduto → Produto(CodigoProduto)
Estoque_Movimentacao_Produto.CodigoProduto → Produto(CodigoProduto)
Estoque_Transferencia_Produto.CodigoProduto → Produto(CodigoProduto)
Produto_Estoque.CodigoProduto    → Produto(CodigoProduto)
Recarga_Produto.CodigoProduto    → Produto(CodigoProduto)
Fidelidade_Regra_Grupo.CodigoGrupo → Produto_Grupo(CodigoGrupo)
```

### 6.3 `CodigoCliente` / `CodigoCadastro` — relacionamentos sem FK

```sql
Venda.CodigoCadastro             → Cadastro(CodigoCadastro)  ← sem FK
Financeiro.CodigoCadastro        → Cadastro(CodigoCadastro)  ← sem FK
SNGPC_Receita.CodigoCadastro     → Cadastro(CodigoCadastro)  ← sem FK
Fidelidade.CodigoCadastro        → Cadastro(CodigoCadastro)  ← sem FK
```

### 6.4 `CodigoFuncionario` — relacionamentos sem FK

```sql
Venda.CodigoFuncionario          → Funcionario(CodigoFuncionario)  ← sem FK
Estoque_Movimentacao.CodigoFuncionario → Funcionario(CodigoFuncionario)  ← sem FK
```

### 6.5 `CodigoConvenio` — relacionamentos sem FK

```sql
Venda.CodigoConvenio             → Convenio(CodigoConvenio)  ← sem FK
Venda_FP.CodigoConvenio          → Convenio(CodigoConvenio)  ← sem FK
Produto_Estoque.CodigoConvenio   → Convenio(CodigoConvenio)  ← sem FK
```

### 6.6 `CodigoPlano` — relacionamentos sem FK

```sql
Venda_FP.CodigoPlano             → Plano_Venda(CodigoPlano)  ← sem FK
Financeiro_Valor.CodigoPlano     → Plano_Venda(CodigoPlano)  ← sem FK
```

### 6.7 `CodigoFornecedor` — relacionamentos sem FK

```sql
Compra.CodigoFornecedor          → Fornecedor(CodigoFornecedor)  ← sem FK
Compra_Pedido.CodigoFornecedor   → Fornecedor(CodigoFornecedor)  ← sem FK
```

---

## 7. Diagrama Textual de Dependências

### 7.1 Hierarquia central do sistema

```
Config (empresa/filial)
  │
  ├── Lancamento (registro de toda transação)
  │     ├── Venda ──────────────── Venda_Produto ─── Produto
  │     │     ├── Venda_FP         Venda_Produto_Lote
  │     │     ├── Venda_PBM        Venda_Produto_PBM
  │     │     └── Venda_Pagamento  Venda_Produto_Prescritor
  │     │
  │     ├── Compra ─────────────── Compra_Produto ── Produto
  │     │     ├── Compra_NFe       Compra_Produto_Fiscal
  │     │     └── Compra_Pedido    Compra_Produto_Reajuste
  │     │
  │     ├── Fiscal ─────────────── Fiscal_Produto ── Produto
  │     │     ├── Fiscal_NFe       Fiscal_Produto_Extensao
  │     │     ├── Fiscal_Pagamento Fiscal_Produto_Reducao
  │     │     └── Fiscal_Evento
  │     │
  │     ├── Financeiro ──────────── Financeiro_Valor
  │     │     ├── Boleto           Financeiro_Valor_Cartao
  │     │     ├── Cobranca         Financeiro_Valor_Especie
  │     │     └── Extrato          Financeiro_Valor_Cheque
  │     │
  │     ├── Caixa_Abertura ─────── Caixa_Fechamento
  │     │     └── Caixa            Caixa_Fechamento_Especie
  │     │
  │     ├── Estoque_Movimentacao ─ Estoque_Movimentacao_Produto ─ Produto
  │     │     └── Estoque_Movimentacao_Fiscal
  │     │
  │     └── Agendamento
  │
  ├── Cadastro (pessoas/empresas)
  │     ├── Cliente ─────────── Cliente_Convenio ─── Convenio
  │     │     ├── Cliente_Continuo     (→ Produto)
  │     │     ├── Cliente_Bloqueio
  │     │     └── Cliente_Desconto
  │     │
  │     ├── Funcionario ─────── Funcionario_Comissao
  │     │     └── Funcionario_Meta
  │     │
  │     ├── Fornecedor
  │     ├── Cadastro_Contato
  │     ├── Cadastro_Endereco ─ Cadastro_Cidade ─── Cadastro_Cidade_UF
  │     │                       Cadastro_Bairro
  │     └── Cadastro_LGPD
  │
  ├── Produto (catálogo)
  │     ├── Produto_Estoque ──── Produto_Estoque_Lote
  │     ├── Produto_NCM ──────── Produto_NCM_UF ──── Produto_NCM_Tributo
  │     ├── Produto_Substancia ─ Produto_Formula_Substancia
  │     ├── Produto_Grupo ────── PBM_Grupo
  │     └── Produto_Fiscal_UF
  │
  └── Usuario (operadores)
        ├── Acesso_Usuario
        ├── Usuario_Funcao ─── Usuario_Funcao_Grupo
        └── Usuario_Conta ─── Usuario_Conta_Funcao
```

### 7.2 Fluxo de Venda

```
Caixa_Abertura
    │ (CodigoAbertura)
    ▼
Venda ─────────────────────────────────────────────────────┐
    │ CodigoLancamento → Lancamento (empresa, usuário, data)│
    │ CodigoCadastro   → Cadastro / Cliente                  │
    │ CodigoFuncionario→ Funcionario                         │
    │ CodigoConvenio   → Convenio (implícito)                │
    ▼                                                        │
Venda_Produto ──────────────────────────────────────────────┤
    │ CodigoProduto    → Produto                             │
    │ CodigoEstoque    → Produto_Estoque                     │
    ▼                                                        │
Venda_FP (forma de pagamento) ──────────────────────────────┤
    │ CodigoPlano      → Plano_Venda                         │
    ▼                                                        │
Fiscal (NF-e / NFC-e gerada) ───────────────────────────────┘
    │ CodigoLancamento → Lancamento (mesmo lançamento)
    ▼
Fiscal_NFe (XML + protocolo SEFAZ)
```

### 7.3 Fluxo de Compra

```
Compra_Pedido → (para o fornecedor)
    │ CodigoFornecedor → Fornecedor
    │ CodigoConexao    → Compra_Pedido_Conexao
    ▼
Compra (entrada da NF-e)
    │ CodigoLancamento → Lancamento
    │ CodigoFornecedor → Fornecedor
    ▼
Compra_Produto
    │ CodigoProduto    → Produto
    ▼
Estoque_Movimentacao (dá entrada no estoque)
    │ CodigoLancamento → Lancamento
    ▼
Produto_Estoque (saldo atualizado)
    ▼
Fiscal (NF-e de entrada registrada)
```

### 7.4 Fluxo Financeiro (Conta a Receber)

```
Venda (venda a prazo)
    ▼
Financeiro (movimento gerado)
    │ CodigoLancamento → Lancamento
    ▼
Financeiro_Valor (parcela individual)
    ├── Financeiro_Valor_Cartao  (se cartão)
    ├── Financeiro_Valor_Especie (se espécie)
    ├── Financeiro_Valor_Cheque  (se cheque)
    └── Boleto (se emitiu boleto)
            ├── Boleto_Remessa → arquivo CNAB
            └── Boleto_Retorno ← retorno bancário
                    └── Boleto_Retorno_Baixa (baixa automática)
```

---

## 8. Tabelas Órfãs e Isoladas

### 8.1 Tabelas sem nenhuma FK (entrada ou saída) — 170 tabelas

São candidatas a: tabelas de domínio puras, tabelas de staging/temp, tabelas de integração, ou tabelas legadas sem uso.

**Tabelas de domínio puro (esperado não ter FK):**
`Adquirente_Plano`, `Cadastro_Cidade_UF`, `Cadastro_Endereco_Tipo`, `Caixa_Config`, `Cartao_Rede`, `Cliente_Tipo`, `Concil_Processo_Fase`, `Concil_Processo_Status`, `Conta_Especie`, `Conta_Banco_Tabela`, `Fiscal_PISCofins`, `Fiscal_Pagamento_Forma`, `Fiscal_Pagamento_Forma_Cartao_Bandeira`, `Fornecedor_Tipo`, `Funcionario_Tipo`, `IBPTax_Versao`, `Log_Tipo`, `Log_Leitura_Tipo`, `NCM_Valido`, `Plano_Pagamento`, `Produto_ClasseTerapeutica`, `Produto_Fabricante`, `Produto_Sessao`, `Produto_Substancia_Lista`, `Produto_Unidade`, `Sincronismo_Grupo`, `Transmissao_Tipo`, `Usuario_Funcao_Grupo`.

**Tabelas de integração sem FK (prováveis relacionamentos via código):**
`Convcard`, `PBM_Linkedfarma`, `PBM_ObjectPro`, `PBM_Orizon`, `Scanntech_Promocao`, `Imensdes_*`, `Gestor_Tributario_Envio`, `Config_ECommerce`, `Ecommerce_Configuracao_Integracao`.

**Tabelas de staging/temp (descartáveis):**
`ClienteConvenioTemp`, `Produto_Lancamento_Temp`, `Financeiro_Valor_TEMP`, `SNGPC_Receita_Temp`.

**Tabelas legadas suspeitas (possível descontinuação):**
`ProdutoGrupo` (parece duplicata de `Produto_Grupo`), `Usuario_Funcao1` (possível cópia de `Usuario_Funcao`), `ECF_*` (hardware ECF/CF-e provavelmente descontinuado), `Parametros` (pode ter sido substituída por `Config_Valor`).

---

## 9. Problemas Estruturais Identificados

### 9.1 Duplicidade de tabelas

| Problema | Tabelas envolvidas | Risco |
|---|---|---|
| Grupo de produto duplicado | `Produto_Grupo` e `ProdutoGrupo` | ALTO — qual é a canônica? |
| Funções de usuário duplicadas | `Usuario_Funcao` e `Usuario_Funcao1` | MÉDIO — possível histórico |
| Grupo financeiro | `Conta_Grupo` e `Financeiro_Valor_Grupo` | BAIXO — podem ser propósitos distintos |
| Termos LGPD | `Cadastro_LGPD_Termo` e `LGPD_Termo` | MÉDIO — duplicata provável |

### 9.2 Tabelas temporárias persistidas em schema de produção

```sql
-- Estas tabelas não devem existir em produção:
ClienteConvenioTemp       -- sem PK, sem FK, nenhum índice
Produto_Lancamento_Temp   -- tabela de staging sem constraints
Financeiro_Valor_TEMP     -- idem
SNGPC_Receita_Temp        -- idem
```

**Risco:** Acúmulo silencioso de dados, sem limpeza automática. Podem causar crescimento indevido do banco.

### 9.3 Ausência de FK em colunas críticas da tabela `Venda`

A tabela mais central do sistema transacional não possui FK explícita para:
```sql
Venda.CodigoCadastro    -- → Cadastro (não declarado)
Venda.CodigoFuncionario -- → Funcionario (não declarado)
Venda.CodigoConvenio    -- → Convenio (não declarado)
Venda.CodigoEmpresa     -- → Config (não declarado)
```

### 9.4 Referência circular em `Conta_Grupo`

```sql
CONSTRAINT FK_Conta_Grupo_Conta_Grupo1 FOREIGN KEY (CodigoGrupoResultado)
    REFERENCES dbo.Conta_Grupo(CodigoGrupo)
```

Hierarquia auto-referencial (pai/filho). Válido para plano de contas, mas cuidado com recursão em consultas sem `MAXRECURSION`.

### 9.5 `Manifestacao_Evento` com FK auto-referencial inválida

```sql
CONSTRAINT FK_Manifestacao_Manifestacao_Evento FOREIGN KEY (CodigoManifestacao)
    REFERENCES dbo.Manifestacao_Evento(CodigoManifestacao)
```

Esta FK aponta a tabela para ela mesma na mesma coluna PK. Parece um erro de script — provavelmente deveria referenciar `Manifestacao(CodigoManifestacao)`.

### 9.6 Colunas `varbinary` na tabela `Config_Campo`

```sql
Config_Campo.NomeCampo  varbinary(255)
Config_Campo.Descricao  varbinary(MAX)
Config_Campo.NomeTipo   varbinary(255)
```

Dados textuais armazenados como binário. Pode indicar campo criptografado (proposital) ou erro de tipagem. Sem documentação adicional, é um risco de legibilidade e manutenção.

### 9.7 Ausência de FK em `Caixa_Abertura` (duplicata de constraint)

```sql
-- Duplicata de constraint no mesmo campo:
CONSTRAINT FK_Caixa_Abertura_Lancamento FOREIGN KEY (CodigoLancamento) REFERENCES ...Lancamento...
CONSTRAINT FK_Caixa_Abertura_Lancamento1 FOREIGN KEY (CodigoLancamento) REFERENCES ...Lancamento...
```

Constraint duplicada pode causar overhead desnecessário e indica inconsistência no script de geração.

### 9.8 Coluna `image` em tabelas de configuração

```sql
Config.ImagemLogo   image  -- tipo deprecated
Config.ImagemBanner image
Config_Imagem.ImagemLogo image
Config_Imagem.ImagemBanner image
```

O tipo `image` foi descontinuado no SQL Server. Deve ser migrado para `varbinary(MAX)`.

---

## 10. Sugestões de Foreign Keys Faltantes

Scripts SQL para criação das FKs implícitas mais críticas:

```sql
-- Módulo Venda: relacionamentos da tabela central sem FK
ALTER TABLE dbo.Venda
    ADD CONSTRAINT FK_Venda_Config
        FOREIGN KEY (CodigoEmpresa) REFERENCES dbo.Config(CodigoEmpresa);

ALTER TABLE dbo.Venda
    ADD CONSTRAINT FK_Venda_Cadastro
        FOREIGN KEY (CodigoCadastro) REFERENCES dbo.Cadastro(CodigoCadastro);

ALTER TABLE dbo.Venda
    ADD CONSTRAINT FK_Venda_Funcionario
        FOREIGN KEY (CodigoFuncionario) REFERENCES dbo.Funcionario(CodigoFuncionario);

ALTER TABLE dbo.Venda
    ADD CONSTRAINT FK_Venda_Convenio
        FOREIGN KEY (CodigoConvenio) REFERENCES dbo.Convenio(CodigoConvenio);

ALTER TABLE dbo.Venda
    ADD CONSTRAINT FK_Venda_Lancamento
        FOREIGN KEY (CodigoLancamento) REFERENCES dbo.Lancamento(CodigoLancamento);

-- Módulo Venda_Produto: itens sem FK para Produto
ALTER TABLE dbo.Venda_Produto
    ADD CONSTRAINT FK_Venda_Produto_Produto
        FOREIGN KEY (CodigoProduto) REFERENCES dbo.Produto(CodigoProduto);

ALTER TABLE dbo.Venda_Produto
    ADD CONSTRAINT FK_Venda_Produto_Venda
        FOREIGN KEY (CodigoVenda) REFERENCES dbo.Venda(CodigoVenda);

-- Módulo Compra: cabeçalho sem FK
ALTER TABLE dbo.Compra
    ADD CONSTRAINT FK_Compra_Config
        FOREIGN KEY (CodigoEmpresa) REFERENCES dbo.Config(CodigoEmpresa);

ALTER TABLE dbo.Compra
    ADD CONSTRAINT FK_Compra_Fornecedor
        FOREIGN KEY (CodigoFornecedor) REFERENCES dbo.Fornecedor(CodigoFornecedor);

-- Módulo Produto_Estoque: sem FK para Produto
ALTER TABLE dbo.Produto_Estoque
    ADD CONSTRAINT FK_Produto_Estoque_Produto
        FOREIGN KEY (CodigoProduto) REFERENCES dbo.Produto(CodigoProduto);

ALTER TABLE dbo.Produto_Estoque
    ADD CONSTRAINT FK_Produto_Estoque_Config
        FOREIGN KEY (CodigoEmpresa) REFERENCES dbo.Config(CodigoEmpresa);

-- Módulo Estoque_Movimentacao_Produto: sem FK
ALTER TABLE dbo.Estoque_Movimentacao_Produto
    ADD CONSTRAINT FK_Estoque_Mov_Produto_Produto
        FOREIGN KEY (CodigoProduto) REFERENCES dbo.Produto(CodigoProduto);

-- SNGPC: sem FK para Produto e Cadastro
ALTER TABLE dbo.SNGPC_Receita_Produto
    ADD CONSTRAINT FK_SNGPC_Receita_Produto_Produto
        FOREIGN KEY (CodigoProduto) REFERENCES dbo.Produto(CodigoProduto);

-- Fiscal: sem FK para Config
ALTER TABLE dbo.Fiscal
    ADD CONSTRAINT FK_Fiscal_Config
        FOREIGN KEY (CodigoEmpresa) REFERENCES dbo.Config(CodigoEmpresa);

-- Corrigir FK auto-referencial incorreta em Manifestacao_Evento
-- (remover a existente e criar correta)
ALTER TABLE dbo.Manifestacao_Evento
    DROP CONSTRAINT FK_Manifestacao_Manifestacao_Evento;

ALTER TABLE dbo.Manifestacao_Evento
    ADD CONSTRAINT FK_Manifestacao_Evento_Manifestacao
        FOREIGN KEY (CodigoManifestacao) REFERENCES dbo.Manifestacao(CodigoManifestacao);
```

> **Atenção:** Antes de adicionar FKs em tabelas transacionais com grande volume de dados, verificar integridade dos dados existentes com:
> ```sql
> SELECT COUNT(*) FROM dbo.Venda v
> WHERE NOT EXISTS (SELECT 1 FROM dbo.Cadastro c WHERE c.CodigoCadastro = v.CodigoCadastro);
> ```

---

## 11. Índices Relevantes

### 11.1 Índices compostos críticos encontrados

```sql
-- Lancamento: índice composto para filtro por empresa+código
IX_EX_Lancamento_CodigoEmpresa_CodigoLancamento
    ON Lancamento (CodigoEmpresa ASC, CodigoLancamento ASC)
    INCLUDE (CodigoUsuario, DataLancamento)

-- Lancamento: filtro por data
IX_EX_Lancamento_DataLancamento
    ON Lancamento (DataLancamento ASC)

-- Venda: filtro por empresa (mais acesso)
IX_EX_Venda_CodigoEmpresa
    ON Venda (CodigoEmpresa ASC)
    INCLUDE (CodigoVenda, Cupom)

-- Venda: índice para comissão por funcionário
IX_EX_Venda_CodigoEmpresa_CodigoFuncionario_Eliminado_DataVenda
    ON Venda (CodigoEmpresa, CodigoFuncionario, Eliminado, DataVenda)

-- Fiscal: por empresa e por chave de acesso/série
IX_EX_Fiscal_CodigoEmpresa
IX_EX_Fiscal_Serie_NumeroNota_Modelo

-- Fiscal_NFe: por chave de acesso (busca de NF-e)
-- Produto: índices em CodigoBarra, NomeProduto, CodigoGrupo
-- Auditoria: por empresa e data para auditoria
-- SNGPC_Inventario: múltiplos índices por empresa e data
```

### 11.2 Tabelas de alto volume sem índice otimizado aparente

As tabelas abaixo possivelmente carecem de índices adicionais, dependendo do volume de dados:

- `Venda_Produto` — sem índice explícito em `CodigoProduto` (acesso frequente)
- `Estoque_Movimentacao_Produto` — filtros por produto e empresa
- `Financeiro_Valor` — filtros por data de vencimento/liquidação
- `SNGPC_Receita_Produto` — filtros por produto e data

### 11.3 Sugestão de índices adicionais

```sql
-- Acesso a itens de venda por produto (relatórios)
CREATE INDEX IX_Venda_Produto_CodigoProduto
    ON dbo.Venda_Produto (CodigoProduto, CodigoEmpresa) INCLUDE (Quantidade, ValorUnitario);

-- Acesso a movimentos de estoque por produto
CREATE INDEX IX_Estoque_Mov_Produto_CodigoProduto
    ON dbo.Estoque_Movimentacao_Produto (CodigoProduto) INCLUDE (Quantidade);

-- Financeiro_Valor por vencimento (cobrança)
CREATE INDEX IX_Financeiro_Valor_DataVencimento
    ON dbo.Financeiro_Valor (DataVencimento, CodigoEmpresa, Situacao);
```

---

## 12. Fluxo de Dependência entre Tabelas

### Nível 0 — Entidades raiz (nenhuma dependência de entrada)
`Config_Cidade_UF`, `Produto_Substancia_Lista`, `Produto_Unidade`, `Log_Tipo`, `Usuario_Funcao_Grupo`, `Sincronismo_Grupo`, `Conta_Grupo` (raiz), `Plano_Pagamento`, `Fiscal_PISCofins`, `Produto_NCM_Tributo`, `Funcionario_Tipo`, `Cliente_Tipo`, `Fornecedor_Tipo`

### Nível 1 — Entidades de domínio (referenciam apenas nível 0)
`Cadastro_Cidade_UF` → `Cadastro_Cidade`, `Produto_NCM`, `Produto_Grupo`, `Produto_ClasseTerapeutica`, `Produto_Fabricante`, `Produto_Formula`, `Produto_Substancia`, `Fiscal_Natureza`, `Plano_Venda`, `Conta_Banco`

### Nível 2 — Entidades de cadastro (referenciam níveis 0 e 1)
`Config`, `Cadastro`, `Produto`, `Fornecedor`, `Convenio`, `PBM`, `Usuario`

### Nível 3 — Entidades de negócio primárias (referenciam até nível 2)
`Lancamento`, `Cliente`, `Funcionario`, `Produto_Estoque`, `Produto_Fiscal_UF`

### Nível 4 — Entidades transacionais (referenciam até nível 3)
`Caixa_Abertura`, `Venda`, `Compra`, `Fiscal`, `Financeiro`, `Estoque_Movimentacao`, `SNGPC_Receita`, `Fidelidade`

### Nível 5 — Detalhes transacionais (referenciam até nível 4)
`Venda_Produto`, `Compra_Produto`, `Fiscal_Produto`, `Financeiro_Valor`, `Estoque_Movimentacao_Produto`, `Caixa_Fechamento`, `Boleto`

### Nível 6 — Sub-detalhes e derivações (referenciam até nível 5)
`Venda_Produto_Lote`, `Venda_Produto_PBM`, `Venda_FP`, `Fiscal_NFe`, `Boleto_Remessa`, `Boleto_Retorno`, `Financeiro_Valor_Cartao`, `Financeiro_Valor_Especie`

### Nível 7 — Logs, auditorias e históricos (referenciam qualquer nível)
`Auditoria`, `Auditoria_Campo`, `Log`, `Financeiro_Valor_Historico`, `Acesso_Usuario`, `Agendamento_Service_Historico`

---

*Documento gerado por análise do script `dbo.sql` — INOVAFARMA_DPOPPARA — Maio/2026*
*Para dúvidas sobre relacionamentos específicos, consultar o DBA ou o código-fonte da aplicação InovaFarma.*
