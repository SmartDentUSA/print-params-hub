## Objetivo
Acelerar carregamento de imagens do Supabase Storage em todo o app (thumbs, cards, hero, avatars, previews) usando Image Transformation + lazy loading, e corrigir uploads que salvam PNG com extensão `.webp`.

## Validação já feita
- `/render/image/public/...?width=256&quality=75` retorna **−92% payload** (745KB → 58KB) e `Cache-Control: max-age=3600`.
- Descoberto: arquivos `.webp` no bucket são na verdade PNG (content-type `image/png`), inflando 5–10×.

## Mudanças

### 1. Helper central (novo)
`src/utils/storageImage.ts` — função `getStorageImageUrl(url, { width, quality, format? })`:
- Detecta URLs `/storage/v1/object/public/<bucket>/...` e reescreve para `/render/image/public/<bucket>/...?width=&quality=&resize=contain`.
- URLs externas (Loja Integrada, Astron, etc.) passam intactas.
- Idempotente: se já é `/render/image/`, retorna como está.
- `null`/vazio → retorna o valor original.

### 2. Aplicar em componentes que renderizam imagens do bucket
| Componente | Width | Notas |
|---|---|---|
| `MentionedProducts.tsx` | 256 | thumbs 128×128 |
| `ModelGrid.tsx` | 128 | thumbs 64×80 |
| `WaLeadsMediaPreview.tsx` | 96 / 600 | compact vs expandido |
| `WaMediaUploader.tsx` | 256 | preview pós-upload |
| `InlineProductCard.tsx` | 400 | cards Dra. LIA |
| `AuthorBio`, `AuthorSignature`, `AuthorImageUpload` | 128 | avatars |
| Hero de artigos/knowledge | 1200 | `fetchpriority="high"` |
| Imagens inline em artigos | 800 | — |
| `AdminCatalog`, `ProductsFlow` | 400 | grids |

Adicionar em todos: `loading="lazy"`, `decoding="async"`, `width`/`height` explícitos (hero usa `fetchpriority="high"` em vez de lazy).

### 3. Correção de uploads PNG-disfarçados-de-WebP
- `src/utils/uploadExternalImage.ts`: detectar `blob.type` real e usar a extensão correta (`.png`, `.jpg`, `.webp`) em vez de assumir a extensão do nome original. Setar `contentType: blob.type` explicitamente no upload.
- `src/components/ImageUpload.tsx` e demais uploaders de imagem: mesma regra — extensão derivada de `file.type`, não do nome.
- Não converte arquivos antigos (Image Transformation já normaliza no servir). Apenas previne novos casos.

### 4. `document-proxy` (PDFs)
Trocar `arrayBuffer()` por streaming do `Response.body` direto, mantendo `Cache-Control: public, max-age=31536000, immutable`. Reduz memória da edge function e TTFB de PDFs grandes.

## Fora do escopo
- Estrutura de upload/paths/buckets, RLS, lógica de negócio, Dra. LIA, CRM, catálogo, UI além das tags `<img>`.
- Conversão retroativa dos arquivos PNG existentes (não necessário — transform resolve).

## Validação
1. DevTools Network em `/base-conhecimento/...` e admin `Modelos`: comparar payload e `Cache-Control` antes/depois.
2. Conferir que URLs externas (Loja Integrada) continuam carregando inalteradas.
3. Upload de teste: confirmar que novo arquivo tem extensão batendo com `content-type`.

## Risco
Baixo. Helper é aditivo e idempotente; se Image Transformation falhar para alguma URL, o navegador apenas exibe o original (comportamento atual). Sem mudanças de schema, RLS ou lógica.
