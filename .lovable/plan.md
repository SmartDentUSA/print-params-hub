## 1. Busca global em Vídeos / Artigos (público)

Arquivos: `src/components/knowledge/KbTabVideos.tsx`, `src/components/knowledge/KbTabArtigos.tsx`.

Hoje a busca usa `.or(title/excerpt/content_html ILIKE ...)` mas capa em `.limit(500)` — pode esconder resultados.

- Quando o usuário digita um termo (≥ 2 chars), remover o `.limit()` (ou subir para 5000) e remover o `.eq('category_id', chip)` durante a busca — busca passa a varrer **toda** a base de conhecimento ativa, ignorando o chip atual.
- Manter a paginação padrão (50/150) e o filtro por chip quando o campo de busca está vazio.
- Em `KbTabArtigos`, o pré-filtro de IDs com vídeo continua sendo aplicado pós-query.
- Mostrar um pequeno aviso "Buscando em toda a base" quando o termo está ativo e o chip foi temporariamente ignorado.

## 2. "Gerenciar Base de Conhecimento" (admin) — paginação + busca global

Arquivo: `src/components/AdminKnowledge.tsx` (bloco da lista de `contents` a partir da linha 1753) + `src/hooks/useKnowledge.ts` (`fetchContentsByCategory`).

- Quando NÃO há termo de busca: mostrar somente os primeiros **100 conteúdos** da categoria selecionada. Adicionar botão **"Mostrar tudo (N)"** ao final que expande para o array completo.
- Quando há termo de busca (`contentSearch` não vazio):
  - Disparar uma busca global no Supabase em `knowledge_contents` (sem filtro por categoria), via novo método `searchAllContents(term)` em `useKnowledge`, usando `.or(title.ilike, slug.ilike, excerpt.ilike, content_html.ilike)` com `.limit(2000)` e `eq('active', true)`.
  - Renderizar os resultados desta busca em vez da lista da categoria, exibindo um chip "Buscando em todas as categorias — N resultados" e botão "Limpar busca".
- O filtro local em memória continua como complemento (refina conforme digita), mas a fonte agora é a query global.

## 3. Apresentações não aparecem em "Resina Smart Print Modelo Láqua"

Causa: o catálogo tem o nome PT "Resina Smart Print Modelo Láqua" enquanto a `resins.name` é "Smart Print Model L'Aqua". O matcher `resinKey` tokeniza `Láqua → laqua` no catálogo e `L'Aqua → l aqua → aqua` na resina (apóstrofo separa, `l` é descartado por tamanho 1). Não há overlap → resin não é casado, e por isso `resin_presentations` (6 linhas existentes no banco) não são exibidas.

Correção em `src/components/knowledge/KbTabCatalogo.tsx`:

- Indexar resinas também por **slug** (`m.set('slug:' + r.slug, info)`).
- No lookup de cada card (apenas quando `isResinCategory`), tentar nesta ordem:
  1. `resins.get(name.lowercased)`
  2. `resins.get('slug:' + p.slug)` *(novo — resolve o caso L'Aqua, slugs idênticos no banco)*
  3. `resins.get('fk:' + resinKey(p.name))`
  4. `findResinBySubset(...)`
- Reforço no `resinKey`: tratar apóstrofos/acentos colando tokens (`l'aqua → laqua`) substituindo `'` por vazio **antes** do split de palavras. Mantém `+` para "+Flex". Isto previne casos análogos futuros sem afetar matches atuais.

Nenhuma mudança em RLS, schema ou edge functions.

### Arquivos tocados
- `src/components/knowledge/KbTabVideos.tsx`
- `src/components/knowledge/KbTabArtigos.tsx`
- `src/components/knowledge/KbTabCatalogo.tsx`
- `src/components/AdminKnowledge.tsx`
- `src/hooks/useKnowledge.ts`
