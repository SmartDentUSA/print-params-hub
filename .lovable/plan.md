## Diagnóstico (causa raiz já confirmada por SQL ao vivo)

**1. Cérebro do Copilot está congelado há 6 dias**

Todas as 7 seções do `copilot_brain` (overview, sales_month, sales_ranking, pipeline, products_sold, equipment, alerts) têm `updated_at = 2026-05-22T19:18:52`. Hoje é 28/05.

| Métrica | Cérebro (22/05) | Realidade SQL (28/05) | Diferença |
|---|---|---|---|
| Receita mês | R$ 1.184.236 | **R$ 1.543.634** | −R$ 359 k |
| Deals ganhos | 229 | **339** | −110 |
| Deals criados no mês | — | 2.214 | — |

`SELECT * FROM cron.job WHERE command ILIKE '%brain%'` ⇒ **nenhum job de refresh existe**. A população das tabelas `copilot_brain.brain_*` nunca foi automatizada.

**2. Aba "Relatórios" tem duas implementações e a rica está escondida**

- `SmartOpsReports.tsx` mostra clientes + feed de deals — sem receita do mês.
- `RelatorioMensalComercial.tsx` (renderizado dentro) consome **11 RPCs `fn_relatorio_mes_*`** com receita, ganhas, perdidas, ticket, recorrência. Funciona, mas a UI atual prioriza "Abertos/Estagnados" por vendedor e **omite a coluna de Ganhas R$ / Perdidas R$**, que é o que o gestor compara contra o PipeRun.

## Plano

### Fase 1 — Refresh contínuo do Cérebro (resolve 100 % da divergência do Copilot)

1. Criar `public.refresh_copilot_brain()` (PL/pgSQL, `SECURITY DEFINER`) que repovoa as 8 tabelas `copilot_brain.brain_*` direto das fontes ao vivo:
   - `deals` (filtros: `is_deleted=false`, `merged_into IS NULL` no join com `lia_attendances`)
   - `lia_attendances` canônicas
   - `proposal_items_sold`, `omie_*`, `ecommerce_orders`
   - Reusa lógica de `fn_relatorio_mes_*` e `query_sales_summary` para garantir paridade.
2. Migration: agenda `pg_cron` a cada **5 min** (`*/5 * * * *`) executando a função. Job adicional **a cada hora** executa um sanity-check que loga diff Cérebro vs SQL ao vivo em `system_health_logs`.
3. Trigger imediato após cada webhook do PipeRun (`smart-ops-piperun-webhook`): chamar `refresh_copilot_brain()` **debounceado** (no máx 1×/min via `pg_advisory_lock`) para que vendas reflitam em < 1 min.
4. No Copilot (`smart-ops-copilot/index.ts > loadBrainContext`): se `brain.meta.updated_at < now() - 10 min`, chamar `supabase.rpc("refresh_copilot_brain")` inline antes de servir a resposta + anexar badge "atualizado agora" no prompt.

### Fase 2 — Aba Relatórios completa (resolve "baba relatório")

1. **Header executivo** novo em `RelatorioMensalComercial.tsx`:
   - 4 KPIs grandes: Receita Ganha · Receita Perdida · Ticket Médio · Conversão % (mês atual vs mês anterior com Δ%).
   - Banner se diff vs Cérebro > 5 %: "Cérebro defasado — última atualização há X min — [Atualizar agora]".
2. **Tabela por Vendedor** reformulada (uma linha por vendedor, colunas):
   - Ganhas (qtd · R$)
   - Perdidas (qtd · R$)
   - Em aberto (qtd · R$)
   - Ticket médio
   - Conversão (ganhas / fechadas)
   - Δ Receita MoM
   - Top etapa onde concentra (drill-down expansível para o detalhe atual de "Abertos por etapa")
3. **Reconciliação CRM**:
   - Botão "Reconciliar com PipeRun" que dispara `piperun-full-sync` e depois `refresh_copilot_brain()`.
   - Card "Saúde dos dados" mostrando: último sync PipeRun, último refresh Cérebro, deals com `status='ganha'` sem `lead_status='CLIENTE_ativo'` (resto do backfill anterior — hoje em 33).
4. **Exportação enriquecida**: o CSV atual exporta `lia_attendances`. Adicionar opção "Exportar Relatório do Mês" que serializa as 11 RPCs já consumidas (vendedor, funil, origem, itens, recorrência, astron) em planilha XLSX com abas.

### Fase 3 — Auditoria permanente (evita regressão)

1. Página `/admin/diagnostico-cerebro` (oculta no menu, acessível por link) com 3 painéis:
   - **Cérebro vs CRM ao vivo** (lado a lado, refresh a cada 30 s) — receita, deals ganhos, top vendedor.
   - **Quando o Cérebro pulou** — gráfico de `meta.updated_at` ao longo de 30 dias.
   - **Falhas de webhook PipeRun** — últimas 50 do `system_health_logs` filtradas por `feature='piperun_webhook' AND status='error'`.
2. Alerta automático: se diff > 5 % e `last_refresh > 30 min`, inserir alerta crítico em `copilot_brain.brain_alerts` e o Copilot passa a iniciar respostas com "⚠️ Cérebro defasado — números podem estar atrasados".

## Detalhes técnicos

- A função `refresh_copilot_brain()` faz `TRUNCATE + INSERT` por seção dentro de uma transação para evitar leitura parcial. Cada bloco já existe espalhado nas 11 `fn_relatorio_mes_*` — vamos extrair os SELECTs base para uma única view materializada `copilot_brain.mv_base_deals_mes` (REFRESH CONCURRENTLY) que alimenta tudo.
- Lock de concorrência: `pg_try_advisory_lock(737373)` no início; sai silenciosamente se outro processo está rodando.
- Os RPCs `fn_relatorio_mes_*` permanecem (são usados pela UI). A função nova só consolida o subconjunto que o Copilot lê.
- `query_sales_summary` (tool do Copilot) continua sendo a verdade-de-cálculo para receita; o Cérebro vira apenas o snapshot pré-computado dela. O guard "Max(CRM_Won, Omie_Billing) + LTV_Ecommerce" da memória Core é preservado.

## Verificação

Após Fase 1:
```sql
SELECT (get_copilot_brain()->'overview'->>'receita_mes')::numeric AS brain,
       (SELECT sum(value) FROM deals WHERE status IN ('ganha','ganho','won','1')
        AND piperun_created_at >= date_trunc('month', now())
        AND (is_deleted IS NULL OR is_deleted=false)) AS sql_live;
```
Resultado esperado: diff < 0,5 % e `brain.meta.updated_at` dentro dos últimos 10 min.

## Fora de escopo

- Não vou tocar nos RPCs `fn_relatorio_mes_*` (eles já funcionam, só estão sub-utilizados).
- Não vou criar nova fonte de verdade; o PipeRun continua sendo a referência via `deals` sincronizadas.
- Não vou mexer no Omie/Sellflux/Ecommerce — eles já entram no `query_sales_summary`.

## Pré-requisitos (sim/não)

1. Posso criar job `pg_cron` rodando `refresh_copilot_brain()` a cada 5 min?
2. Posso fazer a página de Relatórios reformular o header e a tabela por vendedor (sem remover nada do que existe hoje — só reordenando e adicionando colunas de Ganhas/Perdidas R$)?
3. Posso criar `/admin/diagnostico-cerebro` para auditoria contínua?
