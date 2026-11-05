# 04 — Segurança

> Status: **aprovada em 2026-11-05** · Decisões: D-07 ✅, D-08 ✅, D-09 ✅, D-11 ✅, D-17 ✅, D-18 ✅, D-19 ✅, D-20 ✅, D-22 ✅

## 1. Senhas (bcrypt)

- **bcrypt** com custo 12 (`BCRYPT_COST`, mínimo 12). O hash fica em `senha_hash`.
- **Limite de 72 bytes:** o bcrypt ignora o que passa disso, então o zod limita `senha` a 72 bytes em UTF-8 (`Buffer.byteLength`), e não a 72 caracteres. As senhas atuais têm 6 dígitos.
- **Tempo constante:** se o CPF não existe ou o dígito verificador é inválido, verifica-se a senha contra um hash bcrypt fictício, gerado na inicialização com o mesmo custo. Assim o tempo de resposta não revela quais CPFs estão cadastrados.
- A senha nunca vai para log, resposta, token ou armazenamento do app.

## 2. Access token (JWT)

| Item | Valor |
|---|---|
| Biblioteca | `jose` |
| Algoritmo | ES256 (P-256). O verificador aceita **só** ES256, sem `none` nem HS* |
| Validade | 900 s (`ACCESS_TOKEN_TTL_SECONDS`) |
| Claims | `sub` (id do responsável), `sid` (id da sessão), `iss`, `aud`, `iat`, `exp` e `jti` |
| Proibido no payload | CPF, nome, e-mail, RM, qualquer dado pessoal |
| Tolerância de relógio | 30 s |
| Chaves | PEM em variáveis de ambiente, com um par por ambiente, nunca versionado |

`requireAuth`:
1. aceita só `Authorization: Bearer <token>`;
2. valida assinatura, algoritmo, `iss`, `aud` e `exp`;
3. carrega a sessão `sid` e exige que **exista, pertença ao `sub` e não esteja revogada**;
4. expõe aos controllers só `guardianId` e `sessionId`.

A verificação da sessão faz o logout e a detecção de reuso valerem na hora, inclusive para o access token já emitido. O custo é uma consulta por requisição autenticada.

## 3. Sessões e refresh token (D-17)

| Regra | Como |
|---|---|
| Sessão | Cada login cria uma linha em `sessoes`. Login em outro aparelho cria outra sessão, independente |
| Hash | O refresh token é formado por 32 bytes de `crypto.randomBytes` em base64url, opaco e não JWT. O banco guarda **só** o SHA-256 em hexadecimal (`refresh_tokens.token_hash`), ligado à sessão |
| Expiração | 30 dias a partir da emissão de cada refresh (`REFRESH_TOKEN_TTL_SECONDS`) |
| Rotação | A cada `POST /v1/auth/refresh`, numa transação: o token atual recebe `usado_em` (fica revogado), nasce um novo na mesma sessão e o antigo aponta para ele (`substituido_por`) |
| Revogação do anterior | Um token com `usado_em` nunca mais é aceito |
| Detecção de reuso | Token já usado apresentado de novo: **revoga a sessão** (`revogada_em`, motivo `reuso`). Todos os refresh e access tokens dela deixam de valer, e o legítimo precisa logar de novo |
| Logout | Revoga a sessão do refresh informado (motivo `logout`). É idempotente |
| Concorrência | O cliente faz um único refresh por vez (single-flight, A-7). Dois refreshes paralelos com o mesmo token disparam a detecção de reuso |

## 4. Autorização (D-07, D-22)

- Toda rota autenticada obtém o responsável **só** do token (`sub`), nunca de parâmetro, corpo ou query.
- Rotas com `{rm}` consultam o aluno **filtrando pelo vínculo** com o responsável do token, numa única consulta.
- RM inexistente e RM de outro responsável respondem igual: 404 `ALUNO_NAO_ENCONTRADO`.
- Não há rotas administrativas nem papéis diferentes de "responsável".

## 5. Transporte: HTTPS e CORS

Os detalhes estão em `features/cors-and-https.md`. Resumo:
- **HTTPS:**
  - obrigatório fora do ambiente local, com TLS na borda da hospedagem (D-21);
  - `trust proxy` com o número exato de proxies;
  - `requireHttps` recusa HTTP com 403 `HTTPS_OBRIGATORIO`, sem redirecionar, para não convidar o envio de credenciais em claro;
  - HSTS de 1 ano.
- **Banco:** TLS entre a API e o Supabase (`sslmode=require`).
- **CORS:**
  - lista exata de origens (`CORS_ORIGINS`), sem curinga, sem refletir a origem e sem credenciais;
  - em produção, só `https://`;
  - requisições sem `Origin` (o app nativo) não são afetadas;
  - CORS não substitui autenticação.

## 6. Limite de tentativas

| Rota | Chave | Limite proposto | Resposta |
|---|---|---|---|
| `POST /v1/auth/login` | IP | 20 por minuto | 429 + `Retry-After` |
| `POST /v1/auth/login` | HMAC-SHA256(CPF, `CPF_HMAC_SECRET`) | 5 falhas a cada 15 minutos; o sucesso zera | 429 + `Retry-After` |
| `POST /v1/auth/refresh` e `/logout` | IP | 30 por minuto | 429 |
| Rotas autenticadas (`/me`, `/alunos`) | IP | 120 por minuto | 429 |

O store em memória atende uma instância (D-11). O preflight `OPTIONS` não conta. O CPF nunca é usado em claro como chave.

## 7. Proteções HTTP e erros

- `helmet` com os padrões (inclui HSTS em produção) e `app.disable('x-powered-by')`.
- `express.json({ limit: '10kb' })`.
- `Cache-Control: no-store` em `/v1/auth/*`, `/v1/me` e `/v1/alunos/*`.
- **Mensagens de erro:**
  - nunca têm stack trace, mensagem do Prisma, SQL ou detalhes de validação além do código;
  - erro de credenciais é sempre genérico.
- `/docs` (Swagger) só fora de produção.

## 8. Banco no Supabase (D-20)

- **O Supabase é só o Postgres gerenciado:**
  - a autenticação é da API, então não se usa Supabase Auth;
  - não se usa o cliente `supabase-js`;
  - as chaves `anon` e `service_role` não entram na API nem no app.
- **Tabelas fora da Data API:**
  - as tabelas ficam no schema `fiap_school` (`?schema=fiap_school` na URL do Prisma), que não é exposto pela Data API (PostgREST);
  - **RLS ativado em todas as tabelas**, sem políticas, como segunda barreira. O Prisma conecta como dono das tabelas e não é afetado.
- **Conexões:**
  - `DATABASE_URL` (runtime) pelo pooler do Supabase;
  - `DIRECT_URL` (migrations) por conexão direta ou pelo pooler em modo sessão;
  - `DATABASE_URL` com `sslmode=verify-full&sslrootcert=certs/supabase-ca.crt`: criptografa e valida o certificado contra a CA raiz do Supabase (D-26);
  - `DIRECT_URL` com TLS obrigatório (`sslmode=require` ou superior); a validação do certificado no CLI do Prisma é conferida na T02;
  - portas: pooler em modo transação (6543) para a `DATABASE_URL` e em modo sessão (5432) para a `DIRECT_URL`.
- **Senha do banco e URLs de conexão:** só em `.env` e nas variáveis da hospedagem, nunca no repositório.
- **Plano gratuito:**
  - o projeto pausa após inatividade, e o primeiro acesso depois disso falha até ele ser reativado no painel;
  - para demonstrações, reativar antes.
- **Desenvolvimento e testes no Supabase (D-04, D-13):**
  - os testes de integração usam só o schema `fiap_school_test`, e o setup aborta fora de um schema `_test`;
  - os dados de teste são os do desafio, sem informação real nova.

## 9. Logs

- `pino` em JSON, com redaction de:
  - `req.headers.authorization`;
  - `req.body.senha`;
  - `req.body.cpf`;
  - `req.body.refreshToken`;
  - `*.accessToken`;
  - `*.refreshToken`;
  - `DATABASE_URL`.
- Não registrar corpos de resposta.
- Os eventos de segurança são registrados sem dados pessoais:
  - falha de login (só o HMAC do CPF);
  - 429;
  - reuso de refresh e revogação de sessão (`sessao_id`);
  - acesso negado a RM (`responsavel_id` e o RM pedido);
  - HTTP recusado em produção.

## 10. Dados pessoais (LGPD)

- Os alunos são menores de idade. A API devolve só o que o app exibe: nome, turma, período, RM, agenda e boletim.
- CPF e e-mail ficam só no banco, para autenticação. Não aparecem em resposta, log ou token.
- O seed lê a fonte de dados sem copiá-la para o repositório e sem registrar valores.
- Proposta: projeto do Supabase na região de São Paulo (dúvida 3 da spec 00).

## 11. OWASP API Security Top 10 (2023)

| Risco | Mitigação |
|---|---|
| API1 Autorização por objeto | `sub` do token em todas as rotas; rotas com `{rm}` filtram pelo vínculo; 404 indistinto |
| API2 Autenticação quebrada | bcrypt; tempo constante; limite por CPF e por IP; JWT ES256 com validação completa; sessões com rotação, reuso e revogação |
| API3 Autorização por propriedade | Views com lista explícita de campos; teste garante a ausência de `cpf`, `email` e `senha` |
| API4 Consumo de recursos | Limite de corpo, limite de tentativas e timeouts |
| API5 Autorização por função | Não há rotas administrativas |
| API6 Fluxos de negócio sensíveis | Login protegido contra força bruta |
| API7 SSRF | A API não faz requisições de saída |
| API8 Configuração | `helmet`, HTTPS obrigatório, HSTS, CORS restrito, sem stack trace, `/docs` só fora de produção, segredos fora do git, RLS no Supabase |
| API9 Inventário | `/v1`, Swagger versionado |
| API10 Consumo inseguro de APIs | Não se aplica |

## 12. Critérios de aceite de segurança

- [ ] CPF inexistente, dígito verificador inválido e senha errada produzem a mesma resposta, com tempo equivalente.
- [ ] Senha com mais de 72 bytes recebe 400 `DADOS_INVALIDOS`.
- [ ] A 6ª falha seguida para o mesmo CPF dentro de 15 minutos recebe 429 com `Retry-After`.
- [ ] Token com assinatura alterada, `alg: none`, `iss` ou `aud` errados, vencido ou de **sessão revogada** é recusado.
- [ ] Refresh reutilizado revoga a sessão, e o access token e o refresh emitidos depois deixam de valer.
- [ ] Logout revoga a sessão na hora: o access token dela passa a receber 401.
- [ ] Um responsável nunca obtém dados de aluno de outro responsável (teste percorrendo todos os RMs).
- [ ] Nenhuma resposta contém `cpf`, `email` ou `senha`. Nenhum log contém CPF, senha, token ou URL do banco.
- [ ] Critérios de CORS e HTTPS de `features/cors-and-https.md` §5.
- [ ] Todas as tabelas do schema `fiap_school` têm RLS ativado (verificado por consulta ao catálogo no teste de integração).
