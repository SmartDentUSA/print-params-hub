
# Fix: Timeout na Importação de Catálogo (upload de imagens + payload grande)

## Causa raiz real (pós-fix do regex)

O erro de regex foi corrigido. O novo erro vem de **dois problemas combinados**:

### Problema 1 — Upload de imagem por produto (timeout)
A função `mapProducts` (linha 416-479) faz upload de imagem para cada produto via `uploadImageToStorage`, que inclui:
- `fetch()` externo para baixar a imagem
- Upload para Supabase Storage
- Verificação se arquivo já existe (loop de storage list)

Com 116 produtos, isso pode levar **5-10 minutos** — muito além do timeout de 150s da edge function.

### Problema 2 — Upsert único de todos os itens
A função tenta fazer upsert de todos os itens em uma única chamada (linha 843-858). Com depoimentos + produtos + reviews, o payload pode ser muito grande.

## Solução

### Fix 1 — Desabilitar upload automático de imagens no `mapProducts`
O upload de imagens não é necessário para a importação do catálogo — a URL original já funciona. A migração de imagens pode ser feita depois, separadamente.

```typescript
// Antes (linha 424-433):
let finalImageUrl = product.image_url
if (product.image_url && product.image_url.startsWith('http')) {
  console.log(`🖼️ Processando imagem: ${product.name}`)
  finalImageUrl = await uploadImageToStorage(...)
}

// Depois: usar URL original diretamente
const finalImageUrl = product.image_url || null
```

### Fix 2 — Upsert em lotes pequenos (chunked)
Substituir o upsert único por lotes de 50 itens para evitar payload grande:

```typescript
// Dividir em lotes de 50
const UPSERT_BATCH = 50
for (let i = 0; i < allCatalogItems.length; i += UPSERT_BATCH) {
  const batch = allCatalogItems.slice(i, i + UPSERT_BATCH)
  const { error } = await supabase
    .from('system_a_catalog')
    .upsert(batch, { onConflict: 'source,external_id', ignoreDuplicates: false })
  if (error) throw error
}
```

### Fix 3 — Adicionar `product_category` e `product_subcategory` ao mapeamento
A função está tentando inserir esses campos mas não estão na interface `CatalogItem`. Adicionar ao tipo para evitar erros de TypeScript e garantir que sejam salvos.

## Arquivo modificado

**`supabase/functions/import-system-a-json/index.ts`**

Mudanças:
1. Linha ~424-433: remover `uploadImageToStorage`, usar URL original diretamente
2. Linha ~843-858: substituir upsert único por loop em lotes de 50
3. Interface `CatalogItem` (linha 82): adicionar campos `product_category` e `product_subcategory`

Nenhuma mudança de banco, nenhuma migração, nenhuma alteração de UI.

## Seção Técnica

- Edge functions Supabase têm timeout de **150 segundos**. Com 116 produtos × ~2s por upload de imagem = ~230s → timeout.
- O `uploadImageToStorage` também chama `storage.list()` em loop (até 100 vezes) antes de cada upload, multiplicando o problema.
- Remover o upload de imagens reduz o tempo de execução de ~3-4 minutos para ~5-10 segundos.
- O upsert em lotes de 50 elimina o risco de payload too large (limite ~6MB por request no Supabase).
- As imagens externas da apostila continuarão funcionando via URL original — se quiser migrar para Storage depois, pode ser feito via função separada `migrate-catalog-images` (já existe no projeto).
