---
name: ManyChat canonical merge on identifier collision
description: Bridge ManyChat funde a duplicata no lead canônico quando email/telefone coletado já existe no CDP, preservando histórico PipeRun
type: feature
---
Quando o usuário responde com e-mail ou telefone no Instagram via ManyChat, o `manychat-lia-bridge` precisa fundir a duplicata recém-criada (pela busca por `manychat_subscriber_id`) no lead canônico existente sempre que esse identificador já pertença a outra linha em `lia_attendances` (merged_into IS NULL).

- Helper `mergeIntoCanonical(supabase, duplicate, matchedBy, value)` faz: Smart Merge append-only no canônico (só preenche campos NULL), marca a duplicata com `merged_into=canonical.id` e zera o `manychat_subscriber_id` da duplicata para liberar o índice único.
- Email: dispara após `lia_attendances_email_ci_key` no UPDATE.
- Telefone: dispara proativamente (SELECT canonical owner antes do UPDATE) e também no fallback de erro de unique.
- Após merge, o bridge continua o fluxo (próximas perguntas + handoff) usando o lead canônico — `lia_attendance_id` enviado ao `smart-ops-ingest-lead` aponta para o canônico, evitando duplicar Person/Deal no PipeRun.
- Log: `manychat_merged_into_canonical` em `system_health_logs` com `from_lead_id`, `to_lead_id`, `matched_by`, `subscriber_id`.