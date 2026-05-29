## Diagnóstico

Logs da fila `wa_message_queue` mostram dois sintomas:

1. `sendMedia 400: SessionError: No sessions` na campanha `73fdbb9f` (grupo `Automação teste`, instância **Danilo Henrique**, scheduled 18:58).
2. `Cooldown anti-duplicata: mesmo nó enviado nas últimas 2h` pulando reenvios legítimos após edição de fluxo (entradas 16:05/16:18).

### Causa #1 — Dispatcher ignora apikey por instância

`supabase/functions/wa-dispatcher/index.ts` resolve apenas `instance_name` por `group_jid`:

```ts
const instance = instanceByJid.get(item.group_jid)
evoId = await sendText(item.group_jid, txt, instance)
```

`_shared/evolution.ts` aceita um 4º arg `apikey?` e, quando ausente, usa `EVO_KEY` global. O dispatcher nunca passa a apikey da instância, então toda chamada usa a apikey de "Dra. Lia". Para grupos cuja instância tem apikey própria (memory `Evolution Per-Instance Credentials`), o Evolution self-hosted devolve `400 No sessions`.

### Causa #2 — Cooldown bloqueia conteúdo novo

`fn_check_group_send_cooldown` ignora o conteúdo: qualquer item da mesma `(group_jid, campaign_id, node_index)` enviado nas últimas 2h faz pular. Edição de flow_json (nó 0 antes era `msg`, agora é `image`) é bloqueada porque o `node_index` continua 0.

## Mudanças

### 1. `supabase/functions/wa-dispatcher/index.ts`

- Ampliar o lookup batched: além de `instance_name`, juntar `team_members` para trazer `evolution_api_key` de cada instância em uso na batch.
- Construir `Map<jid, { instance, apikey }>`.
- Passar `apikey` em `sendText(jid, txt, instance, apikey)` e `sendMedia(jid, kind, url, caption, instance, apikey)` em todos os 5 ramos do switch.

### 2. `supabase/migrations/<timestamp>_wa_cooldown_content_aware.sql`

Recriar `fn_check_group_send_cooldown` para considerar `node_type` e um hash estável do `content_json` (`md5(content_json::text)`), evitando falso-positivo após edição do fluxo. Assinatura preservada (mesmos params) para não exigir mudança no dispatcher.

```sql
CREATE OR REPLACE FUNCTION public.fn_check_group_send_cooldown(
  p_group_jid text, p_node_index integer, p_campaign_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT node_type, md5(coalesce(content_json::text,'')) AS content_hash
    FROM public.wa_message_queue
    WHERE campaign_id = p_campaign_id AND node_index = p_node_index
    ORDER BY id DESC LIMIT 1
  )
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.wa_message_queue q, target t
    WHERE q.group_jid = p_group_jid
      AND q.campaign_id = p_campaign_id
      AND q.node_index  = p_node_index
      AND q.node_type   = t.node_type
      AND md5(coalesce(q.content_json::text,'')) = t.content_hash
      AND q.status = 'sent'
      AND q.sent_at > now() - interval '2 hours'
  );
$$;
```

### 3. Limpeza pontual da fila travada

Resetar para `pending` (sem alterar `scheduled_at`) os 3 itens hoje em `pending` da campanha `73fdbb9f` com `error_message` antiga, e limpar o `retry_count` para nova tentativa após o deploy. Usar `supabase--read_query` é insuficiente — aplicar via migration de dados:

```sql
UPDATE public.wa_message_queue
SET error_message = NULL, retry_count = 0
WHERE status = 'pending' AND error_message ILIKE '%SessionError%';
```

## Validação

1. Após deploy, próximo tick do cron de `wa-dispatcher` deve enviar o item 5ed24793 com sucesso (apikey correta de "Danilo Henrique").
2. `wa_send_log` registra `success=true, instance_name='Danilo Henrique'`.
3. Editar um fluxo já enviado e republicar deve disparar normalmente (cooldown não bloqueia conteúdo diferente).
4. Campanhas pausadas (`a839f4d4`, `9859c6dd`) só voltam a enviar quando o usuário clicar em "Retomar" — comportamento correto, não é bug.

## Fora do escopo

- Reconectar instâncias caídas no Evolution (operação manual no painel da Evolution se a sessão WhatsApp Web cair).
- Refatoração de `_shared/evolution.ts` (assinatura já suporta apikey opcional; só faltava o dispatcher passar).
