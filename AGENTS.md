# Architecture rules

- KOL referral forms use a presentation-only list group derived from canonical professional form references or the legacy referral name prefix; preserve stored purposes to avoid changing ingestion and CRM behavior.

- Public presencial enrollment uses a service-role-only transactional RPC locking the turma to choose confirmed enrollment or the existing waitlist; this prevents concurrent public signups from exceeding capacity.
- Waitlist WhatsApp delivery is shared server-side between public enrollment and the authenticated resend endpoint; public callers never receive permission to resend arbitrary entries.