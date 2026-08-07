---
name: Classificação manual Inbound/Outbound das origens de lead
description: Tabela lead_origin_classification + RPC set_origin_acquisition_type definem inbound/outbound por origem, com override sobre a heurística no painel comercial
type: feature
---
- Tabela `public.lead_origin_classification (origin_key PK, origin_name, acquisition_type in ('inbound','outbound'), notes, updated_by, updated_at)`. Leitura para `authenticated`; escrita só admin (`has_role`).
- RPC `set_origin_acquisition_type(p_origin_key, p_type, p_origin_name)` — admin-only; `p_type` NULL/'' apaga a marcação e volta à detecção automática.
- `list_lead_origins()` devolve `acquisition_type` (manual > heurística) e `acquisition_source` ('manual'|'auto').
- `painel_origens_refresh` usa a marcação manual (match por `meta_form_id`, `platform_form_id`, `form_name` ou `origem_primeiro_contato`) antes da heurística "tem form/meta = Inbound".
- UI: aba **Origens** (Central de Campanhas) → card "Origens não associadas" tem coluna **Aquisição** com seletor Automático/Inbound/Outbound + filtro Inbound/Outbound.