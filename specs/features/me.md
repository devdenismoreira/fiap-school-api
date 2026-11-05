# Feature — Responsável autenticado (`/me`)

> Status: **aprovada em 2026-11-05** · Endpoint: `GET /v1/me` · Substitui: `GuardianDataSource.getById` no app (restaurar sessão)

## 1. Objetivo

Devolver o responsável dono do access token, no mesmo formato do login. Ao abrir, o app renova a sessão com o refresh do Keychain e chama este endpoint no lugar do `getById` local (spec 03 §4).

## 2. Regras

1. **`requireAuth`:**
   - exige `Authorization: Bearer <token>`;
   - valida assinatura ES256, `iss`, `aud` e `exp`;
   - confere se a sessão `sid` existe, pertence ao `sub` e não foi revogada.
   - **Recusas:** falta do cabeçalho, formato errado, assinatura inválida, `iss` ou `aud` errados, ou sessão revogada ou inexistente: 401 `TOKEN_INVALIDO`. Token vencido: 401 `TOKEN_EXPIRADO`.
2. O id vem **só** do `sub`. A rota não aceita id na URL nem na query (spec 04 §4).
3. Responsável do `sub` inexistente: 401 `TOKEN_INVALIDO`.
4. Sucesso: 200 com o objeto `Responsavel` (spec 03 §2) e `Cache-Control: no-store`.
5. A requisição autenticada atualiza `ultimo_uso_em` da sessão, no máximo uma vez por minuto, para evitar escrita a cada requisição.

## 3. Camadas

| Camada | Item |
|---|---|
| Domain | Casos de uso `authenticate(token)` (verifica o token, exige a sessão ativa e registra o uso no máximo uma vez por minuto) e `getCurrentGuardian(guardianId)`; portas `GuardianRepository.findById`, `SessionRepository.findActive` e `recordUse`, `AccessTokenService.verify` e `Clock` |
| Infra | `PrismaGuardianRepository.findById`, com `include` aninhado e `orderBy` em todos os níveis; `PrismaSessionRepository.findActive` |
| Presentation | `requireAuth` (lê o `Bearer` e chama o `authenticate`), `meRoutes` (limite de 120 por minuto por IP → `requireAuth` → controller), `MeController`, `guardianView`; o `no-store` vale para todo `/v1` |

## 4. Paridade com o app

`guardianView` é a única fonte do formato. Ela converte:
- `Decimal` em `number`;
- `DATE` em `AAAA-MM-DD`;
- mantém `null` em `nota` e `faltas`;
- preserva a ordem.

O teste de paridade compara o resultado com o JSON do app (T09).

## 5. Critérios de aceite

- [x] Com o token do login, 200 com o mesmo `responsavel` devolvido no login.
- [x] Sem cabeçalho, com `Basic`, com token adulterado, com `alg: none` ou com `aud` errado: 401 `TOKEN_INVALIDO`.
- [x] Depois do logout ou da revogação da sessão por reuso, o mesmo access token recebe 401 `TOKEN_INVALIDO`.
- [x] Token vencido (com `Clock` fake): 401 `TOKEN_EXPIRADO`.
- [x] Não existe forma de obter dados de outro responsável.
- [x] Dias sem aula vêm com `aulas: []`; `nota` e `faltas` nulos vêm `null`; os arrays seguem a ordem do JSON.
- [x] `Cache-Control: no-store` presente.
