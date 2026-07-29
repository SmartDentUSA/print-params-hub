---
name: WhatsApp Conversation Capture
description: Captura periódica de todas as conversas Evolution das instâncias de team_members vendedor/cs/suporte para whatsapp_inbox
type: feature
---
**Função**: `smart-ops-wa-capture-conversations` (cron `wa-capture-conversations-15min`, */15 min, since_hours=6).

- Itera `team_members` ativos com `role in (vendedor, cs, suporte)` e `evolution_instance_name`; 1 execução por instância (dedupe por nome).
- Chama `POST /chat/findMessages/{instance}` com apikey per-instance; fallback para `EVO_KEY` global em 401/403.
- Grava em `whatsapp_inbox` com `instance_name`, `team_member_id`, `wa_message_id`, `is_group`, `sender_name`, `remote_jid`. Idempotência via índice único `(instance_name, wa_message_id)`.
- Grupos ignorados por padrão (`include_groups: true` para incluir). Status broadcast sempre ignorado.
- Vinculação a lead: telefone em dígitos vs `lia_attendances.telefone_normalized` (formato `+55...`), variantes +/55; LIDs (15+ dígitos) não são vinculados.
- UI: Ferramentas → WhatsApp tem filtro por instância + botão de sincronização manual.
