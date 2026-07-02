## Problema encontrado

Ao inspecionar o fluxo `StepChannels` → `social_scheduled_posts.channels` → `social-publish-worker` → Zernio, encontrei **dois bugs reais** que causam publicações duplicadas / incorretas:

### 1. Duplicação por multi-formato da mesma plataforma
`toZernioPlatform()` normaliza `instagram-feed`, `instagram-stories`, `instagram-reels` todos para `"instagram"` (idem `facebook-*` e `youtube-video`/`youtube-shorts`). O loop empurra cada um no array `platforms` **sem dedupe**:

```ts
for (const ch of channels) {
  const platform = toZernioPlatform(ch.platform ...); // "instagram" 3x
  platforms.push({ platform, accountId }); // repetido
}
```

Se o usuário marca Instagram Feed + Reels + Stories, `bulkPlatforms` fica `[ig, ig, ig]` e a chamada `POST /posts` do Zernio recebe 3 entradas idênticas → 3 publicações no mesmo perfil.

### 2. Formato ignorado (Feed vs Reels vs Stories vs Shorts)
O worker **nunca** envia o `format` ao Zernio. Todo canal cai como post genérico (default Feed). Selecionar "Instagram Reels" não posta Reels — publica no Feed. Idem YouTube Shorts, Facebook Stories, etc.

### 3. Canais faltando/inconsistentes na UI
`CHANNEL_FORMAT_OPTIONS` não expõe: Reddit, Instagram Carrossel, Facebook Álbum, TikTok Carrossel, Pinterest Video/Idea Pin — mas todos estão declarados em `SOCIAL_CHANNELS.formats` e em `channelSchema`. Reddit ainda tem UI de campos extras em `StepChannels` que nunca aparece porque o ícone não existe.

## Correções propostas

### A. `supabase/functions/social-publish-worker/index.ts`
1. Dedupar `platforms` por `platform+accountId+format` antes de montar `groups`.
2. Preservar o `format` de cada canal e mapear para o campo Zernio correspondente (`postType`: `feed` | `reels` | `stories` | `shorts` | `video` | `pin`). Enviar por plataforma (usar formato Zernio: `platforms: [{ platform, accountId, postType }]`).
3. Quando o mesmo `platform` aparece com formatos diferentes (ex.: Feed + Reels), gerar **grupos separados** (uma chamada Zernio por formato) — nunca colapsar em bulk.
4. Adicionar log `channel_dedup` quando um par platform+format+account é descartado.

### B. `src/components/social/editor/steps/StepChannels.tsx`
1. Bloquear no cliente a seleção redundante do mesmo `platform+format` (já é o comportamento — verificar) e adicionar aviso quando o usuário marca Feed + Reels + Stories do mesmo perfil (não é duplicata, é intencional, mas destacar visualmente que serão 3 posts distintos).
2. Deixar claro no rodapé que "Cada formato marcado gera 1 publicação separada".

### C. `src/components/social/editor/ChannelFormatIcon.tsx`
1. Adicionar ícones faltantes que já estão suportados no schema: Reddit (Texto/Link/Imagem), Instagram Carrossel, Facebook Álbum, Pinterest Video Pin. Sem novas plataformas — só expor o que já existe.

### D. Validação Zod em `postSchema`
1. Superrefine: rejeitar canais com `(platform, format)` duplicado.

## Fora de escopo
- Não mexer em backend de agendamento / cron.
- Não trocar provedor (mantém Zernio).
- Sem migração de banco — `channels` já é JSONB flexível.

## Como validar
1. Criar um post marcando Instagram Feed + Reels + Stories → 3 chamadas Zernio distintas com `postType` correto, 3 posts no IG.
2. Marcar apenas Instagram Feed + Facebook Post → 1 chamada bulk com 2 plataformas, 1 post em cada.
3. Tentar salvar com Feed marcado duas vezes → schema rejeita.
