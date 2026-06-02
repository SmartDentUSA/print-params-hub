## Alterações cirúrgicas em `smart-ops-lia-assign/index.ts`

### FIX 1 — Briefing ao vendedor (~linha 3129)
Substituir o bloco `triggerOutboundMessages` (WaLeads) por uma chamada `fetch` direta ao endpoint `smart-ops-lia-notify-seller`, passando `lead_id`, `team_member_id` e `trigger`. Skip quando `assignedTeamMemberId` é nulo ou `"fallback-admin"`. Log de status/body e catch não-fatal.

### FIX 2 — Dedup re-entrega Meta (dentro de `executarEnrichmentDealRoute`, antes do CASE B)
Inserir guard antes do loop `for (const deal of otherOpenDeals)`:
- Consultar `lead_activity_log` por `event_type IN ('deal_reativado_via_redelivery','deal_enriched_via_redelivery')` nas últimas 4h para o lead.
- Se existir: adicionar nota no deal existente via `addDealNote` e retornar `{ flow_type: "dedup_skipped", piperun_id, created_new: false, closed_deals: [], reason: "redelivery_within_4h" }` sem fechar outros funis nem criar novo deal.

### Deploy
Após aplicar os dois patches, rodar deploy de `smart-ops-lia-assign` e confirmar sucesso. Sem migrations, sem mudanças de schema, sem alterações em outras funções.

### Validação
- Verificar logs da função após deploy para confirmar boot limpo.
- Não há testes automatizados para esta rota; validação adicional depende da próxima re-entrega Meta real.
