# Architecture rules

- Support customer context is read through a ticket-scoped edge function after session, support-role and ticket authorization; this exposes required customer details without widening commercial lead RLS.
- Support board customer summaries use the same ticket-authorized endpoint in bounded batches, counting complete ticket history and deriving queue priority from owned equipment rather than sales interest; this avoids per-card requests and commercial RLS changes.
- Support workspace theme tokens are scoped to its page and use an equal-width conversation/profile layout; this preserves unrelated admin styling.

- RMS payment presentation and metrics share product-family resolution; subscription fallback and invoice totals are scoped by family and lead to prevent exoplan/DentalCAD cross-attribution.

- KOL referral forms use a presentation-only list group derived from canonical professional form references or the legacy referral name prefix; preserve stored purposes to avoid changing ingestion and CRM behavior.

- Public presencial enrollment uses a service-role-only transactional RPC locking the turma to choose confirmed enrollment or the existing waitlist; this prevents concurrent public signups from exceeding capacity.
- Waitlist WhatsApp delivery is shared server-side between public enrollment and the authenticated resend endpoint; public callers never receive permission to resend arbitrary entries.- Referral (KOL) forms with a fixed seller override the Vendas immutability rule: open Vendas deals of other sellers are moved to Estagnados and closed lost, after a new Vendas deal is created for the form seller; this guarantees referral attribution while CS and won deals stay untouched.

- Form, KOL and campaign conversion count a lead once per form from the full submission history (plus CRM deals whose origin equals the form name, dated at deal creation) and credit only deals won after that submission, using closed_at or the last PipeRun update; this keeps conversion from depending on the lead's latest form or sync timing.
- The Rotinas automáticas screen reads scheduled jobs live through admin-only database functions, and the Copilot turns jobs on or off through the same functions; this keeps the list always matching the real scheduler.

- Email sequence automations (email_flows) run through one bounded, locked runner with per-enrollment idempotent progress and DB-trigger enrollment for system events; this keeps limits, priority and exit rules in one place.
- Email audience and content graphs are presentation layers over the existing rule definitions and content IDs; retain runner-compatible payloads and persist graph positions/selections without introducing executable node types.
- PipeRun deal value in `deals.value` is P&S plus MRR (both kept in `value_ps`/`value_mrr`); subscription-style sales booked only as MRR would otherwise count as zero revenue.
- PipeRun sync hydrates person contacts via a read-only persons/{id} GET, matches leads by phone when e-mail is missing, and keeps deals without contacts keyed by piperun_id; deals typed directly in PipeRun otherwise never reach the system.
- PipeRun person/company contacts are written and read only through the shared `piperunGet/Post/Put` helpers, which translate to `contact_emails`/`contact_phones`, request `with[]=contactEmails,contactPhones`, merge existing contacts on PUT and use `?email=`/`?phone=` list filters; the legacy `emails[]`/`phones[]` keys and filters are silently ignored by PipeRun and left persons without e-mail and caused duplicate persons.
- PipeRun sync hydrates company contacts separately and does not skip unchanged deals when missing contacts become available; company identifiers must never merge distinct people.
- Proposal item expansion failures never block saving the deal; one bad item used to hide every deal of the lead.
- Lead cards and timeline resolve capture event names through shared event/form references; timeline entries use their own references rather than the lead's latest event to avoid misattributing historical submissions.
- PipeRun deal sync writes `telefone_normalized` alongside `telefone_raw` using the shared Brazilian phone normalizer; lead cards, search and phone matching read only the normalized phone.

- Technical support access is checked in the database through `is_support_staff` (admin or support_agent roles in user_roles); support data stays isolated from commercial queues and campaigns.
- Support ticket lifecycle timestamps (assignment, resolution, closing, reopen count/FCR) are set by a validation trigger on technical_tickets so KPIs never depend on client code.

- LIA capture uses ingest-lead/HMAC, metrics and +E.164; ambiguity requires typed email with masked hints. Filter filled canonical answers server-side, including false/zero and resume. Handoff reads only matching published landing positioning/modules, excludes prices and module applications, then invites before seller; name ambiguity uses neutral wording. Server greeting uses São Paulo time to avoid visitor-clock drift.
