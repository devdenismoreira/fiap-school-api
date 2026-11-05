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

Não iniciada.
