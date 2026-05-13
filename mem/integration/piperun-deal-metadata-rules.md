---
name: PipeRun Deal Metadata Rules
description: Deal Title = clean person name. Origin = exact form name. Loja Integrada quote form normalized.
type: feature
---

- Deal Title = clean Person name (no date prefixes, no "Zapier", no "Plug & Play").
- Deal Origin = exact `form_name` string (created/reused via `resolveOriginId` cache).
- Deal Campaign = `origem_campanha` / `utm_campaign`.

**Loja Integrada quote form (2026-05-13):**
- Front-end posts `form_name="produto_sob_consulta"` with `produto_nome`/`produto_sku`/`page_title` in payload.
- `smart-ops-ingest-lead` normalizes to:
  - `form_name = "# - Orçamento e-commerce"` (PipeRun Origin label)
  - `origem_campanha` = `utm_campaign` = `"# - Orgânico e-commerce"`
  - `produto_interesse` = `produto_nome` || `produto_sku` || `page_title`
- `force_new_deal=true` continues to fire on this form (each quote = distinct opportunity).
