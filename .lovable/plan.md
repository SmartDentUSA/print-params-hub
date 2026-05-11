## Diagnóstico

Os leads do Meta **já aparecem** no "Log de Chegada" do Smart Ops:
- `lead_activity_log` tem 79 entradas com `event_type='meta_ads_lead_entry'` / `source_channel='meta_lead_ads'`, a última agora há pouco (11/05 11:31).
- `SmartOpsLogs.classifySource` reconhece `source_channel` contendo "meta" → fonte "Meta Ads" ✅
- Realtime subscription em `lead_activity_log` já atualiza a UI sem refresh ✅

**Único problema cosmético:** `formatEventLabel` não tem mapping para `meta_ads_lead_entry`, então o evento aparece como texto cru `"meta ads lead entry"` na coluna Evento.

## Mudança proposta (1 linha)

Em `src/components/SmartOpsLogs.tsx`, adicionar ao map de `formatEventLabel`:

```ts
meta_ads_lead_entry: "Lead Meta criado",
```

(Pode também adicionar variantes futuras: `meta_ads_lead_reactivated`, `form_submission_detected`, se quiser uniformizar.)

## Validação

1. Abrir aba "Log de Chegada" → eventos Meta novos exibem "Lead Meta criado" em vez de "meta ads lead entry".
2. Sem mudança de comportamento — apenas label.
