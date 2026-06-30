## Padronizar caps de listagem em 10000

### Mudanças

**1. `src/hooks/useKnowledge.ts`** — `searchAllContents` (linha 188): `.limit(2000)` → `.limit(10000)` para a busca global cobrir toda a base.

**2. `src/components/knowledge/KbTabVideos.tsx`** (linhas 52 e 54): `.limit(5000)` → `.limit(10000)` em ambas branches (com e sem termo de busca).

**3. `src/components/knowledge/KbTabArtigos.tsx`** (linhas 59 e 61): `.limit(5000)` → `.limit(10000)` em ambas branches.

### Fora de escopo
- Catálogo, Parâmetros, Distribuidores, Eventos não foram selecionados.
- Sem alterações de UI/paginação visual.