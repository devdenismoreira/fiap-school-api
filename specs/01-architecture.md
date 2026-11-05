# 01 — Arquitetura

> Status: **aprovada em 2026-11-05** · Decisões: D-01 ✅ (Express + Prisma), D-02 ✅ (MVC + Clean Architecture)

## 1. Stack

| Tecnologia | Responsabilidade |
|---|---|
| Node.js | Runtime |
| Express | API REST |
| TypeScript | Tipagem (`strict`) |
| Prisma ORM | Acesso ao banco |
| PostgreSQL (Supabase) | Banco de dados gerenciado |
| Zod | Validação de corpos, parâmetros e variáveis de ambiente |
| JWT (`jose`) | Autenticação (access token ES256) |
| bcrypt | Hash de senhas |
| Swagger (`swagger-ui-express`) | Documentação da API |
| `helmet`, `cors`, `express-rate-limit`, `pino` | Cabeçalhos de segurança, CORS, limite de tentativas, logs |
| Jest + Supertest | Testes |

## 2. MVC sobre Clean Architecture

O MVC organiza a borda HTTP. A Clean Architecture garante que as regras não dependem de Express, Prisma ou bibliotecas de segurança.

| Papel | Responsabilidade | Pasta |
|---|---|---|
| **Model** | Entidades (`Guardian`, `Student`, `ScheduleDay`, `Lesson`, `ReportCard`, `Term`, `SubjectGrade`, `Session`, `RefreshToken`) e erros de domínio | `src/domain/entities`, `src/domain/errors` |
| Casos de uso | `login`, `getCurrentGuardian`, `refreshSession`, `logout`, `getStudentSchedule` e `getStudentReportCards` | `src/domain/usecases` |
| Portas | `GuardianRepository`, `SessionRepository`, `PasswordHasher`, `AccessTokenService`, `RefreshTokenGenerator`, `Clock` | `src/domain/repositories`, `src/domain/ports` |
| **Controller** | Lê a requisição já validada, chama o caso de uso e devolve a view com o status | `src/presentation/controllers` |
| **View** | Presenter que monta o JSON do contrato campo a campo (`guardianView`, `scheduleView`, `reportCardsView`, `tokensView`, `errorView`) | `src/presentation/views` |
| Rotas e middlewares | Routers do Express, `requireHttps`, `cors`, `requireAuth`, `validate` (zod), limite de tentativas, `noStore` e tratador de erros | `src/presentation/routes`, `src/presentation/middlewares`, `src/presentation/schemas` |
| Adaptadores | `PrismaGuardianRepository`, `PrismaSessionRepository`, `BcryptPasswordHasher`, `JoseAccessTokenService`, `CryptoRefreshTokenGenerator`, `SystemClock` e o logger `pino` | `src/infra/database/repositories`, `src/infra/security`, `src/infra/logging` |
| Composition root | Variáveis de ambiente (zod), injeção manual, criação do app e do servidor (HTTP ou HTTPS local) | `src/main` |

## 3. Regra de dependência

```text
main ──► presentation ──► domain ◄── infra
  └──────────────────────────────────►┘
```

- `domain` não importa nada de fora dele, nem bibliotecas de framework.
- `presentation` conhece os casos de uso e as entidades, nunca o Prisma.
- `infra` implementa as portas do domínio.
- `main` instancia os adaptadores e injeta nos casos de uso e controllers.

O lint verifica essa regra (`no-restricted-imports` por pasta, T01).

## 4. Estrutura

```text
src/
├── main/
│   ├── server.ts              HTTP, ou HTTPS local se houver certificado
│   ├── app.ts                 middlewares globais, rotas, tratador de erros
│   ├── dependencies.ts
│   └── config/env.ts
├── domain/
│   ├── entities/
│   ├── errors/
│   ├── ports/
│   ├── repositories/
│   └── usecases/
├── infra/
│   ├── database/
│   │   ├── prismaClient.ts
│   │   └── repositories/
│   ├── security/
│   └── logging/
└── presentation/
    ├── routes/                health, auth, me, students
    ├── controllers/
    ├── views/
    ├── middlewares/
    └── schemas/
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
tests/
└── integration/
openapi.yaml                   Swagger (T09)
```

## 5. Pipeline de middlewares

Ordem global, em `app.ts`:

1. `trust proxy` (`TRUST_PROXY`).
2. `requireHttps`: só em produção; deixa `/health` passar.
3. `helmet`: inclui HSTS em produção.
4. `cors`: lista de `CORS_ORIGINS`; preflight responde antes do limite de tentativas.
5. `express.json({ limit: '10kb' })`.
6. `pino-http`, com redaction.
7. Rotas, cada uma com o próprio limite, validação, `noStore` e `requireAuth` quando preciso.
8. Rota 404 e `errorHandler`.

## 6. Fluxo de uma requisição

`POST /v1/auth/login`:

1. Middlewares globais (§5) → limite por IP → `validate(loginSchema)` → limite por CPF → `noStore` → `LoginController`.
2. O controller chama `login({ cpf, password })`.
3. O caso de uso valida o dígito verificador do CPF e busca o responsável.
   - Com a senha errada ou o CPF inexistente, verifica o hash do mesmo jeito (contra um hash fictício) e lança `InvalidCredentialsError`.
   - Com sucesso, cria a sessão, gera o refresh (só o hash vai ao banco), emite o access com `sub` e `sid` e devolve `{ guardian, tokens }`.
4. O controller responde 200 com `tokensView(tokens)` mais `responsavel: guardianView(guardian)`.
5. Os erros sobem ao `errorHandler`, que traduz cada erro de domínio para status e código (spec 03). Erro desconhecido vira 500 genérico; os detalhes ficam só no log, com redaction.

`GET /v1/alunos/{rm}/agenda`:

1. Middlewares globais → limite por IP → `requireAuth` (token e sessão ativa) → `validate(studentParamsSchema)` → `noStore`.
2. `getStudentSchedule(guardianId, rm)` → `findLinkedStudent(guardianId, rm)`, numa consulta filtrada pelo vínculo. Se não encontrar, `StudentNotFoundError` → 404.

## 7. Erros de domínio e de borda

| Erro | Status | Código |
|---|---|---|
| `InvalidCredentialsError` | 401 | `CREDENCIAIS_INVALIDAS` |
| `InvalidAccessTokenError` (inclui sessão revogada ou inexistente) | 401 | `TOKEN_INVALIDO` |
| `ExpiredAccessTokenError` | 401 | `TOKEN_EXPIRADO` |
| `InvalidRefreshTokenError` | 401 | `REFRESH_INVALIDO` |
| `StudentNotFoundError` | 404 | `ALUNO_NAO_ENCONTRADO` |
| Corpo ou parâmetro inválido (zod, na apresentação) | 400 | `DADOS_INVALIDOS` |
| HTTP em produção (`requireHttps`) | 403 | `HTTPS_OBRIGATORIO` |
| Limite atingido (middleware) | 429 | `MUITAS_TENTATIVAS` |
| Rota inexistente | 404 | `NAO_ENCONTRADO` |
| Erro inesperado | 500 | `ERRO_INTERNO` |

## 8. Configuração

Variáveis validadas com zod em `src/main/config/env.ts`. O app não sobe se faltar alguma ou se houver valor inseguro em produção. O `.env.example` documenta todas.

| Variável | Uso |
|---|---|
| `NODE_ENV`, `PORT`, `LOG_LEVEL` | Execução |
| `DATABASE_URL` | Prisma em execução: pooler do Supabase em modo transação, com `?schema=fiap_school&sslmode=verify-full&sslrootcert=certs/supabase-ca.crt` (D-26) |
| `DIRECT_URL` | Migrations: pooler em modo sessão, com `?schema=fiap_school&sslmode=require`. Lida só pelo `prisma.config.ts` (D-24) |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | Chaves ES256 (PEM) |
| `JWT_ISSUER`, `JWT_AUDIENCE` | `fiap-school-api` e `fiap-school-mobile` |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS` | 900 e 2592000 |
| `BCRYPT_COST` | 12 (mínimo 12) |
| `CPF_HMAC_SECRET` | Chave do limite por CPF |
| `CORS_ORIGINS` | Origens permitidas; vazio = nenhuma; sem `*`; só `https://` em produção |
| `TRUST_PROXY` | Número de proxies à frente da API |
| `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH` | Opcionais: HTTPS local (`mkcert`) |
| `SEED_SOURCE_PATH` | Caminho do JSON do app (D-12) |

Os testes de integração leem `DATABASE_URL` e `DIRECT_URL` de um `.env.test`, fora do git, apontando para `schema=fiap_school_test`. O setup da suíte aborta se o schema de qualquer uma das duas não terminar em `_test`.

Cada tarefa acrescenta ao `env.ts` as variáveis que passa a usar; o `.env.example` documenta todas desde a T01.

Na `DATABASE_URL`, o único `sslmode` aceito é `verify-full` (D-26); sem ele, o app não sobe. Na `DIRECT_URL` e na trava dos testes, basta TLS obrigatório: `require`, `verify-ca` ou `verify-full`. O caminho do `sslrootcert` é relativo à pasta de onde a API é executada, a raiz do projeto.

## 9. Estratégia de testes

| Nível | O quê | Como |
|---|---|---|
| Unidade | Casos de uso, views, CPF, configuração | Fakes em memória das portas e `Clock` controlável |
| Integração | Rotas completas com banco: autenticação, sessões, autorização, CORS, HTTPS | Supertest contra o `app` e o schema `fiap_school_test` no Supabase, com `migrate deploy` e seed antes da suíte, em série (`--runInBand`) |
| Paridade | `GET /v1/me` igual ao JSON do app | Para cada responsável da fonte do seed |

Os testes de integração nunca tocam no schema de desenvolvimento: a trava do setup confere o sufixo `_test` (D-13). Os testes de unidade não usam banco nem rede.

## 10. Trade-offs

- **Agregado em `/me` mais endpoints por aluno:** o app atual não muda e já existe o caminho para carregar sob demanda, com a autorização testada desde o início.
- **Sessão verificada a cada requisição:** uma consulta a mais em troca de logout e revogação imediatos.
- **Limite de tentativas em memória:** suficiente para uma instância. Com várias, troca-se por Redis sem mudar as rotas.
- **Refresh opaco em vez de JWT:** permite revogar e detectar reuso pelo banco.
- **Supabase também no desenvolvimento e nos testes:**
  - ganhos: nada para instalar no computador, e o painel mostra os dados;
  - custos: depende de internet, o projeto gratuito pausa após inatividade e precisa ser reativado no painel, e os testes de integração são mais lentos que num banco local.
