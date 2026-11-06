---
description: Plan (SDD) — decompõe uma spec aprovada em tarefa com passos por camada, testes e critérios de aceite
argument-hint: <spec aprovada, ex.: specs/features/login.md>
---

Fase **Plan** do SDD para: $ARGUMENTS

Delegue ao agente `architect`.

1. Confirme que a spec e as decisões dela estão aprovadas (✅). Se não estiverem, pare e peça a aprovação.
2. Leia `tasks/README.md` e as tarefas existentes para manter a numeração e o formato.
3. Crie `tasks/Txx-<slug>.md` com:
   - **Depende de** e **Specs**;
   - **Objetivo**;
   - **Escopo** em passos pequenos, na ordem `domain` → `infra` → `presentation` → `main`, citando os arquivos;
   - **Critérios de aceite** em checklist, incluindo os cenários de segurança;
   - **Validação**: `yarn typecheck`, `yarn lint`, `yarn test` e `yarn test:integration`.
4. Liste dependências novas, se houver, com necessidade, compatibilidade e alternativa. Nada é instalado nesta fase.
5. Adicione a tarefa ao índice `tasks/README.md`.
6. Não escreva código.

Ao final, apresente o plano e peça aprovação explícita para o `/implement`.
