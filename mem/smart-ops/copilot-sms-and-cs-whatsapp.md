---
name: Copilot SMS + CS WhatsApp
description: Copilot envia WhatsApp pelo celular de membro com role (cs/vendedor) e SMS one-off via DisparoPro reusando campaign_sessions
type: feature
---
**send_whatsapp**: aceita `role` (ex: 'cs') além de `seller_name`. Quando só `role` é informado, pega 1º team_member ativo com esse role e `waleads_api_key` preenchido.

**send_sms** (novo): cria `campaign_sessions` (channel='sms', lead_ids=[lead], status='running', results={sms_message, sms_codificacao}) e invoca `smart-ops-sms-disparopro` com `{campaign_id, sms_message, sms_codificacao}`. Limites: 160 chars 7-bit ou 70 chars 8-bit. Token via `DISPARO_PRO_TOKEN` (consumido pela função existente).

**Trigger no prompt**: "manda SMS", "dispara SMS", "envia SMS para X".