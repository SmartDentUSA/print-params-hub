## Objetivo

Permitir upload direto de imagens e vídeos nos cards da landing page (hoje o `MediaField` só aceita colar URL).

## Escopo

Aplica-se a todos os pontos que já usam `MediaField` no `LandingPageBuilderModal.tsx`:
- Benefits
- How it Works
- Modules
- (Nova) Hero/Positioning e Comparison — não incluídos, pois o pedido foi manter o fluxo atual, só habilitando upload onde já tem mídia.

## Mudanças

### 1. Novo bucket público `landing-page-media`

Migration:
- `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)` com limite 50MB e mimes `image/png, image/jpeg, image/webp, image/gif, video/mp4, video/webm, video/quicktime`.
- Policies:
  - `SELECT` público (anon + authenticated).
  - `INSERT/UPDATE/DELETE` restrito a `authenticated` no prefixo `landing-pages/`.

### 2. `MediaField` em `LandingPageBuilderModal.tsx`

Adicionar botão "Enviar arquivo" ao lado do input de URL:
- `<input type="file" accept="image/*,video/*">` escondido, disparado por botão.
- Ao selecionar:
  1. Valida tamanho (<= 50MB) e tipo.
  2. Upload em `landing-page-media/landing-pages/{formId|'draft'}/{timestamp}-{safeName}` com `upsert: false`, `cacheControl: 31536000`.
  3. `getPublicUrl` → grava em `media.url`.
  4. Detecta `type` automaticamente pelo `file.type` (`video/*` → `"video"`, senão `"image"`).
  5. Preenche `alt` com o nome do arquivo se vazio.
- Estado de progresso com `useState` local (`uploading: boolean`) exibindo spinner no botão.
- Toast de erro em falhas.

O input de URL continua funcionando (paste de link externo continua válido). O select `Imagem/Vídeo` e o campo `alt` continuam iguais.

### 3. Preview

`PremiumLandingTemplate` já renderiza `media.url` com `<img>` ou `<video>` — nenhuma alteração necessária.

## Detalhes técnicos

- Reutiliza padrão de `CoverImageUpload.tsx` (mesmo `supabase.storage.from(...).upload` + `getPublicUrl`).
- Passar `formId` como prop opcional do editor até o `MediaField` para namespacing dos arquivos (fallback `"draft"` quando ainda não salvo).
- Nenhuma alteração no schema de `LPContent` — `LPMedia` já tem `{ url, type?, alt? }`.
- Nenhuma alteração nas edge functions.

## Arquivos afetados

- `supabase/migrations/{timestamp}_landing_page_media_bucket.sql` (novo)
- `src/components/smartops/LandingPageBuilderModal.tsx` (MediaField + prop drilling de `formId`)
