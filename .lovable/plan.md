# Adicionar Leads Recebidos + Taxa de Conversão ao Ranking de Vendas

## Objetivo
Estender o relatório `fn_resumo_vendas_mes` (usado pelo Copilot via `query_sales_summary`) para incluir, por vendedor:
- **Leads Recebidos** no mês
- **Taxa de Conversão** = `deals ganhos / leads recebidos × 100`

Resultado final exibido pelo Copilot:

| Vendedor | Leads Recebidos | Deals Ganhos | Conversão | Receita | Ticket | % Receita |
|---|---|---|---|---|---|---|

## Mudanças

### 1. Migration: estender `fn_resumo_vendas_mes`
Adicionar 2 colunas ao retorno (`leads_recebidos bigint`, `taxa_conversao numeric`) via CTE adicional sobre `lia_attendances`:

```sql
leads_por_vendedor AS (
  SELECT proprietario_lead_crm AS vendedor, COUNT(*) AS leads_recebidos
  FROM public.lia_attendances
  WHERE merged_into IS NULL
    AND proprietario_lead_crm IS NOT NULL
    AND EXTRACT(YEAR FROM created_at) = p_ano
    AND EXTRACT(MONTH FROM created_at) = p_mes
  GROUP BY proprietario_lead_crm
)
```

JOIN `LEFT` com `base` por `vendedor` (match por nome — mesmo padrão usado no resto do CDP). `taxa_conversao = ROUND(total_deals / NULLIF(leads_recebidos,0) * 100, 1)`.

Mantém `RETURNS TABLE` retrocompatível adicionando colunas ao final para não quebrar callers existentes que usam `SELECT *`.

### 2. Copilot edge function (`smart-ops-copilot/index.ts`)
- Atualizar o schema da tool `query_sales_summary` (campos do output) para incluir as 2 novas colunas.
- Atualizar o system prompt: "Quando montar ranking de vendedores, SEMPRE inclua Leads Recebidos e Taxa de Conversão na tabela."
- Atualizar o template de tabela markdown sugerido no prompt.

### 3. Validação
- Rodar `SELECT * FROM fn_resumo_vendas_mes(2026, 4)` e conferir que conversão = deals/leads coerente (ex.: Janaina 107 deals ganhos / leads_recebidos).
- Pedir ao Copilot "ranking de vendas de abril/2026" e confirmar que a tabela traz as 7 colunas.

## Pontos abertos
1. **Match por nome**: `vw_vendas_ganhas.vendedor` vem de `vendas.vendedor` (string PipeRun) e `lia_attendances.proprietario_lead_crm` também é string. Em geral coincidem, mas posso adicionar normalização (`LOWER(TRIM())`) se preferir mais robustez. Implemento com normalização por padrão.
2. **Definição de "leads recebidos"**: estou usando `created_at` do lead no mês. Alternativa: `last_assigned_at` (quando o lead foi atribuído ao vendedor). `created_at` é mais simples e bate com a leitura "leads que entraram em abril e foram pra X". Seguir com `created_at`?

## Arquivos afetados
- nova migration em `supabase/migrations/`
- `supabase/functions/smart-ops-copilot/index.ts` (schema da tool + system prompt)
