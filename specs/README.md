# Especificações da FIAP School API

Especificações escritas a partir do contrato que o app FIAP School Mobile já consome (`GuardianDataSource` e DTOs) e da estrutura real do JSON do desafio. A diretriz é: **o app troca só a camada de dados**.

As decisões do desenvolvedor estão marcadas com ✅ em `00-project-overview.md` §6. As demais são propostas aguardando aprovação.

| Documento | Conteúdo |
|---|---|
| [00-project-overview.md](00-project-overview.md) | Objetivo, contrato atual do app, formato dos dados, escopo, impactos no app, decisões e dúvidas |
| [01-architecture.md](01-architecture.md) | MVC + Clean Architecture, regra de dependência, pastas, fluxo, erros, configuração, testes |
| [02-data-model.md](02-data-model.md) | Normalização do JSON, esquema Prisma, regras de ordem e `null` |
| [03-api-contract.md](03-api-contract.md) | Endpoints, corpos, erros e correspondência com o app (contract-first) |
| [04-security.md](04-security.md) | bcrypt, JWT, sessões com rotação e reuso, autorização, HTTPS e CORS, limite de tentativas, Supabase, logs, LGPD, OWASP API Top 10 |
| [features/cors-and-https.md](features/cors-and-https.md) | CORS por lista de origens, HTTPS na borda, HSTS, TLS com o Supabase, desenvolvimento em aparelho |
| [features/login.md](features/login.md) | `POST /v1/auth/login` |
| [features/me.md](features/me.md) | `GET /v1/me` |
| [features/refresh-and-logout.md](features/refresh-and-logout.md) | Sessões: `POST /v1/auth/refresh` e `POST /v1/auth/logout` |
| [features/students.md](features/students.md) | `GET /v1/alunos/{rm}/agenda` e `/boletins`, com autorização pelo vínculo |
| [features/seed.md](features/seed.md) | Carga dos dados do desafio |

Regras de manutenção:
- Mudou o contrato? Atualize a spec 03 antes do código.
- Mudou uma decisão? Atualize a spec e a tabela D-xx.
- Documentação não substitui teste.
