
## Diagnóstico

Sim, o Copilot **tem acesso total** à base. As RPCs já existem e retornam dados corretos para Maio/2026 (validado agora):

- `fn_total_vendas_mes(2026,5)` → **212 deals, R$ 1.025.179,10, ticket médio R$ 4.835,75, top: Lucas Silva**
- `fn_resumo_vendas_mes(2026,5)` → ranking completo (Lucas 57 deals / R$ 301k, Paulo Sérgio 37 / R$ 260k, Janaina 56 / R$ 144k, etc.)
- `fn_mix_produtos_mes`, `query_product_mix`, `query_scanner_brand_distribution`, `query_printer_brand_distribution`, `query_deal_history`, `query_sales_summary` — todas ligadas e funcionando

**Por que o relatório vem errado então?**

Olhando os logs do edge function `smart-ops-copilot`, as respostas terminam em **1–2 iterações**. Um "Relatório de Performance Comercial" exige no mínimo 4–6 tool calls encadeados (totais, ranking, mix de produtos, pipeline, metas, comparativo mês anterior). O modelo (Gemini Flash) está:

1. Chamando **apenas 1 tool** (geralmente `query_sales_summary`) e **inventando** o resto das seções (mix de produtos, scanners, impressoras, comparativos).
2. Quando pergunta é "relatório", não há instrução determinística que force a sequência de tools.
3. Não há comparativo automático com mês anterior — o modelo "estima" a variação.
4. `taxa_conversao` da RPC tem bug (Alexandre = 200%, porque divide deals ganhos por leads_recebidos do mês, ignorando deals de leads antigos) — propaga confusão no relatório.

## Plano

### 1. Criar tool dedicada `generate_commercial_report(ano, mes)` no Copilot
Edge function: `supabase/functions/smart-ops-copilot/index.ts`

Em vez de depender do LLM encadear tools, criar **uma única tool server-side** que monta o pacote completo do relatório chamando em paralelo:

- `fn_total_vendas_mes(ano, mes)` + mês anterior (delta % automático)
- `fn_resumo_vendas_mes(ano, mes)` (ranking vendedores)
- `fn_mix_produtos_mes(ano, mes)` (top produtos)
- Pipeline atual via `pipeline-funnel-data` (4 bandas)
- Metas vs realizado (se houver `smart_ops_goals` para o mês)
- Contagem de leads novos no mês (lia_attendances WHERE merged_into IS NULL + created_at no mês)

Retorna JSON estruturado com **todos os números prontos**, eliminando espaço para alucinação.

### 2. Forçar uso da nova tool no SYSTEM_PROMPT
Adicionar regra:
> Quando o usuário pedir "relatório", "report", "performance comercial", "fechamento do mês", "como foi o mês" → SEMPRE use `generate_commercial_report`. NUNCA construa o relatório com tools individuais. NUNCA invente números, percentuais ou comparativos.

### 3. Template determinístico de renderização
Após receber o JSON da tool, o LLM apenas **formata em markdown** seguindo template fixo embutido no prompt (cabeçalho, totais, ranking, mix, pipeline, metas, insights). Sem cálculos.

### 4. Corrigir bug de `taxa_conversao` na `fn_resumo_vendas_mes`
Nova migration: numerador = deals ganhos do vendedor no mês; denominador = leads atribuídos ao vendedor com `assigned_at` no mês (não `leads_recebidos` cru). Cap em 100% e tratar divisão por zero.

### 5. Validação
Após deploy, testar no Copilot: "Me gera o relatório de performance comercial de maio/2026". Conferir que:
- Totais batem com `fn_total_vendas_mes`
- Ranking idêntico à RPC
- Mix de produtos idêntico ao `fn_mix_produtos_mes`
- Comparativo Abr→Mai com delta calculado server-side

### Detalhes técnicos
```text
generate_commercial_report (Promise.all)
 ├── fn_total_vendas_mes(ano, mes)
 ├── fn_total_vendas_mes(ano_prev, mes_prev)   ← delta
 ├── fn_resumo_vendas_mes(ano, mes)
 ├── fn_mix_produtos_mes(ano, mes)
 ├── pipeline-funnel-data (invoke)
 ├── supabase.from("smart_ops_goals").select() WHERE periodo=YYYY-MM
 └── count(lia_attendances) WHERE merged_into IS NULL AND created_at no mês
```

### Fora de escopo
- Não mexer em outras tools (`query_deal_history`, `get_lead_card`, etc.)
- Não trocar modelo (Gemini Flash fica) — fix é estrutural, não de modelo
- Frontend do Copilot (SmartOpsCopilot.tsx) não muda
