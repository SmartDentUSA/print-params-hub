## Garantir que mensagens já enviadas não sejam reenviadas aos grupos

### Situação atual

Já existe alguma proteção, mas tem furos:

- `claim_pending_wa_messages` usa `FOR UPDATE SKIP LOCKED` → ok contra concorrência do dispatcher.
- `fn_check_group_send_cooldown` compara hash do conteúdo, **mas só dentro da mesma `campaign_id` e nas últimas 2 horas**. Se você cria uma **nova campanha/blast** com o mesmo texto/mídia para os mesmos grupos, o sistema **reenvia**.
- Não há trava no momento do *enqueue* (wa-group-blast / wa-broadcast-dispatch): a fila pode receber a mesma mensagem N vezes antes de o dispatcher rodar.

### Solução

Travar duplicidade em duas camadas usando uma tabela global `wa_group_sent_fingerprints` indexada por `(group_jid, content_hash)`.

**Camada 1 — Enqueue (wa-group-blast + wa-broadcast-dispatch):**
Antes de inserir cada linha em `wa_message_queue`, calcular `content_hash = md5(node_type || canonical(content_json))` e descartar os grupos que já receberam aquele hash dentro da janela (default 30 dias). Retornar para a UI `skipped_duplicates: [{group_jid, last_sent_at}]` para o usuário ver o que foi bloqueado.

**Camada 2 — Dispatch (wa-dispatcher):**
Logo após o claim e antes do `send`, revalidar contra a mesma tabela. Se já existe fingerprint válido → marcar `status='skipped'` com `error_message='dedupe_global'`. Isso protege contra: (a) race entre dois blasts simultâneos, (b) mensagens antigas que ficaram em `pending` e teriam sido reenviadas após reativar a campanha.

**Registro do envio:**
No mesmo bloco onde hoje o dispatcher seta `status='sent'`, fazer `INSERT ... ON CONFLICT DO UPDATE` em `wa_group_sent_fingerprints` com `last_sent_at=now()`. Constraint `UNIQUE(group_jid, content_hash)` impede duplicata mesmo sob race.

**Janela configurável:**
Coluna `dedupe_window_days` em `wa_campaigns` (default 30). Permite casos legítimos (ex.: newsletter semanal reenviada após 7 dias) sem desligar a trava.

**Override manual:**
Body opcional `allow_duplicate: true` em `wa-group-blast` para forçar reenvio quando o operador realmente quer. Logado em `wa_send_log` com flag `forced_duplicate`.

### Mudanças

**Banco** (1 migration):
- `CREATE TABLE wa_group_sent_fingerprints(group_jid, content_hash, node_type, last_sent_at, last_campaign_id, send_count)` + `UNIQUE(group_jid, content_hash)` + GRANT service_role.
- `ALTER TABLE wa_campaigns ADD COLUMN dedupe_window_days int DEFAULT 30`.
- Função `fn_check_group_global_dedup(p_group_jid, p_content_hash, p_window_days) returns boolean`.
- Função `fn_record_group_send(p_group_jid, p_content_hash, p_node_type, p_campaign_id)` chamada pelo dispatcher.
- Backfill: popular tabela com últimos 30 dias de `wa_message_queue` onde `status='sent'`.

**Edge functions:**
- `wa-group-blast/index.ts` — calcular hash, filtrar `eligible` via `fn_check_group_global_dedup`, retornar `skipped_duplicates`.
- `wa-broadcast-dispatch/index.ts` — mesmo filtro no enqueue.
- `wa-dispatcher/index.ts` — revalidar dedupe antes do send + chamar `fn_record_group_send` após sucesso.

**UI:**
- `WaGroupBlastModal.tsx` — exibir aviso amarelo listando grupos bloqueados (com data do último envio) + checkbox "Reenviar mesmo assim" que envia `allow_duplicate: true`.
- `SmartOpsWaGroupCampaigns.tsx` — campo numérico "Janela de dedupe (dias)" nas configurações da campanha.

### Detalhes técnicos

Canonicalização do `content_json` para hash estável:

```text
content_hash = md5(node_type + '|' + JSON.stringify(content_json, Object.keys(content_json).sort()))
```

Ordenar chaves evita falsos negativos quando o front-end serializa em ordem diferente. Mídias entram pelo `url` (não pelo binário) — se a mesma URL for reaproveitada com legenda diferente, é tratada como mensagem distinta.

Backfill SQL:

```sql
INSERT INTO wa_group_sent_fingerprints (group_jid, content_hash, node_type, last_sent_at, last_campaign_id, send_count)
SELECT group_jid,
       md5(node_type || '|' || coalesce(content_json::text,'')),
       node_type, max(sent_at), (array_agg(campaign_id ORDER BY sent_at DESC))[1], count(*)
FROM wa_message_queue
WHERE status='sent' AND sent_at > now() - interval '90 days'
GROUP BY group_jid, content_hash, node_type
ON CONFLICT (group_jid, content_hash) DO NOTHING;
```

### Fora de escopo

- Não muda dedupe de WhatsApp 1-to-1 (`whatsapp_send_queue`) — o pedido é específico de grupos.
- Não muda `fn_check_group_send_cooldown` (mantém como segunda linha de defesa intra-campanha de 2h).
- Não toca em mensagens DM individuais nem em `zernio-broadcast-dispatch`.
