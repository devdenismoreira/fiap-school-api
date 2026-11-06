# FIAP School API

API do app FIAP School Mobile (React Native, em repositório separado). Ela substitui o JSON local do app (que a entrega original usava) por HTTP com autenticação JWT e sessões, **sem mudar telas, domínio nem a função de conversão do app**: o app troca só a camada de dados.

> **Status:** as tarefas T01 a T11 estão concluídas: API, segurança, contrato publicado no Swagger, deploy na Railway com HTTPS (banco no Supabase, `sa-east-1`) e integração no app (T10, feita no repositório dele). O login e o `/me` devolvem só o responsável e os alunos; agenda e boletins vêm pelas rotas de alunos (D-28).

## Endpoints

| Endpoint | Autenticação | Função |
|---|---|---|
| `POST /v1/auth/login` | — | CPF e senha → abre uma sessão e devolve os tokens e o responsável com a lista de alunos (sem agenda nem boletins) |
| `GET /v1/me` | Bearer | Responsável do token e seus alunos (`rm`, turma, período, nome), usado para restaurar a sessão ao abrir o app |
| `POST /v1/auth/refresh` | refresh token no corpo | Renova a sessão, com rotação do refresh token e detecção de reuso |
| `POST /v1/auth/logout` | refresh token no corpo | Revoga a sessão; é idempotente |
| `GET /v1/alunos/{rm}/agenda` | Bearer | Agenda de um aluno **vinculado** ao responsável do token: `{ "agenda": [...] }` |
| `GET /v1/alunos/{rm}/boletins` | Bearer | Boletins de um aluno vinculado: `{ "boletins": [...] }` |
| `GET /health` | — | Saúde da API e do banco: 200 `{ "status": "ok" }` ou 503 |

- **Contrato:** [`specs/03-api-contract.md`](specs/03-api-contract.md) e [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1).
- **Swagger:** em **`/docs`**, em todos os ambientes: [produção](https://fiap-school-api-production.up.railway.app/docs) e `http://localhost:3000/docs` no desenvolvimento. O "Try it out" chama o próprio host.
- **Erros:** sempre no formato `{ "erro": { "codigo": "…", "mensagem": "…" } }`.
- **Cache:** toda resposta de `/v1` leva `Cache-Control: no-store`.

### Fluxo do app

1. **Login:** `POST /v1/auth/login`. O app guarda o `refreshToken` no Keychain (iOS) ou Keystore (Android) e o `accessToken` só em memória.
2. **Ao abrir o app:** `POST /v1/auth/refresh` com o refresh do Keychain → `GET /v1/me` com o novo access.
3. **Access vencido:** `401 TOKEN_EXPIRADO` → um único refresh, compartilhado entre as requisições, e a repetição da requisição original.
4. **Sair:** `POST /v1/auth/logout` e limpeza do Keychain.

### Usuários de teste

São os responsáveis do JSON do desafio, em [`prisma/data/responsaveis.json`](prisma/data/responsaveis.json). O login usa os campos `cpf` e `senha` de cada um. Os valores não são repetidos aqui nem em testes e logs: os testes leem o arquivo em tempo de execução.

| Responsável | Situação que exercita |
|---|---|
| id 1 | 2 alunos, agenda com dias sem aula, notas e faltas não lançadas (`null`) |
| id 2 | 1 aluno |
| id 3 | Nenhum aluno (`alunos: []`) |
| id 4 | 1 aluno sem boletim |

Para testar no Swagger:
1. Faça o **Try it out** no `POST /v1/auth/login`.
2. Copie o `accessToken` para o botão **Authorize**.
3. Chame o `GET /v1/me`.

## Stack

| Tecnologia | Responsabilidade |
|---|---|
| Node.js 22 (`>=22.12`) | Runtime |
| Express 5 | API REST |
| TypeScript 6 (`strict`) | Tipagem |
| Prisma ORM 7 + `@prisma/adapter-pg` | Acesso ao banco |
| PostgreSQL no Supabase | Banco gerenciado, também no desenvolvimento |
| Zod 4 | Validação de corpos, parâmetros e variáveis de ambiente |
| `jose` (JWT ES256) | Access token |
| bcrypt (custo 12) | Hash de senhas |
| `helmet`, `cors`, `express-rate-limit`, `pino` + `pino-http` | Cabeçalhos e HSTS, CORS, limite de tentativas, logs com redaction |
| `swagger-ui-express` | Swagger em `/docs` |
| Jest + Supertest + Ajv | Testes de unidade, de integração e validação das respostas contra o `openapi.yaml` |

O motivo de cada escolha está nas decisões D-01 a D-27 da [spec 00](specs/00-project-overview.md) §6. As versões estão no [`package.json`](package.json).

## Arquitetura: MVC + Clean Architecture

```text
main ──► presentation (rotas, controllers, views, middlewares) ──► domain (entidades, casos de uso, portas) ◄── infra (Prisma, bcrypt, jose, pino)
```

| Papel | Pasta | O que tem |
|---|---|---|
| **Model** | `src/domain/entities` | Entidades e regras: CPF, sessão, refresh token |
| Casos de uso | `src/domain/usecases` | `login`, `authenticate`, `getCurrentGuardian`, `refreshSession`, `logout`, `getStudentSchedule`, `getStudentReportCards` |
| Portas | `src/domain/ports`, `src/domain/repositories` | Interfaces que o domínio exige: repositórios, hash, tokens, relógio, logger |
| **Controller** | `src/presentation/controllers` | Recebe a requisição validada, chama o caso de uso e escolhe a view e o status |
| **View** | `src/presentation/views` | Única fonte do formato de resposta, campo a campo |
| Rotas e middlewares | `src/presentation/routes`, `middlewares`, `schemas` | Rotas, `requireAuth`, `validate`, limites, CORS, HTTPS, erros |
| Adaptadores | `src/infra` | Prisma, bcrypt, `jose`, `pino` |
| Composition root | `src/main` | Variáveis de ambiente, injeção manual de dependências, app e servidor |

O domínio não importa Express, Prisma, `jose`, `bcrypt` nem as outras camadas, e o `yarn lint` falha se alguém tentar. Detalhes em [`specs/01-architecture.md`](specs/01-architecture.md).

```text
src/main/         server, app, dependências, config (env, seed)
src/domain/       entidades, erros, portas, repositórios, casos de uso
src/infra/        banco (Prisma, repositórios, seed), segurança, logs
src/presentation/ rotas, controllers, views, middlewares, schemas
prisma/           schema.prisma, migrations, seed.ts, data/responsaveis.json
tests/            integração (Supertest no Supabase) e suporte (trava, verificador de contrato)
scripts/          keys:generate
certs/            CA raiz pública do Supabase (TLS verificado com o banco)
specs/, tasks/    documentação SDD
```

## Segurança

- **Senhas:** bcrypt com custo 12, limitado a 72 bytes. CPF inexistente leva o mesmo tempo que senha errada, graças a um hash fictício.
- **Erro de credenciais:** sempre genérico, sem revelar se o problema foi o CPF ou a senha.
- **Access token:** JWT ES256 de 15 minutos, só com `sub` (responsável) e `sid` (sessão), sem dados pessoais. Aceita só ES256.
- **Sessões:**
  - o refresh token é opaco, guardado só como hash SHA-256 e vale 30 dias;
  - há rotação a cada uso, e o **reuso revoga a sessão inteira**;
  - o logout revoga a sessão na hora, porque o `requireAuth` confere a sessão em toda requisição.
- **Autorização:**
  - o responsável vem só do token;
  - as rotas com `{rm}` consultam pelo vínculo responsável–aluno;
  - RM de outro responsável e RM inexistente recebem o mesmo 404.
- **Limites de tentativa:**
  - login: 20 por minuto por IP e 5 falhas a cada 15 minutos por CPF, contadas pelo HMAC do CPF, nunca pelo CPF em claro;
  - refresh e logout: 30 por minuto por IP;
  - rotas autenticadas: 120 por minuto por IP.
- **Transporte:**
  - em produção, HTTPS obrigatório (HTTP recebe 403), HSTS e `trust proxy`;
  - TLS com certificado verificado até o Supabase;
  - CORS por lista exata de origens.
- **Logs e respostas:**
  - os logs ocultam CPF, senha, tokens, `Authorization` e URL do banco;
  - as respostas nunca têm stack trace nem `cpf`, `email` ou `senha`.

Detalhes em [`specs/04-security.md`](specs/04-security.md) e [`specs/features/cors-and-https.md`](specs/features/cors-and-https.md).

## Como rodar localmente

### Pré-requisitos

- **Node.js 22.12 ou mais recente:** o `nvm use` lê o `.nvmrc`.
- **Yarn 1.22.**
- **Um projeto no [Supabase](https://supabase.com),** plano gratuito, na região São Paulo. Não há banco nem Docker no computador.
- **`openssl`:** só para um teste de unidade do HTTPS local.

### Configuração

1. Rode `yarn` para instalar as dependências e gerar o cliente do Prisma.
2. Confira o certificado da CA raiz do Supabase, já versionado em `certs/supabase-ca.crt`. Ele é público e vale para todos os projetos. `openssl x509 -in certs/supabase-ca.crt -noout -subject -fingerprint -sha256` deve mostrar `CN=Supabase Root 2021 CA` e `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
3. Copie o `.env.example` para `.env` e preencha a `DATABASE_URL` e a `DIRECT_URL` com usuário, senha e host do painel do Supabase (Connect → ORMs → Prisma):
   - use os parâmetros do `.env.example`, não o `?pgbouncer=true` do painel;
   - na senha, codifique `@` como `%40` e `#` como `%23`.
4. Copie o `.env` para `.env.test`, troque o schema das duas URLs para `fiap_school_test` e use `NODE_ENV=test` e `LOG_LEVEL=silent`.
5. Gere as chaves JWT e o segredo do limite por CPF, um conjunto por arquivo: `yarn keys:generate .env && yarn keys:generate .env.test`. O script:
   - só acrescenta o que falta e nunca sobrescreve uma chave;
   - não mostra os valores;
   - recusa o `.env.example`.
6. Crie as tabelas e popule o banco de desenvolvimento: `yarn prisma:migrate && yarn db:seed`.
7. Suba a API com `yarn dev` e abra `http://localhost:3000/docs`.

O `.env` e o `.env.test` ficam fora do git. A API não sobe sem as variáveis obrigatórias, com a `DATABASE_URL` sem `sslmode=verify-full` ou sem schema, e a mensagem de erro não mostra valores. Rode os comandos na raiz do projeto, porque o caminho do certificado é relativo a ela.

### Variáveis de ambiente

| Variável | Obrigatória | Padrão | Uso |
|---|---|---|---|
| `NODE_ENV` | sim | — | `development`, `test` ou `production`. Em produção, liga HTTPS obrigatório e HSTS |
| `PORT` | não | `3000` | Porta HTTP |
| `LOG_LEVEL` | não | `info` | Nível do `pino` (`silent` nos testes) |
| `DATABASE_URL` | sim | — | Pooler do Supabase em modo transação (porta 6543), com `schema=…`, `sslmode=verify-full` e `sslrootcert=certs/supabase-ca.crt` |
| `DIRECT_URL` | para migrations | — | Pooler em modo sessão (porta 5432), com `schema=…` e `sslmode=require`. Só o CLI do Prisma usa |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | sim | — | Par ES256 em PEM, gerado pelo `keys:generate`. Aceita a chave numa linha só, com `\n` |
| `CPF_HMAC_SECRET` | sim | — | Segredo de no mínimo 32 caracteres do limite por CPF, gerado pelo `keys:generate` |
| `JWT_ISSUER`, `JWT_AUDIENCE` | não | `fiap-school-api`, `fiap-school-mobile` | Claims `iss` e `aud` |
| `ACCESS_TOKEN_TTL_SECONDS` | não | `900` | Validade do access token |
| `REFRESH_TOKEN_TTL_SECONDS` | não | `2592000` | Validade do refresh token (30 dias) |
| `BCRYPT_COST` | não | `12` | Custo do bcrypt (mínimo 12) |
| `CORS_ORIGINS` | não | vazio | Origens exatas, separadas por vírgula. Vazio, porque não há cliente web; só `https://` em produção |
| `TRUST_PROXY` | não | `0` | Número de proxies à frente da API (o da hospedagem em produção) |
| `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH` | não | — | HTTPS local com `mkcert`, os dois juntos |
| `SEED_SOURCE_PATH` | não | `prisma/data/responsaveis.json` | Fonte do seed |

### Bancos: um projeto Supabase, três schemas

O schema é escolhido pelo parâmetro `?schema=` da URL, e o código é o mesmo nos três.

| Schema | Arquivo de ambiente | Usado por |
|---|---|---|
| `fiap_school` | `.env` | `yarn dev`, `yarn prisma:migrate`, `yarn db:seed` |
| `fiap_school_test` | `.env.test` | `yarn test:integration` (migrations e seed automáticos) |
| `fiap_school_prod` | variáveis da hospedagem e `.env.production` local | `yarn start` na hospedagem, `yarn prisma:migrate:prod`, `yarn db:seed:prod` |

Todas as tabelas têm RLS ativado e ficam fora da Data API do Supabase. A API conecta como dona das tabelas.

### Comandos

| Comando | O que faz |
|---|---|
| `yarn dev` | API em modo de desenvolvimento, com recarga, lendo o `.env` |
| `yarn build` / `yarn start` | Gera o cliente do Prisma, compila para `dist/` / executa o `dist` |
| `yarn typecheck` | Verificação de tipos |
| `yarn lint` | ESLint (inclui a regra de dependência entre camadas) e Prettier |
| `yarn format` | Formata com Prettier |
| `yarn test` | Testes de unidade, sem banco e sem rede |
| `yarn test:integration` | Testes HTTP no schema `fiap_school_test`; exige internet e o projeto do Supabase ativo |
| `yarn keys:generate <arquivo>` | Acrescenta ao arquivo `.env` informado as chaves JWT e o `CPF_HMAC_SECRET` que faltarem |
| `yarn prisma:migrate` | Aplica as migrations pendentes no schema do `.env` |
| `yarn db:seed` | Apaga e regrava os dados do JSON no schema do `.env`; derruba as sessões abertas; mostra só o destino e as contagens |
| `yarn prisma:migrate:prod` / `yarn db:seed:prod` | O mesmo, no schema de produção, lendo o `.env.production` |

### Testes

- **Unidade (`yarn test`):** cobrem casos de uso com portas falsas e relógio controlado, além de views, schemas, middlewares, adaptadores de segurança, configuração e o verificador de contrato.
- **Integração (`yarn test:integration`):** usam Supertest contra a API completa e o schema `fiap_school_test`:
  - login, `/me`, refresh, reuso, logout e alunos;
  - CORS e HTTPS em modo produção;
  - seed, RLS e o teste de paridade, em que o `/me` precisa ser idêntico ao JSON (só responsável e alunos) para cada responsável;
  - o teste de autorização, que percorre **todos os RMs** com o token de **cada** responsável.
- **Contrato:** toda resposta dos testes de integração é conferida contra o `openapi.yaml`: status documentado, corpo no esquema e nenhuma chave `cpf`, `email`, `senha` ou `passwordHash`.
- **Trava:** os testes de integração abortam se o `.env.test` não existir ou se alguma URL apontar para um schema que não termine em `_test`. Assim, nunca apagam os dados de desenvolvimento.

### HTTPS, CORS e testes no celular

- **Simulador iOS:** `http://localhost:3000`. **Emulador Android:** `http://10.0.2.2:3000`.
- **Aparelho físico:** um túnel HTTPS dá uma URL pública com certificado válido, sem exceções no app: `cloudflared tunnel --url http://localhost:3000` ou `ngrok http 3000`.
- **HTTPS local (opcional):** com o [`mkcert`](https://github.com/FiloSottile/mkcert):

  ```bash
  mkcert -install
  mkdir -p certs/local && mkcert -key-file certs/local/localhost-key.pem -cert-file certs/local/localhost.pem localhost 127.0.0.1
  ```

  No `.env`, use `HTTPS_KEY_PATH=certs/local/localhost-key.pem` e `HTTPS_CERT_PATH=certs/local/localhost.pem`; a API sobe em `https://localhost:3000`. Os `.pem` são ignorados pelo git.
- **CORS:** o app nativo não envia `Origin` e não é afetado. O `CORS_ORIGINS` só importa se surgir um cliente web.

### Novas migrations

O `prisma migrate dev` precisa de um banco-sombra, que o pooler do Supabase não oferece. Para uma migration nova, gere o SQL comparando o banco de desenvolvimento com o `schema.prisma`, revise e aplique:

```bash
mkdir prisma/migrations/AAAAMMDDHHMMSS_nome
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/AAAAMMDDHHMMSS_nome/migration.sql
yarn prisma:migrate
```

Tabelas novas precisam de `ALTER TABLE … ENABLE ROW LEVEL SECURITY` no SQL (D-20).

## Deploy em produção

A API não depende de plataforma: lê `PORT` e `TRUST_PROXY`, roda com `yarn build && yarn start` e espera o TLS na borda da hospedagem. A escolha da plataforma e as limitações do plano gratuito são registradas na D-21 (T11).

### 1. Banco de produção (no seu computador)

1. Crie um `.env.production`, que fica fora do git:
   - parta do `.env.example`;
   - use `NODE_ENV=production`;
   - nas duas URLs, use `schema=fiap_school_prod`.
2. Gere as chaves de produção, diferentes das de desenvolvimento: `yarn keys:generate .env.production`.
3. Crie as tabelas: `yarn prisma:migrate:prod`. Confira na saída que o schema é `fiap_school_prod`.
4. Popule o banco: `yarn db:seed:prod`. A saída mostra o host, o schema e as contagens antes de terminar.

### 2. Serviço na hospedagem

| Configuração | Valor |
|---|---|
| Runtime | Node 22 (lido do `.nvmrc` e de `engines`) |
| Build | `yarn install --frozen-lockfile --production=false && yarn build`. O `--production=false` é necessário porque, com `NODE_ENV=production`, o Yarn pularia as dependências de desenvolvimento usadas no build (Prisma CLI, TypeScript) |
| Start | `yarn start` |
| Health check | `/health`, liberado por HTTP para a verificação da plataforma |
| Variáveis | `NODE_ENV=production`, `DATABASE_URL` (do `.env.production`), `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `CPF_HMAC_SECRET`, `TRUST_PROXY` (número de proxies da plataforma) e `LOG_LEVEL=info`. Não informe `CORS_ORIGINS` nem `DIRECT_URL` |

### 3. Verificações depois do deploy

Troque `https://SEU-SERVICO` pela URL do serviço:

```bash
curl -i https://SEU-SERVICO/health                       # 200 {"status":"ok"} e Strict-Transport-Security
curl -i https://SEU-SERVICO/docs/                         # 200: Swagger (D-14)
curl -i -X OPTIONS https://SEU-SERVICO/v1/auth/login \
  -H 'Origin: https://site-qualquer.com' \
  -H 'Access-Control-Request-Method: POST'                # 403: origem não permitida
curl -i https://SEU-SERVICO/v1/me                         # 401 TOKEN_INVALIDO
```

Depois, faça um login com um usuário de teste e confira o `/me`. Confirme também o `TRUST_PROXY`: o limite por IP precisa contar o IP do cliente, não o do proxy. Meça a primeira requisição depois de a plataforma "dormir", para calibrar o timeout do app (T10).

### Planos gratuitos

- **Supabase:** o projeto pausa após 7 dias sem uso. Um monitor gratuito chamando o `/health` periodicamente, como o UptimeRobot, mantém o banco ativo e, em plataformas que dormem, também a API.
- **Hospedagens gratuitas:** costumam desligar a API sem acesso. A primeira requisição depois disso é lenta.

## Limitações conhecidas

- **Limite de tentativas em memória:** atende uma instância só (D-11). Com várias, troque o `store` por Redis, sem mudar as rotas.
- **CLI do Prisma no macOS:** não consegue validar o certificado do Supabase, porque o macOS recusa certificados com validade acima de 825 dias. A `DIRECT_URL`, usada só nas migrations, fica com `sslmode=require` (criptografada). A API valida o certificado normalmente (D-26).
- **Banco remoto:** os testes de integração dependem de internet e do projeto do Supabase ativo.

## Processo (SDD)

O projeto segue Spec-Driven Development: `/specify` → aprovação → `/plan` → aprovação → `/implement` → `/validate` → `/review`.

| Caminho | Conteúdo |
|---|---|
| [`specs/`](specs/README.md) | Visão geral e decisões (D-01 a D-27), arquitetura, modelo de dados, contrato, segurança e uma spec por funcionalidade |
| [`tasks/`](tasks/README.md) | T01 a T11, com dependências, critérios de aceite, validação e status |
| [`openapi.yaml`](openapi.yaml) | Contrato executável, validado pelos testes |
| [`CLAUDE.md`](CLAUDE.md) | Contexto e regras do projeto para o Claude Code |
| [`.claude/`](.claude/) | Agentes (`architect`, `backend-developer`, `test-engineer`, `code-reviewer`), comandos do ciclo SDD (`/specify`, `/plan`, `/implement`, `/validate`, `/review`) e permissões compartilhadas (`settings.json`). O `settings.local.json`, pessoal, fica fora do git |

O uso de IA no projeto, com as evidências de validação, é registrado no `AI_USAGE.md` (T11).
