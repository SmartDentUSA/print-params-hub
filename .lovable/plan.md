## Diagnóstico

Backfill no banco está correto — `resins.image_background_removed_url` para o Bio Temp B1 aponta para `https://pgfgripuanuwwolmtknn.supabase.co/.../37149ad6-...webp` e o `curl` confirma **HTTP 200** com `access-control-allow-origin: *`.

O motivo de a imagem não carregar no card do admin é **estado obsoleto no `AdminSettings`**: a lista `resins` é lida uma única vez ao montar (`select('*')`) e passada para o `AdminModal` como `item`, que inicializa `formData = { ...item }`. Como a página foi aberta antes do backfill, o `formData.image_background_removed_url` continua `null` e o `resolveProductImage` cai no `image_url` externo (awsli), que aparece quebrado ou barrado pelo CORS.

## Correção

Fazer o `ResinCardStudio` **rehidratar a resina** por `id` ao montar/receber outra resina, garantindo que sempre use os campos mais atuais do banco — inclusive `image_background_removed_url` gravado por outro fluxo (backfill, botão de reimportar, sync).

### `src/components/resin-card/ResinCardStudio.tsx`

- Adicionar `useState` `hydratedResin` inicializado com a prop `resin`.
- `useEffect([resin?.id])`: se `resin?.id` existir, `SELECT image_url, image_urls, image_background_removed_url, name, info_card_plan_pt, info_card_plan_en, info_card_plan_es, processing_instructions FROM resins WHERE id = ?`.
- Ao receber, fazer `setHydratedResin({ ...resin, ...fresh })` (o merge preserva campos não persistidos ainda em edição).
- Usar `hydratedResin` em vez de `resin` em `resolveProductImage`, `planPt`, `ensurePlan`, `handleReimportImage` (mantendo `resin.id`).
- Após o `handleReimportImage` gravar a nova URL, atualizar `hydratedResin` localmente em vez de forçar `window.location.reload()`, para UX mais suave.

### Fora do escopo

- Não alterar `resolveProductImage`, `ProductHero`, exportação, `system_a_catalog` nem o fluxo do `AdminSettings`.
- Não mexer nas 8 resinas sem imagem alguma nem nas 3 awsli sem match — elas continuam com o botão de reimportar.

## Como validar

1. Reabrir a modal do Smart Print Bio Temp B1: chip "Imagem do produto" deve ficar verde, preview renderiza a imagem oficial.
2. Exportar PT: PNG sai com a imagem oficial embutida (sem erro CORS na exportação).