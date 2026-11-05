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

**Concluída em 2026-11-05.** Todos os critérios de `features/refresh-and-logout.md` §6 estão marcados.

Entregue:
- **Domain:**
  - casos de uso `refreshSession` e `logout`;
  - tipo `SessionTokens` movido para `usecases/sessionTokens.ts`, porque o login e o refresh o compartilham.
- **Infra:** o `rotate` e o `revoke` já vinham da T03. Atomicidade testada com falha real no meio da transação (hash duplicado): o token atual segue sem uso, e nenhum token novo fica gravado.
- **Presentation:**
  - `refreshSchema`;
  - `SessionController`: um controller com `refresh` e `end`, em vez de dois, porque as duas ações dividem o mesmo corpo e as mesmas dependências;
  - rotas `POST /v1/auth/refresh` e `/logout`, com limite de 30 por minuto por IP.
- **Main:** um único `CryptoRefreshTokenGenerator`, compartilhado por login, refresh e logout.

Decisões (registradas em `features/refresh-and-logout.md` §4):
- Ordem das verificações do refresh: desconhecido ou de sessão revogada → já usado (reuso) → vencido.
- Refresh vencido não revoga a sessão.
- Corrida no `rotate` é tratada como reuso.

Validação:
- `yarn typecheck` e `yarn lint` passando;
- `yarn test`: 250 testes passando;
- `yarn test:integration`: 85 testes passando, 12 deles de sessões (rotação, reuso que derruba access e refresh emitidos depois, refresh vencido com relógio controlado, logout imediato no `/me`, logout com access vencido, idempotência, independência entre aparelhos e logs sem tokens).
