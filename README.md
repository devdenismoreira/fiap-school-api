# FIAP School API

API do app [FIAP School Mobile](../FiapSchoolMobile). Ela substitui o JSON local do app por HTTP com autenticação JWT e sessões, **sem mudar telas, domínio nem a função de conversão do app**: o app troca só a camada de dados.

> **Status:** specs aprovadas em 2026-11-05. T01 (fundação) implementada: projeto Express + TypeScript + Prisma com `/health`, lint, testes e trava dos testes de integração. A conexão com o Supabase será validada quando o projeto for criado.

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
| Node.js 22 | Runtime |
| Express 5 | API REST |
| TypeScript 6 | Tipagem |
| Prisma ORM 7 (`@prisma/adapter-pg`) | Acesso ao banco |
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

## Como rodar

### Pré-requisitos

- Node.js 22.12 ou mais recente (`nvm use` lê o `.nvmrc`) e Yarn 1.22.
- Um projeto no [Supabase](https://supabase.com) (plano gratuito, região São Paulo). Não há banco nem Docker no computador.

### Configuração

1. `yarn` instala as dependências e gera o cliente do Prisma.
2. O certificado da CA raiz do Supabase já está versionado em `certs/supabase-ca.crt`. Ele é público e vale para todos os projetos. Para conferir: `openssl x509 -in certs/supabase-ca.crt -noout -subject -fingerprint -sha256` deve mostrar `CN=Supabase Root 2021 CA` e `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. O mesmo certificado pode ser baixado no painel (Project Settings → Database → SSL Configuration).
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `DIRECT_URL` com o usuário, a senha e o host das strings do painel (Connect → ORMs → Prisma). Use os parâmetros do `.env.example`, não o `?pgbouncer=true` do painel, e codifique `@` como `%40` e `#` como `%23` na senha.
4. Copie o `.env` para `.env.test`, troque o schema das duas URLs para `fiap_school_test` e use `NODE_ENV=test` e `LOG_LEVEL=silent`.

O `.env` e o `.env.test` ficam fora do git. A API não sobe sem as variáveis obrigatórias, com a `DATABASE_URL` sem `sslmode=verify-full` (D-26) ou sem schema. Execute os comandos na raiz do projeto, porque o caminho do certificado é relativo a ela.

### Comandos

| Comando | O que faz |
|---|---|
| `yarn dev` | Sobe a API em modo de desenvolvimento, lendo o `.env` |
| `yarn build` e `yarn start` | Gera o cliente do Prisma, compila para `dist/` e executa |
| `yarn typecheck` | Verificação de tipos |
| `yarn lint` | ESLint (inclui a regra de dependência entre camadas) e Prettier |
| `yarn format` | Formata o código com Prettier |
| `yarn test` | Testes de unidade, sem banco e sem rede |
| `yarn test:integration` | Testes HTTP no schema `fiap_school_test` do Supabase; exige internet e o projeto ativo |
| `yarn prisma:migrate` | Cria e aplica migrations no schema do `.env` (altera o banco) |
| `yarn db:seed` | Popula o banco com o JSON do app (T02) |

Os testes de integração abortam se o `.env.test` não existir ou se `DATABASE_URL` ou `DIRECT_URL` apontarem para um schema que não termine em `_test`. O `.env.test` prevalece sobre variáveis já definidas no terminal.

## Próximos passos

1. Criar o projeto no Supabase, preencher `.env` e `.env.test` e validar `yarn dev` + `GET /health` e `yarn test:integration`.
2. T02 (dados e seed), T03 (base de segurança) e T04 (CORS e HTTPS), que podem andar em paralelo.
