# KOL rules

- Public KOL agenda exposes only `prof_public_slug`, rate-limits phone checks in `kol_portal_attempts`, and staff-only create fills empty fields with before/after logged; keeps internal ids private.
- `fn_kol_log` updates before inserting because the activity-log dedupe trigger silently drops repeats.
- KOL commissions are copied from the default template into prof_kol_commissions by a DB trigger when a lead becomes KOL; contract, ledger, portal and coupons read only that copy so later default changes never alter existing KOLs.
- KOL commission rules carry a channel (indicacao, cupom, formulario; missing = cupom) and match sales only within their channel, falling back to channel-less legacy rules; keeps old KOLs computing while channels stay separate.
- KOL contracts: legal text lives only in kol_contract_templates (versioned); kol-contract (staff, admin-only) renders drafts via _shared/kol-contract-render.ts and sends the portal link; kol-portal (public, token via professional_portal_tokens) gates commissions/equipment until status 'assinado' and records SHA-256 hash, IP, UA and phone last10 on accept. WA group is auto-created on accept from wa_instance_name + wa_group_members; failures land in wa_group_error, never blocking the accept.
- KOL group fixed members and dry-run live in kol_program_settings (read by kol-portal); test contracts (is_test) never create real groups. Test leads/contracts carry is_test=true and are excluded from lists, counts and commission ledgers.
- Contract acceptance is refused server-side without seller_team_member_id or at least one referral form/coupon, logged as kol_contract_accept_blocked.
- KOL Transparency Portal (/portal-kol, edge kol-transparency): phone-only login creates kol_access_sessions; every read uses the session lead, never request ids; acceptance logic is shared via _shared/kol-accept.ts with kol-portal.
- Internal KOL ops (contest answers, portal unblock, new-device alert test) run in kol-staff-ops gated by fn_is_internal_staff; answering logs kol_contest_answered and notifies the contract seller.
- Commission ledger and any KOL report must read v_kol_contracts_reportable / v_kol_leads_reportable (is_test excluded at DB level), never raw tables.
- KOL event invites/slots (kol_event_invites, kol_event_slots) change only via fn_kol_invite/_respond/_schedule_slot/_cancel_slot/_mark_done, which enforce signed non-revoked contract, test-mode match and accepted invite; hours always come from fn_kol_slot_hours so timeline, portal JSON and v_kol_event_hours agree.

- Public KOL agenda exposes only `prof_public_slug`, rate-limits phone checks in `kol_portal_attempts`, and staff-only create fills empty fields with before/after logged; keeps internal ids private.
- `fn_kol_log` updates before inserting because the activity-log dedupe trigger silently drops repeats.
