# T03 — Base de segurança

**Depende de:** T01 · **Specs:** `04-security.md` §1–3, §6–7, §9, `01-architecture.md` §7

## Objetivo

Criar as portas e os adaptadores de autenticação e sessão e a infraestrutura de erros, logs e limite de tentativas, que login, `/me`, refresh e alunos vão usar.

## Escopo

1. **Domain:**
   - portas `PasswordHasher`, `AccessTokenService` (`issue` com `sub` e `sid`; `verify`), `RefreshTokenGenerator`, `SessionRepository` e `Clock`;
   - entidades `Session` e `RefreshToken`;
   - erros `InvalidCredentialsError`, `InvalidAccessTokenError`, `ExpiredAccessTokenError`, `InvalidRefreshTokenError` e `StudentNotFoundError`;
   - utilitário de CPF (dígito verificador), com a mesma regra do app.
2. **Infra:**
   - `BcryptPasswordHasher` (`BCRYPT_COST`, com o hash fictício gerado na inicialização);
   - `JoseAccessTokenService` (ES256, `iss`, `aud`, `jti`, `sid`, tolerância de 30 s, aceita só ES256);
   - `CryptoRefreshTokenGenerator` (32 bytes em base64url, mais o SHA-256);
   - `PrismaSessionRepository` (`create`, `findActive`, `findByRefreshHash`, `rotate`, `revoke`);
   - `SystemClock`;
   - logger `pino` com a redaction da spec 04 §9.
3. **Presentation:**
   - `requireAuth`: valida o token e a sessão ativa e expõe `guardianId` e `sessionId`;
   - `errorHandler` e `errorView`;
   - `validate(schema)` para corpo e parâmetros;
   - fábricas de limite por IP e por HMAC do CPF (`express-rate-limit`), que ignoram `OPTIONS`;
   - `noStore`.
4. **Chaves:** script `yarn keys:generate` que gera o par ES256 para o `.env` local, sem versionar.
5. **Dependências:** `bcrypt`, `jose`, `express-rate-limit`.

## Critérios de aceite

- [ ] bcrypt verifica a senha correta e recusa a errada; o tempo com CPF inexistente é equivalente (hash fictício).
- [ ] O JWT emitido traz `sub` e `sid` e não contém dados pessoais.
- [ ] `verify` recusa assinatura alterada, `alg: none`, HS256, `iss` ou `aud` errados e token vencido (`Clock` fake), com o erro correto.
- [ ] `requireAuth` recusa token de sessão revogada.
- [ ] O `errorHandler` nunca devolve stack trace nem mensagem interna.
- [ ] Os logs de uma requisição com `cpf`, `senha` e `Authorization` saem com os valores ocultos.
- [ ] O limite por CPF usa o HMAC, nunca o CPF em claro.

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

Não iniciada.
