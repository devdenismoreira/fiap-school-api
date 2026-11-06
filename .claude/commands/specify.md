---
description: Specify (SDD) — escreve ou atualiza a spec de uma funcionalidade ou do contrato da API, sem código
argument-hint: <funcionalidade ou mudança>
---

Fase **Specify** do SDD para: $ARGUMENTS

Delegue ao agente `architect` e acompanhe o resultado.

1. Leia `CLAUDE.md`, `specs/README.md`, as decisões D-xx em `specs/00-project-overview.md` §6, `specs/03-api-contract.md`, `specs/04-security.md` e a spec existente da área, se houver.
2. Levante os insumos reais:
   - o contrato do app em `../FiapSchoolMobile/src/data/datasources/` (`GuardianDataSource.ts` e `dtos.ts`);
   - a estrutura do JSON do desafio, só os formatos, sem valores pessoais;
   - o requisito correspondente em `CLAUDE.md` §3.
3. Escreva ou atualize `specs/features/<funcionalidade>.md`:
   - objetivo e regras numeradas;
   - contrato: método, rota, autenticação, requisição, respostas e códigos de erro;
   - casos de borda e segurança (autorização, validação, limite de tentativas, logs);
   - critérios de aceite em checklist e dúvidas.
4. Mantenha coerentes a spec 03 (contrato), a spec 02 (tabelas) e a spec 04 (segurança).
5. Divergências e escolhas viram decisões D-xx propostas. Não decida sozinho o que altera escopo.
6. Não escreva nem altere código.

Ao final, resuma a spec, liste as dúvidas e peça aprovação explícita para seguir ao `/plan`.
