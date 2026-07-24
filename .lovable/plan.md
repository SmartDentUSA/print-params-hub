## Deduplicação L'Aqua — sem perda de dados

Auditoria completa das duas linhas em `system_a_catalog`:

| Campo | `84bce10e…` (Fev/26, "Modelo Láqua") | `b72a6c52…` (Jul/26, "L'Aqua") |
|---|---|---|
| slug | `resina-smart-print-modelo-laqua` | `resina-laqua` |
| category | `product` | `consumables` |
| product_category / subcategory | 3. IMPRESSÃO 3D / 3.2 RESINAS 3D - USO GERAL | idem |
| description | 142 chars | vazio |
| technical_specs | 713 chars | 2 chars |
| clinical_indications | 70 chars | vazio |
| extra_data | 5.813 chars | 58 chars |
| meta_description / seo_title | 117 / 45 chars | vazio |
| name_en / name_es | preenchidos | vazio |
| wikidata_qid | Q139540872 | vazio |
| price BRL | 916,66 | vazio |
| **ncm** | vazio | **9021.29.00** |
| **gtin** | vazio | vazio |
| image_url | idêntica | idêntica |
| visible_in_ui | **true** | false |
| variações | 4 (100/250/500/1000) sem SKU, com `price_brl 293,70` em 1kg | 4 (100/250/500/1000) **com SKUs 1209–1212** |

Referências FK encontradas — **todas apontam para o registro antigo** `84bce10e…`:
- `knowledge_videos`: 1 vídeo ("Smart Print Model L'Aqua - Pós processamento")
- `smartops_forms`: 1 form ("# - FORMS - Resina 3D Smart Print Modelo Láqua")
- `catalog_documents`, `content_bridge`, `catalog_kit_components`, `produto_aliases`: 0

### Direção do merge

Manter `84bce10e…` como canônico (tem TODO o conteúdo rico + FKs em vídeo/form + `visible_in_ui=true`) e **absorver o que só existe no novo** (NCM + os 4 SKUs 1209–1212).

Ajustar nome/slug para o padrão desejado exibido no print:
- `name = "Resina 3D Smart Print L'Aqua"`
- `slug = "resina-laqua"`
- `category = "consumables"` (alinhado ao restante do 3.2)

### Passos (migration única, transacional)

1. Em `system_a_catalog` no id antigo `84bce10e…`, aplicar:
   - `name = 'Resina 3D Smart Print L''Aqua'`
   - `slug = 'resina-laqua'`
   - `category = 'consumables'`
   - `ncm = '9021.29.00'` (apenas se ainda estiver null)
2. Em `catalog_product_variations`: para cada `presentation_qty` (100/250/500/1000), copiar o `sku` da variação do id novo para a variação correspondente do id antigo (só quando o SKU do antigo estiver null). Preservar o `price_brl = 293,70` já existente em 1kg do antigo.
3. Deletar as 4 variações do id novo (`b72a6c52…`).
4. Deletar o registro `b72a6c52…` de `system_a_catalog`.
5. Antes de tocar em qualquer linha, uma segunda auditoria dentro da migration confirma que não há FK residual apontando para `b72a6c52…` em nenhuma das 7 tabelas mapeadas — abortar se houver.

### O que fica preservado

- Vídeo em `knowledge_videos` (FK intacta, id antigo permanece).
- Form em `smartops_forms` (FK intacta).
- Descrição, specs (713), indicações clínicas, extra_data (5,8k), SEO/meta, traduções EN/ES, wikidata QID, preço BRL 916,66.
- Preço BRL 293,70 na variação 1kg.
- Os 4 SKUs 1209–1212 (agora vinculados ao id canônico).
- Imagem (idêntica nas duas linhas).

### O que muda para o usuário

- Um único card em `/base-conhecimento/catalogo` com slug `/resina-laqua`.
- O card antigo `/resina-smart-print-modelo-laqua` deixa de existir — se quiser posso adicionar um redirect 301 no roteador do KB (fora do escopo desta limpeza, avise se precisar).

Nenhuma alteração de código — só migration de dados.
