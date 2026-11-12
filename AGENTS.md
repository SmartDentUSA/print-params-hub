# Architecture rules

- Public distributor registration uses a shared presentation-only locale dictionary for fields, options and page messages; preserve canonical submitted values and keep the internal editor in Portuguese.
- Event distribution forms render the shared DistributorForm with an adapter to original field IDs and the existing ingest handler; preserve per-event URLs and distribution CRM routing instead of writing to the official distributor registry.
- Public distributor taxonomy groups commercial catalog rows by product family and uses localized display labels without numeric prefixes; retain original subcategory values and leave internal authorization editing unchanged.
- Distribution event URLs use name-derived slugs with a public active-form alias table; retain IDs and include aliases in historical visit metrics. Public country/count aggregates are served by a read-only edge endpoint over a service-only RPC, never by exposing lead rows.

- Panda video analytics use hourly bounded provider snapshots with a service-only lock and cursor; browser play events remain separate session-linked CRM activity. Match embeds by saved embed identity, because player UUIDs and Panda API UUIDs can differ; never attribute aggregate counts to individual leads.

- Form visit metrics normalize legacy/public host URLs and landing paths, and attendance views carry resolved form IDs with the shared page session; domain changes must not split form totals or reset historical conversion logic.

- Support context requires session, support-role and ticket authorization via an edge function; this exposes customer details without widening commercial RLS.
- Support board uses that endpoint in bounded batches for complete ticket counts and owned-equipment priority; this avoids per-card requests and RLS changes.
- Support uses scoped tokens and equal conversation/profile widths; preserves admin styling.
- Bio cards pass hydrated form IDs to LIA, not labels; preserves attribution.
- Bio analytics await lazy Supabase inserts through recordBioEvent; discarding an unconsumed query builder sends no request and silently loses visits/clicks.
- Bio page access totals read only canonical lead_page_views across hosts/query strings; Bio events supply clicks only, avoiding double-counted openings and fabricated per-card impressions.
- Resin cards use the intentionally public read-only kb_catalog_resin_colors RPC (ID/color only) and shared selectors; preserves variation RLS and family separation.

- RMS payment presentation and metrics share product-family resolution; subscription fallback and invoice totals are scoped by family and lead to prevent exoplan/DentalCAD cross-attribution.


- Public presencial enrollment uses a service-role-only transactional RPC locking the turma to choose confirmed enrollment or the existing waitlist; this prevents concurrent public signups from exceeding capacity.
- Waitlist WhatsApp delivery is shared server-side between public enrollment and the authenticated resend endpoint; public callers never receive permission to resend arbitrary entries.
- Referral (KOL) forms with a fixed seller override the Vendas immutability rule: open Vendas deals of other sellers are moved to Estagnados and closed lost, after a new Vendas deal is created for the form seller; this guarantees referral attribution while CS and won deals stay untouched.

- Form, KOL and campaign conversion count a lead once per form from the full submission history (plus CRM deals whose origin equals the form name, dated at deal creation) and credit only deals won after that submission, using closed_at or the last PipeRun update; this keeps conversion from depending on the lead's latest form or sync timing.
- Rotinas automáticas reads live jobs via admin-only DB functions; Copilot toggles jobs through those functions, keeping the list aligned with the scheduler.

- Email sequence automations (email_flows) run through one bounded, locked runner with per-enrollment idempotent progress and DB-trigger enrollment for system events; this keeps limits, priority and exit rules in one place.
- Email audience and content graphs are presentation layers over the existing rule definitions and content IDs; retain runner-compatible payloads and persist graph positions/selections without introducing executable node types.
- PipeRun deal value in `deals.value` is P&S plus MRR (both kept in `value_ps`/`value_mrr`); subscription-style sales booked only as MRR would otherwise count as zero revenue.
- A confirmed new conversion (conversion_key) on a lead whose open Vendas deals are all in Sem contato/C1/C2/C3/SDR creates a new Vendas deal with a drawn seller, then moves the old one to Estagnados stage 708585 and closes it lost "Converteu em outra campanha"; advanced stages, won and CS deals stay untouched so early leads are not stuck under the Golden Rule. Every new Meta leadgen_id (even same form) is a new conversion (`meta:leadgen:<id>`); only the same leadgen_id redelivered is ignored, preventing duplicate deals. System form submissions likewise each carry a unique submission_id (fallback: form+identity per 10-min window) so every resubmission counts.
- Proposal item failures never block saving; avoids hidden deals.
- Event cards and timelines use immutable submission activity, not the latest lead event snapshot; repeat visitors count in every event and refresh CRM summaries without changing Deals.

- Technical support access is checked in the database through `is_support_staff` (admin or support_agent roles in user_roles); support data stays isolated from commercial queues and campaigns.
- Support ticket lifecycle timestamps (assignment, resolution, closing, reopen count/FCR) are set by a validation trigger on technical_tickets so KPIs never depend on client code.

- LIA keeps form order, conditions, canonical answers, HMAC, masked hints and timeline. Notes paginate under shared lock without changing deals. Grounded RAG/AI conversation runs separately during assignment; failure never blocks handoff; seller announcements stay factual.
- LIA context validates the form's success_redirect_url as a WhatsApp group; optional group CTA follows seller CTA without changing ingestion.
- Internal forms and LIA resolve interest from their catalog binding or selected product button so CRM uses exact product names; Meta ingestion stays unchanged.

- Public courses read professional profiles only through a restricted RPC limited to producers of public courses or approved Smart Dent recommendations; anonymous visitors never read the leads table directly.
- Imported Smart Dent trainings become editable professional_courses copies linked by source_smartops_course_id; public pages hide the synthetic entry once a copy exists, and professional public names live in prof_display_name so CRM sync cannot overwrite them.
- Waitlist cancel/promote run server-side in smartops-waitlist-manage; cancelling an enrollment notifies only the oldest not-yet-notified waitlist entry via the course CS instance, keeping vacancy messages single and auditable.
- Subdirectories may have their own AGENTS.md; read it before changing files there (src/components/smartops/AGENTS.md, src/components/smartops/courses/AGENTS.md).
- Páginas públicas abertas pelo endereço admin redirecionam para o www (link único para SEO); ferramentas internas ficam no admin.
- Assets da CDN da Lovable (`/__l5e/...`) não são servidos no domínio www; todo uso em página pública passa por `resolveAssetUrl` (src/utils/assetUrl.ts), que aponta para o admin quando o host não é Lovable.
- KOL rules live in src/components/smartops/courses/AGENTS.md.
- KOL card referral revenue and commissions filter the same exact normalized form origins as portal performance before aggregating; generic KOL origins cannot identify the referring professional.
- Zernio empty keywords require a platform post ID; prevents account-wide replies.
- Capture conversations share isolated semantic chat tokens and a visual-viewport-sized container; landing and bio openings use AttendanceDialog with an edge-to-edge mobile visual viewport so outer dialogs never constrain the chat, without changing ingestion or CRM behavior.
- Capture opening media reads only the published landing hero by the resolved form ID and classifies image, native video or player in a presentation-only helper; missing media never blocks qualification or changes CRM context.
- Distribution forms (form_purpose `distribuicao`) are cloned per event from the `distribuicao-cadastro` template by a DB trigger and routed by ingest to `distribuicao-crm-sync` (Exportação pipeline, distribution owner) instead of lia-assign; this keeps distributor leads out of the Vendas Golden Rule.
- Phone login (`client-access-login`) and Agenda team checks (`crm-insercao`) recognize active team members through `_shared/team-phone-match.ts`: any registered phone (WhatsApp, Evolution, notification), DDD + last 8 digits, with or without 55/9th digit; login stores `team_member_id` and only gates team presentation/actions, never staff data. One rule keeps login and every Agenda function in agreement.
- Cron job 162 (painel-comercial-refresh) runs at "2,32 * * * *" (every 30 min, minute :2 offset), reduced from every 5 min on 2026-11-04 after the refresh (avg 54s under REPEATABLE READ) was linked to a full DB outage; keep the :2 offset to avoid PipeRun sync collisions and never return to sub-15-min cadence without fixing the refresh cost first.
- New SDR and WhatsApp-group access forms are created by `fn_create_form_standard_flow`, cloning the exocad DentalCad RMS question flow with remapped condition IDs; group forms stay `sdr_captacao` (name prefix `# - GRUPO WHATSAPP -`) so CRM routing and simulators are unchanged.
- Commercial campaign forms are `sdr_captacao` forms named `# - CAMPANHA COMERCIAL -` (same standard flow); lia-capture asks the form's capture buttons after identity and before ingest, validates the choice server-side, sends it as the CRM product of interest with the exact form name as origin, and auto-opens the success_redirect_url group; keeps campaign CRM routing identical to SDR forms.
- "Inserção CRM" (Agenda, team only) runs through `crm-insercao`, which resolves the Team Member from the auth session server-side, blocks and e-mails when another seller owns an open Vendas deal, and otherwise ingests via `smart-ops-ingest-lead` with an inactive `insercao_crm` system form per INDICALEADKOL/PROSPLEADKOL origin whose fixed seller is the KOL contract seller and which is appended to the KOL prof_kol_form_ids (inactive, so never shown as a public link) and logged on both lead and KOL timelines; this reuses the Golden Rule path and existing commission/performance attribution instead of a parallel calculation.
- Copilot (`smart-ops-copilot`) requires a session that passes `fn_can_use_copilot` (admin or active marketing team member by verified e-mail); guided creation tools only prepare a `copilot_pending_actions` row and the UI Confirmar button executes it in a separate LLM-free request with an atomic claim, so the model can never write or claim a write by itself. Writes keep each screen's own permission rule (promotional tables admin-only).
- Copilot step-by-step wizards (`src/lib/copilotWizard.ts` + one script per screen) ask one field at a time in the screen's own order without the LLM and submit through `wizard_submit`, which re-runs server validation (same permission as the screen), records a `copilot_pending_actions` row and executes it in the same request; choosing a screen in the menu only asks "O que você quer fazer?" locally, and the typed request goes through `detectWizardIntent(text, section)` before the LLM; this keeps answers deterministic and every write server-validated.
- Social Publisher Copilot wizards reuse the screens' shared helpers (`src/lib/social/bulkPlan.ts`, `channelFormats.ts`, `liveTemplates.ts`, `src/components/social/socialMenu.ts`); AI captions run in the browser before review because bulk generation would exceed edge time, and the server only re-validates (`smart-ops-copilot/social.ts`) and inserts through `copilot_pending_actions`; screen and Copilot posts stay identical.
- Promotional table price-list rules live in src/components/admin/catalog/AGENTS.md.
- Copilot's button menu reads the admin sidebar from `src/components/admin/systemMenu.ts` plus a subtab catalog; the chosen screen reaches the edge as sanitized prompt context only and grants no permission, so the sidebar and Copilot never diverge and tools keep server-side checks.
