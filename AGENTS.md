# Architecture rules

- Support context requires session, support-role and ticket authorization via an edge function; this exposes customer details without widening commercial RLS.
- Support board uses that endpoint in bounded batches for complete ticket counts and owned-equipment priority; this avoids per-card requests and RLS changes.
- Support uses scoped tokens and equal-width conversation/profile areas; preserves other admin styling.
- Bio cards pass hydrated form IDs to LIA, not labels; preserves attribution.

- RMS payment presentation and metrics share product-family resolution; subscription fallback and invoice totals are scoped by family and lead to prevent exoplan/DentalCAD cross-attribution.

- KOL referral forms use a presentation-only list group derived from canonical professional form references or the legacy referral name prefix; preserve stored purposes to avoid changing ingestion and CRM behavior.

- Public presencial enrollment uses a service-role-only transactional RPC locking the turma to choose confirmed enrollment or the existing waitlist; this prevents concurrent public signups from exceeding capacity.
- Waitlist WhatsApp delivery is shared server-side between public enrollment and the authenticated resend endpoint; public callers never receive permission to resend arbitrary entries.
- Referral (KOL) forms with a fixed seller override the Vendas immutability rule: open Vendas deals of other sellers are moved to Estagnados and closed lost, after a new Vendas deal is created for the form seller; this guarantees referral attribution while CS and won deals stay untouched.

- Form, KOL and campaign conversion count a lead once per form from the full submission history (plus CRM deals whose origin equals the form name, dated at deal creation) and credit only deals won after that submission, using closed_at or the last PipeRun update; this keeps conversion from depending on the lead's latest form or sync timing.
- Rotinas automáticas reads live jobs via admin-only DB functions; Copilot toggles jobs through those functions, keeping the list aligned with the scheduler.

- Email sequence automations (email_flows) run through one bounded, locked runner with per-enrollment idempotent progress and DB-trigger enrollment for system events; this keeps limits, priority and exit rules in one place.
- Email audience and content graphs are presentation layers over the existing rule definitions and content IDs; retain runner-compatible payloads and persist graph positions/selections without introducing executable node types.
- PipeRun deal value in `deals.value` is P&S plus MRR (both kept in `value_ps`/`value_mrr`); subscription-style sales booked only as MRR would otherwise count as zero revenue.
- Proposal item failures never block saving; avoids hidden deals.
- Event cards and timelines use immutable submission activity, not the latest lead event snapshot; repeat visitors count in every event and refresh CRM summaries without changing Deals.

- Technical support access is checked in the database through `is_support_staff` (admin or support_agent roles in user_roles); support data stays isolated from commercial queues and campaigns.
- Support ticket lifecycle timestamps (assignment, resolution, closing, reopen count/FCR) are set by a validation trigger on technical_tickets so KPIs never depend on client code.

- LIA keeps form order, conditions, canonical answers, HMAC, masked hints and timeline. Notes paginate under shared lock without changing deals. Grounded RAG/AI conversation runs separately during assignment; failure never blocks handoff; seller announcements stay factual.
- LIA context validates the form's success_redirect_url as a WhatsApp group; optional group CTA follows seller CTA without changing ingestion.
- Internal forms and LIA resolve interest from their catalog binding or selected product button so CRM uses exact product names; Meta ingestion stays unchanged.

- KOL card summaries use existing totals and profile validity; attribution stays unchanged.
- Public courses read professional profiles only through a restricted RPC limited to producers of public courses or approved Smart Dent recommendations; anonymous visitors never read the leads table directly.
- Imported Smart Dent trainings become editable professional_courses copies linked by source_smartops_course_id; public pages hide the synthetic entry once a copy exists, and professional public names live in prof_display_name so CRM sync cannot overwrite them.
- Waitlist cancel/promote run server-side in smartops-waitlist-manage; cancelling an enrollment notifies only the oldest not-yet-notified waitlist entry via the course CS instance, keeping vacancy messages single and auditable.
