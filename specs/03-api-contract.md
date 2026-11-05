# 03 — Contrato da API

> Status: **aprovada em 2026-11-05** · Contract-first (D-14 ✅) · Versão `/v1` (D-15 ✅)

Fonte do formato: `ResponsavelDTO` do app (`../FiapSchoolMobile/src/data/datasources/dtos.ts`). Qualquer mudança aqui precisa manter o app funcionando sem alteração no domínio nem na função `toGuardian`.

## 1. Convenções

- **Transporte:**
  - HTTPS obrigatório fora do ambiente local; em produção, HTTP recebe 403 `HTTPS_OBRIGATORIO`;
  - CORS restrito às origens de `CORS_ORIGINS`;
  - o app nativo não envia `Origin` e não é afetado (`features/cors-and-https.md`).
- **JSON em UTF-8.** Corpo máximo: 10 KB.
- **Autenticação:** `Authorization: Bearer <accessToken>`.
- **Toda resposta de `/v1/auth/*`, `/v1/me` e `/v1/alunos/*`** leva `Cache-Control: no-store`.
- **Erro sempre no formato:**

```json
{ "erro": { "codigo": "CREDENCIAIS_INVALIDAS", "mensagem": "Usuário ou senha inválida." } }
```

| Código | Status | Quando |
|---|---|---|
| `DADOS_INVALIDOS` | 400 | Corpo ou parâmetro ausente, malformado ou com tipos errados, inclusive JSON inválido e corpo acima de 10 KB |
| `CREDENCIAIS_INVALIDAS` | 401 | CPF inexistente, dígito verificador inválido ou senha errada; sempre a mesma resposta |
| `TOKEN_INVALIDO` | 401 | Sem `Bearer`, assinatura inválida, `iss`/`aud` errados, sessão revogada ou responsável inexistente |
| `TOKEN_EXPIRADO` | 401 | Access token vencido; o cliente deve chamar o refresh |
| `REFRESH_INVALIDO` | 401 | Refresh desconhecido, expirado, já usado (reuso) ou de sessão revogada |
| `HTTPS_OBRIGATORIO` | 403 | Requisição sem TLS em produção |
| `ALUNO_NAO_ENCONTRADO` | 404 | RM inexistente ou de aluno não vinculado ao responsável; mesma resposta nos dois casos |
| `NAO_ENCONTRADO` | 404 | Rota inexistente |
| `MUITAS_TENTATIVAS` | 429 | Limite atingido; cabeçalho `Retry-After` em segundos |
| `ERRO_INTERNO` | 500 | Erro inesperado, sem detalhes |

Mensagens fixas:
- T01: `DADOS_INVALIDOS` → "Dados inválidos.", `NAO_ENCONTRADO` → "Recurso não encontrado." e `ERRO_INTERNO` → "Erro interno.".
- T03: `CREDENCIAIS_INVALIDAS` → "Usuário ou senha inválida.", `TOKEN_INVALIDO` → "Token de acesso inválido.", `TOKEN_EXPIRADO` → "Token de acesso expirado.", `REFRESH_INVALIDO` → "Sessão inválida ou expirada.", `ALUNO_NAO_ENCONTRADO` → "Aluno não encontrado." e `MUITAS_TENTATIVAS` → "Muitas tentativas. Tente novamente mais tarde.".
- `HTTPS_OBRIGATORIO` é definida na T04.

## 2. Objeto `Responsavel`

É exatamente o `ResponsavelDTO` do app:

```json
{
  "id": 1,
  "primeiroNome": "…",
  "sobrenome": "…",
  "alunos": [
    {
      "rm": 12345,
      "turma": "7EF",
      "periodo": "Matutino",
      "primeiroNome": "…",
      "sobrenome": "…",
      "agenda": [
        { "dia": "2025-03-16", "aulas": [] },
        { "dia": "2025-03-17", "aulas": [{ "horario": "07:30 - 08:15", "disciplina": "…" }] }
      ],
      "boletim": [
        {
          "ano": "2025",
          "turma": "7EF",
          "trimestres": [
            { "trimestre": 1, "disciplinas": [{ "nome": "…", "nota": 9.5, "faltas": 0 }] },
            { "trimestre": 2, "disciplinas": [{ "nome": "…", "nota": null, "faltas": null }] }
          ]
        }
      ]
    }
  ]
}
```

Regras:
1. **Nunca** inclui `cpf`, `email`, `senha` nem campos de banco (`ordem`, ids internos de dias, aulas ou boletins).
2. Arrays na ordem do JSON de origem. Dias sem aula com `aulas: []`.
3. `nota` (número com até 1 casa decimal) e `faltas` (inteiro) podem ser `null`, e a chave sempre aparece.
4. `dia` no formato `AAAA-MM-DD`; `ano` como texto.

## 3. Endpoints

### `POST /v1/auth/login`

Autenticação: nenhuma. Limites: por IP e por CPF (spec 04).

**Requisição:**

```json
{ "cpf": "<11 dígitos>", "senha": "<texto, 1 a 72 bytes (limite do bcrypt)>" }
```

**200:**

```json
{
  "accessToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "<opaco, base64url>",
  "refreshExpiresIn": 2592000,
  "responsavel": { "…": "objeto Responsavel" }
}
```

**Erros:**
- 400 `DADOS_INVALIDOS`: `cpf` ausente ou fora do formato de 11 dígitos, ou `senha` ausente ou com mais de 72 bytes.
- 401 `CREDENCIAIS_INVALIDAS`: o CPF tem 11 dígitos mas o dígito verificador é inválido, ou o CPF não existe, ou a senha está errada.
- 429 `MUITAS_TENTATIVAS`.

### `GET /v1/me`

Autenticação: Bearer.

- **200:** objeto `Responsavel`, do `sub` do token.
- **401:** `TOKEN_INVALIDO` (inclui sessão revogada) ou `TOKEN_EXPIRADO`.

No app, `getById(id)` chama este endpoint (renovando antes, se não houver access token em memória) e devolve `null` se `responsavel.id !== id` ou se a sessão não puder ser renovada.

### `GET /v1/alunos/{rm}/agenda` e `GET /v1/alunos/{rm}/boletins`

Autenticação: Bearer. Autorização: o aluno precisa estar vinculado ao responsável do token (`features/students.md`).

- **200:**
  - `agenda`: array de `{ dia, aulas: [{ horario, disciplina }] }`;
  - `boletins`: array de `{ ano, turma, trimestres: [{ trimestre, disciplinas: [{ nome, nota, faltas }] }] }`;
  - mesmas regras de ordem e `null` do objeto `Responsavel`.
- **400:** `DADOS_INVALIDOS` (RM não numérico, negativo ou com mais de 9 dígitos).
- **401:** `TOKEN_INVALIDO` ou `TOKEN_EXPIRADO`.
- **404:** `ALUNO_NAO_ENCONTRADO`, idêntico para RM inexistente e para RM de outro responsável.

O app atual não usa estes endpoints. Eles preparam o carregamento sob demanda (D-07).

### `POST /v1/auth/refresh`

Autenticação: o próprio refresh token, no corpo. Limite por IP.

**Requisição:**

```json
{ "refreshToken": "<opaco>" }
```

- **200:** `{ accessToken, tokenType, expiresIn, refreshToken, refreshExpiresIn }`, sem `responsavel`. O refresh antigo deixa de valer (rotação).
- **400:** `DADOS_INVALIDOS`.
- **401:** `REFRESH_INVALIDO`. Se o token já tinha sido usado, a **sessão inteira** é revogada (spec 04 §3).
- **429:** `MUITAS_TENTATIVAS`.

### `POST /v1/auth/logout`

Autenticação: o refresh token, no corpo. Não exige access token, para funcionar mesmo com ele vencido.

**Requisição:**

```json
{ "refreshToken": "<opaco>" }
```

- **204:** sempre que o corpo for válido. A sessão do token é revogada, e o access token dela também deixa de valer. Também responde 204 para token desconhecido ou já revogado (idempotente, não revela nada).
- **400:** `DADOS_INVALIDOS`.

### `GET /health`

Sem autenticação e fora do `/v1`.

- **200:** `{ "status": "ok" }` se o banco responde.
- **503:** `{ "status": "indisponivel" }` caso contrário.

Não expõe versão, dependências nem dados.

## 4. Correspondência com o app

| App (`GuardianDataSource`) | API | Tradução |
|---|---|---|
| `signIn(cpf, senha)` → `ResponsavelDTO` | `POST /v1/auth/login` | 200 → refresh no Keychain, access em memória, devolve `responsavel`; 401 `CREDENCIAIS_INVALIDAS` → `null`; outros → erro de rede ou servidor |
| `getById(id)` → `ResponsavelDTO` (ao abrir o app) | `POST /v1/auth/refresh` → `GET /v1/me` | Sem refresh no Keychain → `null`. Com refresh, renova (access em memória) e busca o `/me`. 200 com o mesmo id → `responsavel`; refresh com 401 → limpa o Keychain e devolve `null` |
| `signOut()` (só local hoje) | `POST /v1/auth/logout` | Melhor esforço; depois limpa o Keychain e o AsyncStorage |

Regras do cliente (T10):
- Nenhum token no AsyncStorage.
- 401 `TOKEN_EXPIRADO` dispara um único refresh compartilhado e repete a requisição original uma vez.

## 5. OpenAPI

A T09 gera o `openapi.yaml` (OpenAPI 3.1) desta spec. Ele é servido pelo Swagger (`swagger-ui-express`) em `/docs` quando `NODE_ENV !== 'production'`. Os testes de integração validam as respostas contra o esquema.
