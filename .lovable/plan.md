# Integração Carrossel Sistema A → Social Publisher

## Rotas
Adicionar alias `/ferramentas/social-publisher/criar` apontando para `SocialPostEditor` em `src/App.tsx`, além da rota existente `/social/novo`. Ambas renderizam o mesmo componente.

URL final esperada:
```
/ferramentas/social-publisher/criar?source=carrossel&ref=carrosseis/bio-vitality/abc123&produto=bio-vitality&tipo=visual&total=6
```

## Arquivos afetados
1. `src/App.tsx` — alias de rota.
2. `src/components/social/editor/SocialPostEditor.tsx` — ler query params, estado `selectedCarrosselImages`, montar `media_items` final, passar props.
3. `src/components/social/editor/steps/StepContent.tsx` — seção "Carrossel Recebido" + pré-seleção automática de produto via slug.
4. `src/components/social/editor/steps/StepMedia.tsx` — container "Imagens do Carrossel" ordenável acima do upload manual.

Nenhuma migration. Sem alterações em `postSchema`, hooks de publish/schedule, ou outras telas.

## Mudança 1 — Seção "Carrossel Recebido" (StepContent)

`SocialPostEditor.tsx`:
- `useSearchParams()` para extrair `source`, `ref`, `produto`, `tipo`, `total` (parse int, clamp 1–20).
- Construir URLs públicas via `import.meta.env.VITE_SUPABASE_URL`:
  ```
  ${SUPABASE_URL}/storage/v1/object/public/wa-media/${ref}/slide-${i}.png
  ```
  (`i` de 0 a `total-1`).
- Estado `selectedCarrosselImages: string[]` (URLs na ordem em que o usuário marcou).
- Passar para `StepContent`: `carrosselSlides`, `carrosselTipo`, `produtoSlug`, `selectedCarrosselImages`, `onToggleCarrosselImage`, `onSelectAllCarrossel`, `onClearCarrossel`.

`StepContent.tsx`:
- Quando `source === 'carrossel'`, renderizar acima do bloco "Copies prontas":
  - Título `🖼️ Carrossel Recebido do Gerador` + `Badge "Novo"` (verde `bg-emerald-500/15 text-emerald-600 border-emerald-500/30`).
  - Label `Carrossel {tipo} — {N} slides`.
  - Botão "Selecionar todos" / "Limpar".
  - Grid responsivo: `grid grid-cols-3 gap-2` desktop, `flex overflow-x-auto` mobile. Thumbnails 120×120 com `Checkbox` por item. Número de slide visível.
- Bloco "Copies prontas do Sistema A" permanece inalterado, logo abaixo.
- Pré-seleção do produto: ao carregar `products`/`resins`, se `produtoSlug` presente e `value.product_ref` vazio, procurar primeiro em `products` (por `slug === produtoSlug`), depois em `resins`; chamar `onProductChange('product:'+id)` ou `'resin:'+id` automaticamente.

## Mudança 2 — Container "Imagens do Carrossel" (StepMedia)

`@dnd-kit/core`, `@dnd-kit/sortable` e `@dnd-kit/utilities` já estão instalados.

`StepMedia.tsx`:
- Receber `selectedCarrosselImages` e `onCarrosselReorder` / `onCarrosselRemove` via props.
- Se array não vazio, renderizar bloco ACIMA do `MediaItemsEditor` padrão:
  - Título `📌 Imagens do Carrossel`.
  - Grid de cards 120×120, cada um com:
    - Preview `<img>`.
    - Número de ordem no topo-esquerda.
    - Handle `GripVertical` para drag.
    - Botão `X` topo-direita (remove o item de `selectedCarrosselImages`).
  - `DndContext` + `SortableContext` (estratégia `rectSortingStrategy`) + `arrayMove` para reordenar.
- Se vazio: nada é renderizado (comportamento atual preservado).
- `MediaItemsEditor` (uploads manuais) fica intacto abaixo.

## Mudança 3 — Mídia final do post

No `SocialPostEditor.tsx`, sempre que `selectedCarrosselImages` mudar, sincronizar a lista efetiva em `data.media_items` de forma que a parte inicial seja o carrossel (na ordem definida pelo usuário) e o restante sejam uploads manuais. Estratégia:
- Manter `manualMedia: MediaItem[]` separado do carrossel.
- Computar `data.media_items = [...carrosselAsMedia, ...manualMedia]` antes do preview/validação/salvar.
- `carrosselAsMedia = selectedCarrosselImages.map(url => ({ url, type: 'image' as const, path: '' }))`.

Isso garante que `SocialPostPreview`, `StepReview` e o salvamento usem a mídia correta sem alterar `postSchema`.

## Mudança 3b — Geração de copy
Pré-seleção de produto (acima) é a única mudança. `useGenerateCaption`, tons e instruções permanecem inalterados.

## Não alterar
- `postSchema`, hooks `useCreateScheduledPost`, `useUpdateScheduledPost`, `useMediaUpload`.
- `StepChannels`, `StepSchedule`, `StepReview` (consomem `media_items` final automaticamente).
- Outras telas do Social Publisher.

## QA
- Abrir URL com 6 slides → carrossel renderiza, produto pré-selecionado.
- Selecionar tudo → 6 cards aparecem em "Imagens do Carrossel" no passo 2, drag-and-drop funciona.
- Remover/adicionar uploads manuais → aparecem após os do carrossel no preview.
- URL sem `source=carrossel` → comportamento atual 100% preservado.
