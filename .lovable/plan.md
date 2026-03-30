

# Diagnóstico: Copilot não identifica itens de propostas ganhas

## Resumo da investigação

A infraestrutura de dados está correta:
- **3.375 deals ganhos** no banco, dos quais **2.676 têm itens de proposta detalhados**
- A função SQL `fn_search_deals_by_status` retorna `deal_items` corretamente
- 680 deals ganhos (~20%) têm o array `proposals` vazio — são deals antigos do backfill que não tinham snapshot de proposta

## Causa raiz

O **prompt do sistema do Copilot tem instruções contraditórias**:

1. **Linha 1316**: diz para usar `query_leads_advanced` com `where_text_search` em campos JSONB para buscar por produto
2. **Linhas 1350-1356**: reforça o uso de `where_text_search` em `itens_proposta_parsed` e `proposals_data`
3. **Linhas 1389-1400**: diz para "NUNCA" usar `query_leads_advanced` para `piperun_deals_history` e usar `query_deal_history`

Quando o usuário pergunta "quais produtos foram vendidos?" ou "vendas de resina", o modelo pode escolher `query_leads` (que retorna campos flat sem itens) ou `query_leads_advanced` com `where_text_search` (que faz busca textual mas não retorna os itens detalhados), em vez de usar `query_deal_history` que é a ferramenta correta.

## Correção proposta

**Arquivo: `supabase/functions/smart-ops-copilot/index.ts`** — apenas ajustes no `SYSTEM_PROMPT`

### 1. Reforçar no bloco COMPORTAMENTO (linhas ~1314-1327)

Adicionar regra explícita:
```
- Para vendas, produtos vendidos, itens de proposta, faturamento ou deal ganho → use SEMPRE query_deal_history
- NUNCA use query_leads ou query_leads_advanced para buscar vendas/produtos vendidos — eles não retornam deal_items
```

### 2. Atualizar bloco de filtros avançados (linhas ~1354-1365)

Remover a sugestão de usar `where_text_search` em `itens_proposta_parsed` para análise de vendas e redirecionar para `query_deal_history`:
```
- itens_proposta_parsed e itens_proposta_crm: SOMENTE para filtrar leads que receberam proposta de determinado produto (campanhas, reativação)
- Para ANALISAR vendas realizadas, use query_deal_history com status="ganho" — retorna deal_items com nomes dos produtos
```

### 3. Expandir exemplos no bloco HISTÓRICO DE DEALS (linhas ~1393-1400)

Adicionar exemplos de perguntas comuns que devem usar `query_deal_history`:
```
- "Quais produtos foram vendidos?" → query_deal_history com status="ganho"
- "Faturamento do mês" → query_deal_history com status="ganho"
- "Vendas de resina" → query_deal_history com status="ganho", product="resina"
- "Top produtos vendidos" → query_deal_history com status="ganho", limit=200
```

## Resultado esperado

O Copilot passará a usar consistentemente `query_deal_history` para qualquer pergunta sobre vendas/produtos vendidos, retornando os `deal_items` corretamente.

