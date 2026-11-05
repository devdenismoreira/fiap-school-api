# T10 — Integração no app (FiapSchoolMobile)

**Depende de:** T09 · **Onde:** repositório `../FiapSchoolMobile`, pelo ciclo SDD de lá (`/specify` → `/plan` → `/implement`) · **Specs:** `03-api-contract.md` §4, `00-project-overview.md` §5

## Objetivo

Trocar o `GuardianLocalDataSource` pelo datasource remoto, sem mudar o domínio, a função `toGuardian`, as telas nem os ViewModels.

## Escopo previsto (será especificado no app)

| Biblioteca ou recurso | Responsabilidade |
|---|---|
| `react-native-keychain` | Guardar o refresh token com proteção nativa (Keychain no iOS, Keystore no Android) e removê-lo no logout |
| `fetch` | Requisições HTTP, sem Axios: `fetch` resolve o caso, e a decisão será registrada como D-xx no app |
| Context API (`SessionProvider`) | Estado de autenticação, como hoje |

Regras de armazenamento:
- **Access token:** só em memória.
- **Refresh token:** Keychain (iOS) e o armazenamento seguro equivalente (Android), com `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- **Senha:** nunca persistida.
- **Nenhum token no AsyncStorage.** Ele continua só com `selectedStudentRm`.

Itens:
1. **Decisões do app**, como D-xx de lá: A-1 a A-4 da spec 00 §5 (login sem internet, abrir offline, sessão expirada, 429).
2. **`react-native-keychain`:** dependência nativa; exige `pod install` e rebuild.
3. **`core/http/httpClient.ts`:**
   - `fetch` com URL base por ambiente: `https://` em release; `localhost` ou `10.0.2.2` em debug; túnel HTTPS para aparelho físico;
   - timeout com `AbortController` e `Bearer`;
   - **interceptador:** um 401 `TOKEN_EXPIRADO` dispara um refresh e repete a requisição original **uma única vez**;
   - **renovação compartilhada:** se cinco requisições receberem 401 juntas, todas esperam a mesma promessa de refresh (single-flight).
4. **`core/storage/tokenStorage.ts`:** Keychain para o refresh, memória para o access.
5. **`data/datasources/remote/GuardianRemoteDataSource.ts`:**
   - implementa a mesma `GuardianDataSource`;
   - `signIn` usa o login;
   - `getById` restaura a sessão: refresh do Keychain → `/me`, sem pedir login.
6. **`app/bootstrap/dependencies.ts`:** troca o datasource e remove a latência simulada de 800 ms.
7. **`SessionProvider.signOut`:** chama o logout da API em melhor esforço e remove as credenciais do Keychain e do AsyncStorage.
8. **Release:** sem exceções de ATS nem de tráfego sem TLS. Certificate pinning fica fora (D-23).
9. O `GuardianLocalDataSource` continua como dublê nos testes do app.

## Critérios de aceite

- [ ] Os testes atuais do app passam sem mudança nas telas.
- [ ] Novos testes do datasource remoto e do `httpClient` cobrem:
  - sucesso;
  - 401 de credencial;
  - token expirado com refresh;
  - **cinco requisições simultâneas com 401 gerando um único refresh**;
  - refresh inválido;
  - erro de rede.
- [ ] Nenhum token no AsyncStorage (teste do armazenamento).
- [ ] Ao reabrir o app com refresh válido, a sessão é restaurada sem login.
- [ ] O fluxo completo funciona no aparelho com a API: login → agenda → boletim → trocar aluno → fechar e reabrir → sair.

## Status

Não iniciada. Será detalhada no repositório do app.
