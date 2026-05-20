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

**Form Submission = New Deal (2026-05-20):**
- Toda submissão de qualquer formulário ativo com `form_name` não-vazio dispara `force_new_deal=true` no `smart-ops-lia-assign`.
- Person/Company são reutilizadas (mesmo `pessoa_piperun_id`); Deals anteriores (aberto em Vendas, Estagnado, ou perdido) permanecem intocados.
- Cada submissão = nova oportunidade em Funil de Vendas, com `origin_name = form_name` distinguindo a campanha de origem.
- Owner segue round-robin do Deal novo (não herda do Deal antigo).
