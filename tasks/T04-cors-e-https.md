# T04 — CORS e HTTPS

**Depende de:** T01 · **Specs:** `features/cors-and-https.md`, `04-security.md` §5, D-18 ✅, D-19 ✅, D-21 (hospedagem, em aberto)

## Objetivo

Configurar CORS por lista de origens e HTTPS obrigatório fora do ambiente local, sem atrapalhar o app nativo nem o desenvolvimento em simulador, emulador e aparelho.

## Escopo

1. **`env.ts`:**
   - `CORS_ORIGINS`: lista de URLs exatas; recusa `*`; recusa `http://` em produção;
   - `TRUST_PROXY`: inteiro ≥ 0;
   - `HTTPS_KEY_PATH` e `HTTPS_CERT_PATH`: opcionais, juntos;
   - em produção, recusa `DATABASE_URL` e `DIRECT_URL` sem `sslmode=require`.
2. **CORS:**
   - dependência `cors`;
   - origem aceita só por comparação exata com a lista;
   - métodos `GET`, `POST` e `OPTIONS`;
   - cabeçalhos aceitos `Authorization` e `Content-Type`;
   - cabeçalho exposto `Retry-After`;
   - `credentials: false` e `maxAge: 600`;
   - preflight de origem não permitida → 403;
   - registrado antes dos limites de tentativa.
3. **HTTPS na API:**
   - `app.set('trust proxy', TRUST_PROXY)`;
   - middleware `requireHttps`: em produção, `req.secure === false` → 403 `HTTPS_OBRIGATORIO`; `/health` liberado;
   - HSTS pelo `helmet` (`max-age=31536000; includeSubDomains`) em produção.
4. **HTTPS local:** `server.ts` sobe com `https.createServer` quando `HTTPS_KEY_PATH` e `HTTPS_CERT_PATH` estão definidos. O README documenta:
   - `mkcert`;
   - túnel HTTPS (`cloudflared` ou `ngrok`) para aparelho físico;
   - `localhost` (simulador iOS) e `10.0.2.2` (emulador Android).
5. **Ordem dos middlewares** conforme a spec 01 §5.
6. **Produção:** a terminação TLS depende da hospedagem (D-21). Esta tarefa deixa a API pronta para rodar atrás do proxy dela. A configuração na plataforma fica na T11.

## Critérios de aceite

Os de `features/cors-and-https.md` §5, com testes de integração para:
- origem permitida e não permitida;
- requisição sem `Origin`;
- preflight;
- HTTP recusado em produção, simulado com `X-Forwarded-Proto` e `TRUST_PROXY=1`;
- `/health` liberado;
- HSTS presente.

E testes de unidade do `env.ts` para as recusas de configuração insegura.

## Validação

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:integration`.

## Status

Não iniciada.
