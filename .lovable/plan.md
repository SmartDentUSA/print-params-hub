
# Análise: Novo arquivo "knowledge_base_llm_optimized" vs arquivo anterior

## O arquivo é substancialmente melhor — e compatível com a função de importação

### Diferenças estruturais confirmadas

| Campo | Arquivo Anterior (apostila) | Novo Arquivo (llm_optimized) |
|---|---|---|
| Chave raiz | `data.products[]` | `data.products[]` (mesma) |
| Slug | URL completa da loja | **Slug limpo** (`atos-resina-composta-direta-da2-estetica-dentina`) |
| Descrição | Texto simples | Texto limpo + sem HTML |
| Preço | `price` + `promo_price` | `price` + `original_price` (diferente!) |
| FAQs | Ausentes | Presentes com HTML nos links |
| Keywords | Lista básica | Lista extensa + `market_keywords` separado |
| Anti-alucinação | Ausente | Presente por produto |
| `sales_pitch` | Ausente | Presente (rico) |
| `applications` | Ausente | Presente |
| `technical_specifications` | Ausente | Array de key/value |
| `bot_trigger_words` | Ausente | Presente |
| `required_products` | Ausente | Presente |
| `forbidden_products` | Ausente | Presente |
| `target_audience` | Pode estar no produto | Presente por produto |

### Problema identificado: campo de preço promocional diferente

O arquivo novo usa `original_price` (não `promo_price`). A função `mapProducts` atual lê `product.promo_price`:
```typescript
// Código atual — vai perder o original_price
promo_price: product.promo_price ? parseFloat(product.promo_price) : undefined,
```

No novo arquivo, a lógica correta é:
- `price` = preço atual (já com desconto)
- `original_price` = preço original (de/por)
- O que salvar como `promo_price` no banco = `product.original_price` (preço "de") ou manter `price` como o preço final

### Problema identificado: FAQs têm HTML

As FAQs no novo arquivo têm `<a href="...">` nos textos. Quando salvo em `extra_data`, isso é válido. Mas precisamos garantir que seja armazenado.

### Dados extras valiosos que devem ir para `extra_data`

O novo arquivo tem campos ricos por produto que a função atual não captura:
- `sales_pitch` — texto de vendas para a Dra. L.I.A.
- `applications` — indicações clínicas
- `technical_specifications` — especificações técnicas estruturadas
- `anti_hallucination` — regras anti-alucinação por produto
- `faq` — FAQs com respostas
- `market_keywords` — keywords de mercado adicionais
- `required_products` / `forbidden_products` — contexto de uso
- `bot_trigger_words` — palavras gatilho para o chatbot
- `brand` e `mpn` — marca e código do produto

## O que precisa mudar na função de importação

Apenas **1 arquivo** a modificar: `supabase/functions/import-system-a-json/index.ts`

### Mudança 1 — Corrigir mapeamento de preço promocional (linha ~439)

```typescript
// Antes:
promo_price: product.promo_price ? parseFloat(product.promo_price) : undefined,

// Depois (suporta ambos os schemas):
promo_price: product.promo_price 
  ? parseFloat(product.promo_price) 
  : (product.original_price ? parseFloat(product.original_price) : undefined),
```

### Mudança 2 — Capturar slug limpo (linha ~434)

O novo arquivo tem `slug` como um slug real (ex: `atos-resina-composta-direta-da2-estetica-dentina`), não uma URL. O código atual usa `product.slug` diretamente — isso já está correto. Mas o `canonical_url` deve ser gerado a partir de `product.product_url` se disponível:

```typescript
canonical_url: product.canonical_url || product.product_url || undefined,
```

### Mudança 3 — Expandir `extra_data` para capturar campos ricos (linha ~459-468)

```typescript
extra_data: {
  // Existentes
  variations: product.variations,
  benefits: product.benefits,
  features: product.features,
  images_gallery: product.images_gallery,
  coupons: p.coupons,
  specifications: product.specifications || product.technical_specifications,
  category: product.category,
  subcategory: product.subcategory,
  // Novos campos do llm_optimized
  sales_pitch: product.sales_pitch,
  applications: product.applications,
  anti_hallucination: product.anti_hallucination,
  faq: product.faq,
  market_keywords: product.market_keywords,
  required_products: product.required_products,
  forbidden_products: product.forbidden_products,
  bot_trigger_words: product.bot_trigger_words,
  target_audience: product.target_audience,
  brand: product.brand,
  mpn: product.mpn,
  product_url: product.product_url,
}
```

### Mudança 4 — Merge de keywords (linhas ~442)

O novo arquivo tem `market_keywords` separado de `keywords`. Mesclar os dois na importação:

```typescript
keywords: [
  ...(Array.isArray(product.keywords) ? product.keywords : []),
  ...(Array.isArray(product.market_keywords) ? product.market_keywords : [])
],
```

## Resultado esperado

Após estas mudanças, a importação do novo arquivo irá:
1. Salvar preços corretos (price + original_price como promo_price)
2. Salvar o slug limpo (melhora URLs dos produtos)
3. Armazenar `sales_pitch`, `faq`, `anti_hallucination`, `applications` e `technical_specifications` em `extra_data` — disponíveis para a Dra. L.I.A.
4. Combinar keywords + market_keywords para SEO mais rico
5. Manter compatibilidade com o arquivo anterior (todos os campos são opcionais)

## Seção Técnica

- O arquivo novo tem 23.371 linhas vs ~5.000 do anterior — muito mais rico
- A estrutura raiz `{ api_version, format, data: { company, categories, products, ... } }` é compatível com a normalização já feita na função (linha 742-756)
- `company` ainda existe com estrutura similar — compatível
- `categories` ainda existe — compatível
- Não há `testimonials` nem `reviews` neste arquivo (apenas products + company + categories) — isso é OK, a função ignora seções ausentes
- Nenhuma mudança de banco necessária — `extra_data` é JSONB e aceita qualquer estrutura
- Deploy da edge function necessário após as mudanças
