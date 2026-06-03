## Diagnóstico

Olhando os logs e o código:

1. **Spam de "deal enriched via redelivery" na timeline a cada minuto** — Meta re-entrega o mesmo `leadgen_id` continuamente. Hoje, mesmo quando o payload chega 100% idêntico ao já persistido (nada para enriquecer), `smart-ops-ingest-lead` ainda invoca `smart-ops-lia-assign` na rota universal de redelivery. Os logs confirmam: `ENRICHMENT_ROUTE: lead=... fields=[]` se repetindo a cada poucos minutos para os mesmos leads. Cada execução faz:
   - PUT no deal no PipeRun (sem mudança real)
   - `INSERT` em `lead_activity_log` com `event_type=deal_enriched_via_redelivery` → é o que aparece como evento na timeline do Smart Ops

2. **Vários deals abertos para "lucas Freitas"** — a tela do PipeRun mostra deals abertos simultâneos em Sem contato, Proposta enviada (TEMP) × N, C2 × N, Apresentação, Estagnados. O CASE A da `routeDealForEnrichment` só pega UM deal aberto em VENDAS (`openDeals.find(...)`); se já existem N abertos em VENDAS, os outros nunca são reconciliados.

## Plano de correção

### Fix 1 — Curto-circuito de redelivery no-op (raiz do spam)
Arquivo: `supabase/functions/smart-ops-ingest-lead/index.ts` (~linha 548-590)

- Calcular `enrichedFields` **antes** de invocar `smart-ops-lia-assign`.
- Se `enrichedFields.length === 0` AND `deferredRedeliveryVia` é redelivery puro (hard/family dedupe): **não** invocar `lia-assign`, **não** gravar `system_health_logs` repetidamente.
- Retornar imediatamente `{ success: true, duplicate_skipped: true, dedupe_via, lead_id, incremental_enrichment: [] }`.
- Continuar invocando `lia-assign` somente quando houver pelo menos um campo realmente enriquecido.

### Fix 2 — Guard de no-op dentro do CASE A
Arquivo: `supabase/functions/smart-ops-lia-assign/index.ts` (~linha 1957-2013)

- Logo após localizar `vendaDeal`, se a invocação veio com `enriched_fields=[]` (rota de re-entrega Meta sem mudança):
  - Pular o `updateExistingDeal` (PUT PipeRun)
  - Pular o `INSERT` em `lead_activity_log`
  - Apenas garantir que `lia_attendances.piperun_id` aponta para o `vendaDeal.id` (já costuma estar correto — fazer só se divergente).
  - Retornar `{ flow_type: "preserve_vendas_noop", piperun_id, created_new: false, closed_deals: [] }`.
- Assim, mesmo se algum fluxo legado ainda chamar a rota, não há mais escrita.

### Fix 3 — Consolidar múltiplos deals abertos em VENDAS
Arquivo: `supabase/functions/smart-ops-lia-assign/index.ts` (mesma função `routeDealForEnrichment`, antes do CASE A)

- Detectar `openVendasDeals = openDeals.filter(d => pipeline_id === VENDAS && !freezed)`.
- Se `openVendasDeals.length > 1`:
  - Manter o mais recente como `vendaDeal` (ordenar por `updated_at` desc, fallback `created_at`).
  - Fechar os demais com `status: 2` (Perdido) e `lost_reason: "duplicado_redelivery_meta"`.
  - Adicionar nota curta no deal preservado: `"⚠️ [Dra. L.I.A.] N deal(s) duplicado(s) fechado(s): ID …"`.
  - Registrar 1 entrada em `lead_activity_log` `event_type="vendas_duplicates_consolidated"`.
- Não rodar este passo se `enriched_fields=[]` (combina com Fix 2 — ficar 100% silencioso em redelivery puro).

### Fix 4 — Validação e deploy
- Deploy de `smart-ops-ingest-lead` + `smart-ops-lia-assign`.
- Conferir nos logs após 10 min: linhas `ENRICHMENT_ROUTE: ... fields=[]` devem sumir (o ingest passa a short-circuitar antes).
- Conferir na timeline do Smart Ops: novas entradas `deal_enriched_via_redelivery` só devem aparecer quando há campo novo de fato (raro).
- Para lucas Freitas (deal_id alvo a confirmar via Smart Ops Copilot), rodar uma re-entrega forçada para acionar Fix 3 e confirmar que sobra 1 deal aberto em VENDAS.

## Resultado esperado

- Smart Ops timeline para de receber dezenas de eventos `deal_enriched_via_redelivery` por hora.
- PipeRun para de receber PUTs idênticos sem mudança.
- Leads com múltiplos deals abertos em VENDAS são consolidados em 1 só na próxima re-entrega legítima.
- Comportamento de enriquecimento real (quando o lead realmente preenche um novo campo) permanece intacto.

## Detalhes técnicos

- `enrichmentDiff` já é calculado em `smart-ops-ingest-lead` (linha ~516); usar `Object.keys(enrichmentDiff).length === 0` como gate.
- `lead_activity_log` continua recebendo `meta_family_dedupe_lifetime` (em `system_health_logs`) para auditoria, mas só 1x por leadgen_id novo (já é o caso).
- Fix 3 é puramente reativo: roda quando há enriquecimento real, evitando loop entre redeliveries.