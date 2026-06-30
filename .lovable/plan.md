## Objetivo
Tornar o "Exportar Apostila DOCX" um dump completo e consolidado de **catálogo de produtos** e **resinas**, sem truncamentos e sem campos faltando.

## Diagnóstico
O `supabase/functions/export-apostila-docx/index.ts` hoje:

1. **Trunca conteúdo crítico** com `truncate(...)`:
   - Descrição de resina (`processing_instructions` cortado em 500 chars).
   - Descrição de produto do catálogo (300 chars).
   - Artigos (1000), transcrições de PDF/vídeo (400-500).
2. **Lê só `system_a_catalog`** — ignora `products_catalog` (que é a fonte das tabelas técnicas exibidas nos cards de Base de Conhecimento) e ignora `extra_data.system_a_live.technical_specs`.
3. **Resinas usam só ~5 colunas** das 70 disponíveis em `resins` (sem ficha técnica, sem indicação clínica, sem certificações, sem campos EN/ES, sem `models_compatible`, etc.).
4. **Catálogo não imprime tabela técnica** (`technical_specifications` / `technical_specs`), nem categorias EN/ES, nem subcategoria, nem código/SKU.
5. **Produtos e resinas não estão "consolidados"** — produto não lista resinas/parâmetros vinculados; resina não lista produtos do catálogo correspondentes.

## Mudanças propostas (apenas em `supabase/functions/export-apostila-docx/index.ts`)

### A) Catálogo de Produtos — seção 4 (full dump + tabela técnica)
- Trocar a query: ler **`products_catalog`** (fonte oficial das fichas) **+ `system_a_catalog`** e fundir por `name`/`slug`, marcando origem.
- Remover `truncate` da descrição — imprimir `description` PT integral; quando existir, imprimir também `description_en` e `description_es` em blocos separados.
- Imprimir todos os metadados: `product_category`, `product_subcategory`, `category`/`category_en`/`category_es`, `sku`/`code`, `brand`, tags, `slug`.
- **Renderizar tabela técnica completa** como `Table` DOCX a partir de (prioridade): `products_catalog.technical_specifications` → `system_a_catalog.technical_specs` → `system_a_catalog.extra_data.system_a_live.technical_specs`. Cada linha = label + valor; imprimir TODAS as linhas (sem corte).
- **Bloco "Resinas e parâmetros vinculados"** sob cada produto-resina: se o `name`/`slug` casar com `resins.name`/`slug`, listar parâmetros (`parameter_sets`) e modelos compatíveis.
- Imprimir todos os CTAs (até 4) com label original.

### B) Resinas — seção 1 (full dump)
- Imprimir 100% dos campos relevantes de `resins`: `description` (PT/EN/ES), `processing_instructions` PT/EN/ES **sem truncate**, `clinical_indication`, `contraindications`, `warnings`, `storage`, `shelf_life`, `composition`, `certifications`/`anvisa`/`ce`, `wavelength`, `color`, `viscosity`, `manufacturer_url`, `safety_data_sheet_url`, etc. (gerar via iteração das colunas conhecidas, ignorando metadados internos).
- **Tabela técnica da resina**: renderizar tabela DOCX a partir de `resins.technical_specs` (jsonb) se existir.
- **Bloco consolidado "Parâmetros desta resina"**: listar todos os `parameter_sets` onde `resin_name`/`resin_slug` casa, agrupados por marca → modelo.
- **Bloco "Produto no catálogo"**: link e SKU do item correspondente em `products_catalog`/`system_a_catalog`.

### C) Outras seções
- Remover `truncate` de `processing_instructions` e `extracted_text` (PDFs) e `video_transcript` para não perder conteúdo — limite só por sanidade em ~50 mil chars/campo (DOCX não estoura).
- Sumário inicial: incluir contagem real de specs técnicas renderizadas.

### D) Robustez
- Subir todas as queries para `.limit(10000)` explicitamente (hoje usa default 1000 do PostgREST) em: `resins`, `parameter_sets`, `products_catalog`, `system_a_catalog`, `knowledge_contents`, `knowledge_videos`, `catalog_documents`, `resin_documents`.
- Log no final com contagem por seção para auditoria.

## Fora do escopo
- UI do botão (mantém igual).
- Não mudar Base de Conhecimento / Vídeos / Autores / Links (já listam tudo; só remover truncate).
- Sem mudanças em schema, RLS ou outras edge functions.

## Arquivos afetados
- `supabase/functions/export-apostila-docx/index.ts` (único arquivo).
