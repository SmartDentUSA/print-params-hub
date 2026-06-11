## Refatoração da página KnowledgeBase

Substituir o corpo de `src/pages/KnowledgeBase.tsx` por um novo shell de 4 tabs (Parâmetros, Vídeos, Artigos, Catálogo), pixel a pixel conforme a spec. Zero alteração em hooks, rotas, edge functions, CSS global, ou qualquer arquivo fora do escopo da KnowledgeBase.

## Arquivos a alterar

**`src/pages/KnowledgeBase.tsx`** — substituir todo o `<main>` pelo novo shell:
- Manter `<Header showAdminButton />` intacto.
- Manter `<KnowledgeSEOHead>` ativo apenas quando a URL contém `:contentSlug` (deep link de artigo).
- Adicionar um único `<style>` local com todos os tokens `--kb-*`, keyframes `kbFadeIn` e `shimmer`, scrollbar customizada — tudo escopado em `.kb-root`.
- Renderizar `.kb-root` com `<KbTabSwitcher>` + painel do tab ativo.
- Remover do JSX (arquivos preservados): hero + search antiga, `KnowledgeCategoryPills`, grid `KnowledgeSidebar`/`KnowledgeContentViewer`, `KnowledgeFeed`, seção help/WhatsApp, footer inline.
- Quando `contentSlug` estiver presente, abrir `<Dialog>` shadcn com `<KnowledgeContentViewer>` sobre o tab Artigos.

## Arquivos a criar em `src/components/knowledge/`

1. `KbTabSwitcher.tsx` — pill `#FFFFFF` r-30px com 4 botões (ícones SVG inline: sliders/play/file-text/grid 2×2). Lê e grava `?tab` via `useSearchParams` + `window.history.replaceState`.
2. `KbSectionHeader.tsx` — h1 24px + p 14px centralizado.
3. `KbSearchBar.tsx` — input pill `#E8ECF4`, debounce 300ms, placeholder configurável.
4. `KbChips.tsx` — chips reutilizáveis (mesmo componente usado em marcas, categorias e catálogo).
5. `KbResultCount.tsx` — texto centralizado "{N} … encontrado(s)".
6. `KbEmptyState.tsx` — ícone temático + "Nenhum resultado encontrado".
7. `KbSkeletonGrid.tsx` — 8 cards skeleton com shimmer.
8. `KbContentCard.tsx` — card padrão (thumb 16:9, meta+badge categoria, título 2-line, excerpt 2-line, footer data+botão). Props para badge de duração e label do botão.
9. `KbTabParametros.tsx` — fluxo marca → modelo → grid de resinas. Sem busca. Queries:
   - `brands WHERE active=true ORDER BY name`
   - `models WHERE brand_id=X AND active=true` + count agregada de `parameter_sets` por model
   - `parameter_sets ps LEFT JOIN resins r ON r.name=ps.resin_name AND r.active=true WHERE ps.brand_slug AND ps.model_slug AND ps.active=true ORDER BY ps.resin_name`
   - Card de resina com 6 parâmetros (Exposição/Fundo/Camadas/Espessura/Vel. subida/Vel. retorno), badges FDA/ANVISA, badge anti-aliasing, botão `Ver página →` para `https://parametros.smartdent.com.br/base-conhecimento/f/{resin_slug}` (só se `resin_slug` existir), notas com prefixo 📝.
10. `KbTabVideos.tsx` — query com `INNER JOIN knowledge_videos` (via `knowledge_videos!inner(...)`), filtros por `category_id` e ILIKE em `title`/`excerpt`, LIMIT 50. Card com thumb, badge de duração formatada (`M:SS` ou `Xh Ymin`), botão "▶ Assistir" abre Dialog com `<KnowledgeContentViewer>`.
11. `KbTabArtigos.tsx` — mesmo padrão, com 2 queries combinadas para emular `NOT EXISTS knowledge_videos` (PostgREST não suporta NOT EXISTS direto). Card com `og_image_url`, botão "Ler mais →" abre Dialog.
12. `KbTabCatalogo.tsx` — query direta em `products_catalog` com `category IN (...7 valores...)`, filtros por chip e ILIKE em `name`. Card com placeholder colorido + emoji 📦, badge da categoria, badges especiais detectados em `subcategory` (FDA/ANVISA/NOVO/KIT/KOL/LANÇAMENTO), botão "Ver mais +" abre `datasheet_url` ou `spec_sheet_url`.
13. `kbCategoryColors.ts` — mapa estático `CATEGORY_COLORS[letter] = { color, bgBadge, emoji, gradient }` para as 7 letras (A–G) + cores das 7 categorias de catálogo. Reutilizado por `KbContentCard`.

## Comportamentos

- **URL tab**: ler `?tab` no mount; gravar com `window.history.replaceState(null,'',\`?tab=${tab}\${hash}\`)` ao trocar. Default `parametros`. Quando entra com `:categoryLetter` legado sem `?tab`, mapear: A/E → vídeos; B/C/D/F → artigos; G → catálogo.
- **Deep link de artigo**: rota legada `/base-conhecimento/:letter/:slug` continua resolvendo no mesmo componente; conteúdo abre em `<Dialog>` sobre o tab Artigos (preserva SEO + Dra. LIA + i18n). Ao fechar, `replaceState('?tab=artigos')`.
- **i18n**: render PT fixo (rotas `/en/knowledge-base` e `/es/base-conocimiento` apontam para o mesmo componente; spec é toda em PT).
- **Click em card de vídeo/artigo**: abre Dialog com `<KnowledgeContentViewer>` (sem mudar rota); botão "Ver no link" dentro do viewer continua linkando para `getArticleUrl(content)` (canônico atual).
- **Busca**: input controlado com debounce 300ms; filtragem em memória sobre o batch carregado (LIMIT 50/100) por `title` + `excerpt`.
- **Skeleton**: 8 placeholders idênticos em dimensão durante loading.
- **Stagger**: `animationDelay = index * 22ms` em cards de conteúdo; `index * 18ms` em cards de resina.

## Preservação de dados

Zero mock, zero hardcoded, zero seed. Todas as queries são `SELECT` puros via `@/integrations/supabase/client`, exatamente como na spec, sobre as tabelas existentes (591 knowledge_contents, 547 knowledge_videos, 260 parameter_sets, 14 resins, 54 models, 15 brands, 123 products_catalog filtrado pelas 7 categorias).

## Arquivos NÃO tocados

`KnowledgeContentViewer`, `KnowledgeFeed`, `KnowledgeSidebar`, `KnowledgeCategoryPills`, `KnowledgeSEOHead`, `Header`, `Footer`, `DraLIA`/`AgentEmbed`, `Index.tsx`, `PrinterParamsFlow`, `BrandSelector`, `ModelGrid`, `ParameterTable`, `SupportResources`, todos os hooks (`useKnowledge`, `useKnowledgeSearch`, `useAllVideos`, `useCatalogProducts`, `useSupabaseData`), `App.tsx`, rotas, edge functions, `index.css`, `tailwind.config.ts`.
