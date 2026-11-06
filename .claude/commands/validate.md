---
description: Validate (SDD) — executa as verificações da API e confere os critérios de aceite da tarefa um a um
argument-hint: <tarefa, ex.: tasks/T06-me.md>
---

Fase **Validate** do SDD para: $ARGUMENTS

1. Com Node 22 (`nvm use`), rode e registre a saída real de:
   - `yarn typecheck`
   - `yarn lint`
   - `yarn test`
   - `yarn test:integration`: usa o schema `fiap_school_test` do Supabase e exige internet e o projeto ativo.
2. Para cada critério de aceite da tarefa, indique a evidência: o teste (arquivo e nome do caso) ou o comando executado.
3. Se a tarefa toca no contrato, confirme que o teste de paridade com o JSON do app passa e que a spec 03 e o OpenAPI estão iguais.
4. Se faltar cobertura, sobretudo dos cenários de segurança da spec 04, delegue ao agente `test-engineer` e rode tudo de novo.

Não afirme que algo foi validado sem o comando ou a evidência correspondente. Atualize a seção "Status" da tarefa com o resultado.
