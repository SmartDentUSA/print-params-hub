---
name: WaLeads descomissionado
description: WaLeads removido do sistema; envio WhatsApp 100% Evolution via smart-ops-wa-send; gatilho de voz SDR removido
type: constraint
---
WaLeads está descontinuado. Proibido reintroduzir referências (código, UI, colunas, endpoints waleads.roote.com.br).

- Envio de WhatsApp: `smart-ops-wa-send` (antes `smart-ops-send-waleads`) + `_shared/wa-messaging.ts` (antes `waleads-messaging.ts`), sempre via Evolution.
- Colunas renomeadas: `cs_automation_rules.wa_ativo/wa_tipo/mensagem_wa/wa_media_url/wa_media_caption`, `ltv_reactivation_rules.wa_message`, `campaign_send_log.wa_message_id`, `lia_attendances.last_wa_instance`. Colunas `team_members.waleads_*` removidas.
- Componentes UI: `MessageVariableBar`, `MessageMediaPreview`.
- `fn_enqueue_whatsapp` default provider = `evolution`.
- Gatilho de voz do SDR (`trg_sdr_voice_on_seller_assign` / `fn_trigger_sdr_voice_on_assign`) removido: automações são configuradas somente no painel Automações.
