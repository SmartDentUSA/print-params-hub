---
name: Cognitive Prompt SDR Enrichment
description: cognitive-lead-analysis prompt inclui bloco "Perfil técnico (SDR Qualificação)" com equip_scanner, sdr_software_cad_interesse, imprime_resinas_ld/guias, custom_fields e smartops_form_field_responses dedup
type: feature
---
**Bloco no prompt**: `**Perfil técnico (SDR Qualificação):**` é injetado em `supabase/functions/cognitive-lead-analysis/index.ts` antes da Memória Longitudinal.

**Fontes consumidas:**
- Colunas: `equip_scanner`, `sdr_software_cad_interesse`, `imprime_resinas_ld`, `imprime_guias`, `especialidade`.
- `raw_payload.custom_fields` (top 10 chaves) — capturado dos campos `custom_field_name` do Form Builder.
- `smartops_form_field_responses` (limit 40, dedup por `field_label`, top 12 pares mais recentes).

**Diretrizes adicionadas:**
- Lead com CAD + resinas LD → MQL avançado/SAL, não pesquisador.
- "perde pacientes" / "motivo de perda" → base de `objection_risk`.
- Marca scanner/CAD no `recommended_approach`.
- "por onde ficou sabendo" reforça `primary_motivation`.

**Por que importa**: antes da v2, o DeepSeek só via `impressora_modelo`, `tem_scanner`, `volume_mensal_pecas` e `produto_interesse`. Toda a qualificação rica de formulários SDR (exocad, Medit i600, resinas LD, guias) era descartada, derrubando a precisão da classificação `lead_stage_detected`.
