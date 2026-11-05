# 00 — Visão geral

> Status: **aprovada em 2026-11-05** · Fase SDD: _Implement_ (T01) · Atualizado em 2026-11-05 (aprovação das propostas, versões da T01)

## 1. Objetivo

Criar a API que substitui o JSON local do app FIAP School Mobile. O app deve passar a usar HTTP **trocando apenas a camada de dados**: telas, ViewModels, domínio e a função `toGuardian` continuam iguais.

## 2. Contexto: o contrato que o app já usa

O app acessa os dados por uma única interface (`../FiapSchoolMobile/src/data/datasources/GuardianDataSource.ts`):

```ts
interface GuardianDataSource {
  signIn(cpfDigits: string, password: string): Promise<ResponsavelDTO | null>;
  getById(id: number): Promise<ResponsavelDTO | null>;
}
```

- `signIn` faz o login. `null` significa credenciais inválidas, e o app mostra o erro genérico.
- `getById` restaura a sessão ao abrir o app. `null` descarta a sessão, e o app volta ao Login.
- Os dois devolvem o **agregado completo**: responsável → alunos → agenda → boletins.
- A sessão do app hoje guarda no AsyncStorage só `{ version, guardianId, selectedStudentRm }`. A troca de aluno é local.

## 3. Formato real dos dados

Origem: JSON do desafio, inspecionado só quanto ao formato.

| Campo | Formato | Observação |
|---|---|---|
| `id` (responsável) | inteiro | 2 responsáveis |
| `cpf` | 11 dígitos, sem máscara | Credencial; nunca sai da API |
| `senha` | texto de 6 dígitos | Credencial; no banco, só o hash |
| `email` | texto | Não é usado pelo app; nunca sai da API |
| `alunos[].rm` | inteiro, único | 3 alunos; um responsável tem 2 |
| `turma`, `periodo` | texto (ex.: `7EF`, `Matutino`) | |
| `agenda[].dia` | `AAAA-MM-DD`, em ordem crescente | 7 dias por aluno; **6 dias sem aula** (`aulas: []`) |
| `aulas[].horario` | `HH:MM - HH:MM` | |
| `boletim[].ano` | texto (ex.: `"2025"`) | 1 ou 2 boletins por aluno; a turma é a daquele ano |
| `trimestres[].trimestre` | 1, 2, 3 | |
| `disciplinas[].nota` / `faltas` | número ou `null` | 72 valores `null` ("não lançado") |

## 4. Escopo

| Dentro | Fora (por enquanto) |
|---|---|
| Login, `/me`, refresh, logout, `/health` | Cadastro e recuperação de senha |
| Agenda e boletins por aluno, com autorização pelo vínculo (D-07) | Administração e escrita de notas ou agenda |
| Sessões com refresh token rotativo (D-17) | Supabase Auth, Storage e Realtime (D-20) |
| CORS (D-18) e HTTPS (D-19) | Certificate pinning no app (D-23) |
| PostgreSQL no Supabase, com seed dos dados do desafio | |
| Limite de tentativas, logs seguros, Swagger | |

## 5. Impactos no app

Estes pontos são decididos no repositório do app, pelo SDD de lá (T10). Ficam registrados aqui porque a API influencia a resposta.

| # | Situação | Com a API |
|---|---|---|
| A-1 | Login sem internet | Hoje qualquer falha mostra "Usuário ou senha inválida", o que estaria errado. O Figma só tem esse estado de erro |
| A-2 | Abrir o app offline | Uma falha de rede no refresh ou no `/me` derrubaria o usuário para o Login. Opções: cache do último `/me` ou tela de "tentar novamente" |
| A-3 | Sessão expirada ou revogada | Volta ao Login em silêncio ou com mensagem? |
| A-4 | 429 no login | Mensagem genérica ou específica? |
| A-5 | Tokens | O refresh token vai para o `react-native-keychain` (Keychain no iOS, Keystore no Android) e o access fica **só em memória**. **Nenhum token vai para o AsyncStorage**; ele continua só com `selectedStudentRm`. A senha nunca é persistida |
| A-6 | Restaurar a sessão | Ao abrir o app, ler o refresh token do Keychain → `POST /v1/auth/refresh` → `GET /v1/me`, sem pedir login. Sem refresh token, vai para o Login |
| A-7 | Camada HTTP | `fetch` com interceptador: ao receber 401 `TOKEN_EXPIRADO`, renova uma vez e repete a requisição original uma única vez. Renovação **compartilhada** entre requisições simultâneas: cinco 401 juntos geram um único refresh |

## 6. Decisões

✅ = definida ou aprovada pelo desenvolvedor. Sem ✅ = proposta aguardando aprovação.

| # | Tema | Decisão / proposta |
|---|---|---|
| D-01 ✅ | Framework e ORM | **Express + Prisma** |
| D-02 ✅ | Arquitetura | **MVC + Clean Architecture**: Model = domínio; View = presenters JSON; Controller = camada HTTP fina; casos de uso e portas independentes de framework (spec 01) |
| D-03 ✅ | Linguagem e runtime | **Node.js + TypeScript** (`strict`). Node 22 (`.nvmrc`, como o app; `engines` `>=22.12`, mínimo do Prisma 7) e Express 5. **TypeScript 6.0**, não o 7: o `typescript-eslint` aceita `<6.1` e o `ts-jest` aceita `<7` (T01, 2026-11-05). Reavaliar quando os dois suportarem o 7 |
| D-04 ✅ | Banco | **PostgreSQL gerenciado no Supabase, também no desenvolvimento.** Decisão do desenvolvedor em 2026-11-05: sem banco nem Docker no computador. Região **São Paulo (`sa-east-1`)**, confirmada em 2026-11-05: um primeiro projeto criado em `us-east-1` será substituído e apagado (a senha dele também foi exposta no chat). A hospedagem da T11 deve ficar perto do banco. Organização: o schema `fiap_school` para desenvolvimento e o `fiap_school_test` para os testes de integração, no mesmo projeto. Produção é decidida na T11: outro projeto gratuito ou outro schema |
| D-05 ✅ | Gerenciador de pacotes | Yarn 1.22, como no app |
| D-06 ✅ | Formato da resposta | O app não muda: `responsavel` idêntico ao `ResponsavelDTO`, com chaves em português, ordem e `null` preservados |
| D-07 ✅ | Granularidade e autorização | `/me` com o agregado completo, que o app usa. Endpoints por aluno (`/v1/alunos/{rm}/agenda` e `/boletins`) **validam o vínculo responsável–aluno**, e trocar o RM na URL não expõe alunos de outro responsável (`features/students.md`) |
| D-08 ✅ | Autenticação | **JWT**: access ES256 de 15 minutos, gerado com `jose`, com `sid` (sessão) e sem dados pessoais (spec 04 §2). Refresh de 30 dias |
| D-09 ✅ | Hash de senha | **bcrypt**, custo 12. A senha é limitada a 72 bytes, o limite do algoritmo. Substitui a proposta anterior de Argon2id |
| D-10 ✅ | Validação | **Zod** (corpos, parâmetros e variáveis de ambiente) |
| D-11 ✅ | Proteções HTTP e logs | `helmet`; `express-rate-limit` por IP e por CPF (chave = HMAC do CPF): 5 falhas por CPF a cada 15 minutos e 20 requisições por IP por minuto nas rotas de autenticação; `pino` com redaction |
| D-12 ✅ | Seed | Lê o JSON do app por `SEED_SOURCE_PATH`, sem copiá-lo. Grava as senhas com bcrypt, mantém ids e ordem e é idempotente |
| D-13 ✅ | Testes | Jest + Supertest. Integração no schema `fiap_school_test` do Supabase, em série (`--runInBand`), com **trava**: a suíte se recusa a rodar se o schema da URL não terminar em `_test`, para nunca apagar os dados de desenvolvimento. Teste de paridade obrigatório com o JSON. Custo: os testes de integração exigem internet e o projeto ativo (o plano gratuito pausa após inatividade). O Jest roda com `--experimental-vm-modules`, exigido pelo `import()` dinâmico do cliente do Prisma 7 (T01), e transpila o pacote `jose`, que é só ESM, com o próprio `ts-jest` (`transformIgnorePatterns`, T03). Fora do Jest, o Node 22 carrega o `jose` normalmente |
| D-14 ✅ | Documentação | **Swagger**: `openapi.yaml` (OpenAPI 3.1) gerado da spec 03 e servido com `swagger-ui-express`, só fora de produção |
| D-15 ✅ | Versionamento | Prefixo `/v1` |
| D-16 ✅ | Formato de erro | `{ "erro": { "codigo": "…", "mensagem": "…" } }`, com os códigos da spec 03 |
| D-17 ✅ | Sessões | O refresh token é guardado só como hash, **associado a uma sessão** (`sessoes`): rotação a cada uso, revogação do anterior, expiração, detecção de reuso (revoga a sessão) e logout revogando a sessão. O access token leva `sid`, e o `requireAuth` recusa sessão revogada, para o logout valer na hora |
| D-18 ✅ | CORS | Lista de origens permitidas por ambiente (`CORS_ORIGINS`), sem curinga e sem credenciais. Requisições sem `Origin` (o app nativo) não são afetadas. **Não há cliente web** (2026-11-05): `CORS_ORIGINS` fica vazio em todos os ambientes, com o middleware e os testes prontos para quando houver (`features/cors-and-https.md`) |
| D-19 ✅ | HTTPS | Obrigatório fora do ambiente local: TLS na borda da hospedagem, `trust proxy`, recusa de HTTP com 403 e HSTS. TLS também entre a API e o Supabase (`sslmode=require`). HTTPS local opcional (mkcert) ou túnel para testar em aparelho (`features/cors-and-https.md`) |
| D-20 ✅ | Uso do Supabase | Só como Postgres gerenciado. Sem Supabase Auth, porque a autenticação é da API. Tabelas no schema `fiap_school`, fora da Data API do Supabase, com RLS ativado em todas como segunda barreira |
| D-21 ✅ | Hospedagem da API | **Escolhida ao fim do projeto, na T11** (decisão do desenvolvedor em 2026-11-05). Critérios: plano gratuito, rodando por ao menos 30 dias, para tráfego baixo, com HTTPS no domínio da plataforma. Até lá, a API é independente de plataforma: lê `PORT` e `TRUST_PROXY` do ambiente e roda com `yarn build && yarn start`. Riscos do gratuito: a hospedagem pode "dormir" sem acesso (primeira requisição lenta) e o Supabase pausa após inatividade. O timeout do app (T10) e o roteiro de demonstração precisam considerar os dois |
| D-22 ✅ | Aluno não vinculado | 404 `ALUNO_NAO_ENCONTRADO`, a mesma resposta para RM inexistente e para RM de outro responsável, sem revelar se o aluno existe |
| D-23 ✅ | Certificate pinning no app | Não agora: uma renovação de certificado travaria o app. Reavaliar em produção |
| D-24 ✅ | Prisma 7 | Versão estável atual (7.10; a tag `latest` do npm aponta para a 8 em RC, por isso a versão é fixada). O Prisma 7 não aceita `url`/`directUrl` no `schema.prisma` e exige *driver adapter*: as URLs ficam no `prisma.config.ts` (CLI, `DIRECT_URL`) e o cliente usa `@prisma/adapter-pg` com `DATABASE_URL`, recebendo o schema da URL. O `pg` e os tipos vêm como dependência do adapter (T01, 2026-11-05) |
| D-25 ✅ | Variáveis de ambiente | Lidas pelo próprio Node 22 (`--env-file-if-exists` no `dev`, `process.loadEnvFile` no `prisma.config.ts` e `util.parseEnv` na trava dos testes), sem a biblioteca `dotenv`. Na hospedagem, vêm das variáveis da plataforma. O `.env` nunca sobrescreve uma variável já definida no ambiente. Exceção: o setup dos testes de integração aplica o `.env.test` por cima do ambiente e só então confere a trava do schema `_test` (T01, 2026-11-05) |
| D-26 ✅ | TLS com o Supabase | **Certificado validado.** A `DATABASE_URL` usa `sslmode=verify-full&sslrootcert=certs/supabase-ca.crt`, e o `env.ts` aceita só `verify-full` nela. Motivo: o Supabase assina os certificados com CA própria (cadeia `*.pooler.supabase.com` ← Supabase Intermediate 2021 CA ← Supabase Root 2021 CA), e sem a raiz o `pg` recusa a conexão (`SELF_SIGNED_CERT_IN_CHAIN`). O `pg` 8 já trata `require` como `verify-full`, mas o `pg` 9 vai tratá-lo como só criptografia, então a URL explicita `verify-full`. O certificado raiz é público e está versionado em `certs/`. Ele foi extraído da própria conexão TLS com o pooler, porque o desenvolvedor não o encontrou no painel. A impressão digital SHA-256 (`80:70:25:AD:…:CA:FA`) foi a mesma em `us-east-1` e em `sa-east-1`, e pode ser comparada com o arquivo do painel (Project Settings → Database → SSL Configuration). A `DIRECT_URL`, usada pelo CLI do Prisma, segue com `sslmode=require`: criptografa, mas não valida o certificado. Conferido na T02: com `sslaccept=strict&sslcert=certs/supabase-ca.crt`, o CLI carrega a CA, mas o TLS nativo do macOS recusa o certificado do pooler, que tem validade de 1.825 dias (o macOS aceita no máximo 825). No Linux (CI ou hospedagem), o modo estrito deve funcionar e será conferido na T11. Decisão do desenvolvedor em 2026-11-05 |

## 7. Dúvidas em aberto

1. Os pontos A-1 a A-7 serão especificados no repositório do app, na T10.

Respondidas em 2026-11-05:
- **Propostas:** todas aprovadas pelo desenvolvedor (D-03, D-05, D-08, D-11 a D-17, D-20, D-22 e D-23).
- **Repositório:** `github.com/devdenismoreira/fiap-school-api`, com `main` e `develop`.
- **Durações:** access de 15 minutos e refresh de 30 dias.
- **Limite de tentativas:** 5 falhas por CPF a cada 15 minutos e 20 requisições por IP por minuto nas rotas de autenticação.
- **Hospedagem:** escolhida ao fim do projeto, gratuita, por ao menos 30 dias (D-21).
- **Supabase:** projeto ainda não criado. Será usado também no desenvolvimento, então precisa existir antes da T01 (D-04).
- **Cliente web:** não existe; `CORS_ORIGINS` vazio (D-18).
