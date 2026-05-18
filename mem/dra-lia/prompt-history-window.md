---
name: DeepSeek/Gemini History Window
description: Janela do histórico enviado ao LLM é tunável via DRA_LIA_HISTORY_WINDOW (default 15); instrumentação de prompt_chars em system_health_logs
type: preference
---
**Constante**: `HISTORY_WINDOW` em `dra-lia/index.ts` lê `Deno.env.get("DRA_LIA_HISTORY_WINDOW")`, default 15.

**Aplicação**: `messagesForAI` usa `history.slice(-HISTORY_WINDOW)` ao invés do antigo `-8` fixo.

**Por que**: latência cresce O(n) com turnos. 15 mensagens (~7-8 turnos U/A) + system prompt + cognitive_summary como memória longa balanceia contexto vs velocidade.

**Instrumentação**: cada turno insere `system_health_logs(event_type='prompt_window')` com `messages_count`, `prompt_chars`, `history_window`, `history_in_count` para validar p50/p95.

**How to apply**: para tunar sem deploy, alterar a env `DRA_LIA_HISTORY_WINDOW` no Supabase. Subir/baixar gradualmente monitorando `prompt_chars`.
