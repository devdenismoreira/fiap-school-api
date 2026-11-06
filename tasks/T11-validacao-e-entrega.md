# T11 — Validação final e entrega

**Depende de:** T09 (e T10 para o fluxo ponta a ponta) · **Specs:** `CLAUDE.md` §12, D-04 ✅, D-21 ✅

## Objetivo

Garantir que a API cumpre as specs, está publicada com HTTPS e está documentada para quem for rodar ou avaliar.

## Escopo

1. `/review` completo do repositório, com foco na spec 04 (OWASP API Top 10).
2. **Escolha da hospedagem (D-21).** Critérios:
   - plano gratuito;
   - ao menos 30 dias no ar;
   - tráfego baixo;
   - HTTPS no domínio da plataforma;
   - deploy de app Node (`yarn build && yarn start`) com variáveis de ambiente.

   Registrar a escolha e as limitações do plano (por exemplo, hibernação sem acesso) na spec 00.
3. **Banco de produção (D-04):** decidir entre outro projeto gratuito no Supabase ou outro schema no mesmo projeto. Rodar as migrations e o seed com confirmação.
4. **Deploy:**
   - TLS e redirecionamento de HTTP para HTTPS na borda da plataforma;
   - `TRUST_PROXY` correto para ela;
   - variáveis de ambiente e chaves JWT de produção;
   - `CORS_ORIGINS` vazio (sem cliente web).
5. **Verificações em produção:**
   - HTTPS válido e HSTS presente;
   - HTTP recusado com 403;
   - CORS recusando origem desconhecida;
   - `/docs` indisponível;
   - `/health` respondendo;
   - tempo da primeira requisição após hibernação medido e informado para o timeout do app (T10).
6. **README:**
   - pré-requisitos (Node 22, Yarn 1, conta Supabase);
   - variáveis de ambiente e `.env.test`;
   - chaves;
   - schemas de desenvolvimento e de teste;
   - migrations e seed;
   - HTTPS local e túnel;
   - execução e testes;
   - arquitetura MVC + Clean;
   - endpoints com link para o Swagger;
   - hospedagem;
   - SDD.
7. **`AI_USAGE.md`:** como a IA foi usada e validada, no mesmo modelo do app, com evidências reais.
8. Atualizar specs e tasks com o que mudou durante a implementação, e registrar no `CLAUDE.md` §4 as versões instaladas.

## Critérios de aceite

- [ ] Todos os critérios de aceite das tarefas marcados ou com pendência justificada.
- [ ] typecheck, lint, testes de unidade e de integração passando.
- [ ] Verificações de produção do item 5 executadas e registradas.
- [ ] Um ambiente novo sobe seguindo só o README.
- [ ] Nenhum segredo ou dado pessoal versionado.

## Status

Concluída: deploy na Railway com HTTPS, Swagger em produção (`/docs`), README e `AI_USAGE.md`. Pendências do desenvolvedor: tornar o repositório público e enviar o e-mail da entrega.
