# KOL rules

- Public KOL agenda exposes only `prof_public_slug`, rate-limits phone checks in `kol_portal_attempts`, and staff-only create fills empty fields with before/after logged; keeps internal ids private.
- `fn_kol_log` updates before inserting because the activity-log dedupe trigger silently drops repeats.
- KOL commissions are copied from the default template into prof_kol_commissions by a DB trigger when a lead becomes KOL; contract, ledger, portal and coupons read only that copy so later default changes never alter existing KOLs.
- KOL commission rules carry a channel (indicacao, cupom, formulario; missing = cupom) and match sales only within their channel, falling back to channel-less legacy rules; keeps old KOLs computing while channels stay separate.
