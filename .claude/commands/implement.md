---
description: Implement (SDD) — implementa uma tarefa aprovada da API, com testes, sem sair do escopo
argument-hint: <tarefa, ex.: tasks/T05-login.md>
---

Fase **Implement** do SDD para: $ARGUMENTS

Delegue ao agente `backend-developer`. Use o `test-engineer` para os testes de integração, de segurança e de paridade.

1. Confirme que a tarefa foi aprovada. Leia a tarefa, as specs citadas e o código vizinho antes de editar.
2. Implemente somente o escopo, respeitando:
   - a regra de dependência da Clean Architecture;
   - os papéis do MVC (controllers finos, views explícitas);
   - a spec de segurança;
   - sem comentários no código.
3. Escreva os testes de cada critério de aceite: de unidade com fakes e de integração com Supertest.
4. Rode `yarn typecheck`, `yarn lint` e `yarn test`. Se houver rota ou banco envolvidos, rode também `yarn test:integration` (schema `fiap_school_test` no Supabase). Migrations e seed pedem confirmação.
5. Se uma decisão mudar, atualize a spec (contrato, dados ou segurança).
6. Atualize a seção "Status" da tarefa.
7. Não faça commit nem push sem pedido explícito.

Ao final, informe:
- arquivos alterados;
- decisões;
- comandos executados, com resultados;
- pendências.

Sugira os commits no padrão Conventional Commits: tipo em inglês, mensagem em português, um por funcionalidade.
