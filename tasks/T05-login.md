# T05 — Login

**Depende de:** T02, T03 · **Specs:** `features/login.md`, `03-api-contract.md`, `04-security.md`

## Objetivo

Implementar `POST /v1/auth/login`, que substitui o `signIn` do app e abre uma sessão.

## Escopo

1. **Domain:** caso de uso `login(cpf, password)`:
   1. dígito verificador do CPF;
   2. `findByCpf`;
   3. `verify`, com o hash fictício se o CPF não existir;
   4. cria a sessão e o primeiro refresh (`SessionRepository.create`);
   5. `issue` do access token com `sub` e `sid`.
2. **Infra:** `PrismaGuardianRepository.findByCpf` com o agregado e `PrismaSessionRepository.create`, criando a sessão e o refresh na mesma transação.
3. **Presentation:**
   - `loginSchema` (zod: CPF de 11 dígitos, senha de até 72 bytes);
   - `LoginController` e `tokensView`;
   - `authRoutes`: limite por IP → validação → limite por CPF → `noStore` → controller.
4. **Main:** ligar tudo em `dependencies.ts` e registrar a rota.

## Critérios de aceite

Os de `features/login.md` §5, com testes de unidade (caso de uso com fakes) e de integração (Supertest no schema `fiap_school_test`, credenciais lidas da fonte do seed).

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

**Concluída em 2026-11-05.** Todos os critérios de `features/login.md` §5 estão marcados e cobertos por testes.

Entregue:
- **Domain:** caso de uso `createLogin`, com o tipo `SessionTokens`, que a T07 reaproveita.
- **Presentation:**
  - `loginSchema` (senha de 1 a 72 bytes em UTF-8, sem `trim`);
  - `tokensView` e `loginView`;
  - `LoginController`, que registra `login_sucesso` e `login_falha` só com o HMAC do CPF;
  - `authRoutes`.
- **Main:**
  - `createDependencies` passou a ser assíncrono (hash fictício do bcrypt e importação das chaves);
  - `createApp` recebe a lista de rotas;
  - limites de login: 20 por minuto por IP e 5 falhas a cada 15 minutos por CPF.

Decisões (registradas em `features/login.md` §3 e na spec 01 §5–6):
- **Credenciais primeiro:** o `findByCpf` traz só as credenciais, e o agregado vem do `findById` depois de a senha conferir. Uma tentativa errada não carrega dados de alunos.
- **`no-store` em todo `/v1`, no `app.ts`, antes do parser de JSON.** O teste de integração mostrou que, aplicado na rota, o 400 de JSON malformado saía sem o cabeçalho.

Validação:
- `yarn typecheck` e `yarn lint` passando;
- `yarn test`: 186 testes passando;
- `yarn test:integration`: 49 testes passando, 14 deles de login, com as credenciais lidas da fonte do seed;
- no `yarn dev`, um login com corpo inválido responde 400 com `no-store` e os cabeçalhos `RateLimit`.
