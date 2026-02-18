
# Fix: Campos brand, mpn, anti_hallucination, required_products, forbidden_products nulos após importação

## Causa raiz identificada (leitura direta do JSON)

Após ler a estrutura real do arquivo `knowledge_base_llm_optimized_2026-02-18.json`, foram identificados dois problemas distintos:

### Problema 1 — required_products e forbidden_products estão dentro de anti_hallucination

No JSON real, a estrutura é:
```
product.anti_hallucination.required_products[]
product.anti_hallucination.forbidden_products[]
product.anti_hallucination.never_claim[]
product.anti_hallucination.never_mix_with[]
product.anti_hallucination.always_require[]
product.anti_hallucination.always_explain[]
product.anti_hallucination.never_use_in_stages[]
```

O mapeamento atual está tentando ler `product.required_products` e `product.forbidden_products` no nível raiz — esses campos **não existem** lá. Por isso chegam nulos.

### Problema 2 — brand e mpn existem no produto mas chegam nulos

O banco mostra `brand: null` para produtos como "Atos Resina Composta Direta - DA1" que claramente tem `"brand": "SMART DENT®"` e `"mpn": "9021.29.00"` no JSON. Isso indica que o upsert está sendo executado mas sobrescrevendo com `extra_data` sem esses campos (conflito com registro anterior do arquivo apostila que não tinha esses campos, e cujo `extra_data` sobrescreveu o novo).

### Problema 3 — bot_trigger_words não existe no novo arquivo

O campo `bot_trigger_words` não aparece em nenhum produto do novo arquivo `llm_optimized`. Foi mapeado desnecessariamente. Pode ser removido do mapeamento (será null sempre).

### Estrutura correta confirmada do produto

```json
{
  "id": "760dd503-...",
  "name": "Atos Resina Composta Direta - DA1",
  "brand": "SMART DENT®",          ← nível raiz (OK, mas upsert sobrescrevendo)
  "mpn": "9021.29.00",             ← nível raiz (OK, mas upsert sobrescrevendo)
  "sales_pitch": "...",            ← nível raiz (já funcionando)
  "faq": [...],                    ← nível raiz (já funcionando)
  "anti_hallucination": {          ← objeto completo
    "never_claim": [...],
    "never_mix_with": [...],
    "always_require": [...],
    "always_explain": [...],
    "never_use_in_stages": [...],
    "required_products": [...],    ← está AQUI, não no nível raiz
    "forbidden_products": [...]    ← está AQUI, não no nível raiz
  }
}
```

## Solução

### Mudança única: `supabase/functions/import-system-a-json/index.ts`

Corrigir o objeto `extra_data` dentro de `mapProducts` (linhas 464-486):

#### 1. required_products e forbidden_products: extrair de dentro de anti_hallucination

```typescript
// ANTES (errado):
anti_hallucination: product.anti_hallucination,
required_products: product.required_products,     // não existe no nível raiz
forbidden_products: product.forbidden_products,   // não existe no nível raiz

// DEPOIS (correto):
anti_hallucination: product.anti_hallucination,   // salva o objeto completo
required_products: product.anti_hallucination?.required_products,   // extrai do sub-objeto
forbidden_products: product.anti_hallucination?.forbidden_products, // extrai do sub-objeto
```

#### 2. Garantir que brand e mpn são capturados corretamente

Os campos já estão mapeados corretamente mas o upsert de registros antigos pode estar sobrescrevendo. A solução é garantir que o `extra_data` use merge com dados existentes **ou** forçar que brand/mpn sejam sempre escritos corretamente mesmo em upserts.

Como `extra_data` é JSONB e o upsert substitui o campo inteiro, o problema é que registros importados anteriormente (do arquivo apostila) que não tinham `brand`/`mpn` sobrescrevem os novos. A solução correta é:
- Usar `jsonb_set` no upsert para fazer merge de `extra_data`, **ou**
- Simplesmente fazer a importação funcionar corretamente com o novo arquivo (garantindo que brand/mpn sejam capturados agora)

A abordagem mais simples é garantir que o upsert substitua os dados corretamente — o novo arquivo tem os dados, então a próxima reimportação vai gravar corretamente.

#### 3. Remover bot_trigger_words (campo inexistente no novo arquivo)

Campo não existe no novo arquivo. Remover para manter o código limpo.

## Arquivo modificado

**`supabase/functions/import-system-a-json/index.ts`** — apenas o bloco `extra_data` dentro de `mapProducts`:

```typescript
extra_data: {
  variations: product.variations,
  benefits: product.benefits,
  features: product.features,
  images_gallery: product.images_gallery,
  coupons: p.coupons,
  specifications: product.specifications || product.technical_specifications,
  category: product.category,
  subcategory: product.subcategory,
  // Campos ricos do llm_optimized
  sales_pitch: product.sales_pitch,
  applications: product.applications,
  anti_hallucination: product.anti_hallucination,
  // CORRIGIDO: extrair de dentro do objeto anti_hallucination
  required_products: product.anti_hallucination?.required_products,
  forbidden_products: product.anti_hallucination?.forbidden_products,
  faq: product.faq,
  market_keywords: product.market_keywords,
  target_audience: product.target_audience,
  brand: product.brand,
  mpn: product.mpn,
  product_url: product.product_url
}
```

## Resultado esperado após reimportar

Após deploy e nova importação do arquivo `knowledge_base_llm_optimized`:

| Campo | Antes | Depois |
|---|---|---|
| `anti_hallucination` | null | objeto completo com never_claim, always_explain etc. |
| `required_products` | null | array de produtos necessários |
| `forbidden_products` | null | array de produtos incompatíveis |
| `brand` | null | "SMART DENT®" |
| `mpn` | null | "9021.29.00" |

## Seção Técnica

- Nenhuma mudança de banco necessária
- O upsert usa `onConflict: 'source,external_id'` — portanto produtos com mesmo `external_id` serão sobrescritos corretamente na próxima importação
- `bot_trigger_words` foi removido: o campo não existe em nenhum produto do novo arquivo (pode ter sido planejado mas não implementado no export)
- A extração `product.anti_hallucination?.required_products` usa optional chaining — segura para produtos sem `anti_hallucination`
- Deploy da edge function necessário antes da reimportação
