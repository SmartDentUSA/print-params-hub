

## Refatorar `smart-ops-sync-piperun` para usar `piperun-field-map.ts`

### Mudancas

**Arquivo:** `supabase/functions/smart-ops-sync-piperun/index.ts`

1. **Remover codigo duplicado** (linhas 8-172): apagar todos os maps locais (`SALES_STAGE_MAP`, `STAGNANT_STAGE_MAP`, `CS_STAGE_MAP`, `STATUS_MAP`), funcoes `mapStageToStatus`, `isStagnantFunnel`, `isStagnant`, `isInStagnantFunnel`, `extractCustomField`, e `buildUpdatePayload`

2. **Importar do shared**: usar `mapDealToAttendance`, `STAGE_TO_ETAPA`, `PIPELINES`, `piperunGet`, `PIPERUN_API_BASE` do `../_shared/piperun-field-map.ts`

3. **Substituir fetch manual pela API helper**: trocar o `fetch` direto para `https://api.pipe.run/v1/deals` por `piperunGet(apiKey, "deals", { show: 100, page, ...})`

4. **Substituir `buildUpdatePayload`** por `mapDealToAttendance(deal)` — que usa IDs numericos dos custom fields em vez de busca por nome de string

5. **Substituir `mapStageToStatus`** por lookup direto em `STAGE_TO_ETAPA[deal.stage_id]` — usando ID numerico do stage em vez de parsear nome por string

6. **Manter logica de stagnation tracking** mas baseada em `deal.pipeline_id === PIPELINES.ESTAGNADOS` em vez de string matching no nome do funil

7. **Manter logica de upsert** (busca por `piperun_id`, fallback por email, create se nao existe)

### Resultado

- Elimina ~160 linhas de mapeamento hardcoded por string
- Usa IDs numericos (imunes a mudancas de nome no CRM)
- Centraliza tudo no `piperun-field-map.ts` (single source of truth)
- Mantém compatibilidade total com o fluxo atual

