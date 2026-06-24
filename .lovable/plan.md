## Alteração cirúrgica em `supabase/functions/smart-ops-ingest-lead/index.ts`

### Objetivo
Tornar o guard de dedupe Meta (4ª camada — `form_submission` no `lead_activity_log`) **LIFETIME** ao invés de janela de 12h, evitando criação indevida de Deals quando o Meta reenvia o mesmo `leadgen_id` após 12h.

### Mudanças

**1. Remover janela de 12h (linhas ~709 e ~716):**
- Remover declaração `const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();`
- Remover filtro `.gte("event_timestamp", since)` da query no `lead_activity_log`

**2. Renomear identificador `meta_form_history_12h` → `meta_form_history_lifetime` (3 ocorrências no mesmo bloco):**
- Linha ~791: `via: "meta_form_history_12h"` em `enrichment_history`
- Linha ~842: `via: "meta_form_history_12h"` em `lead_activity_log` (`form_enrichment`)
- Linha ~864: `dedupe_via: "meta_form_history_12h"` no response

### Escopo
- Apenas o arquivo `supabase/functions/smart-ops-ingest-lead/index.ts`
- Nenhuma outra lógica alterada
- Nenhum outro arquivo tocado