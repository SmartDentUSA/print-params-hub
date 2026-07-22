# Redesign da Base de Conhecimento no padrão do mockup

## Objetivo
Adotar o shell da referência para `/base-conhecimento`: sidebar esquerda persistente, hero editorial no topo do conteúdo, barra de busca em destaque, chips de subcategoria, toggle grid/list e ordenação — mantendo TODO o backend, rotas, dados e SEO como estão hoje.

## O que muda (apenas visual/estrutural)
1. **Novo shell de layout** em `KnowledgeBase.tsx`:
   - Sidebar esquerda fixa (~240px) com:
     - Logo Smart Dent no topo
     - Bloco "NAVEGAÇÃO": Visão geral, Catálogo, Vídeos, Artigos, Ebooks, Eventos, Revendas
     - Bloco "CATEGORIAS": lista de subcategorias da aba ativa com badge de contagem
     - Card CTA no rodapé ("Soluções de odontologia digital" → link atual)
   - Área principal com:
     - Header topo direita (Admin, seletor de idioma, avatar) — reaproveita `<Header>` atual
     - Hero editorial: título grande da aba + subtítulo + imagem decorativa à direita
     - Barra de busca larga (reaproveita `KbSearchBar`)
     - Chips de subcategoria em linha (reaproveita `KbChips`)
     - Toggle grid/list + dropdown "Mais recentes" à direita
     - Grid de cards (mantém `KbContentCard` / `KbProductCard` atuais)

2. **Sidebar substitui `KbTabSwitcher`** como navegação primária. O switcher horizontal atual sai; o mapeamento tab↔componente em `KnowledgeBase.tsx` permanece igual.

3. **"Visão geral"** (item novo): tela agregadora simples reutilizando cards existentes das outras abas — nada de dado novo.

4. **Toggle grid/list**: apenas CSS. Grid = layout atual. List = mesmo card em variante horizontal.

5. **Contagens de categoria na sidebar**: usa queries já existentes (`useKnowledge`, `useCatalogProducts`) — só agrega `count`.

## O que NÃO muda
- Rotas (`/base-conhecimento`, `/base-conhecimento/{letra}/{slug}`, `?tab=`)
- Nomes e keys de tabs (`parametros`, `catalogo`, `videos`, `artigos`, `ebooks`, `distribuidores`, `eventos`)
- Componentes de conteúdo (`KbTabVideos`, `KbTabCatalogo`, `KbContentCard`, dialogs, etc.)
- `seo-proxy` (SSR para bots) — nenhuma alteração
- Contrato de dados, hooks, i18n keys
- URLs de artigos, deep-links, share links

## Risco real por eixo

**SEO / GEO — MUITO BAIXO**
- Zero mudança em rotas, JSON-LD, sitemap, `seo-proxy`. Bots continuam vendo o mesmo HTML.
- Sidebar adiciona links internos (bom para crawl). Nenhuma URL removida.

**Regressão funcional — BAIXO-MÉDIO**
- Risco concentrado em: preservar `?tab=` deep-links, deep-link de artigo (`contentSlug`), i18n PT/EN/ES, `KbTabSwitcher` sendo removido sem quebrar rotas alias (`/artigos`, `/catalogo`).
- Mitigação: manter as mesmas keys de tab; sidebar chama o mesmo `setTab()`.

**Mobile — MÉDIO**
- Mockup é claramente desktop. Sidebar precisa virar drawer/off-canvas em ≤900px, com botão hamburger no header. Hero encolhe (só título + subtítulo, sem imagem). Chips com scroll-x.
- Sem cuidado explícito, mobile quebra.

**Escopo de código — MÉDIO**
- `KnowledgeBase.tsx` (110 linhas) recebe wrapper novo (baixo).
- `kbStyles` (CSS inline gigante) precisa ganhar tokens do novo shell.
- Nenhum arquivo de aba interna precisa ser reescrito.

**Performance — BAIXO**
- Contagens de sidebar são queries agregadas leves; usam cache do React Query existente.

**Superfície de dados nova — ZERO**
- Não cria tabelas, colunas, edge functions. Só consome o que já existe.

## Fases (todas revertíveis)

**Fase 1 — Shell isolado atrás de flag**
- Criar `KbShellSidebar.tsx` + `KbHero.tsx` + `KbToolbar.tsx` (grid/list + sort).
- Feature flag `?shell=v2` renderiza o novo layout envolvendo os `KbTab*` atuais sem tocar neles.
- Preview lado-a-lado com URL antiga.

**Fase 2 — Sidebar com contagens + "Visão geral"**
- Hook `useKbCounts()` agrega totais por aba/subcategoria (queries já existentes).
- Tela "Visão geral" com blocos "Últimos vídeos", "Últimos artigos", "Produtos em destaque" reusando cards.

**Fase 3 — Mobile + toggle list/grid + remoção da flag**
- Sidebar vira drawer em ≤900px.
- Variante `.kb-card--list` no CSS.
- Substituição definitiva; `KbTabSwitcher` removido.

## O que NÃO fazer
- Não trocar rotas nem slugs.
- Não mexer em `seo-proxy` (bots).
- Não reescrever `KbTabVideos/Artigos/Catalogo` — só envolver.
- Não adicionar "avatar do usuário" no header se não houver auth de front-end para isso (mostrar só quando `useAuth` retornar user real).
- Não inventar contagens — só usar dado real; oculta o badge quando `count = 0`.

## Estimativa
Fase 1: ~½ dia. Fase 2: ~½ dia. Fase 3: ~½ dia. Total ~1,5 dia com validação.

## Veredito
Risco **baixo** desde que seja tratado como refit de shell (envelope) e não como reescrita das abas. O ponto único de atenção real é o mobile (drawer + hero colapsável). Nada aqui ameaça SEO, dados, CRM, ou os fluxos já estabilizados.
