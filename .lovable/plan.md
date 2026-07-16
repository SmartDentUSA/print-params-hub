## Problema

Ao gerar o card "Instruções de Pré e Pós Processamento" para **Smart Print Bio Temp B1**, a imagem oficial do produto não carrega e o export falha com `productImageLoaded: false`.

**Causa:** `resins.image_url` aponta para `https://cdn.awsli.com.br/...` (CDN externo da loja). O `<img>` em `ProductHero.tsx` usa `crossOrigin="anonymous"`, mas o awsli não devolve cabeçalhos CORS, então o navegador rejeita o carregamento e o `html-to-image` na exportação também falha. O mesmo produto já existe no Supabase Storage (via `system_a_catalog`), mas o `resins` guarda a URL externa.

## Solução

Rehospedar a imagem no Supabase Storage e persistir de volta em `resins.image_background_removed_url` (campo de maior prioridade em `resolveProductImage`), sem tocar em lógica de negócio. Fica reutilizável para qualquer resina que tenha só URL externa.

### Passos

1. **`src/components/resin-card/ResinCardStudio.tsx`**
   - Detectar quando `productImageUrl` é uma URL externa não-Supabase (não bate com `VITE_SUPABASE_URL`).
   - Mostrar um botão "Reimportar imagem para o Storage" no alerta amarelo já existente e também abaixo do chip "Imagem do produto" quando a validação falhar.
   - Ao clicar: chamar `uploadExternalImage(productImageUrl, slugify(resin.name))`, salvar a URL nova em `resins.image_background_removed_url` via `supabase.from('resins').update(...)`, e disparar `onCardUrlChanged`/refetch (ou reload local do resin) para recomputar `productImageUrl`.
   - Toast de sucesso/erro.

2. **`src/components/resin-card/ProductHero.tsx`**
   - Remover `crossOrigin="anonymous"` quando a URL for externa (não-Supabase) para pelo menos exibir o preview. Manter `crossOrigin` para URLs Supabase (necessário para o `toPng` funcionar sem taint).
   - Isso garante que o preview visual renderize mesmo antes do rehost; o export continua exigindo a versão rehospedada (comportamento já garantido pelo `validateAssets`).

3. **Backfill pontual (opcional, via read_query aprovado depois)**
   - Para o registro atual (`e193267c-5328-4ac0-b8c7-5ff82bde8b7a`, Smart Print Bio Temp B1): copiar a URL Supabase já existente em `system_a_catalog` (`https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/products/37149ad6-63de-4b14-80af-b28b2cedbd19-1764283864354.webp`) para `resins.image_background_removed_url`, resolvendo o caso agora sem depender do botão.

### Fora do escopo
- Não alterar `resolveProductImage`, `exportInfographic.ts`, nem o pipeline de tradução.
- Não mexer em outras resinas nem em lógica de catálogo/sync.

## Detalhes técnicos

- Detecção de URL externa: `!url.startsWith(import.meta.env.VITE_SUPABASE_URL)`.
- Bucket de destino: reaproveitar `model-images` (já usado por `uploadExternalImage`) para não criar bucket novo.
- Após update no `resins`, invalidar a query React (se houver) ou aceitar refresh manual da página — verificar como `resin` chega ao `ResinCardStudio` (prop drilling de `AdminModal.tsx`/`KbTabParametros.tsx`) antes de decidir se basta `window.location.reload()` ou emitir um evento.