# Feature — CORS e HTTPS

> Status: **aprovada em 2026-11-05** · Decisões: D-18 ✅ (CORS; sem cliente web), D-19 ✅ (HTTPS), D-21 ✅ (hospedagem gratuita, escolhida na T11)

## 1. Objetivo

Garantir que a API só seja usada sobre TLS fora do ambiente local e que navegadores só leiam respostas de origens explicitamente permitidas, sem atrapalhar o app nativo nem os testes em aparelho.

## 2. CORS

### 2.1 Contexto

CORS é uma regra **do navegador**. Ele decide se uma página de outra origem pode ler a resposta. Não protege contra o app nativo, `curl` ou outro servidor, porque esses clientes não enviam `Origin` nem respeitam CORS. A proteção real da API continua sendo autenticação, autorização e limite de tentativas. CORS evita que sites de terceiros usem o navegador do usuário para ler a API.

### 2.2 Regras

1. Middleware `cors`, configurado por `CORS_ORIGINS`: lista de origens exatas separadas por vírgula (ex.: `https://admin.fiapschool.com.br`). Validada com zod no `env.ts`.
2. **Sem curinga (`*`) e sem refletir a origem recebida.** A origem só é aceita se estiver na lista, por comparação exata com esquema, host e porta.
3. Em produção, só origens `https://`. O `env.ts` recusa `http://` quando `NODE_ENV=production`.
4. `CORS_ORIGINS` vazio significa que nenhuma origem cruzada é permitida. **Não há cliente web** (D-18), então esse é o valor em todos os ambientes. Os testes usam origens fictícias para validar o comportamento.
5. **Requisição sem `Origin`** (app nativo, `curl`, health check): o CORS não interfere e a requisição segue normalmente.
6. **Origem permitida:**
   - `Access-Control-Allow-Origin: <origem>` e `Vary: Origin`;
   - métodos `GET`, `POST` e `OPTIONS`;
   - cabeçalhos aceitos `Authorization` e `Content-Type`;
   - cabeçalho exposto `Retry-After`;
   - `Access-Control-Max-Age: 600`.
7. **Origem não permitida:** a resposta sai sem cabeçalhos CORS, e o navegador bloqueia a leitura. O preflight (`OPTIONS`) de origem não permitida recebe 403, sem corpo.
8. `credentials: false`. Os tokens trafegam no cabeçalho `Authorization`, nunca em cookie, então não há risco de CSRF por cookie.
9. **Ordem:** o CORS roda antes do limite de tentativas, e o preflight `OPTIONS` não conta no limite.
10. O Swagger em `/docs` é servido pela própria API (mesma origem) e não depende do `CORS_ORIGINS`.

### 2.3 Valores por ambiente

| Ambiente | `CORS_ORIGINS` |
|---|---|
| Local | Vazio (não há cliente web) |
| Teste | Origens fictícias, só para validar o comportamento |
| Produção | Vazio. Se surgir cliente web, as origens dele, só `https://`, registradas como nova decisão |

## 3. HTTPS

### 3.1 Produção (fora do ambiente local)

1. **TLS terminado na borda da hospedagem** (D-21). A hospedagem gratuita escolhida na T11 precisa oferecer HTTPS no próprio domínio, com certificado gerenciado, TLS 1.2 ou superior e redirecionamento de HTTP para HTTPS na borda. Esse é um critério de escolha.
2. **Na API:**
   - `app.set('trust proxy', TRUST_PROXY)`, com o número exato de proxies, nunca `true`. Assim `req.secure`, `req.protocol` e `req.ip` refletem o cliente real, e o limite por IP funciona;
   - middleware `requireHttps`: com `NODE_ENV=production`, a requisição com `req.secure === false` recebe **403 `HTTPS_OBRIGATORIO`**. Não há redirecionamento, porque redirecionar um `POST /auth/login` já teria enviado CPF e senha em texto puro;
   - exceção: `GET /health`, que a plataforma pode chamar por HTTP na rede interna.
3. **HSTS** pelo `helmet`: `max-age=31536000; includeSubDomains`. Sem `preload`, até o domínio estar estável.
4. **Banco:** a conexão com o Supabase usa TLS com o certificado validado: `sslmode=verify-full` e `sslrootcert` com a CA raiz do Supabase na `DATABASE_URL`; TLS obrigatório na `DIRECT_URL` (D-26).

### 3.2 Desenvolvimento

| Cenário | Como |
|---|---|
| Simulador iOS e emulador Android | `http://localhost:3000` (iOS) e `http://10.0.2.2:3000` (Android). O ATS do iOS libera `localhost`, e o build de debug do Android já permite HTTP (template do React Native) |
| Aparelho físico | **Túnel HTTPS** (ex.: `cloudflared` ou `ngrok`), que dá uma URL pública com certificado válido, sem exceções no app; ou HTTPS local com `mkcert`, instalando a CA no aparelho |
| HTTPS local na API | Opcional: se `HTTPS_KEY_PATH` e `HTTPS_CERT_PATH` estiverem definidos, o `server.ts` sobe com `https.createServer`; senão, HTTP só em `localhost` |

O app **não** recebe exceções de ATS nem `cleartextTrafficPermitted` em release. O build de release só fala com `https://`.

### 3.3 Certificate pinning

Não agora (D-23). Uma renovação ou troca de certificado na hospedagem travaria o app. Reavaliar quando houver domínio próprio e um processo de renovação controlado.

## 4. Configuração

| Variável | Uso |
|---|---|
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula; vazio = nenhuma |
| `TRUST_PROXY` | Número de proxies à frente da API (`0` no ambiente local) |
| `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH` | Opcionais: HTTPS local com `mkcert`. Os arquivos `.pem` ficam fora do git |

## 5. Critérios de aceite

- [ ] Origem da lista recebe `Access-Control-Allow-Origin` com a própria origem e `Vary: Origin`.
- [ ] Origem fora da lista não recebe cabeçalhos CORS, e o seu preflight responde 403.
- [ ] Requisição sem `Origin` funciona normalmente em todas as rotas.
- [ ] Preflight de origem permitida responde 204 com os métodos e cabeçalhos da regra 6, sem contar no limite de tentativas.
- [ ] O `env.ts` recusa `*` sempre e recusa `http://` em `CORS_ORIGINS` quando `NODE_ENV=production`.
- [ ] Em produção, requisição sem TLS (`X-Forwarded-Proto: http` atrás do proxy de confiança) recebe 403 `HTTPS_OBRIGATORIO`, exceto `/health`.
- [ ] Em produção, as respostas trazem `Strict-Transport-Security`.
- [ ] Com `TRUST_PROXY` correto, `req.ip` é o IP do cliente (o limite por IP usa o IP real).
- [ ] Com `HTTPS_KEY_PATH` e `HTTPS_CERT_PATH`, a API sobe em HTTPS localmente.
- [x] A `DATABASE_URL` exige `sslmode=verify-full`, e o `env.ts` recusa qualquer outro modo em todos os ambientes (T01, D-26).
