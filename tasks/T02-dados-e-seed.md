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

- [ ] A migration cria as tabelas, colunas, unicidades e cascatas da spec 02, no schema `fiap_school`, com RLS ativado em todas (verificado pelo catálogo `pg_class.relrowsecurity`).
- [ ] O seed é idempotente, mantém os ids da fonte e não mostra dados. Funciona nos schemas `fiap_school` e `fiap_school_test`.
- [ ] `findById` devolve o agregado com arrays na ordem da fonte, dias sem aula vazios e `null` preservados (teste de integração no schema de teste).
- [ ] `findLinkedStudent` devolve `null` para RM de outro responsável.
- [ ] As views não expõem `cpf`, `email`, `passwordHash` nem `position` (teste de unidade).
- [ ] O domínio não importa Prisma (lint).

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`. Migrations e seed pedem confirmação.

## Status

Não iniciada.
