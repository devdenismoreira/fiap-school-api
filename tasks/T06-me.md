# T06 — Responsável autenticado (`/me`)

**Depende de:** T05 · **Specs:** `features/me.md`, `03-api-contract.md`, `04-security.md` §2

## Objetivo

Implementar `GET /v1/me`, que substitui o `getById` usado pelo app ao restaurar a sessão.

## Escopo

1. **Domain:** caso de uso `getCurrentGuardian(guardianId)`; responsável inexistente gera `InvalidAccessTokenError`.
2. **Presentation:** `MeController` e `meRoutes` (limite por IP → `requireAuth` → `noStore`).
3. **Infra:** atualização de `ultimo_uso_em` da sessão, no máximo uma vez por minuto.
4. **Main:** ligar tudo em `dependencies.ts`.

## Critérios de aceite

Os de `features/me.md` §5, com testes de unidade e de integração, inclusive:
- token vencido, com `Clock` fake;
- token de sessão revogada.

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

**Concluída em 2026-11-05.** Todos os critérios de `features/me.md` §5 estão marcados.

Entregue:
- **Domain:**
  - caso de uso `getCurrentGuardian` (responsável inexistente → `InvalidAccessTokenError`);
  - caso de uso `authenticate` (verifica o token, exige a sessão ativa do `sub` e registra o uso se o último tiver 60 s ou mais);
  - regra `shouldRecordSessionUse` na entidade `Session`.
- **Infra:** `PrismaSessionRepository.recordUse`, com a mesma condição de 60 s no `WHERE`, para que requisições simultâneas não gravem duas vezes.
- **Presentation:**
  - `MeController` e `meRoutes` (limite de 120 por minuto por IP → `requireAuth` → controller);
  - o `requireAuth` passou a só ler o `Bearer` e chamar o `authenticate`.
- **Main:** `createDependencies` aceita um `Clock` substituto, para os testes de expiração (a T07 reaproveita). O limite das rotas autenticadas é um só, compartilhado com a T08.

Decisão: a verificação da sessão saiu do middleware e foi para o caso de uso `authenticate`. Registrar o uso é regra de negócio, e a CLAUDE.md §5 pede que a apresentação use casos de uso, não portas. Registrado em `features/me.md` §3 e na spec 01 §2.

Validação:
- `yarn typecheck` e `yarn lint` passando;
- `yarn test`: 233 testes passando;
- `yarn test:integration`: 73 testes passando, 13 deles do `/me` (paridade com o JSON, cinco recusas, sessão revogada por logout e por reuso, token vencido com relógio controlado, id de outro responsável e `ultimo_uso_em`).
