---
name: form_data merge profundo + custom_fields_history
description: ingest-lead acumula snapshots de cada submissão em form_data[form_name][] (cap 20) e raw_payload.custom_fields_history[] (cap 50); form_data agora está em MERGE_JSONB_FIELDS para não cair em enrichment-only
type: feature
---
**Problema corrigido (Maio/2026)**: `form_data` era setado uma vez como `{}` e nunca mais atualizado porque caía em ENRICHMENT_ONLY no `mergeSmartLead`. Custom fields (`raw_payload.custom_fields`) eram sobrescritos a cada submissão sem histórico.

**Mudanças:**

1. `_shared/lead-enrichment.ts`: `form_data` adicionado a `MERGE_JSONB_FIELDS`. Shallow merge preserva snapshots de outros `form_name` enquanto o caller atualiza o bucket atual.

2. `smart-ops-ingest-lead/index.ts`:
   - `form_data[bucketKey]` agora é **array de snapshots** (cap 20 por form_name). Coerção retrocompatível: bucket pré-existente como objeto vira `[obj]`.
   - Snapshot inclui `{ submitted_at, source, responses, raw_fields }`.
   - `raw_payload.custom_fields_history` é append-only (cap 50): `[{ submitted_at, form_name, source, fields }]`. `raw_payload.custom_fields` continua sendo última versão para compat.

3. Instrumentação `system_health_logs.event_type='form_data_appended'` com `{ form_name, source, responses_count, raw_fields_count, history_size }` em cada submissão de formulário.

**Bucket key**: `form_name` quando presente; senão `_unnamed`.

**Validação**: submeter o mesmo formulário 2× → `form_data['# - Formulário Padrão']` vira array com 2 entradas; `raw_payload.custom_fields_history` cresce 2 itens.
