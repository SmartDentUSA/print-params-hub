## Adicionar aba "Ebooks" na Base de Conhecimento

Nova aba na Base de Conhecimento pública que agrega artigos marcados como Ebook, independente da categoria original. O artigo continua com sua categoria (A–G) e ganha uma flag adicional `is_ebook` controlada por um toggle no editor.

### 1. Banco de dados (migration)
- Adicionar coluna `is_ebook boolean not null default false` em `public.knowledge_contents`.
- Índice parcial `create index if not exists idx_knowledge_contents_is_ebook on public.knowledge_contents (is_ebook) where is_ebook = true;` para acelerar a listagem da aba.
- Sem alteração de RLS/GRANTS (coluna nova em tabela existente já liberada).

### 2. Editor de conteúdo — `src/components/AdminKnowledge.tsx`
- Adicionar `is_ebook: false` ao `formData` inicial, ao reset e ao carregamento de artigo existente (`content.is_ebook`).
- Logo abaixo do bloco `<Label>Categoria</Label>` (linhas ~2037–2057), inserir um bloco com `Switch` + label **"Marcar como Ebook"** e descrição curta: *"Se ativo, o artigo também aparece na aba Ebooks da Base de Conhecimento, mantendo sua categoria original."*
- Incluir `is_ebook: effectiveFormData.is_ebook` no payload de insert/update (~linha 1197 e demais pontos de save).

### 3. Nova aba pública
- `src/components/knowledge/KbTabSwitcher.tsx`: adicionar `'ebooks'` ao tipo `KbTab`, à `ORDER` (posição entre `artigos` e `distribuidores`) e ao `ICONS` (ícone de livro).
- `src/locales/{pt,en,es}.json`: adicionar `kb.tabs.ebooks` ("Ebooks" / "Ebooks" / "Ebooks").
- `src/pages/KnowledgeBase.tsx`: aceitar `'ebooks'` na validação do query param e no switch; renderizar `<KbTabEbooks onOpen={openArticle} />`.
- Criar `src/components/knowledge/KbTabEbooks.tsx` reutilizando o layout/consultas do `KbTabArtigos.tsx`, mas filtrando `is_ebook = true` na query `knowledge_contents`. Mantém ordenação, paginação, cards e abertura em Dialog idêntica à aba Artigos.

### 4. Tipos
- `src/integrations/supabase/types.ts` é regenerado automaticamente após a migration; nenhum edit manual.

### Fora do escopo
- Não cria nova categoria em `knowledge_categories`.
- Não altera URLs canônicas dos artigos (permanecem `/base-conhecimento/{letra}/{slug}`).
- Não mexe em SEO/sitemap agora (pode entrar em fase 2 se necessário).
