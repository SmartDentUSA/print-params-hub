## Ordenação por data de publicação

Ajustar a ordenação das listagens da Base de Conhecimento:

### 1. Aba **Artigos** (`src/components/knowledge/KbTabArtigos.tsx`)
- Hoje ordena por `view_count DESC` e cai para `created_at DESC`.
- Passar a ordenar **sempre por `created_at DESC`** (data de publicação), removendo o sort por views.

### 2. Aba **Vídeos** (`src/components/knowledge/KbTabVideos.tsx`)
- Hoje ordena por `analytics_views DESC` e cai para `created_at DESC` em todos os chips.
- Manter esse comportamento para os demais chips.
- Quando o chip ativo for **Depoimentos** (`ff524477-c553-4518-868e-8435e16a5c57`), ordenar **apenas por `created_at DESC`**, ignorando views.

### Fora do escopo
- Home / `useLatestKnowledgeArticles` e aba Parâmetros continuam como estão (não foram citados).
- Nenhuma mudança de schema, RLS ou edge function.

### Validação
- Abrir `/base-conhecimento?tab=artigos` e conferir que os cards mais recentes aparecem primeiro.
- Abrir `/base-conhecimento?tab=videos`, selecionar chip "Depoimentos" e confirmar ordem por data; alternar para outro chip e confirmar que a ordem por views é preservada.
