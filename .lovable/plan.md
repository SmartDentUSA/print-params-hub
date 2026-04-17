
## Diagnóstico

O usuário aponta que o `query_product_mix` (e `query_product_sales`) deve considerar **apenas oportunidades GANHAS**, não em aberto. Preciso verificar o que as funções SQL atuais (`fn_mix_produtos_mes`, `fn_vendas_produto`) estão filtrando.

Vou checar a definição dessas funções no banco para confirmar se filtram por status `ganha` ou se trazem deals em qualquer estado.

## Verificação Necessária

1. Inspecionar `fn_mix_produtos_mes(ano, mes)` — fonte de dados (Omie ou deals?), filtro de status
2. Inspecionar `fn_vendas_produto(busca, inicio, fim)` — mesmo
3. Confirmar campo de data correto (`closed_at` para ganhas, não `created_at`)

Se as funções já filtram por ganhas (Omie só tem faturado), apenas reforçar no prompt. Se não filtram, criar nova migration com versão corrigida ou ajustar a tool no edge function para passar filtro adicional.

## Plano de Correção

### Passo 1 — Auditar funções SQL existentes
Ler definição de `fn_mix_produtos_mes` e `fn_vendas_produto` via `pg_get_functiondef` para confirmar o filtro atual.

### Passo 2 — Garantir filtro "ganha apenas"
Dois cenários possíveis:

**A) Funções já usam Omie (faturamento real)** — então já são "ganhas por definição". Apenas reforçar no system prompt.

**B) Funções usam tabela `deals` sem filtro de status** — criar migration substituindo as funções para filtrar `WHERE status = 'ganha'` (ou equivalente CRM_Won) e usar `closed_at` no lugar de `created_at`.

### Passo 3 — Reforçar no system prompt do Copilot
Em `supabase/functions/smart-ops-copilot/index.ts`, atualizar a descrição das tools `query_product_mix` e `query_product_sales` e a "REGRA CRÍTICA — PRODUTOS":

```
- query_product_mix retorna APENAS produtos de deals GANHOS (status='ganha').
- NUNCA inclua deals em aberto, em negociação ou perdidos no mix de produtos vendidos.
- Para pipeline em aberto use query_deal_history com status='aberta'.
```

### Passo 4 — Validar com SQL
Rodar SELECT comparando totais por status para confirmar que o mix bate com `query_sales_summary` (que já é ganhas).

## Arquivos Afetados

- `supabase/migrations/` — nova migration corrigindo as funções (se necessário após auditoria)
- `supabase/functions/smart-ops-copilot/index.ts` — reforçar descrições e regra crítica

## Resultado Esperado

Mix de produtos retornado pelo Copilot reflete somente vendas concluídas (ganhas/faturadas), batendo numericamente com a receita reportada por `query_sales_summary`.
