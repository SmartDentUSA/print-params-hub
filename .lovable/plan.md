## Objetivo
Importar para o repositório as 28 edge functions que hoje rodam apenas no Supabase, **uma a uma**, com risco zero de quebra.

## Princípio de Risco Zero
Para cada função, o ciclo é:
1. **Baixar** o código atual via Management API do Supabase (`GET /v1/projects/{ref}/functions/{slug}/body`) — isso garante que o que vamos commitar é **byte-a-byte o que já está em produção**.
2. **Salvar** em `supabase/functions/{slug}/index.ts` sem nenhuma alteração de lógica.
3. **Aguardar deploy automático** do Lovable (mesmo código → mesmo comportamento, operação idempotente).
4. **Validar** via `supabase--edge_function_logs` que a função continua respondendo normalmente (boot OK, sem novos erros) após o deploy.
5. Só então passar para a próxima.

Se qualquer função apresentar divergência (ex.: importa de path local que não existe), **paro imediatamente**, reporto e pergunto antes de continuar.

## Ordem de Importação (28 funções)

Agrupadas por criticidade decrescente, dentro de cada grupo da menos arriscada para a mais arriscada:

### Lote 1 — Social Publisher (4) — bugs ativos
1. `social-posts-sync`
2. `social-post-group-dispatch`
3. `social-broadcast-dispatch` (se existir)
4. `social-flow-runner` (se existir)

### Lote 2 — Smart Ops core (alto volume, validar com cuidado)
5. `smart-ops-autonomous-agent`
6. `smart-ops-lead-reconciliation`
7. `smart-ops-cognitive-engine`
8. `smart-ops-revenue-reporter`
9. `smart-ops-merge-leads`
10. `smart-ops-deal-history-sync`

### Lote 3 — Integrações externas
11. `meta-audience-sync`
12. `meta-capi-dispatcher`
13. `omie-sync-nf`
14. `omie-sync-parcelas`
15. `sellflux-poll`
16. `piperun-stage-sync`

### Lote 4 — WhatsApp / Evolution
17. `wa-followup-cron`
18. `wa-contact-sync`
19. `wa-group-member-sync`

### Lote 5 — Conhecimento / Conteúdo
20. `kb-embed-refresh`
21. `content-bridge-sync`
22. `training-factory-cron`

### Lote 6 — Operacional / Manutenção
23. `daily-backup-drive`
24. `system-health-cron`
25. `cron-dispatcher`
26. `cleanup-stale-locks`
27. `analytics-rollup`
28. `seo-sitemap-refresh`

> Os nomes acima são os mapeados na investigação anterior. Antes de começar, vou listar via Management API as funções deployadas e cruzar com o repo para confirmar a lista **exata** das 28 órfãs — se algum nome divergir, ajusto a fila e prossigo.

## Detalhes Técnicos

- Download via Management API requer `SUPABASE_ACCESS_TOKEN` (PAT). Se não estiver disponível como secret, peço ao usuário antes do primeiro lote.
- Cada função vira `supabase/functions/{slug}/index.ts`. Se a função usar arquivos em `_shared/`, eles já existem no repo e serão referenciados como hoje.
- **Nenhuma migração SQL** será criada nesta fase — só import de código.
- **Nenhuma refatoração** será feita. Bugs conhecidos (ex.: vazamento do `social-post-group-dispatch`) ficam para uma fase seguinte, com plano próprio, depois que o código estiver versionado.
- Validação por função: leio últimos logs (boot + 1 execução real, se houver tráfego) e confirmo "status quo" antes de avançar.

## Critério de Parada
- Falha de deploy → paro, reporto erro, peço orientação.
- Função importada começa a logar erros que não existiam antes → reverto via History e reporto.
- Nome/slug divergente → paro e confirmo com o usuário.

## Entregáveis
- 28 PRs lógicos (um por função) dentro do mesmo branch do Lovable.
- Ao fim de cada lote, um resumo curto: "Lote X concluído, N funções importadas, 0 regressões nos logs".
- Ao fim de tudo: lista final do que ficou versionado + recomendação dos próximos passos (ex.: corrigir o vazamento do dispatcher agora que temos o código).

## Pré-requisito para começar
Confirmar que tenho acesso ao `SUPABASE_ACCESS_TOKEN` (PAT com escopo de Edge Functions read) para baixar o código original. Se não tiver, a alternativa é você colar o código de cada função do Dashboard — mas isso multiplica o tempo por ~10x.
