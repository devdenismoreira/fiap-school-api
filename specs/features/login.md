# Feature — Login

> Status: **aprovada em 2026-11-05** · Endpoint: `POST /v1/auth/login` · Substitui: `GuardianDataSource.signIn` no app

## 1. Objetivo

Autenticar o responsável por CPF e senha, abrir uma sessão e devolver, numa só resposta, os tokens e o responsável completo. É o que o `signIn` local devolve hoje, mais os tokens.

## 2. Regras

1. O corpo é validado com zod:
   - `cpf` é string de exatamente 11 dígitos;
   - `senha` é string de 1 a **72 bytes** (limite do bcrypt, D-09).

   Fora disso: 400 `DADOS_INVALIDOS`. O app já envia o CPF normalizado.
2. CPF com dígito verificador inválido: 401 `CREDENCIAIS_INVALIDAS`, sem consultar o banco. Mesmo assim, verifica o hash fictício para manter o tempo constante.
3. CPF inexistente ou senha errada: 401 `CREDENCIAIS_INVALIDAS`, com o mesmo corpo e tempo equivalente (spec 04 §1).
4. **Sucesso:**
   - cria uma **sessão** em `sessoes`;
   - gera o refresh token, ligado à sessão, com só o hash no banco;
   - emite o access token com `sub` e `sid`;
   - responde 200 com tokens e `responsavel` (spec 03 §2);
   - zera o contador de falhas daquele CPF.
5. **Limites:** 20 por minuto por IP e 5 falhas a cada 15 minutos por HMAC do CPF. Acima disso: 429 `MUITAS_TENTATIVAS` com `Retry-After`.
6. **Logs:** só o evento (sucesso ou falha) e o HMAC do CPF. Nunca CPF, senha ou tokens.
7. `Cache-Control: no-store`. Em produção, só sobre HTTPS (`features/cors-and-https.md`).

## 3. Camadas

| Camada | Item |
|---|---|
| Domain | Caso de uso `login(cpf, password)`; portas `GuardianRepository.findByCpf`, `PasswordHasher.verify`, `SessionRepository.create`, `RefreshTokenGenerator.generate`, `AccessTokenService.issue` e `Clock`; erro `InvalidCredentialsError` |
| Infra | `PrismaGuardianRepository.findByCpf` (com o agregado), `BcryptPasswordHasher`, `PrismaSessionRepository.create` (sessão e primeiro refresh na mesma transação), `CryptoRefreshTokenGenerator` e `JoseAccessTokenService` |
| Presentation | `authRoutes`, `loginSchema`, `LoginController`, `tokensView`, `guardianView`, limites por IP e por CPF, `noStore` |

## 4. Casos de borda

- CPF com máscara (`000.000.000-00`) no corpo: 400, porque o contrato exige só dígitos.
- Senha com espaços: comparada como veio, sem `trim`, como no app.
- Senha com 73 bytes ou mais: 400. O bcrypt truncaria, e duas senhas diferentes passariam a valer.
- Responsável sem alunos: 200 com `alunos: []`.
- Dois aparelhos: cada login cria uma sessão independente.

## 5. Critérios de aceite

- [ ] Login válido de cada responsável da fonte do seed responde 200, com `responsavel` igual ao JSON sem `cpf`, `email` e `senha`.
- [ ] Cada login cria uma sessão, e o `accessToken` traz `sub`, `sid`, `iss`, `aud`, `exp` e `jti`, sem dados pessoais.
- [ ] `refreshToken` gravado só como hash, ligado à sessão.
- [ ] CPF inexistente, dígito verificador inválido e senha errada produzem a mesma resposta 401.
- [ ] Corpo malformado ou senha com mais de 72 bytes respondem 400 `DADOS_INVALIDOS`.
- [ ] 429 com `Retry-After` após 5 falhas para o mesmo CPF.
- [ ] `Cache-Control: no-store` presente.
- [ ] Nenhum log contém CPF, senha ou token.
