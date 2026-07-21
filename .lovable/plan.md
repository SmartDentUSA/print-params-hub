## Popular variações Bio Bite Splint Clear

Parent `system_a_catalog.id = 8ea6c6fd-7ae4-4fcd-ae18-5a85a69f461f` — enriquecer + 3 variações canônicas (SKU 1672/amostra 100g fica de fora conforme instrução).

### 1. Enriquecer parent (JSONB não-destrutivo)
Atualiza somente campos vazios/desatualizados em `system_a_catalog`:
- `ncm_hs`: `9021.29.00`
- `loja_integrada_id`: `91705641`
- `extra_data` (merge): manter documentos/campos existentes intactos.

Não toca em `name`, `description`, `category`, documentos ou vínculos.

### 2. Variações em `catalog_product_variations`
Match por `sku` dentro do `catalog_product_id` do parent (via `system_a_id`). Upsert por SKU:

| SKU  | Cor         | Qty | Unit | GTIN            | NCM        | Peso (kg) | Dim (cm)          | BRL     |
|------|-------------|-----|------|-----------------|------------|-----------|-------------------|---------|
| 1491 | Translúcida | 250 | grs  | 0756014745412   | 9021.29.00 | 0.40      | 18.0 × 12.0 × 15.0 | 599.50  |
| 1671 | Translúcida | 500 | grs  | 0756014745429   | 9021.29.00 | 0.61*     | 19.5 × 8.5 × 8.5*  | 917.40  |
| 1670 | Translúcida | 1000| grs  | 0756014745405   | 9021.29.00 | 1.13*     | 24.5 × 9.5 × 9.5*  | 1710.50 |

*500g e 1kg: fonte marcou N/D. Aplico os presets padrão de resinas (`RESIN_GRS_PRESETS` já em uso: 500g → 0,61 kg / 19.5×8.5×8.5; 1000g → 1,13 kg / 24.5×9.5×9.5) — mesma regra usada em Vitality/+Flex. Confirmar se prefere deixar null.

- SKU 1672 (100g amostra): **não** alterado, conforme solicitado.
- Se algum SKU acima ainda não existir na tabela, criar como nova variação vinculada ao parent (mantendo `sort_order` sequencial).
- `source = 'manual_enrichment_bio_bite_splint'`.

### 3. Fora de escopo
- Não altero documentos, imagens, `products_catalog` nem `resins`.
- Não regero o CSV master (posso rodar depois se quiser).
- Não mexo em preços USD/EUR (sem fonte).

### Pergunta rápida
Para 500g e 1kg: aplicar os presets padrão de peso/dimensão (recomendado, mantém consistência com Vitality/+Flex) ou deixar `null` até ter medida oficial?
