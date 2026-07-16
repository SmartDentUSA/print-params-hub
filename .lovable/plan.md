## Diagnóstico das 22 resinas

| Categoria | Qtd | Ação |
|---|---|---|
| Já hospedadas no Supabase Storage | 9 | Nada a fazer |
| CDN externo (awsli) — problema atual | 5 | 2 têm match no `system_a_catalog` (backfill imediato), 3 usam o botão de reimportar |
| Sem imagem alguma | 8 | Cadastro manual (alerta `MISSING_OFFICIAL_PRODUCT_IMAGE` já cobre) |

### Backfill imediato (2 resinas via `system_a_catalog`)

- **Smart Print Bio Temp B1** (`e193267c-…`) → usa a URL Supabase já existente.
- **Smart Print Model Plus** (`e56b385b-…`) → usa a URL Supabase já existente (`832fa3e7-…webp`).

Ambas serão gravadas em `resins.image_background_removed_url`, campo de maior prioridade em `resolveProductImage`, sem alterar o `image_url` original.

### Aviso sobre resinas sem match (3 awsli)

Ficam para o botão de reimportação:
- Smart Print Bio Denture (Rosa)
- Smart Print Model L'Aqua
- Smart Print Try-in Calcinavel

## Solução (mesma do plano anterior, aplicada a todas)

1. **`src/components/resin-card/ResinCardStudio.tsx`**
   - Detectar URL externa (não começa com `VITE_SUPABASE_URL`).
   - Adicionar botão "Reimportar imagem para o Storage" no alerta e ao lado do chip "Imagem do produto" quando `productImageLoaded` falhar.
   - Ao clicar: `uploadExternalImage` → `UPDATE resins SET image_background_removed_url = …` → toast + reload da resina (callback opcional; se ausente, `window.location.reload()`).

2. **`src/components/resin-card/ProductHero.tsx`**
   - Remover `crossOrigin="anonymous"` quando a URL não for Supabase, para o preview conseguir renderizar. Exportação continua exigindo a versão rehospedada.

3. **Backfill imediato via `supabase--insert`** para os 2 casos acima.

## Fora do escopo

- Não mexer em `resolveProductImage`, `exportInfographic.ts`, catálogo ou traduções.
- Resinas sem imagem alguma (8) permanecem dependentes de upload manual — o alerta já existente sinaliza.