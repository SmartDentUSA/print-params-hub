---
name: Copilot Timeline & Semantic Graph Access
description: Tools query_lead_timeline (timeline unificada de 8 fontes) e query_semantic_graph (Identity Graph + kg_entities/kg_relations) no smart-ops-copilot
type: feature
---
`smart-ops-copilot` tem duas tools de acesso total ao histórico do lead:

**query_lead_timeline** — resolve lead canônico (`lead_id` > `piperun_id` > `email` > `telefone`, sempre `merged_into IS NULL`) e mescla em ordem cronológica real 8 fontes: `lead_activity_log` (event_timestamp), `interactions` (occurred_at), `event_store` (occurred_at), `message_logs` (data_envio), `whatsapp_inbox` (created_at, por lead_id OR phone), `lead_page_views` (created_at), `lead_state_events` (**changed_at**, old_stage/new_stage), `agent_interactions` (created_at). Filtros: `sources`, `event_types`, `from`/`to`, `limit` (padrão 120, máx 400), `ascending`. Retorna `counts_por_fonte`, `total_eventos`, `truncado`, `primeiro/ultimo_evento`, `errors`.

**query_semantic_graph** — `mode=lead` (person via `lead_activity_log.person_id`, fallback `people` por piperun/email/telefone_normalized; + `identity_keys`, `companies`, `person_company_relationship`, contagem de `interactions`, resumo de `event_store` por event_type), `mode=entity` (kg_entities por nome/tipo + kg_relations), `mode=relations` (relações + vizinhos de uma entidade).

Cuidados de schema: `lia_attendances` NÃO tem coluna `telefone` (usar `telefone_raw`/`telefone_normalized`); `lead_state_events` usa `changed_at`; `agent_interactions` não tem `channel`/`intent_detected`; `message_logs` usa `mensagem_preview`/`tipo`/`data_envio`; `whatsapp_inbox` usa `message_text`.

Whitelist de `query_table` ampliada: event_store, interactions, people, companies, identity_keys, person_company_relationship, kg_entities, kg_relations, deals, deal_items.
