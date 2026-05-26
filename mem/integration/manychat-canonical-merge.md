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

## Pre-handoff merge + synthetic-email strip (v2)

Bug histórico: o merge canônico só rodava nos ramos `nextMissing === "email" | "phone"` (durante a coleta). Quando o telefone já vinha pré-preenchido pelo perfil do ManyChat — ou quando o usuário pulava a pergunta de telefone — o bridge entregava o handoff sem nunca tentar fundir, criando 1 lead órfão Instagram por subscriber.

Garantias adicionadas (sempre antes do dispatch ao `smart-ops-ingest-lead`):

1. **Pre-handoff phone merge**: se `lead.telefone_normalized` casar com outro lead canônico (`merged_into IS NULL`, `id != lead.id`), `mergeIntoCanonical(supabase, lead, "phone", phone)` é executado incondicionalmente. Em caso de erro, loga `manychat_prehandoff_merge_failed` e segue.
2. **Synthetic email strip**: `email` no payload de handoff vira `null` se `!hasRealEmail(emailAtual)` (`@instagram.lead` ou `@manychat.internal`). Sem isso, `smart-ops-ingest-lead` tentava criar `Person` no PipeRun com o e-mail sintético e/ou disparava `lia_attendances_email_ci_key` no insert duplicado → handoff 500 → nada chegava ao CRM.
3. **Unblock CRM**: `crm_creation_blocked=false` no canônico final assim que houver telefone OU e-mail real (telefone basta como identifier — ver `mem://architecture/empty-person-piperun-guard`).

## ingest-lead: `lia_attendance_id` como chave de identidade fallback

`smart-ops-ingest-lead` antes recusava `payload.email` vazio com `400 "Email obrigatório"`, abortando todo handoff sem e-mail real. Agora: se `email` for vazio e `payload.lia_attendance_id` estiver presente, resolve o canônico (segue `merged_into` até 5 hops) e usa o e-mail do canônico (sintético ou real) como chave do resto do pipeline. O lookup-by-email subsequente encontra o canônico direto e segue o caminho de "lead existente" (PipeRun Person/Deal update, owner assignment).