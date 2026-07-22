## Fix: `area_atuacao` contaminado por cargo/QSA no sync PipeRun

### Causa
Em `supabase/functions/_shared/piperun-field-map.ts`, `mapDealToAttendance` gravava `person.job_title` (cargo/QSA) em `fields.area_atuacao`, e nunca lia o custom field correto (`DEAL_CUSTOM_FIELDS.AREA_ATUACAO`, id 549241).

### Mudanças em `supabase/functions/_shared/piperun-field-map.ts`

1. **Import** no topo:
   ```ts
   import { normalizeAreaAtuacao, normalizeEspecialidade } from "./zernio-field-normalizer.ts";
   ```

2. **Remover** dentro do bloco `if (person && !personMismatch) {`:
   ```ts
   if (person.job_title) fields.area_atuacao = person.job_title;
   ```
   Manter a linha seguinte (`pessoa_cargo = person.job_title`).

3. **Substituir** o bloco de leitura de custom fields:
   ```ts
   const especialidade = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.ESPECIALIDADE);
   if (especialidade) fields.especialidade = normalizeEspecialidade(especialidade) ?? especialidade;

   // FIX (22/jul/2026): área de atuação lia person.job_title por engano.
   const areaAtuacaoRaw = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.AREA_ATUACAO);
   if (areaAtuacaoRaw) fields.area_atuacao = normalizeAreaAtuacao(areaAtuacaoRaw) ?? areaAtuacaoRaw;
   ```

### Redeploy
`piperun-field-map.ts` é `_shared` — todas as functions que o importam precisam ser reempacotadas. Rodar:
```bash
grep -rl "piperun-field-map" supabase/functions --include="*.ts" | grep -v "_shared/piperun-field-map.ts"
```
e redeployar cada function listada (esperados: `smart-ops-piperun-webhook`, `piperun-full-sync`, `smart-ops-sync-piperun`, `piperun-mirror-import`, `piperun-offline-enrich`, mais o que a busca real retornar).

### Fora de escopo
- `LeadDetailPanel.tsx`, schema de `lead_activity_log`, contratos PipeRun/SellFlux, verificação de assinatura de webhooks.
- Backfill de dados (já feito diretamente no banco).
- Alterar linha `pessoa_cargo = person.job_title` (correta).

### Validação
Forçar re-sync de 1 deal de teste e conferir:
```sql
SELECT area_atuacao, pessoa_cargo FROM lia_attendances WHERE piperun_id = '<ID>';
```
`area_atuacao` deve ser um dos 9 canônicos (ou null), nunca igual a `pessoa_cargo`.
