# FIAP School API — Contexto do Projeto

## 1. Papel do Claude

Atue como engenheiro de software backend sênior, parceiro de implementação e revisão técnica desta API.

O objetivo é entregar uma API segura, testada e proporcional ao escopo, que permita ao app FIAP School Mobile trocar o JSON local por chamadas HTTP **sem mudar telas, domínio nem a função de conversão do app**.

Não presuma requisitos nem invente dados, regras de negócio ou endpoints. Quando houver ambiguidade, registre-a como decisão D-xx em `specs/00-project-overview.md` §6 e pergunte antes de decidir algo que altere o escopo.

## 2. Informações do projeto

- **Projeto:** FIAP School API.
- **Cliente:** app FIAP School Mobile (React Native), em `../FiapSchoolMobile`.
- **Estado atual:** specs aprovadas em 2026-11-05. T01 a T09 concluídas (fundação, dados e seed, base de segurança, CORS e HTTPS, login, `/me`, refresh e logout, alunos com autorização, Swagger e paridade) e validadas no Supabase (`sa-east-1`). Próximas: T10 (integração no app, no repositório do app) e T11 (entrega).
- **Repositório:** `github.com/devdenismoreira/fiap-school-api`, com `main` e `develop`.
- **Contrato que a API substitui:** a interface `GuardianDataSource` do app (`../FiapSchoolMobile/src/data/datasources/GuardianDataSource.ts`), com os DTOs de `../FiapSchoolMobile/src/data/datasources/dtos.ts`.
- **Fonte dos dados:** o JSON do desafio em `prisma/data/responsaveis.json`. Ele saiu do app em 2026-11-05, quando o app passou a usar só a API, e é lido pelo seed por caminho configurável (D-12).
- **Banco:**
  - PostgreSQL gerenciado no **Supabase**, também no desenvolvimento, sem banco nem Docker no computador (D-04);
  - usado só como Postgres: sem Supabase Auth, com RLS ativado (D-20);
  - schemas: `fiap_school` para desenvolvimento e `fiap_school_test` para os testes de integração, protegido por uma trava contra uso fora do schema `_test` (D-13).

Não copie CPFs, e-mails ou senhas do JSON para specs, tasks, testes ou logs. Os testes leem os dados da fonte do seed em tempo de execução.

## 3. Requisitos funcionais

| Endpoint | Função | Substitui no app |
|---|---|---|
| `POST /v1/auth/login` | Autentica por CPF e senha; devolve tokens e o responsável completo | `signIn(cpf, senha)` |
| `GET /v1/me` | Devolve o responsável do token | `getById(id)` (restaurar sessão) |
| `POST /v1/auth/refresh` | Troca o refresh token por um novo par (rotação da sessão) | — |
| `POST /v1/auth/logout` | Revoga a sessão | — |
| `GET /v1/alunos/{rm}/agenda` e `/boletins` | Agenda e boletins de um aluno **vinculado** ao responsável do token | — (carregamento sob demanda futuro) |
| `GET /health` | Verificação de saúde para a hospedagem e o monitoramento | — |

O contrato detalhado fica em `specs/03-api-contract.md`. Regras que não podem ser quebradas:
- O objeto `responsavel` tem exatamente o formato do `ResponsavelDTO` do app, com as chaves em português e sem `cpf`, `email` ou `senha`.
- `nota` e `faltas` com valor `null` significam "não lançado". Nunca troque por 0 nem omita a chave.
- A ordem dos arrays é a ordem de exibição: alunos, dias, aulas, boletins, trimestres e disciplinas. Dias sem aula vêm com `aulas: []`.
- O erro de credenciais é sempre genérico: não revela se o problema é o CPF ou a senha.
- **Autorização em todo endpoint:**
  - o responsável vem do token;
  - rotas com `{rm}` verificam o vínculo responsável–aluno;
  - trocar o RM na URL nunca expõe aluno de outro responsável (404 indistinto, D-22).
- Fora do escopo: cadastro, recuperação de senha e administração.

## 4. Stack e restrições

| Tecnologia | Responsabilidade | Status |
|---|---|---|
| Node.js (22, `>=22.12`) | Runtime | ✅ D-03 |
| Express (5.3) | API REST | ✅ D-01 |
| TypeScript (6.0, `strict`) | Tipagem; o 7 é incompatível com `typescript-eslint` e `ts-jest` | ✅ D-03 |
| Prisma ORM (7.10) + `@prisma/adapter-pg` | Acesso ao banco; versão fixada, porque a tag `latest` é a 8 em RC | ✅ D-01, D-24 |
| PostgreSQL no Supabase | Banco de dados gerenciado | ✅ D-04 |
| Zod (4.6) | Validação de corpos, parâmetros e variáveis de ambiente | ✅ D-10 |
| JWT (`jose` 6.2, ES256) | Autenticação. Só ESM: o Jest o transpila com `ts-jest` | ✅ D-08 |
| bcrypt (6.0, custo 12) | Hash de senhas (seed e `BcryptPasswordHasher`) | ✅ D-09 |
| Swagger (`swagger-ui-express` 5.0) + `openapi.yaml` (3.1) | Documentação em `/docs` fora de produção; `yaml`, `ajv` e `ajv-formats` (dev) validam as respostas dos testes contra o contrato | ✅ D-14 |
| `cors` (2.8) | CORS por lista exata de origens, envolvido por `createCors` (403 no preflight não permitido) | ✅ D-18 |
| `helmet` (8.3), `pino` (10.4), `pino-http` (11.0), `express-rate-limit` (8.7) | Cabeçalhos e HSTS, logs com redaction, limite de tentativas | ✅ D-11 |
| Jest (30.5) + `ts-jest` (29.4) + Supertest (7.3), schema `fiap_school_test` no Supabase | Testes | ✅ D-13 |
| ESLint (10.14) + `typescript-eslint` (8.72) + Prettier (3.9) | Lint, regra de dependência entre camadas e formatação | ✅ T01 |
| `tsx` (4.23), `tsc-alias` (1.9) | Execução em desenvolvimento; alias `@/` no build | ✅ T01 |
| Variáveis de ambiente pelo Node 22, sem `dotenv` | `.env` em desenvolvimento, `.env.test` nos testes | ✅ D-25 |
| Yarn 1.22 | Gerenciador de pacotes (como no app) | ✅ D-05 |

Versões instaladas na T01 em 2026-11-05. Não adicione bibliotecas por conveniência: antes de instalar, explique necessidade, compatibilidade e alternativa. Também não adicione NestJS, GraphQL, ORMs extras, container de injeção de dependência, Supabase Auth nem o `supabase-js`.

## 5. Arquitetura: MVC + Clean Architecture

| Papel | Camada | Pasta |
|---|---|---|
| **Model** | Entidades e regras do domínio | `src/domain/entities` |
| Casos de uso | Regras da aplicação, independentes de framework | `src/domain/usecases` |
| Portas | Interfaces que o domínio exige: repositórios (inclusive de sessões), hash, tokens, relógio | `src/domain/repositories`, `src/domain/ports` |
| **Controller** | Recebe a requisição validada, chama o caso de uso e escolhe a view e o status | `src/presentation/controllers` |
| **View** | Converte a entidade no JSON do contrato (presenter) | `src/presentation/views` |
| Rotas e middlewares | Express: rotas, HTTPS, CORS, autenticação, validação, limite de tentativas, erros | `src/presentation/routes`, `src/presentation/middlewares`, `src/presentation/schemas` |
| Adaptadores | Implementam as portas: Prisma, bcrypt, `jose`, `pino` | `src/infra` |
| Composition root | Monta as dependências e o servidor | `src/main` |

Estrutura de referência:

```text
src/
├── main/            server.ts, app.ts, dependencies.ts, config/env.ts
├── domain/          entities/, errors/, ports/, repositories/, usecases/
├── infra/           database/repositories/, security/, logging/
└── presentation/    routes/, controllers/, views/, middlewares/, schemas/
prisma/              schema.prisma, migrations/, seed.ts
tests/integration/   testes HTTP com banco de teste
```

Regras:
- **Regra de dependência:**
  - `domain` não importa Express, Prisma, `jose`, `bcrypt` nem nada de `infra` ou `presentation`;
  - `presentation` usa os casos de uso;
  - `infra` implementa as portas;
  - só `main` conhece todos.
- **Controllers finos:** sem regra de negócio e sem Prisma. Os casos de uso não conhecem `req` nem `res`.
- **Views são a única fonte do formato de resposta.** Elas listam campo a campo o que sai, nunca espalham a entidade inteira.
- **Injeção manual** em `src/main/dependencies.ts`.
- **Sem abstração prematura:**
  - nada de `BaseController` ou `BaseRepository`;
  - nada de UseCase para operação trivial;
  - nada de mapper sem transformação real.
- **Nomenclatura:** código e entidades em inglês, como no app (`Guardian`, `Student`). Tabelas e colunas em português `snake_case` via `@@map`/`@map`. O contrato HTTP usa as chaves em português do JSON.
- **Testes:** os de unidade ficam ao lado do arquivo (`Nome.test.ts`); os de integração, em `tests/integration/`.

## 6. Segurança e dados pessoais

Os detalhes estão em `specs/04-security.md` e `specs/features/cors-and-https.md`. Os pontos inegociáveis:
- **Senha:**
  - só bcrypt (custo ≥ 12), limitada a 72 bytes;
  - nunca em texto puro, em log ou em resposta;
  - tempo constante para CPF inexistente.
- **Access token:** JWT ES256 de 15 minutos com `sub` (responsável) e `sid` (sessão). Sem CPF, nome ou e-mail no payload.
- **Sessões:**
  - o refresh token é opaco, guardado só como hash e associado a uma sessão;
  - rotação a cada uso, revogação do anterior e expiração;
  - reuso revoga a sessão, e o logout também;
  - o `requireAuth` recusa sessão revogada.
- **Autorização:**
  - o responsável vem sempre do `sub` do token, nunca de id enviado pelo cliente;
  - rotas com `{rm}` verificam o vínculo responsável–aluno (OWASP API1).
- **HTTPS:**
  - obrigatório fora do ambiente local (TLS na borda, `trust proxy`, HTTP recusado com 403, HSTS);
  - TLS também na conexão com o Supabase.
- **CORS:** lista exata de origens (`CORS_ORIGINS`), sem `*`, sem refletir origem e sem credenciais. O app nativo não é afetado.
- **Limite de tentativas** no login, por CPF e por IP.
- **Logs** sem CPF, senha, token, URL do banco nem corpo de autenticação (redaction no `pino`).
- **Respostas autenticadas** com `Cache-Control: no-store`. Erros sem informação sensível nem stack trace; `x-powered-by` desligado.
- **Supabase:**
  - sem `anon` nem `service_role` na API ou no app;
  - tabelas fora da Data API, com RLS ativado.
- **Dados de menores (LGPD):** minimização. A API devolve só o que o app exibe.
- **Segredos:**
  - ficam em `.env` e nas variáveis da hospedagem, fora do git; o `.env.example` documenta as chaves;
  - não leia `.env` nem chaves `.pem`.

## 7. Contrato e versionamento

- O contrato é definido primeiro (contract-first), em `specs/03-api-contract.md`. A partir dele se gera o `openapi.yaml` do Swagger (T09). Mudou o contrato, atualize a spec antes do código.
- Prefixo `/v1`. Mudança incompatível exige `/v2`.
- **Teste de paridade obrigatório:** para cada responsável do seed, `GET /v1/me` deve ser igual ao registro do JSON sem `cpf`, `email` e `senha`, inclusive na ordem e nos `null`.

## 8. Qualidade e testes

Priorize testes para:
- login válido, inválido e com corpo malformado;
- erro genérico e limite de tentativas;
- emissão, expiração e assinatura do access token;
- sessões: rotação, reuso que revoga a sessão, logout imediato;
- `/me` sem token, com token inválido, com token expirado e com sessão revogada;
- autorização: nenhum responsável acessa aluno de outro, testando todos os RMs;
- CORS (origem permitida, negada, sem `Origin`) e HTTPS (HTTP recusado em produção, HSTS);
- paridade do contrato com o JSON;
- seed idempotente.

Comandos (criados na T01): `yarn typecheck`, `yarn lint`, `yarn test` (unidade) e `yarn test:integration` (usa o schema `fiap_school_test` no Supabase; exige internet e o projeto ativo).

Não afirme que algo foi validado sem executar o comando correspondente. Registre as limitações do ambiente.

## 9. SDD — Spec-Driven Development

1. **Specify:** comportamento, contrato, estados de erro, critérios de aceite e casos de borda.
2. **Plan:** tarefas pequenas, dependências e estratégia de validação.
3. **Implement:** somente o escopo aprovado.
4. **Validate:** testes, análise estática e conferência do contrato.
5. **Review:** arquitetura, segurança, contrato e testes.

Os artefatos ficam em `specs/` e `tasks/`. Atualize as specs quando uma decisão mudar. No Claude Code, o ciclo está nos comandos `/specify`, `/plan`, `/implement`, `/validate` e `/review`, que delegam aos agentes de `.claude/agents/` (ver §14).

## 10. Organização de tarefas

O plano está em `tasks/README.md`:
- T01: fundação;
- T02: dados e seed;
- T03: base de segurança;
- T04: CORS e HTTPS;
- T05: login;
- T06: `/me`;
- T07: sessões;
- T08: alunos com autorização;
- T09: Swagger e paridade;
- T10: integração no app;
- T11: entrega.

A T10 é executada no repositório do app, com o SDD de lá.

## 11. Padrões de código e colaboração

- TypeScript estrito; evite `any`.
- Funções e classes pequenas, com responsabilidade única. Nomes claros.
- Não escreva comentários no código. As decisões vão para specs, tasks ou README. Ficam só os comentários de configuração e as diretivas (`eslint-disable`, `@ts-expect-error`).
- Não faça refatorações fora do escopo sem explicar o motivo.
- Antes de adicionar uma dependência, explique necessidade, compatibilidade e alternativa.
- Não execute comandos destrutivos sem explicar o impacto e obter confirmação. Isso inclui `prisma migrate reset` e qualquer migration ou seed contra o Supabase. Os testes de integração só rodam no schema `fiap_school_test`.
- Responda, pergunte e documente em português.
- Commits:
  - Conventional Commits, com tipo e escopo em inglês e mensagem em português;
  - um commit por funcionalidade, com os próprios testes;
  - commit só com pedido explícito.
- Nunca faça push automaticamente.
- Ao concluir uma etapa, informe arquivos alterados, decisões, comandos executados, resultados e pendências.

## 12. Critérios de entrega

- Os endpoints de `/v1` e o `/health` funcionando conforme a spec 03, com o teste de paridade passando.
- Segurança da spec 04 aplicada e testada, incluindo autorização, sessões, CORS e HTTPS.
- Publicada com HTTPS na hospedagem escolhida (D-21), com banco no Supabase.
- Ambiente de desenvolvimento documentado no README: projeto no Supabase, schemas de desenvolvimento e de teste, migrations e seed.
- Swagger publicado em `/docs` fora de produção.
- README com pré-requisitos, variáveis de ambiente, execução, testes e arquitetura.
- Documentação SDD e `AI_USAGE.md` atualizados.

## 13. Primeira ação obrigatória

Ao iniciar uma sessão:
1. Leia este arquivo integralmente.
2. Inspecione o estado real do repositório (`git status`, `package.json`, estrutura).
3. Leia as specs e a tarefa da área que vai mudar, incluindo as decisões D-xx em `specs/00-project-overview.md` §6.
4. Se mexer no contrato, confira os DTOs reais do app em `../FiapSchoolMobile/src/data/datasources/dtos.ts`.
5. Para escopo novo, siga o ciclo `/specify` → aprovação → `/plan` → aprovação → `/implement` → `/validate` → `/review`.
6. Não implemente nada até o desenvolvedor aprovar a spec e o plano.

## 14. Configuração do Claude Code

| Arquivo | Função |
|---|---|
| `.claude/agents/architect.md` | Specify e Plan: specs, contrato e tarefas; não edita código |
| `.claude/agents/backend-developer.md` | Implement: código e testes de uma tarefa aprovada |
| `.claude/agents/test-engineer.md` | Validate: testes de unidade, integração e paridade |
| `.claude/agents/code-reviewer.md` | Review: revisão do diff com foco em segurança; somente leitura |
| `.claude/commands/*.md` | `/specify`, `/plan`, `/implement`, `/validate` e `/review` |
| `.claude/settings.json` | Permissões compartilhadas |

Permissões:
- **Liberado:** typecheck, lint, testes e leitura do git.
- **Pede confirmação:** commit, push, dependências, Prisma (migrations) e seed, que alteram o banco no Supabase.
- **Bloqueado:** push forçado, `git reset --hard`, `git clean` e leitura de `.env` e `.pem`.

Configurações pessoais ficam em `.claude/settings.local.json`, ignorado pelo git.
