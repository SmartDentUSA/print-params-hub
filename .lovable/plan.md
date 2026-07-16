## Causa raiz

O mesmo post do Instagram está chegando 2–3× nos grupos WA porque:

1. `social-posts-sync` grava **uma linha por plataforma** em `social_posts` (Instagram + Facebook + TikTok + às vezes YouTube). Todas com **caption idêntica**, mas `post_url`/`short_link` diferentes.
   - Confirmado no banco: no mesmo minuto de sincronização aparecem 2 a 4 linhas com o mesmo texto, por exemplo em 2026-07-14 15:00, 2026-07-09 15:00, 2026-07-07 22:00 (3 plataformas cada).
2. `social-post-auto-blast` (`supabase/functions/social-post-auto-blast/index.ts`) percorre `social_posts` onde `auto_blast_at IS NULL` e dispara **um `wa-group-blast` por linha**. Cada linha vira uma campanha separada com o mesmo texto.
3. A trava de dedupe global em `wa-group-blast` (`wa_group_sent_fingerprints` por `content_hash`) **não pega** porque o hash inclui o `short_link`/`post_url`, que muda por plataforma. Ou seja: mesmo texto + URL diferente = hash diferente = dedupe não dispara.
4. Efeito visível confirmado em `wa_group_dispatch_log`: mesma legenda enviada a cada grupo 2–3 vezes com poucos segundos/minutos de intervalo.

## Correção proposta (mínima e focada)

Alterar `supabase/functions/social-post-auto-blast/index.ts` para deduplicar **por caption normalizada** antes de chamar `wa-group-blast`:

1. Ao buscar os posts pendentes (mesma query atual: `auto_blast_at IS NULL`, `caption IS NOT NULL`, `MAX_POSTS_PER_RUN=20`), agrupar em memória por uma chave canônica:
   - `captionKey = caption.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500)`
   - Se `product_name` existir, incluir na chave para não colidir posts diferentes com mesmo texto genérico.
2. Para cada grupo com mesma `captionKey`:
   - Escolher **um representante**, prioridade: `instagram → facebook → tiktok → youtube → primeiro por `created_at``.
   - Só o representante entra em `wa-group-blast` (mantém `text = caption + '\n\n' + short_link || post_url` do representante).
   - **Todos os IDs do grupo** (inclusive os não enviados) recebem `auto_blast_at = now()` num único `.update(...).in('id', ids)`. Isso garante que na próxima rodada nada re-dispare.
3. Log: incluir `console.log('[social-post-auto-blast] deduped', { captionKey, chosen: representative.id, suppressed: siblings.length })` para auditoria.
4. Manter o comportamento atual quando não há colisão (post único = fluxo idêntico ao atual, zero impacto).

Extras de robustez:

- Se a URL final estiver ausente no representante mas presente em um "sibling", promover o sibling com URL (evita perder o link).
- Nenhuma mudança de schema. Nenhuma mudança em `wa-group-blast`, `wa-dispatcher`, `wa_group_sent_fingerprints`, `social_posts`, cron.
- Idempotência preservada: `auto_blast_at` marca todas as plataformas de uma vez, então mesmo se o cron rodar concorrentemente (a cada 10 min), a segunda execução vai encontrar `auto_blast_at NOT NULL` e não repetirá.

## Fora do escopo (não vou fazer agora)

- Não vou alterar `social-posts-sync` para não gravar espelhos de plataforma — o Banco de Posts precisa continuar mostrando cada plataforma.
- Não vou "backfill" nem apagar os logs históricos de disparos duplicados em `wa_group_dispatch_log`.
- Não vou mexer no dedupe do `wa-group-blast` (fingerprint por `group_jid+content_hash`) — ele continua útil como segunda linha de defesa contra usuários dispararem manualmente.

## Verificação após a correção

1. Deploy da edge function `social-post-auto-blast`.
2. Rodar manualmente uma vez (`supabase.functions.invoke('social-post-auto-blast', {method:'POST'})`) com o backlog atual (todos os posts recentes estão `auto_blast_at = NULL`; ideia é marcá-los como processados agora **sem re-disparar** o que já foi enviado antes — se preferir que eu execute só um "silent flush" que marca todos como processados e não dispara nada, ajusto o plano).
3. Aguardar a próxima sincronização real do Zernio e conferir em `wa_group_dispatch_log` que aparece **1 envio por grupo por caption**, não mais 2–3.

Ok subir a correção nesses termos?
