---
name: Copilot Social Flows Tools
description: 6 tools no smart-ops-copilot para CRUD de social_flows (IG DM) via diálogo + 7 templates; canvas read-only
type: feature
---
`smart-ops-copilot` expõe 6 tools de Social Publisher: `list_social_flows`, `get_social_flow`, `create_social_flow`, `update_social_flow`, `toggle_social_flow`, `delete_social_flow`. Todas via service role.

`buildFlowFromTemplate(template, config)` monta `nodes/edges/trigger` no shape `{id, type:'default', data:{label, nodeType, config}}` (compatível com `SocialFlowEditor` e `flow-executor`). Templates: `comment_keyword_dm`, `welcome_new_follower`, `mention_reply`, `lead_capture_dm`, `ads_click_to_messenger`, `dra_lia_handoff`, `content_sequence`.

Regras (SYSTEM_PROMPT bloco "SOCIAL PUBLISHER — FLOWS IG DM"):
- Gatilhos: "automação", "flow", "IG DM", "social publisher", "quando comentarem", etc → chamar `list_social_flows` primeiro.
- Criar sempre com `is_active:false`; ativar só via `toggle_social_flow` após confirmação explícita.
- Excluir exige `confirmed:true` explícito do usuário.
- `comment_keyword_dm` depende de automação nativa Zernio — avisar usuário.
- Inferir intent quando usuário manda tudo em uma frase ("quando comentarem VITA responde X e DM Y").

`flow-executor` ganhou handler `dra_lia_chat`: conta sessões anteriores do `ig_user_id` e delega para EF `lia-instagram-responder` com `{ig_user_id, ig_username, is_follower, incoming_payload, context}`, marcando sessão `completed`. `collect_input` e `create_lead` já existiam.

`SocialFlowEditor`: canvas permanece read-only. Adicionado `new_follower` em TRIGGER_TYPES, `dra_lia_chat` em NODE_TYPES, e banner no painel lateral instruindo a editar via Copilot.