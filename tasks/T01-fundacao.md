# T01 — Fundação do projeto

**Depende de:** aprovação das specs (spec 00 §7) e **projeto criado no Supabase** · **Specs:** `01-architecture.md`, `CLAUDE.md` §4–5, D-04 ✅, D-13, D-21 ✅

## Pré-requisito (feito pelo desenvolvedor no painel do Supabase)

1. Criar o projeto no plano gratuito, região São Paulo, e guardar a senha do banco num gerenciador de senhas.
2. Copiar as strings de conexão do Prisma:
   - pooler, para `DATABASE_URL`;
   - conexão direta ou pooler em modo sessão, para `DIRECT_URL`.

   Confirmar portas e parâmetros na documentação atual do Supabase para Prisma.
3. Colocar essas strings só no `.env` e no `.env.test` locais. Nunca em chat, commit ou documentação.

## Objetivo

Criar o projeto vazio, porém completo em infraestrutura: compila, testa, valida a arquitetura no lint e conecta ao Supabase, com um schema de desenvolvimento e outro de testes. Não há banco nem Docker no computador.

## Escopo

1. `git init` com `main` e `develop`. Remoto só se o desenvolvedor criar o repositório (dúvida 2 da spec 00).
2. `.nvmrc` (22), `package.json` com `"packageManager": "yarn@1.22.22"` e `engines.node >= 22`.
3. Dependências nas versões estáveis atuais, registradas no `CLAUDE.md` §4:
   - `express@5`, `@prisma/client`, `zod`, `pino`, `pino-http`, `helmet`, `dotenv`;
   - de desenvolvimento: `typescript`, `tsx`, `prisma`, `jest`, `ts-jest` (ou `@swc/jest`), `supertest`, `eslint`, `prettier` e tipos.

   As bibliotecas de segurança, CORS e documentação entram nas tarefas que as usam.
4. `tsconfig.json` com `strict` e alias `@/` → `src/`, igual ao app.
5. ESLint e Prettier. Regra `no-restricted-imports` por pasta, para garantir a dependência: `domain` não importa `express`, `@prisma/client`, `jose`, `bcrypt`, `pino`, `@/infra` nem `@/presentation`.
6. **Prisma e Supabase:**
   - `prisma init`, só com o datasource (`url` e `directUrl`). O esquema entra na T02;
   - `.env`: `DATABASE_URL` e `DIRECT_URL` com `?schema=fiap_school&sslmode=require`;
   - `.env.test`: as mesmas URLs, com `?schema=fiap_school_test&sslmode=require`;
   - o `env.ts` exige `sslmode=require` em qualquer URL do Supabase.
7. **Trava dos testes de integração:** o `globalSetup` do Jest de integração carrega o `.env.test` e aborta, com mensagem clara, se o schema da `DATABASE_URL` não terminar em `_test`. O script `test:integration` roda em série (`--runInBand`).
8. `src/main/config/env.ts` (zod) e `.env.example` com todas as variáveis da spec 01 §8, com valores fictícios. `CORS_ORIGINS` vazio, porque não há cliente web.
9. `src/main/app.ts` e `server.ts` (lê `PORT`, sem nada específico de plataforma, D-21):
   - `helmet`, `x-powered-by` desligado, `express.json({ limit: '10kb' })`;
   - `GET /health` (consulta `SELECT 1`);
   - rota 404 e tratador de erros genérico.
10. Scripts:
    - `dev`, `build`, `start`;
    - `typecheck`, `lint`;
    - `test` (unidade, sem banco), `test:integration` (schema de teste);
    - `prisma:migrate`, `db:seed`.
11. README com o mínimo para configurar o `.env` e subir em desenvolvimento.

## Critérios de aceite

- [x] `yarn typecheck`, `yarn lint` e `yarn test` passam (teste de `env.ts` e de `/health` com o banco simulado). Os testes de unidade não usam rede; o único teste com o cliente real conecta em `127.0.0.1:1`, que recusa a conexão.
- [x] Um import de `express` dentro de `src/domain` faz o lint falhar.
- [x] `yarn dev` sobe conectado ao Supabase, e `/health` responde 200 (projeto em `sa-east-1`, com `verify-full`). Com a URL do banco inválida, responde 503 (verificado com o banco inacessível).
- [x] `yarn test:integration` aborta se o `.env.test` apontar para um schema sem `_test`.
- [x] O app não sobe sem variável obrigatória nem com URL do Supabase sem `sslmode=require`. A mensagem é clara e não mostra o valor.
- [x] `.env` e `.env.test` fora do git; `.env.example` versionado; nenhuma URL ou senha do Supabase no repositório.

## Validação

Comandos acima. Comandos do Prisma que alteram o banco pedem confirmação.

## Status

**Implementada em 2026-11-05, exceto a validação com o Supabase**, porque o projeto ainda não foi criado.

Diferenças em relação ao escopo, registradas na spec 00:
- TypeScript 6.0, não o 7 (D-03).
- Prisma 7 com `@prisma/adapter-pg` e `prisma.config.ts`, sem `url`/`directUrl` no `schema.prisma` (D-24).
- Sem `dotenv`: o Node 22 lê os arquivos de ambiente (D-25).
- `pino-http` adiado para a T03, junto com a redaction.
- `tsc-alias` acrescentado, para reescrever o alias `@/` no build.
- O `env.ts` valida só as variáveis que a T01 usa (`NODE_ENV`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`); cada tarefa acrescenta as suas. A `DIRECT_URL` é validada no `prisma.config.ts`.
- `NODE_ENV` é obrigatória, sem padrão, para que a produção nunca suba como desenvolvimento por esquecimento.
- JSON malformado e corpo acima de 10 KB respondem 400 `DADOS_INVALIDOS` (spec 03 atualizada).

Primeira tentativa com o Supabase (2026-11-05, projeto em `us-east-1`):
- Usuário, senha e host corretos: a conexão funciona com criptografia nas duas URLs.
- Com a validação do certificado, falha com `SELF_SIGNED_CERT_IN_CHAIN`, porque o Supabase usa CA própria. Cadeia observada: `*.pooler.supabase.com` ← Supabase Intermediate 2021 CA ← Supabase Root 2021 CA.
- Decisões do desenvolvedor: validar o certificado (D-26, já aplicada no `env.ts` e nos testes) e recriar o projeto em São Paulo (D-04).

Projeto em `sa-east-1` (2026-11-05):
- Certificado raiz extraído da conexão TLS e versionado em `certs/supabase-ca.crt` (D-26).
- API rodando com o `.env` gerado: `GET /health` → 200 `{"status":"ok"}` no Supabase, com `sslmode=verify-full`.

- Com o `.env` e o `.env.test` definitivos, copiados pelo desenvolvedor: `yarn dev` + `GET /health` → 200, e `yarn test:integration` passa no schema `fiap_school_test`.
- **Jest com `--experimental-vm-modules`:** o cliente do Prisma 7 carrega o compilador de consultas (WebAssembly) com `import()` dinâmico, que o Node bloqueia dentro do `vm` do Jest sem essa flag (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`). Os scripts `test` e `test:integration` passam a usá-la. Fora do Jest, em `yarn dev` e `yarn start`, nada muda.
- O teste de unidade do cliente real agora confere que a falha é de conexão ("Can't reach database server"). Antes, ele passava mesmo com o cliente sem carregar.

**T01 concluída em 2026-11-05.** Validação final: `yarn typecheck`, `yarn lint`, `yarn test` (56 testes) e `yarn test:integration` (1 teste) passando.

Pendência levada para a T02: conferir a validação do certificado na `DIRECT_URL`, usada pelo CLI do Prisma nas migrations.
