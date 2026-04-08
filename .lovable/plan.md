

## Fix: Page Views do SPA não chegam ao Google Analytics

### Causa raiz

O site é uma SPA (Single Page Application). O GTM/GA só dispara `page_view` no carregamento inicial do `index.html`. Navegações internas (React Router) não geram novos requests HTTP — o GA simplesmente não sabe que o usuário mudou de página.

O hook `usePageTracking` (linha 63-96) já detecta cada mudança de rota e envia para o Supabase, mas **não faz `dataLayer.push`** para o GTM.

### Solução

Adicionar um `dataLayer.push` com evento `page_view` virtual dentro do `usePageTracking`, no mesmo ponto onde já insere no Supabase. Isso faz o GTM/GA receber cada navegação.

### Mudança

**Arquivo**: `src/hooks/usePageTracking.ts`

Dentro do `setTimeout` callback (após `lastTracked.current = key`), adicionar antes do insert no Supabase:

```typescript
// Push virtual pageview to GTM/GA
if (typeof window !== 'undefined' && (window as any).dataLayer) {
  (window as any).dataLayer.push({
    event: 'page_view',
    page_path: path,
    page_title: document.title,
    page_type: detectPageType(path),
    page_location: window.location.href,
    session_id: sessionId,
    ...utms,
  });
}
```

### O que isso resolve

- Cada navegação interna (artigos, produtos, depoimentos, parâmetros) será reportada ao GA como um page_view
- Os dados de UTM, tipo de página e session_id ficam disponíveis como variáveis no GTM
- O `session_id` permite correlacionar o GA com o tracking interno do Supabase
- Zero impacto no tracking existente — é um push adicional

### Escopo

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePageTracking.ts` | +8 linhas (dataLayer.push dentro do setTimeout) |

Nenhum outro arquivo precisa mudar.

