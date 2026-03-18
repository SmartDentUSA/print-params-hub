

# Correção: Eventos E-commerce Não Aparecem na Timeline do Lead

## Diagnóstico Confirmado

O webhook `smart-ops-ecommerce-webhook` está funcionando corretamente — ele insere eventos na tabela `lead_activity_log` (linha 769-787). O problema está em **dois lugares**:

1. **Backend (`smart-ops-leads-api`)**: A action `detail` NÃO busca registros de `lead_activity_log`. Retorna apenas: lead, person, company, deals, opportunities, tickets.

2. **Frontend (`LeadDetailPanel.tsx`)**: A função `buildTimeline()` (linha 258-351) foi **explicitamente desabilitada** para e-commerce na linha 302:
   ```
   // (E-commerce orders removed — data was fake)
   ```
   A timeline só renderiza: deals PipeRun, Academy, Support tickets, e CRM tags. Nunca lê `lead_activity_log`.

## Plano de Correção

### 1. Adicionar fetch de `lead_activity_log` no `smart-ops-leads-api/index.ts`

Após o fetch de tickets (linha ~136), adicionar:

```ts
const { data: activityLog } = await supabase
  .from("lead_activity_log")
  .select("id, event_type, entity_type, entity_id, entity_name, event_data, source_channel, value_numeric, event_timestamp, created_at")
  .eq("lead_id", id)
  .order("event_timestamp", { ascending: false })
  .limit(100);
```

Incluir `activity_log: activityLog || []` no response JSON.

### 2. Atualizar `LeadDetailPanel.tsx` — Adicionar `activity_log` à interface e ao `buildTimeline()`

**a)** Adicionar `activity_log` ao `DetailResponse` interface.

**b)** Substituir o comentário na linha 302 por lógica que renderiza eventos do `lead_activity_log`:

```ts
// E-commerce & outros eventos do activity_log
(detail?.activity_log || []).forEach((ev: any) => {
  const isEcommerce = ev.source_channel === "ecommerce";
  const evData = ev.event_data || {};
  events.push({
    date: ev.event_timestamp || ev.created_at,
    dotCls: isEcommerce ? "tl-dot-buy" : "tl-dot-crm",
    title: isEcommerce
      ? `🛒 ${ev.event_type.replace("ecommerce_", "")} — Pedido #${evData.pedido || ev.entity_id || "?"}`
      : ev.event_type,
    desc: ev.entity_name || evData.produtos?.join(", ") || "",
    tags: evData.tags_added?.slice(0, 3) || [],
    detail: {
      ...(evData.valor ? { Valor: formatBRLFull(evData.valor) } : {}),
      ...(evData.status ? { Status: evData.status } : {}),
      ...(evData.fonte ? { Fonte: evData.fonte } : {}),
    },
  });
});
```

### 3. Fix bug secundário: falsy values no enrichment (linha 354)

```ts
// Antes (bug):
lojaintegrada_ltv: ltv || null,
lojaintegrada_total_pedidos_pagos: totalPedidosPagos || null,

// Depois (fix):
lojaintegrada_ltv: ltv != null ? ltv : null,
lojaintegrada_total_pedidos_pagos: totalPedidosPagos != null ? totalPedidosPagos : null,
```

### Resultado

- Pedidos da Loja Integrada (como o do `danilohen@gmail.com`) aparecerão na timeline do card do lead
- Todos os eventos de `lead_activity_log` (e-commerce, formulários, SDR, etc.) serão visíveis
- Valores zero preservados corretamente no LTV

