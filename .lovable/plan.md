## Corrigir dados do Relatório Mensal — usar `public.deals` como verdade do CRM

### Diagnóstico
As 4 views (`v_relatorio_mes_kpis`, `v_relatorio_mes_vendedor`, `v_relatorio_mes_funil`, `v_relatorio_mes_origem`) leem de `lia_attendances.piperun_deals_history` (JSONB snapshot). Comparado a `public.deals` (canônico, alimentado pelo webhook + full sync), no mês corrente:

- Ganhos: **273 (deals) vs 338 (view)** → +24%
- Receita: **R$ 1.480.796,36 vs R$ 1.719.672,08** → +R$ 238 mil

Razões: duplicação por merges, status defasado, `is_deleted` ignorado e timezone UTC.

### Solução
Migration `CREATE OR REPLACE VIEW` nas 4 views, lendo de `public.deals` JOIN `public.lia_attendances` (apenas canônicos `merged_into IS NULL`), com:

- **Mês de referência**: `to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM')`
- **Ganhos do mês**: `deals.status='ganha' AND COALESCE(is_deleted,false)=false AND to_char(closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes_ref`
- **Abertos para funil**: `deals.status='aberta' AND COALESCE(is_deleted,false)=false`
- **Vendedor**: `deals.owner_name` (verdade atual) — fallback `'Sem atribuição'`
- **Origem**: `lia_attendances.origem_campanha` (origem da pessoa, não do deal — mantém compatibilidade com o card atual)
- **Leads criados no mês**: `lia_attendances.created_at` no mês (timezone SP), com `merged_into IS NULL`

### Novas definições

**`v_relatorio_mes_kpis`** — `SELECT count(*) total_deals, sum(value) receita_total, avg(NULLIF(value,0)) ticket_medio, count(DISTINCT owner_name) vendedores_ativos, (subselect leads canônicos mês) leads_criados_mes, mes_ref, now() gerado_em FROM deals WHERE ganhas_mes`.

**`v_relatorio_mes_vendedor`** — CTEs `ganhos` e `perdidos` de `deals` (mês SP, `is_deleted=false`) agregadas por `owner_name`; `leads_mes` por `proprietario_lead_crm` de `lia_attendances`. LEFT JOIN para preservar vendedores com leads mas sem ganhos.

**`v_relatorio_mes_funil`** — `deals` com `status='aberta'`, `is_deleted=false`, agrupados por `owner_name`, `pipeline_name`, `stage_name`. Sem filtro de `created_at` da `lia_attendances` (estagnados antigos devem aparecer).

**`v_relatorio_mes_origem`** — `leads_orig` por `origem_campanha`; `ganhos_orig` JOIN `deals d ON d.lead_id = la.id` no mês. Mantém `HAVING total_leads >= 3`.

### Resultado esperado
- Números batem com a tabela `deals` (verdade do CRM, atualizada pelo webhook em tempo real e pelo Full Sync)
- Sem duplicação por merges, sem deals deletados, sem deals estados antigos
- Timezone correto (mês corrente em Brasília)
- Componente frontend (`RelatorioMensalComercial.tsx`) não muda — mesmas colunas/contratos

### Validação pós-migration
Rodar comparação `SELECT * FROM v_relatorio_mes_kpis` vs query direta em `deals` para o mês — devem coincidir.

### Memória a registrar
Nova regra core: "Relatórios Mensais Comerciais leem de `public.deals` (verdade canônica), não de `lia_attendances.piperun_deals_history`. JSONB é histórico/snapshot, sujeito a duplicação por merges."