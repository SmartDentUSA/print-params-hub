

## Melhorar Sistema de Tracking de Páginas

### Tarefa 1 — Corrigir `detectPageType` em `usePageTracking.ts`

Substituir a função `detectPageType` (linhas 44-57) pela nova lógica que classifica corretamente rotas de artigos, categorias, resinas (`resin_params`), etc.

### Tarefa 2 — Enriquecer tracking nas páginas de parâmetros

No `usePageTracking.ts`, extrair os segmentos da URL para rotas de 3 segmentos (brand/model/resin) e incluir `extra_data` no insert do Supabase. Também enviar `parameter_card_view` ao dataLayer do GTM.

Mudança no insert existente: quando `page_type === 'resin_params'`, adicionar campo `extra_data` com `{ brand, model, resin, action: 'view' }`.

### Tarefa 3 — Evento de cópia de parâmetros

No `ParameterTable.tsx`, após a cópia bem-sucedida (linha 315), adicionar:
- Insert fire-and-forget em `lead_page_views` com `page_type: 'resin_params'` e `extra_data: { ...slugs, action: 'copy' }`
- `dataLayer.push` com evento `parameter_copied`

Os slugs serão extraídos de `window.location.pathname` (split por `/`), já que o componente não recebe props de rota.

### Tarefa 4 — GTM dataLayer para view de parâmetros

Já coberto na Tarefa 2 — o `dataLayer.push` com `parameter_card_view` será adicionado junto ao enriquecimento do tracking.

### Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePageTracking.ts` | Substituir `detectPageType`, adicionar `extra_data` condicional + GTM push para params |
| `src/components/ParameterTable.tsx` | Adicionar tracking de cópia (Supabase + GTM) no `handleCopy` |

### Detalhes técnicos
- Slugs extraídos de `window.location.pathname.split('/')` — sem necessidade de passar props
- Insert fire-and-forget (`.then()` sem await)
- Session ID reutilizado via `getPageTrackingSessionId()` já exportado
- Nenhuma tabela ou edge function criada/alterada

