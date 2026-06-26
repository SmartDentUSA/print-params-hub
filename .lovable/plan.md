## Diagnóstico

Seu último post (`8f99633e…`, 26/06 13:56) falhou no Zernio com o erro:

> Instagram Image 1: Aspect ratio 0.67:1 is outside Instagram's allowed range (0.75 to 1.91). Current: 1024 × 1536px. This looks like a Story/TikTok format. Crop it to 4:5 for Instagram feed posts.

A imagem é vertical 2:3 (formato Stories/Reels). Você marcou **Instagram Feed + Stories** no mesmo post. O Stories aceita, mas o Feed rejeita qualquer ratio < 0.75, então o Zernio reprovou o post inteiro antes de publicar.

Mesmo erro aconteceu em `208e5378…` (24/06 22:14, imagem 941×1672, 0.56:1).

Hoje o Social Publisher só valida MIME e tamanho — não checa proporção, então o usuário só descobre o problema quando o Zernio devolve 400.

## Plano

### 1. Validação de aspect ratio na hora do upload (frontend)
Em `src/lib/social/mediaValidation.ts`:
- Adicionar `validateImageAspectRatio(file, channels)` async que lê dimensões via `createImageBitmap`.
- Regras por canal (limites do Instagram/Meta):
  - Feed (instagram/facebook): 0.8 – 1.91 (recomendado 4:5 a 1.91:1)
  - Stories/Reel (instagram/tiktok): 0.5 – 0.5625 ideal (9:16); aceita 0.5 – 1.0
  - LinkedIn Post: 0.4 – 2.4
- Retornar lista de canais incompatíveis + sugestão ("essa imagem é 9:16 — use apenas em Stories/Reel").

### 2. UI — bloquear seleção de canal incompatível
Em `src/components/social/editor/` (passo de Mídia/Canais):
- Após anexar mídia, calcular ratio e mostrar badge "Vertical 9:16" / "Quadrada 1:1" / "Paisagem 16:9".
- Em `StepChannels`, desabilitar checkbox de canais incompatíveis com aviso inline ("Imagem 2:3 não é aceita no Feed do Instagram — use Stories ou recorte para 4:5").
- No `StepReview`, exibir badge de aviso se houver mismatch antes de Publicar.

### 3. Defesa no worker (fallback)
Em `supabase/functions/social-publish-worker/index.ts`:
- Antes de enviar ao Zernio, filtrar `channels[]` removendo canais cujo formato não bate com o ratio detectado da mídia (preserva ao menos um canal compatível). Se todos forem incompatíveis, marcar `status='failed'` com mensagem amigável e **não** chamar o Zernio.
- Loga `publish_errors` com motivo claro ("Imagem 2:3 incompatível com Feed do Instagram — selecione Stories").

### 4. Recovery do post falhou
Adicionar botão "Republicar como Stories" no `SocialPostCard` quando o erro contém "Aspect ratio" — reusa `useReschedulePost`/`useRetryPublish` mudando `channels` para Stories somente.

## Arquivos tocados
- `src/lib/social/mediaValidation.ts` (+ função de ratio)
- `src/components/social/editor/steps/StepMedia.tsx` (badge + cálculo)
- `src/components/social/editor/steps/StepChannels.tsx` (desabilitar canais)
- `src/components/social/editor/steps/StepReview.tsx` (aviso final)
- `src/components/social/SocialPostCard.tsx` (botão republicar Stories)
- `supabase/functions/social-publish-worker/index.ts` (filtro defensivo)

## Não altera
- Schema do banco, fluxos do Zernio, lógica de outras abas (Post Grupos, Avaliações).

Quer que eu já corrija o post `8f99633e…` reenviando só como Stories junto da implementação?