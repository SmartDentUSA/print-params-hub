

## Fix: Letter mismatch redirect + placeholder links na Base de Conhecimento

### Problemas

1. **Letter errado na URL** → artigo não carrega (ex: `/base-conhecimento/a/slug` quando artigo está na cat E)
2. **`/base-conhecimento/undefined/slug`** → já corrigido parcialmente, mas precisa reforçar
3. **Links `href="#"` no content_html** → cliques não fazem nada
4. **Links internos no HTML** → recarregam a página em vez de usar React Router

### Mudanças

#### 1. Redirect de letter errado em `KnowledgeBase.tsx`
No `useEffect` que carrega o artigo por slug (linha 97-107), após `fetchContentBySlug`:
- Comparar `categoryLetter` da URL com `knowledge_categories.letter` do artigo retornado
- Se não bater, fazer `navigate(url_correta, { replace: true })`
- Se artigo não existir, mostrar estado vazio ou redirecionar para listagem

#### 2. Interceptar cliques em `DirectHTMLRenderer.tsx`
Adicionar `useEffect` com event listener de click no container:
- Bloquear `href="#"` e `javascript:void(0)`
- Interceptar links internos (`/base-conhecimento/...`) e usar `useNavigate` do React Router
- Manter comportamento atual de links externos (target=_blank)

#### 3. Importar `useNavigate` no DirectHTMLRenderer
Necessário para interceptar links internos sem reload.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/KnowledgeBase.tsx` | Redirect quando letter não bate com artigo |
| `src/components/DirectHTMLRenderer.tsx` | Interceptar cliques em `#` e links internos |

### Resultado
- `/base-conhecimento/a/slug-da-cat-e` → redireciona para `/base-conhecimento/e/slug-da-cat-e`
- Links `href="#"` não fazem nada (sem scroll indesejado)
- Links internos navegam via React Router (sem reload)

