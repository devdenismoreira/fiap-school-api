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

Não iniciada.
