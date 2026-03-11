

# Plano: Ferramentas Operacionais do Copilot (WhatsApp + CRM)

## Problema

O Copilot não consegue executar comandos operacionais básicos porque:

1. **`send_whatsapp` não sabe de quem enviar** — não aceita `seller_name` nem `team_member_id`, então a chamada ao `smart-ops-send-waleads` falha por falta de `team_member_id`
2. **Não existe ferramenta para mover etapa de funil** — o `smart-ops-kanban-move` já existe mas o Copilot não tem acesso
3. **Não existe ferramenta para buscar carrinhos abandonados** — o Copilot não consegue consultar pedidos da Loja Integrada filtrados por status/data

## Solução: 3 Mudanças no `smart-ops-copilot/index.ts`

### 1. Refatorar `send_whatsapp` → aceitar `seller_name`

O Copilot busca o vendedor por nome na `team_members`, pega o `id` + `waleads_api_key`, e passa o `team_member_id` para `smart-ops-send-waleads`. Se o lead for passado por nome/email em vez de telefone, busca o telefone automaticamente.

```text
Comando: "Envie msg da Patricia para o lead João dizendo X"
  │
  ▼
1. query team_members WHERE nome_completo ILIKE '%patricia%'
2. query lia_attendances WHERE nome ILIKE '%joão%' → pega telefone
3. POST smart-ops-send-waleads { team_member_id, phone, message, lead_id }
```

**Nova definição da tool:**
- `seller_name` (string, opcional) — nome do vendedor (busca em team_members)
- `lead_name` (string, opcional) — nome do lead (alternativa ao phone)
- `lead_id` (string, opcional) — UUID do lead
- `phone` (string, opcional) — telefone direto
- `message` (string, obrigatório)

### 2. Nova tool: `move_crm_stage`

Chama `smart-ops-kanban-move` para mover o deal no PipeRun e atualiza `etapa_crm` no `lia_attendances`.

**Parâmetros:**
- `lead_id` (string) — UUID do lead
- `new_stage` (string) — nova etapa (ex: "negociacao", "proposta", "ganho")

**Fluxo:** Busca `piperun_id` do lead → chama `kanban-move` → atualiza `etapa_crm` local.

### 3. Nova tool: `query_ecommerce_orders`

Consulta pedidos da Loja Integrada filtrados por status e data. Resolve o caso de "carrinhos abandonados".

**Parâmetros:**
- `status` (string) — ex: "checkout_iniciado", "aguardando_pagamento"
- `since` (string) — data ISO (ex: "2026-03-11")
- `limit` (number)

### 4. Atualizar SYSTEM_PROMPT

Adicionar instruções para o Copilot usar essas novas ferramentas:
- "Para enviar WhatsApp do celular de um vendedor, use `send_whatsapp` com `seller_name`"
- "Para mover etapa CRM, use `move_crm_stage`"
- "Para carrinhos abandonados, use `query_ecommerce_orders` com status 'checkout_iniciado'"

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-copilot/index.ts` | Refatorar `send_whatsapp` tool + executor, adicionar `move_crm_stage` e `query_ecommerce_orders` tools + executors, atualizar SYSTEM_PROMPT |

