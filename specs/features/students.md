# Feature — Agenda e boletins por aluno (com autorização)

> Status: **aprovada em 2026-11-05** · Decisões: D-07 ✅ (autorização pelo vínculo), D-22 ✅ (404 para aluno não vinculado) · Endpoints: `GET /v1/alunos/{rm}/agenda` e `GET /v1/alunos/{rm}/boletins`

## 1. Objetivo

Oferecer a agenda e os boletins de **um aluno**, para carregamento sob demanda numa evolução do app, garantindo que um responsável **não consiga consultar alunos de outro responsável trocando o RM na URL**. Isso cobre o risco nº 1 da OWASP API (autorização por objeto, BOLA/IDOR).

O app usa estes endpoints para carregar a agenda e os boletins ao entrar, ao trocar de aluno e ao puxar a tela para atualizar (D-28). O `/me` e o login deixaram de trazê-los: mudança incompatível dentro de `/v1`, sem `/v2`, aceita porque o app não é publicado em loja (a entrega é só o repositório) e não há clientes antigos.

## 2. Regras

1. Os dois endpoints exigem `requireAuth`: access token válido e sessão ativa (spec 04 §2).
2. O `{rm}` é validado com zod como texto `^[1-9]\d{0,8}$` (inteiro positivo de até 9 dígitos, sem zero à esquerda) e só então convertido em número. Fora disso: 400 `DADOS_INVALIDOS`. A validação roda depois do `requireAuth`, então quem não está autenticado recebe 401 antes de qualquer verificação do RM.
3. **Autorização pelo vínculo:**
   - o caso de uso consulta o aluno **filtrando pelo responsável do token** (`responsavel_aluno` com `responsavel_id = sub` e `aluno_rm = rm`), numa única consulta;
   - nunca busca o aluno primeiro para comparar o dono depois.
4. **RM inexistente ou de outro responsável:** 404 `ALUNO_NAO_ENCONTRADO`, com resposta idêntica nos dois casos. Assim a API não revela se o RM existe (D-22).
5. **Respostas:**
   - `/agenda`: `{ agenda: DiaAgendaDTO[] }` (D-27);
   - `/boletins`: `{ boletins: BoletimDTO[] }` (D-27);
   - mesmas chaves, ordem e regras de `null` do `/me` (spec 03 §2);
   - as views são as mesmas partes usadas pelo `guardianView`.
6. `Cache-Control: no-store`. Os logs registram o RM recusado só como evento de segurança, sem dados do aluno.
7. Limite por IP igual ao das rotas autenticadas (proposta: 120 requisições por minuto).

## 3. Camadas

| Camada | Item |
|---|---|
| Domain | Casos de uso `getStudentSchedule(guardianId, rm)` e `getStudentReportCards(guardianId, rm)`; porta `GuardianRepository.findLinkedStudent(guardianId, rm)`; erro `StudentNotFoundError` |
| Infra | `PrismaGuardianRepository.findLinkedStudent`, que consulta pelo par (`guardianId`, `rm`) com `include` ordenado |
| Presentation | `studentRoutes` (limite de 120 por minuto por IP, compartilhado com o `/me` → `requireAuth` → validação do RM → controller), `studentParamsSchema`, `StudentController` (`schedule` e `reportCards`), `studentScheduleView` e `studentReportCardsView`, que embrulham `scheduleView` e `reportCardsView` |

## 4. Critérios de aceite

- [x] O responsável A consegue ler a agenda e os boletins de cada aluno vinculado a ele, no mesmo formato e ordem do JSON.
- [x] O responsável A recebe 404 `ALUNO_NAO_ENCONTRADO` ao pedir o RM de um aluno do responsável B.
- [x] RM inexistente e RM de outro responsável produzem respostas idênticas (status e corpo).
- [x] RM não numérico, negativo ou com mais de 9 dígitos recebe 400 `DADOS_INVALIDOS`.
- [x] Sem token, com token inválido ou com sessão revogada: 401.
- [x] Existe teste que percorre todos os RMs da fonte do seed com o token de cada responsável e confirma acesso **somente** aos vinculados.
