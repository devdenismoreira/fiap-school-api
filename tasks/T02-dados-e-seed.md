# T02 — Dados e seed

**Depende de:** T01 · **Specs:** `02-data-model.md`, `features/seed.md`, `03-api-contract.md` §2

## Objetivo

Modelar o agregado e as sessões no banco, carregar os dados do desafio e ler o agregado completo na ordem certa.

## Escopo

1. **Domain:**
   - entidades `Guardian`, `Student`, `ScheduleDay`, `Lesson`, `ReportCard`, `Term` e `SubjectGrade`;
   - porta `GuardianRepository` (`findById`, `findByCpf`, `findLinkedStudent`).
2. **Infra:**
   - `prisma/schema.prisma` conforme a spec 02, incluindo `Session` e `RefreshToken`;
   - a primeira migration, com RLS ativado em todas as tabelas (SQL na migration);
   - `PrismaGuardianRepository`, com `include` aninhado e `orderBy` em todos os níveis, devolvendo entidades do domínio (o `Decimal` vira `number` aqui).
3. **Seed:**
   - `prisma/seed.ts` conforme `features/seed.md`: lê de `SEED_SOURCE_PATH`, valida com zod, aplica bcrypt (`bcrypt` entra aqui), roda numa transação, mantém ids e ordem e mostra só contagens;
   - script `db:seed`.
4. **Presentation:** `guardianView`, `scheduleView` e `reportCardsView`, que montam o JSON campo a campo (spec 03 §2).

## Critérios de aceite

- [x] A migration cria as tabelas, colunas, unicidades e cascatas da spec 02, no schema `fiap_school`, com RLS ativado em todas (verificado pelo catálogo `pg_class.relrowsecurity` nos dois schemas).
- [x] O seed é idempotente, mantém os ids da fonte e não mostra dados. Funciona nos schemas `fiap_school` e `fiap_school_test`.
- [x] `findById` devolve o agregado com arrays na ordem da fonte, dias sem aula vazios e `null` preservados (teste de integração no schema de teste).
- [x] `findLinkedStudent` devolve `null` para RM de outro responsável.
- [x] As views não expõem `cpf`, `email`, `passwordHash` nem `position` (teste de unidade).
- [x] O domínio não importa Prisma (lint).

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`. Migrations e seed pedem confirmação.

## Status

**Concluída em 2026-11-05.**

Entregue:
- **Domínio:** entidades `Guardian` (com `GuardianCredentials`, que só o login usa), `Student`, `ScheduleDay`, `Lesson`, `ReportCard`, `Term` e `SubjectGrade`, e a porta `GuardianRepository`. O `findByCpf` devolve só `{ guardianId, passwordHash }`; o agregado vem do `findById`.
- **Infra:**
  - migration `20261105000000_init`, gerada com `prisma migrate diff`, sem schema fixo no SQL e com RLS nas 10 tabelas;
  - `PrismaGuardianRepository`, com `orderBy` em todos os níveis, `Decimal` → `number` e `Date` → `AAAA-MM-DD`.
- **Seed:**
  - `src/infra/database/seed` (fonte validada com zod em objetos estritos, gravação nível por nível com `createMany` numa transação, `setval` da sequência);
  - `src/main/config/seedEnv.ts` (padrões, `BCRYPT_COST` mínimo 12, `--force` em produção);
  - `prisma/seed.ts`, que mostra só o destino e as contagens. Em caso de erro do banco, mostra só o tipo e o código, porque a mensagem do Prisma pode trazer os valores gravados.
- **Apresentação:** `guardianView`, `scheduleView` e `reportCardsView`. As duas últimas devolvem os arrays e são as mesmas partes usadas no `guardianView`.
- **Testes:**
  - o setup de integração aplica as migrations e roda o seed no `fiap_school_test`;
  - os testes leem a fonte do seed em tempo de execução, sem copiar dados.

Decisões e achados:
- O script `prisma:migrate` passou a ser `prisma migrate deploy`. O `migrate dev` precisa de banco-sombra, e as novas migrations seguem o roteiro do README (`migrate diff --from-config-datasource`).
- **TLS da `DIRECT_URL` (pendência da T01):** o CLI do Prisma no macOS não consegue validar o certificado do pooler, que tem validade acima do limite de 825 dias do macOS. Segue com `sslmode=require`, criptografado. Registrado na D-26; conferir o modo estrito no Linux na T11.
- A tabela de controle `_prisma_migrations`, criada pelo próprio Prisma, fica sem RLS. Ela não tem dados pessoais, e o schema não é exposto pela Data API.

Validação: `yarn typecheck`, `yarn lint`, `yarn test` (79 testes) e `yarn test:integration` (21 testes, duas rodadas seguidas) passando.
