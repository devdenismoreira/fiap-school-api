# Feature — Agenda e boletins por aluno (com autorização)

> Status: **aprovada em 2026-11-05** · Decisões: D-07 ✅ (autorização pelo vínculo), D-22 ✅ (404 para aluno não vinculado) · Endpoints: `GET /v1/alunos/{rm}/agenda` e `GET /v1/alunos/{rm}/boletins`

## 1. Objetivo

Oferecer a agenda e os boletins de **um aluno**, para carregamento sob demanda numa evolução do app, garantindo que um responsável **não consiga consultar alunos de outro responsável trocando o RM na URL**. Isso cobre o risco nº 1 da OWASP API (autorização por objeto, BOLA/IDOR).

O app atual continua usando só o `/me` (D-06). Estes endpoints são aditivos.

## 2. Regras

1. Os dois endpoints exigem `requireAuth`: access token válido e sessão ativa (spec 04 §2).
2. O `{rm}` é validado com zod como inteiro positivo de até 9 dígitos. Fora disso: 400 `DADOS_INVALIDOS`.
3. **Autorização pelo vínculo:**
   - o caso de uso consulta o aluno **filtrando pelo responsável do token** (`responsavel_aluno` com `responsavel_id = sub` e `aluno_rm = rm`), numa única consulta;
   - nunca busca o aluno primeiro para comparar o dono depois.
4. **RM inexistente ou de outro responsável:** 404 `ALUNO_NAO_ENCONTRADO`, com resposta idêntica nos dois casos. Assim a API não revela se o RM existe (D-22).
5. **Respostas:**
   - `agenda`: array de `DiaAgendaDTO` (`[{ dia, aulas: [{ horario, disciplina }] }]`);
   - `boletins`: array de `BoletimDTO` (`[{ ano, turma, trimestres: [...] }]`);
   - mesmas chaves, ordem e regras de `null` do `/me` (spec 03 §2);
   - as views são as mesmas partes usadas pelo `guardianView`.
6. `Cache-Control: no-store`. Os logs registram o RM recusado só como evento de segurança, sem dados do aluno.
7. Limite por IP igual ao das rotas autenticadas (proposta: 120 requisições por minuto).

## 3. Camadas

| Camada | Item |
|---|---|
| Domain | Casos de uso `getStudentSchedule(guardianId, rm)` e `getStudentReportCards(guardianId, rm)`; porta `GuardianRepository.findLinkedStudent(guardianId, rm)`; erro `StudentNotFoundError` |
| Infra | `PrismaGuardianRepository.findLinkedStudent`, que consulta pelo par (`guardianId`, `rm`) com `include` ordenado |
| Presentation | `studentRoutes`, `studentParamsSchema`, `StudentScheduleController`, `StudentReportCardsController`, `scheduleView`, `reportCardsView` |

## 4. Critérios de aceite

- [ ] O responsável A consegue ler a agenda e os boletins de cada aluno vinculado a ele, no mesmo formato e ordem do JSON.
- [ ] O responsável A recebe 404 `ALUNO_NAO_ENCONTRADO` ao pedir o RM de um aluno do responsável B.
- [ ] RM inexistente e RM de outro responsável produzem respostas idênticas (status e corpo).
- [ ] RM não numérico, negativo ou com mais de 9 dígitos recebe 400 `DADOS_INVALIDOS`.
- [ ] Sem token, com token inválido ou com sessão revogada: 401.
- [ ] Existe teste que percorre todos os RMs da fonte do seed com o token de cada responsável e confirma acesso **somente** aos vinculados.
