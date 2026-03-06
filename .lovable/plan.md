

# Plano: Upload de Fotos para IA + Botao "Usar como Hero"

## Resumo

Adicionar ao bloco de "Imagem OG (Open Graph)" em `AdminKnowledge.tsx`:
1. Area de upload de multiplas fotos de referencia para a IA usar na geracao
2. Se nenhuma foto for enviada, usa a imagem do produto selecionado (comportamento atual)
3. Se fotos forem enviadas, envia-as como input para a IA
4. Apos gerar a OG image, mostrar botao "Usar como Imagem Principal (Hero)"

## Mudancas

### 1. Frontend — `src/components/AdminKnowledge.tsx`

**Estado novo (~linha 160):**
- `ogReferenceImages: string[]` — URLs das imagens de referencia uploaded
- `uploadingOgRef: boolean` — loading state

**Upload de referencia (UI, apos linha 3672):**
- Input `type="file" multiple accept="image/*"` para upload de varias fotos
- Preview em grid das fotos uploaded com botao X para remover cada uma
- Upload vai para `knowledge-images/og-references/` no Supabase Storage

**Logica `handleGenerateAIOGImage` (~linha 1516):**
- Se `ogReferenceImages.length > 0`, enviar array de URLs no body como `referenceImageUrls`
- Se vazio, manter comportamento atual (busca imagem do produto/resina)

**Botao "Usar como Hero" (apos preview da OG, ~linha 3660):**
- Quando `formData.og_image_url` existe, mostrar botao extra
- Ao clicar: `setFormData(prev => ({ ...prev, content_image_url: prev.og_image_url, content_image_alt: prev.title }))`

### 2. Backend — `supabase/functions/ai-generate-og-image/index.ts`

**Aceitar `referenceImageUrls` no body (~linha 375):**
- Extrair `referenceImageUrls?: string[]` do JSON
- Se presente, usar modo EDIT com multiplas imagens no content array
- Cada imagem vira um `{ type: "image_url", image_url: { url } }` na mensagem
- Prompt adaptado para "compose these reference images into a professional OG image"

### 3. Nenhuma migracao de banco necessaria
- Usa bucket `knowledge-images` existente (publico)

## Arquivos alterados
1. `src/components/AdminKnowledge.tsx` — estado, UI, logica
2. `supabase/functions/ai-generate-og-image/index.ts` — aceitar multiplas imagens

