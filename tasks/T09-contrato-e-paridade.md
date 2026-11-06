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

- [x] O teste de paridade passa para todos os responsáveis da fonte.
- [x] Todas as respostas dos testes de integração são válidas contra o `openapi.yaml`.
- [x] `/docs` responde em desenvolvimento e 404 em produção. *Revisado na T11 (D-14): o Swagger passou a responder também em produção, só por HTTPS.*
- [ ] A spec 03 e o `openapi.yaml` dizem a mesma coisa (revisão no `/review`).

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

**Implementada em 2026-11-05.** Falta só a revisão de equivalência entre a spec 03 e o `openapi.yaml`, prevista para o `/review`.

Entregue:
- **`openapi.yaml` (OpenAPI 3.1):**
  - os 7 endpoints;
  - esquemas estritos (`additionalProperties: false`, todas as chaves obrigatórias, `nota` e `faltas` como `number | null`);
  - respostas de erro reaproveitáveis;
  - segurança Bearer (JWT);
  - exemplos fictícios.
- **`/docs`:** `docsRoutes` serve o Swagger UI e o `openapi.yaml` cru, que o próprio Swagger UI lê no navegador (sem parser de YAML em runtime). Os scripts vêm só da própria origem, compatíveis com o CSP do `helmet`. Só é registrado quando `NODE_ENV !== 'production'`.
- **Validação das respostas:**
  - `tests/support/contractChecker.ts` envolve a API nos testes de integração, sem mudar o código da API, e confere toda resposta: status documentado, corpo contra o esquema (Ajv 2020-12) e ausência das chaves `cpf`, `email`, `senha` e `passwordHash` (teste de exposição);
  - as violações são checadas ao fim de cada arquivo (`setupFilesAfterEnv`);
  - o próprio verificador tem testes de unidade que provam que ele acusa campo a mais, nota trocada, chave `null` omitida, status não documentado e corpo fora do formato de erro.
- **Paridade:** `tests/integration/parity.test.ts` (login → `GET /v1/me` → `toStrictEqual` com a fonte sem credenciais, para cada responsável).
- **Dependências:** `swagger-ui-express` (runtime, D-14); `yaml`, `ajv` e `ajv-formats` (só desenvolvimento).

Validação:
- `yarn typecheck` e `yarn lint` passando;
- `yarn test`: 276 testes passando;
- `yarn test:integration`: 107 testes passando em 12 arquivos, com todas as respostas verificadas contra o `openapi.yaml` e nenhuma violação.
