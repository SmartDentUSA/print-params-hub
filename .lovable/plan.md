## Objetivo
Toda vez que um **novo post do Instagram** entra no banco (`social_posts` com `platform='instagram'`), anexar 3 nós ao fluxo da campanha do grupo WhatsApp **"Dashboard - SMDT - Diária"** (campanha `3af64f4c-9ea9-47c6-8e14-93047b85f36e`) e reativá-la.

## Gatilho
- Tabela: `public.social_posts`
- Evento: `AFTER INSERT OR UPDATE OF post_url, status`
- Condição: `NEW.platform = 'instagram'` AND `NEW.post_url IS NOT NULL` AND (insert novo OU primeira vez que `post_url` foi preenchido).
- Idempotência: checar se já existe nó no `flow_json` da campanha alvo com `source_post_id = NEW.id`. Se sim, não faz nada.

## Nós anexados (nesta ordem)
1. **`image`** — `media_url = NEW.thumbnail_url` (fallback: `NEW.media_url`), `caption = NEW.product_name` (se houver).
2. **`link`** — `url = NEW.post_url`, `title = "Novo post no Instagram"`, `description = NEW.caption` truncado em 180 chars.
3. **`msg`** — texto:
   ```
   Conteúdo postado!
   Galera, curta - salva - compartilha com clientes - e comenta o CTA.
   ```
   Com metadata `source_post_id = NEW.id` para idempotência.

Se `thumbnail_url` e `media_url` ambos vazios → pula nó 1, mantém 2 e 3.

## Reativação da campanha
```sql
UPDATE wa_campaigns
SET flow_json = flow_json || nodes,
    status = 'active',
    finished_at = NULL,
    next_send_at = now()
WHERE id = '3af64f4c-9ea9-47c6-8e14-93047b85f36e';
```
`current_node_index` permanece — o worker continua de onde parou e processa os novos nós no final da fila.

## Log
`system_health_logs` com `event_type='social_post_to_wa_appended'`, `metadata = { post_id, platform, post_url, nodes_added }`.

## Implementação
- **Uma migration** criando:
  - `public.fn_social_post_to_wa_campaign()` (SECURITY DEFINER, `SET search_path=public`)
  - Trigger `trg_social_post_to_wa` em `social_posts`
- Hardcoded: `target_campaign_id` e texto da mensagem dentro da função (fácil de editar depois via nova migration).

## Fora do escopo
- Outras plataformas (facebook, tiktok, youtube) — só Instagram conforme pedido.
- Backfill dos 30 posts Instagram já publicados (se quiser, rodo um INSERT manual depois).
- UI para configurar grupo/campanha alvo.
