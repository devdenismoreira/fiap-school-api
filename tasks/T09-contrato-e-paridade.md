# T09 — Contrato (Swagger) e paridade com o app

**Depende de:** T04, T07, T08 · **Specs:** `03-api-contract.md`, D-06 ✅, D-14 ✅

## Objetivo

Publicar o contrato no Swagger e provar, por teste, que o app pode trocar o datasource local pelo remoto sem outra mudança.

## Escopo

1. `openapi.yaml` (OpenAPI 3.1) gerado da spec 03:
   - todos os endpoints de `/v1` e o `/health`;
   - esquemas `Responsavel`, `DiaAgenda`, `Boletim`, `Tokens` e `Erro`;
   - esquema de segurança Bearer (JWT);
   - exemplos sem dados reais.
2. Swagger UI em `/docs` com `swagger-ui-express`, só quando `NODE_ENV !== 'production'`.
3. Validação das respostas dos testes de integração contra o `openapi.yaml`.
4. **Teste de paridade:** para cada responsável da fonte do seed, login → `GET /v1/me` → `toEqual` com o registro da fonte sem `cpf`, `email` e `senha`.
5. **Teste de exposição:** nenhuma resposta da suíte contém as chaves `cpf`, `email`, `senha` ou `passwordHash`.

## Critérios de aceite

- [ ] O teste de paridade passa para todos os responsáveis da fonte.
- [ ] Todas as respostas dos testes de integração são válidas contra o `openapi.yaml`.
- [ ] `/docs` responde em desenvolvimento e 404 em produção.
- [ ] A spec 03 e o `openapi.yaml` dizem a mesma coisa (revisão no `/review`).

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

Não iniciada.
