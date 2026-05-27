---
name: Seller Note 7×3 Workflow Diagnosis
description: PipeRun seller note + WhatsApp briefing + cognitive prompt all consume `_shared/workflow-diagnosis.ts` which cross-refs lead stack vs workflow_cell_mappings (Motor de Regras 7×3) to produce stack/intent/lacunas/combo/perguntas + LLM positioning script
type: feature
---

**Module**: `supabase/functions/_shared/workflow-diagnosis.ts`

**Inputs (read-only)**:
- `workflow_cell_mappings` (cached 5 min) — products / sdr_fields / competitors per `workflow_stage` × `workflow_cell`
- `lia_attendances.*` (canonical row, `merged_into IS NULL`)
- `smartops_form_field_responses` (latest 80, indexed by `field_name` + `field_label`)
- `lia_attendances.raw_payload.custom_fields`
- `system_a_catalog` (cached 5 min via `_shared/product-rag.ts`) — RAG dossiers (description, benefits, technical_specs, faq, clinical_indications, compatibility_list, contraindications) used to ground the LLM positioning script

**Output `WorkflowDiagnosis`**:
- `stack_atual`: which cells have data, value found, whether it matches a competitor on that cell
- `intent`: produto_interesse / produto_interesse_auto / form_name / resina_interesse resolved against product labels of the mapping (substring + token match) → target_stage/target_cell
- `lacunas`: prereq stages (STAGE_PREREQS) without data, plus target_cell itself if empty
- `combo_sugerido`: top 3 products of intent cell + top 2 of next adjacent stage + top 1 course if etapa_6 vazia
- `perguntas_qualificacao`: derived from `sdr_field` labels of the intent cell + lacuna cells that are empty on the lead (mapped via QUESTION_TEMPLATES)
- `concorrentes_detectados`: flagged when lead value matches a `competitor` mapped_value on the same cell
- `llm_script`: optional 5-bullet DeepSeek positioning (12s timeout, soft-fail, max_tokens=400). Disable with `{ enableLLM: false }`.

**Positioning script grounding (RAG)**:
- Always fetches `fetchProductDossier(intent.matched_product_label || intent.produto)` from `system_a_catalog`.
- Fetches dossiers for top 2 products of `combo_sugerido.mesma_celula` (parallel).
- When a printer is involved (competitor printer OR stack has `etapa_3_impressao` OR intent target stage ∈ {3,4,5}), fetches the Rayshape dossier and appends a fixed REGRA RAYSHAPE: "impressoras genéricas têm limitações operacionais; Rayshape elimina e é sempre superior em facilidade no fluxo digital odontológico — citar apenas specs do dossiê".
- All dossiers injected into DeepSeek prompt under "=== RAG OFICIAL SMART DENT ===" with explicit instruction to use ONLY these facts, no invented specs/prices.
- Soft-fail: if a dossier is not found in `system_a_catalog`, that block is omitted and the bullet falls back to the label only.

**Renderers**:
- `renderDiagnosisHTML(diag)` — PipeRun note block. Injected in `_shared/seller-summary.ts` after Inteligência.
- `renderDiagnosisWhatsApp(diag)` — Compact text for seller WhatsApp. Injected in `smart-ops-lia-assign/buildSellerNotification` between cabeçalho e HISTÓRICO.
- `renderDiagnosisForPrompt(diag)` — Plain text for LLM context. Appended to "Perfil técnico (SDR Qualificação)" in `cognitive-lead-analysis` to anchor `lead_stage_detected` / `recommended_approach` in the official 7×3 ruler.

**Preview / verification**: edge function `smart-ops-preview-seller-note` (`verify_jwt=false`). GET `?email=` / `?lead_id=` / `?piperun_id=` returns `{ diagnosis, diagnosis_html, diagnosis_whatsapp_text, piperun_note_html, piperun_note_hash }` without posting to PipeRun/WhatsApp/DB.

**Config**: `STAGE_ORDER`, `STAGE_LABEL`, `STAGE_PREREQS`, `QUESTION_TEMPLATES` são tabelas curtas hardcoded no módulo. Edição produto/concorrente/sdr_field continua 100% no `SmartOpsMappingFieldsEditor`.

**PipeRun posting (lia-assign)**: as 3 chamadas de nota no `smart-ops-lia-assign` (`updateExistingDeal`, `moveDealToVendas`, `createNewDeal`) agora passam pelo helper `postRichSellerNote`, que usa `buildSellerDealSummaryHTML` (Resumo do Lead completo + bloco 7×3 + RAG + Rayshape) com idempotência por `last_seller_note_hash` / `last_seller_note_at` (skip se hash idêntico, throttle se <5 min). Reativação preserva o cabeçalho `🔄 Deal reativado` via `headerPrefix`. Em caso de erro do builder, faz fallback para o `buildDealNoteHTML` legado (mantido como deprecated). Notas curtas de auditoria (enrichment tag, owner bloqueado, razão social) continuam usando `addDealNote` direto.

**Falha-suave**: se `workflow_cell_mappings` estiver vazio, `diagnoseLead` retorna estrutura vazia e os renderers devolvem string vazia → nota/briefing seguem sem o bloco. Se DeepSeek cair, `llm_script` fica undefined e os outros campos seguem.
