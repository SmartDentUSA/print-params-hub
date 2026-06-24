## Objetivo
Quando o vendedor marcar um deal como **Perdido** no Funil de Vendas (18784), o sistema move automaticamente o MESMO deal para o Funil **Estagnados** (72938), etapa **00 – Novos** (`447250`), e **reabre** o deal (status `0`). Sem criar deal novo, sem fechar nada em Estagnados.

## Onde plugar
`supabase/functions/smart-ops-piperun-webhook/index.ts` — já recebe o evento de mudança de status do deal, já calcula `isLost` (linha 1267) e já conhece `ids.pipelineId` (pipeline atual do deal).

## Regra de disparo
Disparar a movimentação SOMENTE quando TODAS as condições forem verdadeiras:
1. `isLost === true` (status normalizado = "lost").
2. `ids.pipelineId === PIPELINES.VENDAS` (18784). Deals perdidos em qualquer outro funil (CS, Estagnados, Reativação) são ignorados — só Vendas vira Estagnados.
3. `dealId` presente.
4. Idempotência: pular se o deal já estiver em Estagnados (proteção contra reentrega do webhook).

## Ação no PipeRun
Chamada única à API do PipeRun via helper existente em `_shared/piperun-hierarchy.ts` (já tem token/headers padronizados):

```
PUT /deals/:id
{
  pipeline_id: 72938,           // PIPELINES.ESTAGNADOS
  stage_id:    447250,          // STAGES_ESTAGNADOS.ETAPA_00_NOVOS
  status:      0                // reabre (0 = aberto)
}
```

Owner, valor, motivo de perda e demais campos permanecem intocados — o histórico de perda fica registrado no deal e nas notas.

Após sucesso, postar uma nota no deal:
> 🔄 [Dra. L.I.A.] Deal marcado como Perdido no Funil de Vendas → movido para Estagnados / Etapa 00 – Novos e reaberto automaticamente.

## Sincronização do snapshot no Supabase
Após o PUT bem-sucedido, atualizar `lia_attendances` do lead:
- `piperun_pipeline_id = 72938`
- `piperun_pipeline_name = 'Estagnados'`
- `piperun_stage_id = 447250`
- `piperun_stage_name = 'Etapa 00 – Novos'`
- `piperun_status = 0`
- `status_oportunidade = 'aberta'` (sobrescreve o `perdida_renutrir` que o bloco atual seta na linha 1287, somente quando a movimentação ocorrer)
- `lead_status = 'est_etapa1'` (entra no journey de estagnação via `STAGE_TO_ETAPA`)
- `motivo_perda` e `comentario_perda` permanecem (auditoria).

Registrar em `lead_activity_log` (`type: 'vendas_lost_moved_to_estagnados'`) e em `system_health_logs` (`event_type: 'vendas_lost_auto_move_to_estagnados'`) com `dealId`, `leadId`, `previousStageId`, `lossReason`.

## Tratamento de erro
- Se o `PUT` falhar (4xx/5xx/timeout): NÃO sobrescrever `status_oportunidade`; manter o comportamento atual (`perdida_renutrir`) e logar `vendas_lost_move_failed` em `system_health_logs` com `error_message` + `http_status`. Não estourar o webhook (200 OK para o PipeRun continuar).
- Dedup: usar `wa_message_dedup`-style guard ou checar `piperun_pipeline_id` atual do snapshot antes do PUT para evitar loop com o próprio webhook que o PUT vai disparar.

## Anti-loop do webhook
O `PUT` acima vai re-disparar o `smart-ops-piperun-webhook` com `pipelineId=72938` e `status=0`. Como a regra exige `pipelineId === VENDAS` E `isLost`, o reentrada não dispara nova movimentação. Garantido.

## Interações com regras existentes (verificar e preservar)
- **Golden Rule / Deal-Create Lock**: não é afetada — não criamos deal novo, só fazemos `PUT` no existente.
- **SDR-CAPTAÇÃO reativação** (linha 1797): continua não fechando Estagnados automaticamente. Sem conflito.
- **TAGs de jornada** (`computeTagsFromStage`): o bloco já existente entre linhas 1228-1242 vai recalcular as tags corretamente quando o webhook reentrar com o stage de Estagnados.

## Arquivos a alterar
1. `supabase/functions/smart-ops-piperun-webhook/index.ts` — novo bloco logo após detecção `isLost`, antes do bloco de cross-sell (linha 1270).
2. `supabase/functions/_shared/piperun-hierarchy.ts` — adicionar helper `moveDealToEstagnadosNovos(dealId, env, { reason })` que faz o PUT + post da nota.
3. `mem://integration/piperun-sync-spec-v6` — anotar a nova regra "Lost-in-Vendas auto-move to Estagnados/Etapa 00".

## Critérios de aceite
- Deal `61299540` (Vendas) marcado como Perdido → em <5s aparece em Estagnados / Etapa 00 – Novos, status aberto, com nota da Dra. L.I.A.
- Deal Perdido em CS Onboarding ou em Estagnados → nada acontece.
- Snapshot do lead em `lia_attendances` reflete o novo pipeline/stage.
- Webhook não entra em loop (reentrada com pipeline=72938 não dispara nova movimentação).
- Falha de API PipeRun: log de erro + status_oportunidade=`perdida_renutrir` mantido, sem 500 no webhook.