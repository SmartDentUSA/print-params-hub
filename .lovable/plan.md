# Bio Temp B1 — Limpeza + Enriquecimento Completo

Parent: `system_a_catalog.id = 96ca1d7d-9bfe-4409-a7d9-b7111658bb06`

## Estado atual (11 linhas em `catalog_product_variations`)

- 2 canônicas já inseridas: 250g SKU 310 e 500g SKU 315 (`manual_enrichment_bio_temp`)
- 8 duplicatas/legado a remover: bulk_import 100g/250g/500g/1000g, system_a_sync 250g/500g/1kg, e 2 placeholders "Nova"/"Nova 2"
- 1 linha 1kg (bulk_import, GTIN 0756014745594, 1,13 kg) — será substituída pela canônica SKU 316

## 1. Enriquecer parent (não-destrutivo)

Merge em `system_a_catalog` só onde vazio:
- `ncm_hs = 9021.29.00` (já aplicado, reconfirmar)
- `anvisa_registration = 81835969003`
- `loja_integrada_id = 52117002`

Não toca em nome, descrição, documentos, imagens ou vínculos.

## 2. Deletar 8 duplicatas legadas

IDs a remover:
- `201bf833` (100g bulk_import placeholder — sem SKU/preço)
- `2df8b27b` / `b3757f87` (250g bulk_import + system_a_sync)
- `e4f7817c` / `e456ae93` (500g bulk_import + system_a_sync)
- `c0144858` / `1940d985` (1kg bulk_import + system_a_sync)
- `eb8c0c4a` / `e33a4247` ("Nova" e "Nova 2" manuais)

## 3. Upsert das 4 variações canônicas

Match por SKU dentro do parent. Linhas 250g e 500g já existem — só reconfirmar valores. Inserir 100g e 1kg.

| SKU  | Var  | Un  | Cor | GTIN            | Peso (kg) | Dim (cm)         | BRL      | Obs |
|------|------|-----|-----|-----------------|-----------|------------------|----------|-----|
| 839  | 100  | grs | B1  | 0756014745542   | 0,11*     | 10.0 × 6.0 × 6.0* | 240,00   | Amostra |
| 310  | 250  | grs | B1  | 0756014745566   | 0,25      | 16.0 × 16.0 × 16.0 | 733,70   | mantém |
| 315  | 500  | grs | B1  | 0756014745573   | 0,61*     | 19.5 × 8.5 × 8.5*  | 1.223,20 | mantém |
| 316  | 1000 | grs | B1  | 0756014745559   | 1,13*     | 24.5 × 9.5 × 9.5*  | 2.077,90 | novo |

*Presets padrão (`RESIN_GRS_PRESETS`) para 100g/500g/1kg — mesmos usados em Vitality/+Flex/Bio Bite Splint quando a fonte marcou N/D. Alternativa: deixar `null` até medida oficial.

`source = 'manual_enrichment_bio_temp_b1'`.

## 4. Fora de escopo

- Não altero `products_catalog`, `resins`, documentos, imagens ou preços USD/EUR.
- Não regero CSV master (posso rodar depois se pedir).

## Pergunta rápida

Presets de peso/dimensão para 100g, 500g e 1kg: **aplicar** (recomendado, consistente com resinas irmãs) ou **deixar null** até medida oficial?
