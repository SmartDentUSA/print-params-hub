# Popular Bio Vitality preservando vínculos existentes

## Estado verificado agora

- Produto pai `system_a_catalog` id `fc3b3928-ac28-46c5-a7f0-6ede5ff7230c` **permanece intocado** — nenhum DELETE nele.
- `catalog_documents` são vinculados por `product_id` = id do pai, então não são afetados.
- `catalog_product_variations`: 13 linhas. As **8 com GTIN preenchido** casam exatamente com os 8 SKUs enviados. As **5 sem GTIN** são fantasmas (todos os campos nulos).

## Mapa GTIN → id (para UPDATE-in-place)

| SKU | Cor | GTIN | id atual da variação |
|---|---|---|---|
| 1736 | A2 | 756014744965 | `43c3a76d…` |
| 1645 | A3 | 756014745016 | `38c5427d…` |
| 1266 | B1 | 756014745122 | `c0c9cc40…` |
| 1644 | BL1 | 756014745009 | `40217485…` |
| 2230 | A2 HT | 0756014744804 | `78b832f0…` |
| 2231 | A3 HT | 0756014744811 | `1deeecb1…` |
| 2233 | B1 HT | 0756014744835 | `db51bcbc…` |
| 2232 | BL1 HT | 0756014744828 | `161df76d…` |

## Execução (não destrutiva)

### 1. UPDATE nas 8 variações reais, casando por GTIN
Preserva ids, timestamps e qualquer FK futuro. Em cada linha:
- `sku` = valor da tabela
- `color` = valor da tabela (A2, A3, B1, BL1, A2 HT, A3 HT, B1 HT, BL1 HT)
- `presentation` = '250g'
- `price_brl` = 1859
- `ncm_hs` = '3906.90.49'
- `sort_order` = 1..8 na ordem Classic → HT

### 2. DELETE apenas nas 5 linhas fantasmas
Só as com `gtin_ean IS NULL AND sku IS NULL` (`ec2c6e04`, `c4abef7c`, `68ffc71d`, `080fe1b1`, `0c875af4`). Zero dado real perdido.

### 3. UPDATE no produto pai (sem tocar em documentos/imagens)
- `anvisa_registration = '81835969003'`
- `fda_510k = 'Regulation 872.3760'`

Nenhum outro campo do pai é tocado. Documentos em `catalog_documents` continuam ligados ao mesmo `product_id`.

## O que este plano NÃO faz

- Não deleta o produto pai.
- Não recria variações do zero (evita perder ids e qualquer referência).
- Não mexe em `catalog_documents`, `resin_documents`, `resins`, imagens ou SEO do pai.
- Não sincroniza para `resins`/`products_catalog` neste passo — se você quiser espelhar depois, faço em plano separado seguindo a política `resins-canonical-mirror`.

## Confirma?

Se OK, ao entrar em build eu rodo os 3 passos acima em uma migração/insert única, na ordem: UPDATE das 8 → DELETE das 5 fantasmas → UPDATE do pai.