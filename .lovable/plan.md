

## Corrigir atribuição de `source` no sellflux-webhook

### Problema
O `smart-ops-sellflux-webhook` hardcoda `source: "sellflux_webhook"` e `utm_source: "sellflux"` em todos os payloads. Quando o SellFlux dispara automações originadas da Loja Integrada, o source deveria ser `"loja_integrada"`, não `"sellflux_webhook"`.

### Solução
Detectar a origem real do payload analisando os campos presentes e inferir o `source` correto:

1. **No `smart-ops-sellflux-webhook/index.ts`**, antes de montar o `normalizedPayload`:
   - Se o payload contém `tracking` ou `transaction` ou tags de e-commerce (`loja_integrada`, `compra-realizada`, `aguardandopagamento`, etc.) → `source = "loja_integrada"`
   - Se contém `event: "automation_trigger"` sem campos de e-commerce → `source = "sellflux_automacao"`
   - Se contém `form_name` ou `automation_name` específicos → usar esse valor
   - Fallback: `source = "sellflux_webhook"`

2. **Ajustar `utm_source`** com a mesma lógica:
   - Loja Integrada → `utm_source = "loja_integrada"`
   - Automação genérica → `utm_source = "sellflux"`

### Mudanças técnicas

**Arquivo:** `supabase/functions/smart-ops-sellflux-webhook/index.ts`

Adicionar função de detecção de origem (~15 linhas) antes da montagem do `normalizedPayload`:

```typescript
function detectRealSource(payload: Record<string, unknown>, tags: string[]): { source: string; utm_source: string } {
  // Loja Integrada indicators
  const hasTracking = payload.tracking && typeof payload.tracking === "object";
  const hasTransaction = payload.transaction && typeof payload.transaction === "object";
  const ecommerceTags = ["loja_integrada", "compra-realizada", "pedido-pago", "aguardandopagamento", "gerouboleto", "cancelado"];
  const hasEcommerceTags = tags.some(t => ecommerceTags.some(ec => t.toLowerCase().includes(ec)));
  
  if (hasTracking || hasTransaction || hasEcommerceTags) {
    return { source: "loja_integrada", utm_source: "loja_integrada" };
  }

  // Use automation_name or form_name if provided
  const automationName = payload.automation_name || payload.form_name;
  if (automationName) {
    return { source: String(automationName), utm_source: "sellflux" };
  }

  return { source: "sellflux_webhook", utm_source: "sellflux" };
}
```

Substituir os valores hardcoded no `normalizedPayload`:
- `source: "sellflux_webhook"` → `source: detected.source`
- `utm_source: payload.utm_source || "sellflux"` → `utm_source: payload.utm_source || detected.utm_source`

**Deploy:** Redeployar `smart-ops-sellflux-webhook` após a alteração.

