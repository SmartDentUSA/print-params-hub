# Architecture rules

- RMS payment presentation and metrics share product-family resolution; subscription fallback and invoice totals are scoped by family and lead to prevent exoplan/DentalCAD cross-attribution.

- KOL referral forms use a presentation-only list group derived from canonical professional form references or the legacy referral name prefix; preserve stored purposes to avoid changing ingestion and CRM behavior.

- Public presencial enrollment uses a service-role-only transactional RPC locking the turma to choose confirmed enrollment or the existing waitlist; this prevents concurrent public signups from exceeding capacity.
- Waitlist WhatsApp delivery is shared server-side between public enrollment and the authenticated resend endpoint; public callers never receive permission to resend arbitrary entries.- Referral (KOL) forms with a fixed seller override the Vendas immutability rule: open Vendas deals of other sellers are moved to Estagnados and closed lost, after a new Vendas deal is created for the form seller; this guarantees referral attribution while CS and won deals stay untouched.

- Form, KOL and campaign conversion count a lead once per form from the full submission history and credit only deals won after that submission, using closed_at or the last PipeRun update; this keeps conversion from depending on the lead's latest form or sync timing.
- The Rotinas automáticas screen reads scheduled jobs live through admin-only database functions, and the Copilot turns jobs on or off through the same functions; this keeps the list always matching the real scheduler.

- Email sequence automations (email_flows) run through one bounded, locked runner with per-enrollment idempotent progress and DB-trigger enrollment for system events; this keeps limits, priority and exit rules in one place.
- Email audience and content graphs are presentation layers over the existing rule definitions and content IDs; retain runner-compatible payloads and persist graph positions/selections without introducing executable node types.
