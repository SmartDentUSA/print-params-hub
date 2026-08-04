---
name: Email integrity guard (sem perder dados)
description: Trigger fn_sanitize_lead_email + _shared/email-sanitize.ts garantem email canônico único, secundários em email_secundarios e bruto inválido em email_invalido_raw
type: constraint
---
**Rule**: `lia_attendances.email` só aceita UM e-mail válido e não-placeholder.

- Trigger `trg_sanitize_lead_email` (BEFORE INSERT OR UPDATE OF email) chama `public.fn_sanitize_lead_email()` — vale para TODOS os writers (edge functions, imports, UI).
- Listas (`a@x.com, b@y.com`): 1º válido vira `email`, o resto entra em `email_secundarios text[]` (dedup).
- Valor sem e-mail aproveitável (domínio puro `live.com`, `e-mail não informado`, `@example.com`, `@test.com`, `@placeholder`, `@lid`, `@whatsapp.lead`): `email = NULL` e original preservado em `email_invalido_raw`. NUNCA descartar o bruto.
- Código: `supabase/functions/_shared/email-sanitize.ts` (`sanitizeEmailField`, `isRealEmail`) — usar em qualquer ingestão nova; `smart-ops-piperun-webhook` já usa e o cascade de identidade procura também por `email_secundarios`.

**Why**: e-mails compostos/placeholder vindos do PipeRun causavam 23505 (unique piperun_id/email), leads duplicados e skips silenciosos. Backfill 2026-08-04 corrigiu 146 leads (68 com e-mail secundário) sem perder nenhum valor original.