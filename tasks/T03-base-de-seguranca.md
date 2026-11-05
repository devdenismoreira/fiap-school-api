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

- [x] bcrypt verifica a senha correta e recusa a errada; o tempo com CPF inexistente é equivalente (hash fictício). Medido no teste: razão entre 0,5 e 2.
- [x] O JWT emitido traz `sub` e `sid` e não contém dados pessoais (o payload tem exatamente `aud`, `exp`, `iat`, `iss`, `jti`, `sid` e `sub`).
- [x] `verify` recusa assinatura alterada, `alg: none`, HS256, `iss` ou `aud` errados e token vencido (`Clock` fake), com o erro correto. Também recusa payload alterado, outra chave ES256, `sid` ausente ou fora do formato UUID e `sub` não numérico.
- [x] `requireAuth` recusa token de sessão revogada (teste de unidade e teste de integração com token real e sessão no banco).
- [x] O `errorHandler` nunca devolve stack trace nem mensagem interna.
- [x] Os logs de uma requisição com `cpf`, `senha` e `Authorization` saem com os valores ocultos.
- [x] O limite por CPF usa o HMAC, nunca o CPF em claro (o teste confere as chaves gravadas no store).

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

**Concluída em 2026-11-05.** O desenvolvedor gerou as chaves no `.env` e no `.env.test` com `yarn keys:generate`.

Entregue:
- **Domain:**
  - `isValidCpf` (mesma regra do `cpf.ts` do app);
  - entidades `Session` e `RefreshToken`, com `isSessionActive`, `isRefreshTokenUsed` e `isRefreshTokenExpired`;
  - os cinco erros em `DomainErrors.ts`;
  - portas `PasswordHasher`, `AccessTokenService`, `RefreshTokenGenerator`, `Clock` e `SessionRepository`.
- **Infra:**
  - `BcryptPasswordHasher` (`verify(senha, hash | null)`: sem hash, compara com o hash fictício e devolve `false`);
  - `JoseAccessTokenService` (ao subir, assina e verifica um token de prova e recusa chaves que não formam um par);
  - `CryptoRefreshTokenGenerator`;
  - `SystemClock`;
  - `PrismaSessionRepository` (`rotate` numa transação, condicionado a `usado_em` nulo, o que também cobre dois refreshes simultâneos; `revoke` idempotente, que mantém a primeira data e o primeiro motivo);
  - logger `pino` com a redaction da spec 04 §9 e `pino-http` com nível `warn` para 4xx e `error` para 5xx.
- **Presentation:**
  - `requireAuth` + `authenticatedContext`, com o tipo de `res.locals` declarado em `presentation/types/express.d.ts`;
  - `validate` (troca o corpo pelo resultado validado e guarda os parâmetros convertidos em `res.locals.params`);
  - `createIpRateLimit` e `createCpfRateLimit` (ignoram `OPTIONS`, respondem 429 com `Retry-After`, e o sucesso zera as falhas do CPF);
  - `noStore`;
  - `errorHandler` com a tabela de erros conhecidos.
- **Main:** o `env.ts` ganhou as variáveis de autenticação e o `loadDatabaseEnv`, usado pelo seed. O `pino-http` entra no app depois do `express.json`. Os adaptadores de autenticação são ligados às rotas na T05 e na T06.
- **Chaves:** `yarn keys:generate <arquivo>`.

Decisões:
- **`jose` 6 é só ESM:** o Node 22 o carrega em runtime, mas o Jest não; os dois arquivos de configuração do Jest o transpilam com `ts-jest` (D-13).
- **Fábricas de limite com `store` opcional:** permitem conferir no teste a chave gravada e, no futuro, trocar a memória por Redis sem mudar as rotas (spec 01 §10).
- **`keys:generate` exige o arquivo de destino e recusa o `.env.example`,** para que nenhuma chave vá para o git.
- **Mensagens dos novos códigos de erro** registradas na spec 03 §1.

Validação:
- `yarn typecheck` e `yarn lint` passando;
- `yarn test`: 165 testes de unidade passando;
- `yarn test:integration`: 35 testes passando no Supabase, entre eles os de sessões (11) e de `requireAuth` com token real (3);
- `yarn dev` sobe com as chaves; `GET /health` → 200 e rota inexistente → 404 `NAO_ENCONTRADO`.
