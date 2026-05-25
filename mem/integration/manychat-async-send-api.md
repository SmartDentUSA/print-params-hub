---
name: ManyChat Async Bridge + Send API
description: ManyChat External Request 10s timeout requires async pattern via Send API for dra-lia replies
type: feature
---

**Problema**: ManyChat External Request fecha conexão após ~10s. Bridge síncrona que chama `dra-lia` (RAG + LLM) excede esse limite e dispara o fallback do flow no ManyChat, mesmo quando a LIA gera resposta correta.

**Padrão obrigatório** em `supabase/functions/manychat-lia-bridge/index.ts`:

1. Bridge responde imediatamente `EMPTY_REPLY` (`{version:"v2",content:{messages:[]}}`) — flow do ManyChat fica passivo aguardando próxima mensagem.
2. `EdgeRuntime.waitUntil(processAsync(...))` roda em background:
   - `fetch` para `dra-lia` com Service Role, consome SSE inteiro.
   - POST para `https://api.manychat.com/fb/sending/sendContent` com `Authorization: Bearer ${MANYCHAT_API_KEY}`.
   - Payload: `{ subscriber_id, data:{version:"v2",content:{messages:[{type:"text",text}]}}, message_tag:"ACCOUNT_UPDATE" }`.
3. **Chunking** via `chunkText(text, 900)` — divide por `\n\n` → sentenças → corte hard como último recurso. Cada chunk vira uma mensagem separada.
4. **Logging** em `system_health_logs`: usa colunas `function_name`, `severity`, `error_type`, `details` (NÃO use `source/level/message/context` — falha silenciosamente).

**Short-circuits que ainda respondem inline** (não usam async, são <1s):
- Mensagem < 3 chars dentro de 20s (anti-loop)
- Só emoji/URL/pontuação
- Saudação curta de lead já identificado (`manychat_subscriber_id` presente em `lia_attendances`)

**Secret**: `MANYCHAT_API_KEY` deve ser o Public API Token do ManyChat (Settings → API → Your API Token), formato `numeric:hex`. Tokens de Apps ou Page Access Tokens do Facebook NÃO funcionam (retornam 401 "Wrong token").

**Validação**: `system_health_logs WHERE function_name='manychat-lia-bridge'` deve ter `error_type='manychat_send_ok'` após cada interação. `manychat_send_failed` com status 401 indica token errado.