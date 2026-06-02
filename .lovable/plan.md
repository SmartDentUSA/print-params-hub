# Fase 1B — Editor de Post `/social/novo`

Editor de 5 etapas para criar um agendamento na tabela `social_scheduled_posts`, com upload no bucket `wa-media`, validação Zod condicional por canal e preview lateral.

## Arquivos a criar

**Schemas / lógica**
- `src/lib/social/postSchema.ts` — Zod base + refinamentos condicionais (YouTube/TikTok exigem vídeo, Pinterest exige título + mídia, Reddit exige subreddit/título, IG Stories exige mídia, scheduled_at futuro quando não `publish_now`).
- `src/hooks/social/useMediaUpload.ts` — upload sequencial pra `supabase.storage.from('wa-media')`, captura dimensões (image/video), valida tipo e tamanho (≤100 MB), gera `MediaItem` com `url` público + `path`.
- `src/hooks/social/useCreateScheduledPost.ts` — `INSERT` em `social_scheduled_posts` mapeando para a coluna existente; status `scheduled` ou `publishing` conforme `publish_now`; redireciona pra `/social`.

**Componentes do editor (`src/components/social/editor/`)**
- `SocialPostEditor.tsx` — estado central (`useState<PostInput>`), tabs/passos com `Tabs`, header com progresso, footer com Voltar/Avançar/Salvar, validação por etapa via `postSchema.pick(...)`.
- `steps/StepContent.tsx` — caption (textarea + contador 2200), hashtags (chips com Enter), first_comment, product_name/slug.
- `steps/StepMedia.tsx` — dropzone + grid de previews com remover/reordenar; respeita formato vertical 9:16.
- `steps/StepChannels.tsx` — toggles dos 6 canais (`SOCIAL_CHANNELS`), por canal selecionado mostra: format select, e campos condicionais (title, board, destination_url, subreddit, reddit_kind, tiktok_privacy).
- `steps/StepSchedule.tsx` — switch `publish_now` + input datetime-local + select de timezone (default `America/Sao_Paulo`).
- `steps/StepReview.tsx` — resumo final com badges dos canais, contagem de mídia, data formatada e validação completa.
- `SocialPostPreview.tsx` — preview lateral mock-up estilo IG card (avatar, handle, mídia 1:1 ou 9:16, caption truncada, hashtags); atualiza ao vivo.

## Arquivos a editar
- `src/App.tsx` — trocar `<ComingSoon title="Criar Post" />` por `<SocialPostEditor />` na rota `/social/novo`.

## Detalhes técnicos
- Bucket `wa-media` já existe e é público; gera path `social/YYYY-MM-DD/{uuid}.{ext}` pra não colidir com WhatsApp.
- Schema do `social_scheduled_posts` confirmado: `media_items jsonb`, `channels jsonb`, `scheduled_at`, `timezone`, `status`, `publish_now`, `product_name`, `product_slug`, `created_by`.
- Não há mudança de DB nem edge function nessa fase — só UI + insert via SDK.
- Preview lateral sticky no desktop; em mobile o usuário pode abrir colapsado com botão.
- `useCreateScheduledPost` grava `status='publishing'` quando `publish_now=true` para o cron existente `social-publisher-cron` consumir; quando agendado, `status='scheduled'`.

## Fora de escopo desta fase
- Edição de post existente (`/social/novo/:id`) — vem na próxima iteração.
- Drag-and-drop no calendário (Fase 1C).
- "Usar em campanha WA" (Fase 3).
- Sincronizar metadados depois de publicado (cron já existente trata).
