# Feature — Sessões: renovação e logout

> Status: **aprovada em 2026-11-05** · Decisão: D-17 ✅ · Endpoints: `POST /v1/auth/refresh` e `POST /v1/auth/logout` · Novos: o app local não tinha tokens

## 1. Objetivo

Gerenciar sessões, não só emitir JWT:
- manter o responsável logado sem pedir a senha (refresh com rotação);
- detectar o roubo de token (reuso);
- encerrar a sessão no servidor (logout).

Os detalhes estão na spec 04 §3.

## 2. Refresh: regras

1. O corpo `{ refreshToken }` é validado com zod. Inválido: 400 `DADOS_INVALIDOS`.
2. A API busca o token pelo hash SHA-256, junto com a sessão.
3. **Desconhecido, expirado ou de sessão revogada:** 401 `REFRESH_INVALIDO`.
4. **Já usado (reuso):**
   - **revoga a sessão** (`revogada_em`, motivo `reuso`);
   - registra o evento só com o `sessao_id`;
   - responde 401 `REFRESH_INVALIDO`;
   - todo token da sessão, inclusive o access já emitido, deixa de valer.
5. **Válido, numa transação:**
   - marca o atual como usado (revogação do anterior);
   - cria um novo na mesma sessão, com validade de 30 dias;
   - grava `substituido_por`;
   - atualiza `ultimo_uso_em`;
   - emite um access token novo com o mesmo `sid`.
6. Resposta 200: `{ accessToken, tokenType, expiresIn, refreshToken, refreshExpiresIn }`, sem `responsavel`, com `Cache-Control: no-store`.
7. Limite de 30 por minuto por IP.

## 3. Logout: regras

1. O corpo `{ refreshToken }` é validado com zod. Inválido: 400 `DADOS_INVALIDOS`.
2. Token encontrado: a API **revoga a sessão** (motivo `logout`). O access token dessa sessão passa a receber 401 na hora, porque o `requireAuth` confere a sessão.
3. Sempre responde 204 com corpo válido, mesmo para token desconhecido ou de sessão já revogada. É idempotente e não revela se o token existia.
4. Não exige access token, para funcionar mesmo com ele vencido.

## 4. Camadas

| Camada | Item |
|---|---|
| Domain | Casos de uso `refreshSession(token)` e `logout(token)`; entidades `Session` (ativa ou revogada) e `RefreshToken` (expirado ou usado); porta `SessionRepository` (`findByRefreshHash`, `rotate`, `revoke`); erro `InvalidRefreshTokenError` |
| Infra | `PrismaSessionRepository`, com `rotate` em `$transaction` |
| Presentation | `authRoutes`, `refreshSchema`, `RefreshController`, `LogoutController`, `tokensView`, `noStore` |

## 5. Comportamento esperado do app

Detalhado na T10, no repositório do app:
- **Restaurar a sessão ao abrir:** refresh do Keychain → `POST /refresh` → `GET /me`, sem pedir login.
- **Interceptador:** um 401 `TOKEN_EXPIRADO` dispara **um único** refresh, compartilhado entre as requisições simultâneas, e repete a requisição original uma vez.
- Refresh com 401 significa sessão expirada ou revogada: limpa tokens e sessão e volta ao Login.
- O logout chama o endpoint em melhor esforço e depois limpa o Keychain e o AsyncStorage.

## 6. Critérios de aceite

- [ ] Refresh válido devolve um par novo, e o refresh antigo passa a responder 401 (rotação).
- [ ] Reusar um refresh já usado revoga a sessão: o refresh e o access emitidos depois dele também passam a receber 401.
- [ ] Refresh expirado (com `Clock` fake) responde 401 `REFRESH_INVALIDO`.
- [ ] A rotação é atômica: falha no meio não deixa dois tokens válidos.
- [ ] Logout revoga a sessão: o access token dela recebe 401 no `/me`.
- [ ] Logout é idempotente (204 também na segunda chamada e para token desconhecido).
- [ ] Sessões de aparelhos diferentes são independentes: o logout de uma não afeta a outra.
- [ ] Nenhum log contém tokens.
