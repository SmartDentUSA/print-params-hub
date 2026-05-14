# Copilot: acesso total aos dados do card do lead

## Objetivo
Dar ao Copilot a mesma visão 360° que o operador vê no `KanbanLeadDetail` — todos os campos do lead, deals PipeRun, pedidos eCommerce, dados Omie ERP, mensagens, interações de IA, log de atividades, histórico de funil e page views.

## O que existe hoje
- `query_leads` / `query_leads_advanced` retornam apenas um `select` curto e padrão.
- `query_table` tem whitelist restrita — falta `whatsapp_inbox`, `lead_activity_log`, `lead_funnel_history`, `lead_page_views`, `piperun_deals_history`, `ecommerce_orders_history`, `proposals_data`, `omie_clientes`, `omie_pedidos`.
- Existem tools pontuais (`query_deal_history`, `query_ecommerce_orders`) mas nada que entregue o card completo de uma vez.

## Mudanças

### 1. Nova tool `get_lead_card` (one-shot 360°)
Edge function `smart-ops-copilot/index.ts`: nova tool que aceita `lead_id` ou `email`/`telefone`/`piperun_id` e retorna em um único payload:

```ts
{
  lead: <lia_attendances.* completo, exceto embeddings>,
  deals: <piperun_deals_history ordenados desc>,
  ecommerce_orders: <ecommerce_orders_history>,
  omie: { score, faturamento, pedidos, classificacao, inadimplencia, ultima_compra },
  activity_log: <lead_activity_log últimos 50>,
  funnel_history: <lead_funnel_history>,
  page_views: <lead_page_views últimos 30>,
  whatsapp_inbox: <whatsapp_inbox últimos 30 por phone normalizado>,
  agent_interactions: <últimos 20>,
  message_logs: <últimos 30>
}
```
Resolve identidade pelo cascade `piperun_id > email > telefone > id`, sempre filtrando `merged_into IS NULL` em `lia_attendances` (Core Rule).

### 2. Ampliar `query_leads` e `query_leads_advanced`
- Aceitar `select: "*"` para retornar o lead completo.
- Adicionar exemplo no `description`: `select:"*"` quando o usuário pedir "tudo do lead", "card completo", "ficha", etc.

### 3. Expandir whitelist do `query_table`
Adicionar: `whatsapp_inbox`, `lead_activity_log`, `lead_funnel_history`, `lead_page_views`, `piperun_deals_history`, `ecommerce_orders_history`, `proposals_data`, `omie_clientes`, `omie_pedidos`, `lead_state_events` (já está? confirmar).

### 4. System prompt
Adicionar no prompt do Copilot:
- "Quando o usuário pedir 'me mostra esse lead', 'ficha completa', 'card do lead', 'tudo sobre X' → use `get_lead_card`."
- Lembrar que `get_lead_card` já cobre deals/eCommerce/Omie/atividade — não chamar tools redundantes em sequência.

### 5. Memory
Atualizar `mem://smart-ops/copilot-jsonb-intelligence-v3` (ou criar `mem://smart-ops/copilot-lead-360-access`) registrando a nova tool e a expansão da whitelist.

## Arquivos
- `supabase/functions/smart-ops-copilot/index.ts` (nova tool + dispatcher + whitelist + prompt)
- `mem://smart-ops/copilot-lead-360-access` (novo)

## Validação
Pedir ao Copilot: "me dá tudo do lead joao@x.com" e confirmar que a resposta cita deals, pedidos eCommerce, Omie, últimas mensagens e atividade — tudo em uma chamada.
