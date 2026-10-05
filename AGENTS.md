# Architecture rules

- KOL referral forms use a presentation-only list group derived from canonical professional form references or the legacy referral name prefix; preserve stored purposes to avoid changing ingestion and CRM behavior.

- Public presencial enrollment uses a service-role-only transactional RPC locking the turma to choose confirmed enrollment or the existing waitlist; this prevents concurrent public signups from exceeding capacity.
- Waitlist WhatsApp delivery is shared server-side between public enrollment and the authenticated resend endpoint; public callers never receive permission to resend arbitrary entries.- Referral (KOL) forms with a fixed seller override the Vendas immutability rule: open Vendas deals of other sellers are moved to Estagnados and closed lost, after a new Vendas deal is created for the form seller; this guarantees referral attribution while CS and won deals stay untouched.
