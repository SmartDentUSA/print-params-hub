

# Plano: Corrigir geracão de OG Image com referencia

## Problema identificado

Nos logs, quando o usuario envia imagens de referencia:
- `productName: null` e `documentType: "outro"` — a IA nao tem contexto do que o artigo trata
- O prompt diz "Use the provided reference images as visual inspiration" — a IA trata as fotos como "inspiracao" e gera algo completamente diferente
- As golden rules sobrescrevem o config para "Coroa dentária premium" sem relacao com o conteudo real

## Causa raiz

1. **Frontend**: quando `ogReferenceImages.length > 0`, o codigo pula a busca de `productName` da resina/produto — o nome nunca eh enviado
2. **Backend**: o prompt de referencia eh vago demais — diz "inspiration" em vez de instruir a IA a usar as fotos como conteudo principal
3. **Contexto perdido**: o titulo e excerpt do artigo nao sao usados de forma enfatica no prompt

## Mudancas

### 1. Frontend — `src/components/AdminKnowledge.tsx` (~linha 1536-1576)

Buscar `productName` SEMPRE (independente de ter referencia ou nao):

```typescript
// Sempre buscar nome do produto para contexto
const firstResinId = formData.recommended_resins?.[0];
const firstProductId = formData.recommended_products?.[0];

if (firstResinId) {
  const { data } = await supabase.from('resins').select('name, image_url').eq('id', firstResinId).single();
  if (data) { productName = data.name; productImageUrl = data.image_url; }
} else if (firstProductId) {
  const { data } = await supabase.from('system_a_catalog').select('name, image_url').eq('id', firstProductId).single();
  if (data) { productName = data.name; productImageUrl = data.image_url; }
}

if (ogReferenceImages.length > 0) {
  referenceImageUrls = ogReferenceImages;
  // productImageUrl nao eh usado quando ha referencia, mas productName sim
}
```

### 2. Backend — `supabase/functions/ai-generate-og-image/index.ts` (~linha 399-443)

Reescrever o prompt do modo REFERENCE para ser muito mais direto e especifico:

```typescript
const refPrompt = `You are creating a professional 1200x630 Open Graph banner image for a dental industry article.

ARTICLE TITLE: "${title || 'Technical Document'}"
${productName ? `PRODUCT: ${productName}` : ''}
${extractedTextPreview ? `ARTICLE CONTEXT: ${extractedTextPreview.substring(0, 300)}` : ''}

YOUR TASK:
The user has uploaded ${referenceImageUrls.length} reference photo(s) of their ACTUAL product/equipment.
You MUST use these photos as the PRIMARY visual content of the OG image.
Do NOT ignore them. Do NOT replace them with unrelated imagery.

LAYOUT (1200x630):
- Place the product/subject from the reference photos prominently in the LEFT-CENTER
- Product occupies 40-50% of frame height
- Right third has subtle gradient for text overlay space
- Add a professional dental laboratory or clinical background context
- Lighting: ${finalConfig.iluminacao}

CRITICAL RULES:
- The reference photos show the REAL product — keep it recognizable
- Do NOT invent new products or objects not in the photos
- Do NOT add text, logos, watermarks, or human faces
- Do NOT add product packaging or bottles unless shown in reference
- Keep the product proportions accurate
- Output must be photorealistic, professional dental photography style`;
```

Tambem desativar as golden rules para o modo referencia (elas estao sobrescrevendo o config com "Coroa dentaria" sem relacao):

```typescript
const finalConfig = hasReferenceImages 
  ? getBaseConfig(docType)  // sem golden rules quando tem referencia
  : applyGoldenRules(baseConfig, textContext, productName);
```

### Arquivos alterados
1. `src/components/AdminKnowledge.tsx` — sempre buscar productName
2. `supabase/functions/ai-generate-og-image/index.ts` — prompt reescrito, skip golden rules em modo referencia

