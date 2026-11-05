# T07 — Sessões: refresh e logout

**Depende de:** T05 · **Specs:** `features/refresh-and-logout.md`, `04-security.md` §3, D-17 ✅

## Objetivo

Implementar o gerenciamento de sessões:
- renovação com rotação do refresh token;
- revogação do token anterior;
- expiração;
- detecção de reuso, que revoga a sessão;
- logout, que revoga a sessão.

## Escopo

1. **Domain:** casos de uso `refreshSession(token)` e `logout(token)`, com as regras de sessão ativa, refresh expirado e refresh já usado.
2. **Infra:**
   - `PrismaSessionRepository.rotate` em `$transaction`: marca o token como usado, cria o novo, grava `substituido_por` e atualiza `ultimo_uso_em`;
   - `revoke(sessionId, motivo)`.
3. **Presentation:**
   - `refreshSchema`;
   - `RefreshController` (200 com `tokensView`);
   - `LogoutController` (204 sempre que o corpo for válido);
   - limite por IP e `noStore`.
4. **Main:** ligar tudo em `dependencies.ts` e registrar as rotas.

## Critérios de aceite

Os de `features/refresh-and-logout.md` §6, com testes de integração para:
- rotação;
- reuso, que revoga a sessão e invalida o access dela;
- expiração com `Clock` fake;
- atomicidade (falha simulada no meio da rotação);
- logout imediato no `/me`;
- idempotência;
- independência entre sessões.

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

Não iniciada.
