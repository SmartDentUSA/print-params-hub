# Watchdog de entrega WhatsApp + painel de saúde

## Problema
Hoje o `wa-dispatcher` marca `status='sent'` assim que o Evolution responde 200 com um `key.id`. Isso **não** garante que a mensagem chegou no grupo. Quando falha (`SessionError`), o item fica `pending` e o cron pode tentar de novo indefinidamente. Falta:
1. Confirmação real de entrega (consultar o Evolution depois do envio)
2. Garantia anti-duplicação (nunca reenviar um item que já tem `evo_message_id` confirmado)
3. Visibilidade no front

## O que vai ser construído

### 1. Migration — colunas de rastreamento de entrega
Adiciona em `wa_message_queue`:
- `evo_message_id text` — id retornado pelo Evolution no envio (já existe? checar; senão criar)
- `delivery_status text` — `unknown | sent_to_server | delivered | read | failed_undelivered`
- `delivery_checked_at timestamptz`
- `delivery_attempts int default 0`

Índice parcial: `WHERE delivery_status IN ('unknown','sent_to_server') AND sent_at IS NOT NULL`.

### 2. Edge function nova: `wa-delivery-reconciler` (cron 5 min)
Para cada item com `status='sent'`, `evo_message_id IS NOT NULL`, `delivery_status NOT IN ('delivered','read')`, `sent_at > now()-24h`:
1. Resolve a `instance_name` + `apikey` do grupo (via `wa_groups` + `team_members`)
2. Chama `POST /chat/findMessages/{instance}` com filtro pelo `key.id`
3. Lê `status` retornado pelo Baileys: `PENDING`, `SERVER_ACK`, `DELIVERY_ACK`, `READ`, `PLAYED`
4. Atualiza `delivery_status` correspondente
5. Se passou >15 min e ainda `PENDING`/sem registro → marca `delivery_status='failed_undelivered'`, `status='pending'`, `retry_count=0`, `scheduled_at=now()`, **mas mantém `evo_message_id`** para detectar duplicata caso a primeira entrega chegue tarde
6. No próximo ciclo, o dispatcher reenvia — antes de chamar `sendText/sendMedia`, verifica se já existe `evo_message_id`; se sim, primeiro tenta `findMessages` mais uma vez (proteção anti-duplicata)

### 3. Dispatcher — guarda anti-duplicação + retry com warmup
Em `wa-dispatcher/index.ts`:
- Antes de enviar, se o item já tem `evo_message_id`, consulta `/chat/findMessages`; se a mensagem existe e está pelo menos `SERVER_ACK`, marca `delivery_status` direto e **pula o envio** (evita duplicata)
- Ao receber erro `SessionError: No sessions`, chama `GET /group/findGroupInfos?groupJid=...` (warmup do Baileys), aguarda 3s, tenta **1 vez** novamente
- Persiste o `key.id` em `evo_message_id` imediatamente após resposta 200
- Salva `delivery_status='sent_to_server'` no mesmo update

### 4. Cron schedule
`select cron.schedule('wa-delivery-reconciler-5min', '*/5 * * * *', $$ net.http_post(...) $$)` — disparado via SQL após aprovação.

### 5. Frontend — card "Saúde da entrega" em `SmartOpsWaGroupCampaigns.tsx`
Por campanha ativa, mostrar:
```
Agendadas: 12  •  Enviadas: 10  •  Entregues: 8  •  Lidas: 5  •  Falhas: 2
```
Cores: verde (entregue/lida), amarelo (sent_to_server > 10min), vermelho (failed_undelivered).

Botão **"Reprocessar não-entregues"** chama RPC que reseta os items `failed_undelivered` daquela campanha para `pending`/`scheduled_at=now()`.

Tooltip nas falhas com a `error_message` real.

## Arquivos tocados
- `supabase/migrations/<novo>.sql` — colunas + índice
- `supabase/functions/wa-delivery-reconciler/index.ts` — novo
- `supabase/functions/wa-dispatcher/index.ts` — guarda + warmup + persistir evo_message_id
- `src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx` — card de saúde + botão reprocessar
- SQL `pg_cron` schedule (insert tool, não migration)

## Garantias
- **Nunca envia 2x**: dispatcher confere `evo_message_id` + `findMessages` antes de qualquer reenvio
- **Detecta entrega real**: reconciler confirma com o Baileys o estado da mensagem
- **Auto-recupera de SessionError**: warmup + retry 1x dentro do mesmo ciclo
- **Visível no front**: usuário vê em tempo real o que entregou e o que travou

## Fora de escopo
- Reconectar instâncias Evolution caídas (precisa do painel Evolution)
- Webhook de status do Evolution (mais robusto, mas exige configurar webhook no servidor — pode ser fase 2)
