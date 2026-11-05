# Feature — Seed com os dados do desafio

> Status: **aprovada em 2026-11-05** · Decisão: D-12 ✅ · Comando: `yarn db:seed`

## 1. Objetivo

Popular o banco com os mesmos responsáveis, alunos, agendas e boletins do JSON do app. Os logins de teste continuam funcionando sem duplicar o arquivo neste repositório.

## 2. Regras

1. Lê o arquivo do caminho em `SEED_SOURCE_PATH` (por padrão, `../FiapSchoolMobile/src/data/datasources/local/responsaveis.json`). Se não existir, falha com mensagem clara, sem mostrar conteúdo.
2. Valida a estrutura com zod, no formato do JSON (`ResponsavelDTO` + `cpf`, `email` e `senha`). Se o formato for inesperado, aborta antes de gravar.
3. Grava a senha com bcrypt, no custo de `BCRYPT_COST` (D-09). A senha em texto nunca vai para o banco nem para o log.
4. **Idempotente:** numa única transação, apaga os dados e regrava tudo.
   - A exclusão em cascata leva junto as `sessoes` e os `refresh_tokens`, então as sessões abertas caem.
   - O seed é um comando de desenvolvimento e teste (regra 8).
5. **Mantém os ids da fonte:** o `id` do responsável é inserido explicitamente, igual ao do JSON, e a sequência é ajustada depois (`setval`). Assim o `responsavel.id` e o `guardianId` que o app já guardou continuam válidos.
6. Preserva a ordem: `ordem` = índice no array de origem, em todos os níveis.
7. Um aluno que aparece em mais de um responsável vira um único registro em `alunos` com dois vínculos.
8. **Saída:** só contagens (responsáveis, alunos, dias, aulas, boletins, notas). Nenhum valor.
9. Nunca roda em `NODE_ENV=production` sem a flag explícita `--force` (proteção contra sobrescrita).
10. Antes de gravar, mostra o host e o schema de destino (sem usuário nem senha). Assim fica claro se o alvo é `fiap_school` ou `fiap_school_test`.

## 3. Critérios de aceite

- [ ] As contagens do banco batem com as da fonte. O teste calcula as contagens a partir da própria fonte; hoje são 2 responsáveis, 3 alunos e 21 dias de agenda, 6 deles sem aula.
- [ ] Os ids dos responsáveis no banco são os mesmos da fonte.
- [ ] Rodar duas vezes seguidas produz o mesmo estado.
- [ ] `senha_hash` é bcrypt (prefixo `$2b$12$`). Nenhuma coluna contém a senha em texto.
- [ ] O seed funciona nos schemas `fiap_school` e `fiap_school_test` do Supabase.
- [ ] Login com as credenciais da fonte funciona (verificado em teste, lendo a fonte em tempo de execução).
- [ ] A saída do comando não contém CPF, e-mail, senha nem nomes.
