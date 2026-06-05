# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required reading before changes

Before any task touching the commercial/CRM domain, read these in order:

1. `docs/SKILL_SMARTDENT_REVENUE_OS.md` — condensed project context: stack, current DB schema (tables, new columns, triggers), relevant frontend components, critical business rules (Golden Rule, Smart Merge), pending tasks by priority, and **what NOT to change**.
2. `docs/AUDITORIA_WORKFLOW_FORMULARIOS_CRM.md` — full, authoritative system documentation. **Always read before implementing anything related to the Workflow 7×3, forms, or lead ingestion.**

The `docs/` folder holds many large audit/spec documents (`AUDITORIA_*`, `REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md`, `SYSTEM_DESCRIPTION.md`, `AI_*.md`). Treat them as the source of truth over inference — the codebase is large and evolves fast.

Project language is Brazilian Portuguese (domain terms, UI strings, docs, and most identifiers). Match it.

## What this project is

**Sistema B** (`print-params-hub`) — the commercial-intelligence hub of **SmartDent 3D**, a Brazilian digital-dentistry / 3D-printing company. Production: https://parametros.smartdent.com.br (also `print-params-hub.lovable.app`).

It is both a public-facing multilingual SEO site (3D-print parameter pages, knowledge base, RAG chatbot "Dra. L.I.A.") **and** an internal Revenue Intelligence OS (lead CDP, CRM sync, form builder, WhatsApp, social publisher) gated behind `/admin`.

**Sistema A** is a separate marketing/content platform (different repo, ~91 edge functions). Not in this repo — do not touch.

## Commands

This is a **Lovable**-managed project (edits in Lovable auto-commit here, and pushes here reflect back). Package manager is interchangeable — both `bun.lockb` and `package-lock.json` are committed; `bun` is the lockfile of record.

```sh
bun install          # or: npm i
bun run dev          # Vite dev server on http://localhost:8080
bun run build        # production build (vite build)
bun run build:dev    # build with development mode (source-mapped, componentTagger)
bun run lint         # eslint . — the only automated check in this repo
bun run preview      # serve the production build
```

There is **no test runner / test suite** configured. `lint` is the only gate. There is no single-test command.

## Architecture

### Frontend — Vite + React 18 + TypeScript SPA
- **Routing**: `src/App.tsx` is the single route table (`react-router-dom` v6). Routes cover: parameter pages (`/:brandSlug/:modelSlug/:resinSlug` → `Index`), the trilingual knowledge base (`/base-conhecimento`, `/en/knowledge-base`, `/es/base-conocimiento`), public forms (`/f/:slug` → `PublicFormPage`), the L.I.A. iframe embed (`/embed/dra-lia`), the Social Publisher (`/social/*`), and the admin hub (`/admin`).
- **Path alias**: `@/` → `src/` (configured in `vite.config.ts` and `tsconfig`). Always import via `@/...`.
- **UI**: shadcn/ui components live in `src/components/ui/` (Radix primitives + CVA). Styling is Tailwind utility classes (`tailwind.config.ts`, `src/index.css`). Toasts via `useToast()` (`@/hooks/use-toast`) and `sonner`. Config in `components.json`.
- **State / data fetching**: `@tanstack/react-query`; cross-cutting state in `src/contexts/` (`DataContext`, `LanguageContext`). Domain logic is concentrated in `src/hooks/use*.ts` (e.g. `useSupabaseCRUD`, `useKnowledgeSearch`, `useDealSearch`) and pure helpers in `src/lib/` and `src/utils/`.
- **SEO**: `react-helmet-async` with per-page `*SEOHead.tsx` components emitting Schema.org `@graph`. Bot/crawler requests are rewritten server-side to a Supabase `seo-proxy` edge function (see `vercel.json`) for prerendered HTML — the SPA itself is not what crawlers see.

### Backend — Supabase (project ref `okeogjgqijbfkudfjadz`)
- **Client**: `src/integrations/supabase/client.ts` exports the singleton `supabase`. Import it directly: `import { supabase } from "@/integrations/supabase/client"`.
- **Generated types**: `src/integrations/supabase/types.ts` is **auto-generated — do not edit by hand**. Regenerate from the schema rather than patching.
- **Edge Functions**: `supabase/functions/` holds 160+ Deno + TypeScript functions. Shared logic lives in `supabase/functions/_shared/` (e.g. `lead-enrichment.ts`, `piperun-*`, `lia-rag.ts`, `ai-router.ts`). Each function needs CORS headers. JWT verification is per-function in `supabase/config.toml` (`verify_jwt = false` for public webhooks).
- **Migrations**: `supabase/migrations/` (380+ files), append-only — never edit a past migration; add a new one.

### Hosting — Vercel
`vercel.json` is the routing/SEO control plane: SPA fallback to `/index.html`, redirects, crawler→`seo-proxy` rewrites, and `sitemap*.xml` / `llms*.txt` / `/docs/*` rewrites to Supabase edge functions. `api/` holds two small Vercel serverless endpoints (`middleware-bot.ts`, `video-sitemap.ts`).

### The admin hub
`/admin` → `src/pages/AdminViewSecure.tsx` is auth-gated (Supabase auth, role `admin`/`author`/`user`) and composes the whole internal OS by importing the many `Admin*` and `SmartOps*` components from `src/components/`. The `SmartOps*` components are the Revenue Intelligence OS surface; `src/components/smartops/`, `src/components/leads/`, and `src/components/social/` hold their sub-pieces.

## Revenue Intelligence OS — domain model (actively developed)

The commercial core is a **Workflow Portfolio 7×3**: each lead's journey is mapped across 7 stages × subcategories × layers, stored as `portfolio_json` (JSONB) on `lia_attendances` (the central lead/CDP table). Forms feed it via `smartops_form_field_responses`, whose `AFTER INSERT` trigger (`trg_portfolio_cell_on_response` → `fn_portfolio_cell_update`) does a surgical `jsonb_set` into the portfolio. Read leads through the `v_workflow_portfolio` view (filters `merged_into IS NULL`), not raw table scans.

Lead ingestion entry point: edge function `smart-ops-ingest-lead` (detects source → extracts fields → safety filters → Smart Merge or insert → fire-and-forget CRM/AI/marketing hooks).

The skill doc has the exact column lists, the 25 `workflow_stage_target` cell codes, the `workflow_cell_target` format (`etapa_X_nome.subcategoria`), and layer priority. **Consult it rather than guessing field names.**

## Critical business rules (do not violate)

- **Golden Rule**: if an open deal exists in the PipeRun **sales** pipeline, never overwrite its `owner_id` or `stage_id`.
- **Smart Merge** (`_shared/lead-enrichment.ts`): field-level merge strategy — `PROTECTED` (never overwrite: email, piperun_id, id…), `ALWAYS_UPDATE` (last wins: utm_*…), `MERGE_ARRAYS` (append+dedup), `MERGE_JSONB` (deep merge), and `ENRICHMENT_ONLY` (default — fill only if null).
- **portfolio_json writes**: empty cell → write; existing → COALESCE (fill only if null); competitor brand → layer `conc`; SmartDent product → layer `ativo` (highest priority).

## External integrations

PipeRun (primary CRM: Pessoa→Empresa→Deal), SellFlux (marketing automation), WhatsApp/WaLeads, Meta Ads (lead webhook), Loja Integrada (e-commerce webhooks), Supabase Storage (`catalog-images` bucket). AI: Google Gemini (RAG embeddings) + Lovable AI Gateway (LLM streaming); DeepSeek for cognitive lead analysis.

## Conventions

- TypeScript throughout; note `@typescript-eslint/no-unused-vars` is **off** in `eslint.config.js`, so unused vars won't fail lint — don't rely on it to catch dead code.
- Error handling: user-visible failures → `console.error` + toast; non-blocking failures → `try/catch` with `console.error` only.
- Edge functions: Deno + TS, CORS headers mandatory, share code via `_shared/`.

## Do not change without an explicit request

- `LeadDetailPanel.tsx`
- `lead_activity_log` schema
- Existing PipeRun / SellFlux / Meta Ads integration behavior
- RLS policies on existing tables
- `src/integrations/supabase/types.ts` (generated)
- Past migrations (add new ones instead)
- Anything attributed to Sistema A
