# Integração — Fidelidade / Prêmios

Resumo: documentação técnica da integração que implementa listagem, criação, edição e remoção de prêmios no módulo de Fidelidade.

Arquivos relevantes
- Rota e lógica: [src/routes/fidelidade-premio.js](src/routes/fidelidade-premio.js#L1-L999)
- Documentação Swagger: [src/swagger.js](src/swagger.js#L1-L1200)

Endpoints

1) Listar prêmios
- Método: GET
- URL: `/fidelidade-premio`
- Query: nenhuma
- Resposta (200):
  - `{ mensagem, total, premios: [ { codigoPremio, nomePremio, pontos, ativo } ] }`
- Uso: retorna catálogo de prêmios ordenados por `NomePremio`.

Exemplo:

curl -X GET http://localhost:4000/fidelidade-premio

2) Criar prêmio
- Método: POST
- URL: `/fidelidade-premio`
- Body (JSON):
  - `nomePremio` (string) — obrigatório
  - `pontos` (integer) — opcional, default 0
  - `ativo` (boolean) — opcional, default true
- Resposta (201):
  - `{ mensagem: 'Prêmio criado com sucesso', premio: { codigoPremio, nomePremio, pontos, ativo } }`
- Erros comuns:
  - 400 — payload inválido (ex: falta `nomePremio`)
  - 500 — erro de banco (detalhes em `mensagem`)

Exemplo:

curl -X POST http://localhost:4000/fidelidade-premio \
  -H 'Content-Type: application/json' \
  -d '{"nomePremio":"Desconto 10%","pontos":1000,"ativo":true}'

Observação importante sobre `CodigoPremio`
- O schema legado do banco pode não ter `CodigoPremio` como coluna `IDENTITY`. A implementação atual da API assume isso e aplica um mecanismo defensivo:
  1. Calcula `NextId = ISNULL(MAX(CodigoPremio),0) + 1` em tempo de execução.
  2. Insere explicitamente `CodigoPremio = NextId` no `INSERT`.
- Risco: em ambientes com alta concorrência esta técnica pode levar a colisões se múltiplas inserções ocorrerem simultaneamente. Recomenda-se uma das soluções abaixo (preferencialmente a 1):
  1. Transformar `CodigoPremio` em `IDENTITY` no banco — operação segura se aplicada numa janela controlada de manutenção.
  2. Criar uma sequência (`SEQUENCE`) e usar `NEXT VALUE FOR` para obter o próximo id atômico.
  3. Implementar lock/exclusive transaction em tabela antes de calcular `MAX` (menos desejável).

Exemplo de SQL para criar identidade (se aplicável):

-- criar backup e testar antes em ambiente de homologação
BEGIN TRANSACTION;
-- 1) criar nova coluna identity temporária
ALTER TABLE INOVAFARMA_DPOPPARA.dbo.Fidelidade_Premio ADD CodigoPremio_New BIGINT IDENTITY(1,1);
-- 2) popular com valores existentes mantendo correspondência (se necessário)
-- 3) remover constraints e coluna antiga, renomear
-- código específico depende do ambiente — peça DBA se tiver dúvidas
ROLLBACK; -- remova o rollback apenas após validar em homolog

Alternativa com SEQUENCE:

CREATE SEQUENCE dbo.FidelidadePremio_Seq AS BIGINT START WITH 1 INCREMENT BY 1;
-- usar: NEXT VALUE FOR dbo.FidelidadePremio_Seq

3) Editar prêmio
- Método: PUT
- URL: `/fidelidade-premio/{codigo}`
- Path param: `codigo` (integer)
- Body (JSON): qualquer combinação dos campos
  - `nomePremio`, `pontos`, `ativo`
- Resposta (200): `{ mensagem, premio: { codigoPremio, nomePremio, pontos, ativo } }`
- Respostas de erro: 400, 404, 500

Exemplo:

curl -X PUT http://localhost:4000/fidelidade-premio/123 \
  -H 'Content-Type: application/json' \
  -d '{"pontos":1500}'

4) Remover prêmio
- Método: DELETE
- URL: `/fidelidade-premio/{codigo}`
- Path param: `codigo` (integer)
- Query: `force=true` (opcional) — se presente faz exclusão física; se ausente faz soft-delete (Ativo=0)
- Respostas:
  - 200 — sucesso (soft-delete ou delete físico)
  - 404 — prêmio não encontrado

Exemplo (soft-delete):

curl -X DELETE http://localhost:4000/fidelidade-premio/123

Exemplo (exclusão física):

curl -X DELETE 'http://localhost:4000/fidelidade-premio/123?force=true'

Observações técnicas e considerações
- Transações: o `INSERT/UPDATE/DELETE` usam operações simples com `OUTPUT INSERTED.*` para retornar o registro alterado. Em cenários críticos, envolva em transaction scope para rollback automático.
- Validações: atualmente a API realiza validação mínima (`nomePremio` obrigatório no POST). Considere adicionar validações adicionais: limites de `pontos`, autorização/autenticação e sanitização de strings.
- Conflito de concorrência: para geração manual de id, use `SEQUENCE` ou `IDENTITY` para evitar race conditions.
- Logs/monitoramento: erros de banco são logados no console. Em produção, envie logs para um coletor estruturado.

Swagger / documentação
- A documentação OpenAPI foi atualizada em [src/swagger.js](src/swagger.js#L860-L940) com os schemas `FidelidadePremioCreateRequest` e `FidelidadePremioUpdateRequest` e os paths:
  - `GET /fidelidade-premio`
  - `POST /fidelidade-premio`
  - `PUT /fidelidade-premio/{codigo}`
  - `DELETE /fidelidade-premio/{codigo}`

Testes locais rápidos
1. Instalar dependências e rodar a API:

```bash
npm install
node src/index.js
```

2. Usar `curl` (exemplos acima) ou Postman para testar os endpoints.

Notas finais
- Arquivo de rota: [src/routes/fidelidade-premio.js](src/routes/fidelidade-premio.js#L1-L999)
- Se desejar, implemento: autenticação, validação avançada, ou a migração SQL para `IDENTITY`/`SEQUENCE`.
