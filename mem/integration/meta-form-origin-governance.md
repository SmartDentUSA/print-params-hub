---
name: Meta Form Origin Governance
description: Origem no CRM de leads Meta usa sempre origin_system_b de meta_form_mappings; nome cru do formulário na Meta é só fallback
type: feature
---
`meta_form_mappings.origin_system_b` (ex.: `# - [META] - Exocad - RMS`) é o rótulo oficial de origem no PipeRun. O `form_name_meta` (nome cru do formulário na Meta, ex.: `# - Exocad - Smart Dent-copy`) é apenas referência de match por `form_id`.

Cascata obrigatória em toda ingestão Meta (`smart-ops-zernio-lead-webhook`, `meta-lead-ads-pull`):
- `form_name` = `origin_system_b` → fallback `formName` cru.
- `origem_campanha` = `campaignName` → `origin_system_b` → `formName`.

`meta-lead-ads-pull` resolve via `resolveMetaForm` (banco). O de-para hardcoded em `zernio-field-normalizer.ts` é só fallback para form_id não mapeado — editar o mapeamento na UI passa a valer nos dois caminhos.
