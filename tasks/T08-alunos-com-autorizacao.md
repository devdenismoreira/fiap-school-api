# T08 — Alunos com autorização

**Depende de:** T06 · **Specs:** `features/students.md`, `04-security.md` §4, D-07 ✅, D-22

## Objetivo

Implementar `GET /v1/alunos/{rm}/agenda` e `GET /v1/alunos/{rm}/boletins`, garantindo que um responsável não consiga consultar alunos de outro trocando o RM na URL.

## Escopo

1. **Domain:** casos de uso `getStudentSchedule(guardianId, rm)` e `getStudentReportCards(guardianId, rm)`, com `StudentNotFoundError` quando `findLinkedStudent` devolve `null`.
2. **Infra:** `PrismaGuardianRepository.findLinkedStudent`, uma única consulta pelo par (`guardianId`, `rm`) em `responsavel_aluno`, com `include` ordenado.
3. **Presentation:**
   - `studentParamsSchema` (inteiro positivo, até 9 dígitos);
   - `StudentScheduleController` e `StudentReportCardsController`;
   - `studentRoutes` (limite por IP → `requireAuth` → validação → `noStore`);
   - reutiliza `scheduleView` e `reportCardsView`.
4. **Main:** ligar tudo em `dependencies.ts` e registrar as rotas.

## Critérios de aceite

Os de `features/students.md` §4, incluindo o teste que percorre **todos** os RMs da fonte do seed com o token de cada responsável e confirma acesso somente aos alunos vinculados.

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

Não iniciada.
