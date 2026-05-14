# Copilot: Métricas completas de funil por vendedor

## Objetivo
Fazer o Copilot responder, por vendedor e por mês:
- Deals que **entraram no funil** (created_at do deal no mês)
- Deals **ganhos** no mês
- Deals **perdidos** no mês
- Deals **abertos/estagnados** (ainda em aberto, somados)
- **Total de leads do vendedor no mês** = ganhos + perdidos + abertos
- **Receita** (mantém `vw_vendas_ganhas`) e **taxa de conversão** = ganhos / total

## Mudanças

### 1. Migration — estender `fn_resumo_vendas_mes`
Adicionar CTE `deals_no_funil` baseada em `deals.piperun_created_at` no mês alvo, agrupando por `LOWER(TRIM(owner_name))`:

```sql
deals_no_funil AS (
  SELECT
    LOWER(TRIM(owner_name)) AS vendedor_key,
    COUNT(*) FILTER (WHERE status = 'ganha')   AS deals_ganhos,
    COUNT(*) FILTER (WHERE status = 'perdida') AS deals_perdidos,
    COUNT(*) FILTER (WHERE status = 'aberta')  AS deals_abertos,
    COUNT(*) AS total_leads_mes
  FROM public.deals
  WHERE is_deleted IS NOT TRUE
    AND owner_name IS NOT NULL
    AND EXTRACT(YEAR  FROM piperun_created_at) = p_ano
    AND EXTRACT(MONTH FROM piperun_created_at) = p_mes
  GROUP BY LOWER(TRIM(owner_name))
)
```

LEFT JOIN com `base` (receita de `vw_vendas_ganhas`) por nome normalizado. Colunas adicionadas ao final do RETURNS TABLE (retrocompatível):
- `deals_ganhos bigint`
- `deals_perdidos bigint`
- `deals_abertos bigint`
- `total_leads_mes bigint`
- `taxa_conversao numeric` = `ROUND(deals_ganhos::numeric / NULLIF(total_leads_mes,0) * 100, 1)`

Observação: `deals_ganhos` aqui conta deals criados no mês que já foram ganhos (cohort), diferente de `total_deals` da `base` que conta vendas fechadas no mês. Ambos coexistem — Copilot usa o adequado conforme a pergunta.

### 2. `smart-ops-copilot/index.ts`
- Atualizar schema da tool `query_sales_summary` incluindo as 5 novas colunas.
- System prompt: ao montar ranking de vendedores, **sempre** incluir colunas: Vendedor | Total Leads | Ganhos | Perdidos | Abertos | Conversão | Receita | Ticket.
- Esclarecer que "abertos" engloba estagnados (sem separação) e que `total_leads_mes = ganhos + perdidos + abertos` por data de criação do deal no funil.

### 3. Memory
Atualizar `mem://smart-ops/revenue-intelligence-reporting-logic-v1` com a nova definição de "leads do mês" (created_at do deal) e fórmula de conversão.

### 4. Validação
- `SELECT * FROM fn_resumo_vendas_mes(2026, 4)` — conferir que soma bate.
- Pedir ao Copilot "ranking completo de vendas de abril/2026" e validar tabela com 8 colunas.

## Arquivos
- Nova migration em `supabase/migrations/`
- `supabase/functions/smart-ops-copilot/index.ts`
- `mem://smart-ops/revenue-intelligence-reporting-logic-v1`
