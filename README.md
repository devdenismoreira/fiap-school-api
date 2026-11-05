# FIAP School API

API do app [FIAP School Mobile](../FiapSchoolMobile). Ela substitui o JSON local do app por HTTP com autenticação JWT e sessões, **sem mudar telas, domínio nem a função de conversão do app**: o app troca só a camada de dados.

> **Status:** fase _Specify/Plan_ do SDD. Specs e tarefas escritas e aguardando aprovação. Ainda não há código.

## Endpoints planejados

| Endpoint | Função |
|---|---|
| `POST /v1/auth/login` | CPF e senha → abre a sessão e devolve tokens + responsável completo |
| `GET /v1/me` | Responsável do token (restaurar sessão) |
| `POST /v1/auth/refresh` | Renova a sessão, com rotação do refresh token |
| `POST /v1/auth/logout` | Revoga a sessão |
| `GET /v1/alunos/{rm}/agenda` e `/boletins` | Dados de um aluno vinculado ao responsável do token; outro RM responde 404 |
| `GET /health` | Saúde do serviço |

O contrato completo está em [`specs/03-api-contract.md`](specs/03-api-contract.md) e será publicado no Swagger (`/docs`).

## Stack

| Tecnologia | Responsabilidade |
|---|---|
| Node.js | Runtime |
| Express | API REST |
| TypeScript | Tipagem |
| Prisma ORM | Acesso ao banco |
| PostgreSQL no Supabase | Banco de dados gerenciado, inclusive no desenvolvimento: schema `fiap_school` (dev) e `fiap_school_test` (testes) |
| Zod | Validação |
| JWT (`jose`, ES256) | Autenticação |
| bcrypt | Hash de senhas |
| Swagger | Documentação da API |
| `helmet`, `cors`, `express-rate-limit`, `pino` | HSTS e cabeçalhos, CORS, limite de tentativas, logs com redaction |

As decisões estão em [`specs/00-project-overview.md`](specs/00-project-overview.md) §6.

## Segurança

- **Sessões:**
  - o refresh token é guardado só como hash e ligado a uma sessão;
  - há rotação, revogação do anterior, expiração e detecção de reuso;
  - o logout revoga a sessão.
- **Autorização:** o responsável vem do token, e rotas por aluno verificam o vínculo responsável–aluno.
- **HTTPS:** obrigatório fora do ambiente local, com HSTS e TLS até o Supabase.
- **CORS:** lista exata de origens.
- **Dados:** validação com Zod, erros sem informação sensível e segredos fora do repositório.

Detalhes em [`specs/04-security.md`](specs/04-security.md) e [`specs/features/cors-and-https.md`](specs/features/cors-and-https.md).

## Arquitetura

```text
main ──► presentation (rotas, controllers, views, middlewares) ──► domain (entidades, casos de uso, portas) ◄── infra (Prisma, bcrypt, jose, pino)
```

- **Model:** entidades do domínio.
- **View:** presenters que montam o JSON do contrato.
- **Controller:** camada HTTP fina.
- **Domínio:** casos de uso e portas, sem Express nem Prisma.

Detalhes em [`specs/01-architecture.md`](specs/01-architecture.md).

## Processo (SDD)

| Caminho | Conteúdo |
|---|---|
| [`specs/`](specs/README.md) | Visão geral e decisões, arquitetura, modelo de dados, contrato, segurança e uma spec por funcionalidade |
| [`tasks/`](tasks/README.md) | T01 a T11, com dependências, critérios de aceite e validação |
| [`CLAUDE.md`](CLAUDE.md) | Contexto e regras do projeto para a IA |
| [`.claude/`](.claude/) | Agentes (`architect`, `backend-developer`, `test-engineer`, `code-reviewer`), comandos (`/specify`, `/plan`, `/implement`, `/validate`, `/review`) e permissões compartilhadas |

Fluxo de cada tarefa: `/specify` → aprovação → `/plan` → aprovação → `/implement` → `/validate` → `/review`.

## Próximos passos

1. Criar o projeto no Supabase (região São Paulo), que é usado já no desenvolvimento.
2. Aprovar as propostas e responder às dúvidas de `specs/00-project-overview.md` §7.
3. Executar a T01 (fundação). O README ganha então as instruções de instalação e execução.
