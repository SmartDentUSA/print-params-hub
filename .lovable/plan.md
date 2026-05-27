## Escopo

Redistribuir os **8 deals abertos do Danilo Pereira no Funil de Vendas** (pipeline_id `18784`) e movê-los para a etapa **"Sem contato"** (`stage_id 379940`). Demais funis (Estagnados, Distribuidor, sem pipeline) ficam fora deste lote.

### Deals afetados

| piperun_deal_id | Etapa atual | Lead |
|---|---|---|
| 59276187 | Etapa 03 - Reativação | 9ba6a87c… |
| 59276212 | Etapa 03 - Reativação | 9ba6a87c… |
| 59276201 | Etapa 02 - Reativação | 9ba6a87c… |
| 59265516 | Etapa 03 - Reativação | 58cdeb60… |
| 58448694 | Etapa 02 - Reativação | f6ea00a8… |
| 58233486 | Etapa 02 - Reativação | 68c3e0f3… |
| 58240759 | Etapa 02 - Reativação | 082f59a2… |
| 58449131 | Etapa 02 - Reativação | 9bb9a979… |

Obs.: 3 deals pertencem ao mesmo lead (`9ba6a87c…`) — todos serão tratados individualmente.

## Implementação

### Edge function one-off: `smart-ops-reassign-danilo-vendas`

Sem UI. Invocada manualmente uma vez. Para cada um dos 8 deals:

1. **Round Robin** entre vendedores ativos: `team_members WHERE ativo=true AND role='vendedor' AND piperun_owner_id IS NOT NULL` (exclui Daniel se desejado? — por padrão **inclui** todos os 9 vendedores ativos atuais).
2. **PATCH PipeRun** `PUT /v1/deals/{id}` com:
   - `user_id`: novo owner (round robin)
   - `stage_id`: 379940 (Sem contato)
3. **UPDATE local** `deals`:
   - `owner_name` = nome do novo vendedor
   - `owner_id` = piperun_owner_id
   - `stage_id` = 379940, `stage_name` = 'Sem contato'
   - `last_stage_updated_at` = `now()`
4. **UPDATE local** `lia_attendances` do lead vinculado: `proprietario_lead_crm` = nome do novo vendedor (somente se o lead atualmente está com Danilo — para não sobrescrever outros).
5. **Log** em `lead_activity_log`: `event_type='deal_reassigned_inactive_seller'`, payload com `from='Danilo Pereira'`, `to=<novo>`, `deal_id`, `previous_stage`, `new_stage='Sem contato'`.
6. **Log resumo** em `system_health_logs` (`error_type='reassign_danilo_vendas'`).

### Sem mudanças estruturais

- Não cria tabelas nem migrations.
- Não altera `lia-assign` nem `ingest-lead` neste lote (esses endurecimentos ficam para um plano separado).
- Won deals: não há nenhum no Funil de Vendas do Danilo, então nada a preservar aqui.

## Arquivo

- `supabase/functions/smart-ops-reassign-danilo-vendas/index.ts` (novo)

## Confirmação

Disparo a função imediatamente após deploy? (Ela é one-off — depois pode ser deletada.)
