## Upload múltiplo estilo mLabs — `/social/novo`

Reformular o `MediaItemsEditor` (e o passo `StepMedia`) para suportar o fluxo de seleção múltipla com modal de decisão, controles por tile (excluir / cortar / reordenar) e validação por plataforma.

### 1. Modal "Múltiplos posts vs Álbum"
- Novo componente `MultiUploadChoiceDialog.tsx` (shadcn `Dialog`).
- Disparado pelo `MediaItemsEditor` quando o usuário seleciona/arrasta **2+ arquivos** num editor vazio.
- Opções:
  - **Múltiplos Posts** (outline): callback `onSplitIntoPosts(files)` — apenas dispara um evento; o `SocialPostEditor` lida com a duplicação (ver §4).
  - **Álbum/Carrossel** (primary): agrega tudo em `media_items[]` do post atual e seta `post_type = 'carousel'`.
- Se já existirem mídias no editor, não pergunta — apenas anexa ao carrossel atual.

### 2. `MediaItemsEditor` reescrito
Mantém DnD existente e adiciona:
- **Barra de progresso global** "Enviando X de N" + indicador por arquivo (lista lateral leve sobre o dropzone).
- **Estado vazio**: dropzone tracejada, ícone `Upload`, copy "Arraste imagens e vídeos aqui / ou clique para selecionar".
- **Tile (hover)**: 4 controles — drag handle (existente), `X` remover (sempre visível, canto sup. dir.), `Trash` excluir (canto inf. esq.), `Scissors` **Cortar** (botão central inferior).
- **Botão `+ Adicionar mais`** como tile final do grid (desabilitado com tooltip se `items.length >= maxItems`).
- **Badges de erro** no tile (ícone ⚠) para arquivos que violarem limites de tamanho/formato.
- **Contador** `X/10 mídias` no topo.

### 3. Crop inline
- Adicionar dependência `react-image-crop` (não está no projeto).
- Novo componente `MediaCropDialog.tsx` (overlay `Dialog`):
  - `ReactCrop` controlado, presets de aspecto: Livre, 1:1, 4:5, 9:16, 16:9.
  - Botões `Cancelar` / `Aplicar crop`.
  - Ao aplicar: renderiza recorte num `<canvas>`, converte para `Blob`, reusa `useMediaUpload` para subir o recorte e substitui a entrada em `items[idx]` (mantém `type`, atualiza `url`/`path`/`width`/`height`).
- Apenas habilitado para `type === 'image'`. Para vídeo, ícone fica desabilitado.

### 4. Múltiplos Posts (split)
- `SocialPostEditor` passa `onSplitIntoPosts` ao `StepMedia` / `MediaItemsEditor`.
- Quando acionado: cria N drafts em memória, cada um clonando o estado atual do editor com `media_items = [file_i]` e `post_type = 'feed'`.
- UX: navega para uma nova view "Lote de N posts" com tabs/lista por post (cada um permite editar caption antes de agendar). Mantém `scheduled_at` base; usuário pode escalonar manualmente.
- Persistência: ao confirmar, dispara `useCreateScheduledPost` em loop, um insert por post em `social_scheduled_posts`.

### 5. Compatibilidade por canal (carrossel)
No `StepMedia`/`StepReview`, quando `post_type === 'carousel'`:
- Aviso `Carrossel disponível em: Instagram, Facebook, LinkedIn`.
- Auto-desmarca canais não suportados (`tiktok`, `youtube`, `pinterest`, `reddit`) e exibe badge ⚠ ao lado deles na seleção de canal.
- Limites por canal aplicados no `mediaItemSchema.superRefine`: IG≤10, FB≤10, LI≤9.

### 6. Validações por arquivo
Helper `validateMediaFile(file)`:
- Imagem: ≤8MB, mime `image/jpeg|png|webp`.
- Vídeo: ≤100MB, mime `video/mp4|quicktime`.
- Inválidos não vão pro upload; aparecem como tile com badge ⚠ + mensagem (removíveis).

### 7. Banco
Migração leve em `social_scheduled_posts`:
- Adicionar coluna `post_type text default 'feed'` (valores: `feed`, `carousel`, `story`, `reels`).
- `media_items jsonb` já existe — passar a salvar `{ type, url, path, order, crop? }`. `order` será o índice do array; `crop` opcional para histórico.
- LinkedIn ainda não existe em `channelSchema.platform`: **fora do escopo desta iteração** (mantemos apenas o aviso textual). Se quiser incluir LinkedIn como canal de fato, abrir tarefa separada.

### Arquivos
- novo: `src/components/social/editor/MultiUploadChoiceDialog.tsx`
- novo: `src/components/social/editor/MediaCropDialog.tsx`
- novo: `src/lib/social/mediaValidation.ts`
- edit: `src/components/social/editor/MediaItemsEditor.tsx`
- edit: `src/components/social/editor/steps/StepMedia.tsx`
- edit: `src/components/social/editor/SocialPostEditor.tsx` (split flow + post_type)
- edit: `src/lib/social/postSchema.ts` (post_type, limites carrossel)
- edit: `src/hooks/social/useCreateScheduledPost.ts` (aceitar lote)
- dep: `bun add react-image-crop`
- migração: `ALTER TABLE social_scheduled_posts ADD COLUMN post_type text NOT NULL DEFAULT 'feed';`

### Confirmações antes de eu começar
1. **LinkedIn**: confirma que NÃO precisa virar canal real agora (só aviso textual no carrossel)? 
2. **Fluxo "Múltiplos Posts"**: posso renderizar como uma nova tela em memória com tabs (1 por post) e um botão "Agendar todos" no final, ou prefere abrir N abas/modais?
3. **Crop em vídeo**: deixar desabilitado (sem crop) — ok?