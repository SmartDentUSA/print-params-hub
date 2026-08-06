---
name: Zernio Unified Inbox
description: Social Publisher aba Conversas lê DMs de todas as plataformas via edge function social-inbox (proxy Zernio /inbox/conversations)
type: feature
---
Aba `/social/conversas` (`SocialInbox.tsx` + `useZernioInbox.ts`) consome a edge function `social-inbox`,
proxy do Zernio Unified Inbox com `ZERNIO_API_KEY` (server-only):
- `action: conversations` → `GET /v1/inbox/conversations` (filtros platform/status/accountId/cursor, sortOrder desc)
- `action: messages` → `GET /v1/inbox/conversations/{id}/messages?accountId=...` (accountId é obrigatório)
- `action: send` → `POST /v1/inbox/conversations/{id}/messages`
- `action: mark_read` → `POST /v1/inbox/conversations/{id}/read`

Leitura é ao vivo (sem tabela espelho); polling 60s nas conversas e 30s nas mensagens.
Mensagens de template (IG) vêm com `message: ""` e o texto dentro de `attachments[].payload.generic.elements[0].title`.
