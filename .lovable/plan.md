

## Plano: Integrar SellFlux via Webhooks (Leads + Campanhas)

### Contexto

Voce tem dois webhooks SellFlux com propositos distintos:

```text
┌─────────────────────────────────────────────────────────┐
│  LEADS (V1) - Captura/atualiza contatos no SellFlux     │
│  webhook.sellflux.app/webhook/lead/{hash}?email=X&...    │
│  Metodo: GET com query params                            │
├─────────────────────────────────────────────────────────┤
│  CAMPANHAS (V2) - Dispara automacoes/fluxos              │
│  webhook.sellflux.app/v2/webhook/custom/{hash}           │
│  Metodo: POST com JSON body                              │
└─────────────────────────────────────────────────────────┘
```

### O que muda

O codigo atual em `sellflux-field-map.ts` usa `api.sellflux.com/v1` com Bearer token (que nao existe). Vamos substituir por chamadas diretas aos dois webhooks.

| # | Acao | Arquivo |
|---|------|---------|
| 1 | Criar 2 secrets: `SELLFLUX_WEBHOOK_LEADS` e `SELLFLUX_WEBHOOK_CAMPANHAS` | Secrets Supabase |
| 2 | Reescrever `sendViaSellFlux()` para 2 funcoes: `sendLeadToSellFlux()` (GET com query params) e `sendCampaignViaSellFlux()` (POST com JSON) | `_shared/sellflux-field-map.ts` |
| 3 | Atualizar `smart-ops-send-waleads` para usar `sendCampaignViaSellFlux()` quando dispara mensagens | `smart-ops-send-waleads/index.ts` |
| 4 | Atualizar `smart-ops-proactive-outreach` para usar `sendCampaignViaSellFlux()` | `smart-ops-proactive-outreach/index.ts` |
| 5 | Adicionar chamada `sendLeadToSellFlux()` no fluxo de ingestao de leads para sincronizar contatos automaticamente | `smart-ops-ingest-lead/index.ts` |

### Detalhe tecnico

**sendLeadToSellFlux** (V1 - Leads):
```typescript
const url = new URL(SELLFLUX_WEBHOOK_LEADS);
url.searchParams.set("email", lead.email);
url.searchParams.set("nome", lead.nome);
url.searchParams.set("phone", lead.telefone_normalized);
url.searchParams.set("area_atuacao", lead.area_atuacao || "");
// ... demais campos mapeados
const res = await fetch(url.toString(), { method: "GET" });
```

**sendCampaignViaSellFlux** (V2 - Campanhas):
```typescript
const res = await fetch(SELLFLUX_WEBHOOK_CAMPANHAS, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: lead.email,
    phone: lead.telefone_normalized,
    nome: lead.nome,
    template_id: templateId, // identificador da campanha
    // ... campos customizados
  }),
});
```

### Secrets necessarios

- `SELLFLUX_WEBHOOK_LEADS` = `https://webhook.sellflux.app/webhook/lead/b9cecca75d277cd77afd8818fd369781`
- `SELLFLUX_WEBHOOK_CAMPANHAS` = `https://webhook.sellflux.app/v2/webhook/custom/afb45b0a20cca8d8eb40e36975316cca`

O secret `SELLFLUX_API_TOKEN` deixa de ser necessario — a autenticacao esta embutida no hash de cada URL.

### Fluxo resultante

```text
Lead chega (Meta/PipeRun/Site)
  └─> smart-ops-ingest-lead
        ├─> Salva em lia_attendances
        └─> sendLeadToSellFlux(lead)  ← NOVO: sincroniza contato no SellFlux

Proactive outreach / Send WaLeads
  └─> sendCampaignViaSellFlux(lead, templateId)  ← dispara automacao
        └─> SellFlux executa o fluxo configurado
```

