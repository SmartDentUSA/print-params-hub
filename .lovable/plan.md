# Bug: Importar produto por URL retorna produto errado

## Diagnóstico (confirmado)

Ao importar `https://loja.smartdent.com.br/ativacao-dentalcad-ultimate-lab-bundle-rms` pelo botão "Novo Produto" (`PublicAPIProductImporter.tsx`), o app chama a edge function `get-product-data?slug=ativacao-dentalcad-ultimate-lab-bundle-rms`.

Verificação real na API/DB:
- Não existe nenhuma linha em `system_a_catalog` com slug/nome contendo "ativacao-dentalcad-ultimate-lab-bundle" nem "ultimate lab bundle".
- A edge function então cai nos **fallbacks fuzzy** em `supabase/functions/get-product-data/index.ts`:
  1. `slug ILIKE %ativacao-dentalcad-ultimate-lab-bundle-rms%` — não acha.
  2. `name ILIKE %ativacao dentalcad ultimate lab bundle rms%` — não acha.
  3. **`name ILIKE %<longestToken>%`** — o "longestToken" é `dentalcad` (após filtro de stopwords). Isso casa com "DentalCAD - Software CAD da exocad" (slug `exocad-software-cad`) e devolve **esse produto errado** com `message: "Produto encontrado (fallback catalog)"`.
- O importer aceita o payload e mostra o produto errado como se fosse o correto.

Testado: `curl .../get-product-data?slug=ativacao-dentalcad-ultimate-lab-bundle-rms` → retorna `exocad-software-cad`. Bug reproduzido.

Causa raiz: quando a origem é uma **URL autoritativa** da loja, cair em match por token único de nome cruza para produtos completamente diferentes. O fallback foi desenhado para busca fuzzy genérica, não para lookup por slug.

## Correção

Editar `supabase/functions/get-product-data/index.ts`:

1. Manter tentativa exata em `system_a_catalog.slug = slug`.
2. Manter tentativa exata em `resins.slug = slug`.
3. **Remover** os fallbacks por `name ILIKE %spaceQuery%` e `name ILIKE %longestToken%` (tanto em catalog quanto em resins). Eles são a fonte do falso positivo.
4. Manter apenas `slug ILIKE %slug%` como fallback tolerante (protege contra trailing hyphen, sufixos triviais) — sem cruzar entidades.
5. Se nada casar, devolver `404` com `{ success: false, message: "Nenhum produto encontrado" }` — o importer já trata esse erro exibindo toast "Produto não encontrado".

Frontend (`PublicAPIProductImporter.tsx`): sem mudanças necessárias — ele já lida com `!success` como erro.

## Efeito colateral esperado

- Slugs que dependiam desse fuzzy amplo para "sugerir" um produto parecido deixarão de trazer resultado. Isso é o comportamento correto para o fluxo "importar por URL", que precisa ser 1:1. Buscas exploratórias devem usar outra tela/endpoint, não a importação.

## Arquivos afetados

- `supabase/functions/get-product-data/index.ts` (única edição)

## Validação pós-fix

- `curl .../get-product-data?slug=ativacao-dentalcad-ultimate-lab-bundle-rms&approved=true` → deve retornar `404 / success:false`.
- `curl .../get-product-data?slug=exocad-software-cad&approved=true` → continua retornando o produto exocad correto (match exato).
