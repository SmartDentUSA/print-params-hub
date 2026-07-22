Popular `catalog_product_variations` das famílias **Atos / SmartGum / SmartMake / UNIKK Veneer / UNIKK Try-in / ATOS Block**, mantendo **1 pai por cor + 1 variação canônica** (mesma política das rodadas anteriores). Preços BRL/USD/EUR preservados por snapshot antes do wipe.

## Escopo

Para cada SKU da lista, encaixar em um parent existente em `system_a_catalog`, snapshotar preços, deletar variações do parent e re-inserir 1 variação canônica com SKU/GTIN/NCM/peso/dimensões. Onde a lista traz múltiplos pesos para o mesmo pai (Unichroma 3g+4g; Try-in 1g+2g), inserir 2 variações no mesmo pai — único desvio pragmático do "1 variação".

## Mapeamento SKU → parent

**Atos Resina Composta Direta (Dentinas/Esmaltes, 4g)** — 939 DA1, 940 DA2, 941 DA3, 942 DA3.5, 943 DA4, 944 DB1, 945 DB2, 946 WD, 947 XWD, 931 EA1, 932 EA2, 933 EA3, 934 EA4, 935 EB1, 936 EB2, 937 WE, 938 XWE.

**Atos Resina Composta Direta (Efeitos 2g)** — 948 Opaque, 949 Clear, 950 OPL.

**Atos Unichroma** — 1 parent, 2 variações: 1732 (4g) + 1118 (3g).

**Resina Atos Academic (2g)** — 1578 Amarelo, 1579 Azul Claro, 1580 Azul Escuro, 1581 Branco, 1582 Cinza, 1583 Incolor, 1584 Laranja, 1585 Rosa, 1586 Verde, 1587 Vermelho. Kits: 1028 (10 cores), 1728 (6 cores).

**ATOS Smart Ortho** — 1097 (Seringa).

**SmartGum (2,5g)** — 1272 Intense Red, 1274 Pink, 1275 Orange, 1273 Ruby, 1271 Cream, 1390 Black, 1279 Smart Base Clear, 1280 Smart Base White. Kit: 1276.

**SmartMake (2,5g)** — 385 A, 386 B, 387 C, 388 D, 389 Stain Blue, 1267 Stain Violet, 393 Stain White, 391 Stain Black, 392 Int. Brown, 394 Int. Ocre, 395 Int. Mahogany, 1270 Efeito Mamelon, 384 Base Clear. Auxiliares: 383 Seal Glaze (5g), 398 SmartWash (30ml, NCM 3906.90.49), 397 Godê (NCM 3906.90.39). Kits: 400 Básico, 399 Completo.

**Cimento UNIKK Veneer (2,5g)** — 1997 A1, 1998 A2, 1999 A3.5, 2001 B1, 2002 BL2, 2000 TRS, **1983 LV** (parent já criado). Kit: 2017.

**Cimento UNIKK Veneer Try-in (2g + 1g no mesmo pai)** — A1(1985), A2(2008+2003), A3.5(2009+2004), B1(2011+2006), BL2(2012+2007), TRS(2010+2005).

**ATOS Block (Caixa 5 un., 0,50 kg / 12×12×5 cm)** — LT: 1338 A1, 1339 A2, 1340 A3, 1341 A3.5, 1342 B1, 1343 C2, 1344 Bleach; HT: 1345 A1, 1346 A2, 1347 A3, 1348 B1.

## Não incluído

- **SmartMake Maleta (SKU 396)** — parent inexistente; pendente sua autorização.
- HIBCC — coluna não existe no schema.

## Execução (uma migration via `supabase--insert`)

1. Snapshot BRL/USD/EUR atuais por (`catalog_product_id`, `sku`, `gtin_ean`) dos parents alvo.
2. `DELETE FROM catalog_product_variations WHERE catalog_product_id IN (…lista…)`.
3. `INSERT` das ~85 variações canônicas com `sku`, `presentation`, `presentation_qty`, `unidade` (`grs`/`ml`/`un`/`kit`), `gtin_ean`, `ncm_hs`, `weight_kg`, `dimensions_cm`, `color`, `sort_order`, `source='manual_enrichment_2026_07_22_atos'`.
4. Preservar preços via LEFT JOIN no snapshot casando por SKU ou GTIN.
5. Kits recebem `unidade='kit'`, sem peso/dim quando `N/D`.

## Fora de escopo

- Não criar/renomear/deletar parents em `system_a_catalog` (LV já criado na rodada anterior).
- Não mexer em `resins` nem em `catalog_documents`.
- Sem alteração de UI e sem regeneração de CSV master.