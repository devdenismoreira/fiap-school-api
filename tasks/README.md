# Plano de tarefas

Cada tarefa tem escopo, dependências, critérios de aceite e estratégia de validação. A implementação só começa após aprovação, uma tarefa por vez, com relatório ao final (arquivos alterados, comandos executados e pendências).

| # | Tarefa | Depende de | Entrega principal |
|---|---|---|---|
| T01 | [Fundação](T01-fundacao.md) ✅ | aprovação das specs e projeto no Supabase | Node + TS + Express 5 + Prisma; Supabase com os schemas de desenvolvimento e de teste; trava dos testes; `/health`; lint, Jest e env validado |
| T02 | [Dados e seed](T02-dados-e-seed.md) ✅ | T01 | Esquema Prisma (schema `fiap_school`, RLS), migrations, repositório do agregado, seed |
| T03 | [Base de segurança](T03-base-de-seguranca.md) ✅ | T01 | bcrypt, JWT, sessões, erros, logs, `helmet`, limite de tentativas |
| T04 | [CORS e HTTPS](T04-cors-e-https.md) ✅ | T01 | `cors` por lista, `requireHttps`, HSTS, `trust proxy`, HTTPS local, TLS com o Supabase |
| T05 | [Login](T05-login.md) ✅ | T02, T03 | `POST /v1/auth/login`, que abre a sessão |
| T06 | [Responsável autenticado](T06-me.md) | T05 | `GET /v1/me` com `requireAuth` e verificação de sessão |
| T07 | [Sessões: refresh e logout](T07-refresh-e-logout.md) | T05 | Rotação, reuso e revogação da sessão |
| T08 | [Alunos com autorização](T08-alunos-com-autorizacao.md) | T06 | `/v1/alunos/{rm}/agenda` e `/boletins`, com vínculo verificado |
| T09 | [Contrato e paridade](T09-contrato-e-paridade.md) | T04, T07, T08 | Swagger (`openapi.yaml`, `/docs`), paridade com o JSON do app |
| T10 | [Integração no app](T10-integracao-no-app.md) | T09 | Datasource remoto, Keychain e interceptador no FiapSchoolMobile (executada lá) |
| T11 | [Validação e entrega](T11-validacao-e-entrega.md) | T09 (e T10) | Deploy com HTTPS, README, `AI_USAGE.md`, revisão de segurança |

Tarefas que podem andar em paralelo:
- T02, T03 e T04, após a T01;
- T06 e T07, após a T05.

No Claude Code, o ciclo de cada tarefa é: `/plan` (se precisar refinar) → aprovação → `/implement` → `/validate` → `/review`.
