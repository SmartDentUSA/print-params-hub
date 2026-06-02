# Fase 2 — IG Flow Engine via **Zernio** (substitui Meta Graph)

Como todas as contas sociais já estão conectadas no Zernio (Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, LinkedIn, Threads…), o worker delega 100% da publicação para a API do Zernio. Uma única integração resolve todos os canais.

Base URL: `https://zernio.com/api/v1`
Auth: `Authorization: Bearer $ZERNIO_API_KEY`

---

## 1. Secret necessária

- `ZERNIO_API_KEY` (formato `sk_…`) — pedida via `add_secret` no início.

Já existe referência no hook `useZernioSync`. Se a chave já estiver salva, reaproveitamos.

---

## 2. Sincronização de contas (catálogo local)

Para o editor saber qual `accountId` mandar pra cada canal, criamos uma tabela espelho:

```sql
CREATE TABLE public.social_zernio_accounts (
  id uuid PK default gen_random_uuid(),
  zernio_account_id text UNIQUE NOT NULL,   -- acc_xxx
  zernio_profile_id text NOT NULL,          -- prof_xxx
  platform text NOT NULL,                   -- instagram, facebook, tiktok…
  handle text,
  display_name text,
  avatar_url text,
  active boolean default true,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now()
);
```
+ GRANT, RLS, policy (`authenticated SELECT`, edge function via service_role).

### Edge function nova: `zernio-accounts-sync`
- `GET /api/v1/accounts` → upsert na tabela.
- Invocada pelo botão "Sincronizar" existente (`useZernioSync` será desdobrado para chamar **tanto** `social-posts-sync` quanto `zernio-accounts-sync`).

---

## 3. Edge function principal: `social-publish-worker`

Roda a cada minuto (cron). Em cada execução:

1. **Claim atômico** de até 10 posts elegíveis:
   ```sql
   UPDATE social_scheduled_posts
   SET status='publishing'
   WHERE id IN (
     SELECT id FROM social_scheduled_posts
     WHERE (publish_now=true AND status='publishing')
        OR (status='scheduled' AND scheduled_at <= now())
     ORDER BY scheduled_at NULLS FIRST
     LIMIT 10
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
   ```
2. Para cada post: monta payload **único** ao Zernio:
   ```json
   POST /api/v1/posts
   {
     "content": "<caption>\n\n<hashtags juntos>",
     "publishNow": true,                  // sempre true; já fizemos o "agendamento" local
     "timezone": "America/Sao_Paulo",
     "mediaItems": [
       { "url": "<public_url do wa-media>", "type": "image" | "video" }
     ],
     "platforms": [
       { "platform": "instagram", "accountId": "acc_xxx" },
       { "platform": "tiktok",    "accountId": "acc_yyy" }
     ],
     "firstComment": "<first_comment>"   // quando suportado
   }
   ```
   - Mapeia `channels[].platform` → `accountId` via `social_zernio_accounts`. Se algum canal não tiver conta ativa, registra erro mas tenta o resto.
   - URLs do bucket `wa-media` já são públicas → passamos direto, sem reupload.
3. **Sucesso**: grava `zernio_post_ids = { "<channel>": "<post._id>" }`, `published_at=now()`, `status='published'`.
4. **Erro parcial**: `status='failed'`, `publish_errors=[{channel, code, message, at}]` (preserva contexto pra retry manual).
5. Logs JSON estruturados (`console.log({ event:'publish.ok'|'publish.fail', post_id, ... })`).

CORS habilitado para chamadas manuais via dashboard ("Forçar publicação").

---

## 4. Cron job

Via SQL insert direto (pg_cron + pg_net), não-migração (contém anon key):

```sql
SELECT cron.schedule(
  'social-publish-worker',
  '* * * * *',
  $$ SELECT net.http_post(
       url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/social-publish-worker',
       headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
       body:='{}'::jsonb
     ) $$
);
```

Extensions `pg_cron` e `pg_net` ativadas (verifica antes; se faltar, migration habilita).

---

## 5. Frontend — pequenas adições

- **`StepChannels`**: dropdown de conta agora carrega `social_zernio_accounts` por plataforma (filtra `active=true`). Hook novo `useZernioAccounts(platform?)`.
- **Banner em `/social`**: se nenhuma conta sincronizada existir, CTA "Sincronizar contas Zernio".
- **`SocialPostCard` failed**: botão "Republicar" já adicionado na Fase 1D — só funcionar automático com o cron rodando.
- **Realtime** (opcional, leve): `supabase.channel('social_scheduled_posts')` no dashboard para refletir mudanças de status sem refresh.

---

## 6. Fora de escopo desta fase

- Carrosséis multi-mídia com `customMedia` por canal (1 mídia única atende a maioria; multi-canal complexo fica pra Fase 2.1).
- Métricas pós-publicação (likes, alcance) — virão via outro endpoint Zernio (`/analytics`) numa fase futura.
- Reuploads de mídia via `media/presign` — usamos URL pública do `wa-media`. Só viramos para presign se algum canal recusar a URL do Supabase.

---

## Ordem de execução

```text
1. add_secret ZERNIO_API_KEY  (pausa pra você colar)
   ↓
2. migration: social_zernio_accounts + extensions
   ↓
3. deploy zernio-accounts-sync  →  você clica "Sincronizar" e valida lista
   ↓
4. deploy social-publish-worker
   ↓
5. schedule cron (insert SQL, sem migration)
   ↓
6. teste manual: criar post Instagram "publicar agora" → ver published_at + zernio_post_ids preenchidos
```

Posso emendar após você aprovar. Pode confirmar?
