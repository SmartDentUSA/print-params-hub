
## Escopo (revisado)
Mexer **somente no legado WaLeads + SellFlux**. Tudo que já usa Evolution / EvolutionGo (envio, webhook, health-check, `evolution_*` em `team_members`, `wa-broadcast-dispatch`, `smart-ops-evolution-*`, `dra-lia-whatsapp` via Evolution, notify-seller via Evolution) permanece intocado.

Sem banners, sem labels "Legado", sem avisos na UI.

## Estado verificado agora
- `wa_campaigns`: 3 registros ativos → serão desabilitados.
- `wa_message_queue`: 13 pendentes → serão pausadas.
- `whatsapp_send_queue`: já vazia e sem consumidor → apenas parar de escrever.
- `smart-ops-send-waleads`: função ativa apontando para `waleads.roote.com.br` + SellFlux webhook.
- Segredos: `SELLFLUX_WEBHOOK_CAMPANHAS`, `SELLFLUX_WEBHOOK_LEADS` (após 7 dias de logs limpos, remover).
- `useEnrollment.ts` ainda dispara tag SellFlux na matrícula.
- `team_members` continua com `waleads_api_key` / `waleads_*` — colunas ficam, uso cessa.

## Regra única do turno
Nenhum código, cron, worker ou UI relacionado a **Evolution** é alterado. Se um arquivo mistura Evolution e WaLeads, só o ramo WaLeads é neutralizado.

## Fases

### Fase 0 — Congelamento (SQL)
1. `UPDATE wa_campaigns SET status='disabled' WHERE status IN ('active','running','scheduled')`.
2. `ALTER TABLE wa_message_queue ADD COLUMN IF NOT EXISTS paused_at timestamptz`; marcar as 13 pendentes com `paused_at=now()`.
3. Nenhuma mudança em `team_members` (sem coluna nova). Evolution já tem seu próprio status.

### Fase 1 — Neutralizar workers/funções WaLeads (sem tocar Evolution)
1. `smart-ops-send-waleads`: passa a retornar `410 {status:"disabled"}` sem chamar WaLeads nem SellFlux. Callers continuam funcionando (recebem erro silencioso, logado em `message_logs` como `skip`).
2. Worker da `wa_message_queue` (se houver cron): filtro `paused_at IS NULL` — como todas as linhas pendentes estão pausadas, drena zero. Novo INSERT no futuro só volta a rodar se alguém remover `paused_at` manualmente (fora deste turno).
3. `whatsapp_send_queue`: remover apenas o INSERT do call-site (produtor). Consumer permanece inerte.
4. `useEnrollment.ts`: bloco SellFlux vira no-op silencioso (early return antes do fetch).
5. Webhooks SellFlux (`smart-ops-sellflux-webhook`, `smart-ops-sellflux-sync`, se existirem): passam a retornar `410`.

Nada em `_shared/waleads-messaging.ts` mais complexo do que virar no-op — **não** vou transformar em adaptador Evolution (para não arriscar tocar em fluxos Evolution).

### Fase 2 — UI (silenciosa)
1. `SmartOpsCampaigns` (dropdown de canal): remover `sellflux` e `waleads` das opções, sem banner. Envio via Evolution/Gmail (que já existe) permanece.
2. Botões/links diretos que chamam `smart-ops-send-waleads` (se houver na UI) são desabilitados silenciosamente ou apontados para o fluxo Evolution já existente.
3. Histórico de campanhas continua exibindo registros antigos com `channel='sellflux'|'waleads'` normalmente.

### Fase 3 — Descomissionamento (só depois de 7 dias sem tráfego)
1. `delete_secret` em `SELLFLUX_WEBHOOK_LEADS` e `SELLFLUX_WEBHOOK_CAMPANHAS`.
2. Deletar `smart-ops-send-waleads`, `smart-ops-sellflux-*` e imports órfãos de `_shared/sellflux-field-map.ts`.

## O que **NÃO** vou tocar
- `supabase/functions/wa-broadcast-dispatch/*` (usa Evolution).
- `supabase/functions/smart-ops-evolution-*` (todas).
- `dra-lia-whatsapp` e qualquer envio que já esteja passando pela Evolution.
- Colunas `evolution_*` em `team_members`.
- `lia_automations` — permanecem como estão.
- Card do team_member: **não** adiciono toggle novo nem badge de status Evolution neste turno.
- Não crio guard universal `canDispatchWhatsApp`, não crio health-check, não crio coluna `automation_whatsapp_enabled`.

## Riscos
| Risco | Mitigação |
|---|---|
| Alguma função Evolution importar de `_shared/waleads-messaging.ts` | Antes de alterar o shared, `rg` por importadores; se algum consumer Evolution aparecer, deixo o shared intocado e neutralizo só nos call-sites WaLeads. |
| Reprocessar as 13 mensagens paradas por engano | `paused_at` bloqueia; nenhum código vai remover automaticamente. |
| SellFlux 410 quebrar UI antiga | Callers já tratam erro; `message_logs` registra como `skip`. |

## Verificação
- `wa_campaigns` status = disabled (0 ativos).
- `wa_message_queue` pendentes com `paused_at IS NOT NULL`.
- Zero novos INSERTs em `campaign_send_log` com `channel IN ('sellflux','waleads')`.
- `message_logs` mostra `tipo LIKE 'waleads_%'` com `status='erro'`/`skip` e nenhum sucesso.
- Nenhum log novo em funções Evolution (fluxo Evolution inalterado).

## Confirmações antes de executar
1. Ok deletar as opções `sellflux`/`waleads` do dropdown de canal em Campaigns sem qualquer aviso na UI?
2. Ok as 13 mensagens pendentes em `wa_message_queue` ficarem paradas indefinidamente (sem reprocessar via Evolution neste turno)?
3. Confirma que `smart-ops-send-waleads` pode retornar 410 imediatamente (nenhum fluxo Evolution depende dele)?
