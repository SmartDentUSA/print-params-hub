## Objetivo
Eliminar ruído no timeline do deal #60413725 (e similares) corrigindo duas causas distintas em `smart-ops-lia-assign` e `smart-ops-ingest-lead`.

---

## FIX 1 — Resumo do Lead duplicado (19:48:17 e 19:48:19)

**Causa raiz:** dois caminhos paralelos chamam `buildSellerDealSummaryHTML` para o mesmo lead Meta:
1. `smart-ops-ingest-lead/index.ts:1285` → invoca `smart-ops-deal-form-note` em fire-and-forget para leads existentes com `piperun_id`.
2. `smart-ops-lia-assign/index.ts:688` → posta o resumo direto ao criar/atualizar o deal.

Ambos rodam em paralelo, ambos leem `last_seller_note_hash=null` antes do primeiro write, e ambos passam pelo throttle de 5 min. Resultado: duas notas idênticas.

**Correção:** em `smart-ops-ingest-lead/index.ts` (~linha 1267), **pular** a chamada a `smart-ops-deal-form-note` quando `source === "meta_lead_ads"`. Para Meta, `lia-assign` é o owner único do resumo. Demais fontes (web forms, ManyChat, etc.) continuam usando deal-form-note normalmente.

Patch alvo:

```ts
if (existingLead.piperun_id && (formName || source === "form") && source !== "meta_lead_ads") {
  // … bloco existente que dispara deal-form-note …
}
```

---

## FIX 2 — Nota "Re-entrega Meta deduplicada" postada indevidamente (19:49:01)

**Causa raiz:** em `smart-ops-lia-assign/index.ts` CASE A (linhas 1956-2003), quando há deal aberto em VENDAS, o código sempre posta `🔁 [Dra. L.I.A.] Re-entrega Meta (form "…")` mesmo quando `enrichedFields` está vazio. No timeline do #60413725, a 2ª invocação 46s depois entrou em CASE A com `enriched_fields:[]` e postou ruído.

**Correção:** envolver o `addDealNote` em CASE A num guard que só posta a nota quando há enriquecimento real:

```ts
if (enrichedFields.length > 0) {
  await addDealNote(
    apiToken,
    Number(vendaDeal.id),
    `🔁 [Dra. L.I.A.] ${enrichTag}`,
  );
}
```

O evento `deal_enriched_via_redelivery` em `lead_activity_log` continua sendo gravado (auditoria preservada), apenas a nota visível no PipeRun é suprimida quando não há mudança.

---

## Arquivos alterados
- `supabase/functions/smart-ops-ingest-lead/index.ts` — adicionar guard `source !== "meta_lead_ads"` na condição do bloco deal-form-note (~linha 1267).
- `supabase/functions/smart-ops-lia-assign/index.ts` — envolver `addDealNote` da CASE A (linhas 1969-1973) em `if (enrichedFields.length > 0)`.

## Deploy
Após aplicar os patches, redeploy de ambas as funções. Sem migrations, sem mudanças de schema.

## Validação
- Próxima submissão Meta real: confirmar que apenas UMA nota "Resumo do Lead" é postada e que a nota "Re-entrega Meta" só aparece quando `enriched_fields` no `lead_activity_log` é não-vazio.
- Logs de `smart-ops-lia-assign` e `smart-ops-ingest-lead` para confirmar boot limpo.
