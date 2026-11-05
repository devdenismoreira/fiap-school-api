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

**Concluída em 2026-11-05.** Todos os critérios de `features/students.md` §4 estão marcados.

Entregue:
- **Domain:** casos de uso `getStudentSchedule` e `getStudentReportCards` (em `usecases/studentRecords.ts`). Os dois consultam o aluno já filtrando pelo vínculo (`findLinkedStudent`, da T02) e, sem vínculo, registram `acesso_aluno_negado` só com `responsavelId` e o RM pedido e lançam `StudentNotFoundError`.
- **Presentation:**
  - `studentParamsSchema` (texto `^[1-9]\d{0,8}$` convertido em número);
  - `StudentController` (`schedule` e `reportCards`);
  - `studentScheduleView` e `studentReportCardsView`;
  - `studentRoutes`: limite de 120 por minuto por IP, compartilhado com o `/me` → `requireAuth` → validação do RM → controller.

Decisões:
- **D-27 (proposta):** o corpo é `{ agenda: [...] }` e `{ boletins: [...] }`. Conferido no FiapSchoolMobile: o app converte elemento a elemento e não força um formato. As telas dependem da ordem (primeiro dia, primeiro boletim) e dos `null`, que o teste confere.
- **Um controller só,** como na T07.
- **RM validado depois do `requireAuth`:** quem não está autenticado recebe 401 antes de qualquer verificação do RM.

Validação:
- `yarn typecheck` e `yarn lint` passando;
- `yarn test`: 267 testes passando;
- `yarn test:integration`: 102 testes passando. Entre eles, o que percorre todos os RMs da fonte com o token de cada responsável: os vinculados voltam iguais ao JSON, e os demais recebem 404. Também passam as respostas idênticas para RM inexistente e de outro responsável, 6 formatos de RM inválido, as recusas sem token, com token inválido e com sessão revogada, e o log sem dados do aluno.
