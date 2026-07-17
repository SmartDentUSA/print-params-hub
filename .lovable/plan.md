## Objetivo
Popular `catalog_product_variations` com os códigos de barras (GTIN-13) da lista enviada, associando cada barcode ao produto existente em `system_a_catalog` por nome. Nenhum produto novo é criado. Barcodes já presentes (`gtin_ean` normalizado) são pulados.

## Estratégia técnica

### Normalização de GTIN
- User enviou GTIN-13 (`0756014740691`). Banco usa GTIN-14 (`07560147406918` — leading zero + check digit) em alguns registros e 13-dígitos em outros. Vou comparar por **sufixo de 12 dígitos após o "0756014"** e normalizar para o formato dominante no banco (14-dígitos com prefixo `0`).
- Antes de inserir, checar `SELECT gtin_ean FROM catalog_product_variations WHERE regexp_replace(gtin_ean,'^0+','') = regexp_replace(<novo>,'^0+','')`. Se existir, pular.

### Matching por nome (barcode → catalog_product_id)
Mapeamento explícito por família (baseado nos produtos que existem no `system_a_catalog` após a reclassificação recente):

**Atos Resina Comp Direta 4g** (barcodes 691–851, exceto opaco/clear/opl):
| Barcode | Nome | catalog_product_id |
|---|---|---|
| 0756014740691 | EA1 4g | 8d5298b3-00d9-4278-83ee-6c2758a812f5 |
| 0756014740707 | EA2 4g | 7ac7caf1-e598-42e9-8851-ed4fd6e532d7 |
| 0756014740714 | EA3 4g | 55d7dd55-f166-402b-91a0-0a74c185ccb9 |
| 0756014740721 | EA4 4g | 03ea0903-fef2-4e39-b30f-4b3e3df0e53d |
| 0756014740738 | EB1 4g | 87fa3b6f-9f2f-43d7-816a-2bfa9f626d03 |
| 0756014740745 | EB2 4g | ca77c5d8-0452-4623-b5eb-ba6cc40a367e |
| 0756014740752 | WE 4g | ac771a42-252a-4abc-819c-750ad4dd0f34 |
| 0756014740769 | XWE 4g | 0cb555b1-a6de-4bee-b0e2-752bdea069a4 |
| 0756014740776 | DA1 4g | c0b509ac-a7ad-4e03-8c90-332b0f672c1c |
| 0756014740783 | DA2 4g | 93476777-8fde-4c2d-9204-aacc8bf2ed88 |
| 0756014740790 | DA3 4g | e2d973ca-0ff4-4830-be14-af6304a0d1f3 |
| 0756014740806 | DA3.5 4g | bbf143d1-7493-4aa9-8c00-28ce60fc13fe |
| 0756014740813 | DA4 4g | 1a63be4f-3aa6-47b0-b514-64b8a61d5213 |
| 0756014740820 | DB1 4g | 8718cd44-67ba-4a5a-868f-1ca5316570a8 |
| 0756014740837 | DB2 4g | 12024ff3-e7ba-47f5-9e06-4f974a77c4a5 |
| 0756014740844 | WD 4g | e403613d-0807-4fe2-b192-b901c0dff1f2 |
| 0756014740851 | XWD 4g | 9b9ee506-b4ff-47cf-b157-04050d055177 |

**Atos Resina Comp Direta 2g** (barcodes 868–882):
| 0756014740868 | Efeito Opaco 2g | 4cf6f950-8990-4d91-882c-220e012b819f |
| 0756014740875 | Efeito Clear 2g | dbc8ea6f-ea68-4435-9845-a382a0033cf0 |
| 0756014740882 | Efeito Opalescente 2g | faf0ec09-c421-4d79-9d24-d7a695062672 |

**Resina Atos Academic 0,5g** (barcodes 899–981) — cores mapeadas para cada produto:
Amarelo→cf591f47, Azul Claro→b5ccfd4f, Azul Escuro→bbeaf483, Branco→34f560ae, Cinza→b175890f, Incolor→aaa2f77e, Laranja→4d286039, Rosa→f72abbe9, Verde→f0456e9c, Vermelho→1aaeb826.

**Kit / Ortho / Unichroma:**
- 0756014741001 Smart Ortho → d9abfa4e-4069-4d07-81f5-7b95ea8c52a9
- 0756014741018 Unichroma → 8838dc65-709d-4ed7-baa0-155b47708f48

**Unikk & Try-in** (barcodes 131–261) → cimentos:
LV→sem produto (skip); A1→6c7c07a5; A2→8edd1594; A3,5→6bad0a5f; B1→b1e85698; BL2→1c047902; T→7d048821; Tryin A1→7708a3f4; Tryin A2→9dc71a3b; Tryin A3,5→1c3faea8; Tryin B1→36d1628a; Tryin BL2→3215415c; Tryin T→9b1126af; Kit veneer→733c2079.

**SmartGum** (barcodes 1050–1122):
Cream→b7ad87a3; Intense Red→671096aa; Orange→06efe1f2; Pink→dc481921; Ruby→c5122dec; SmartBase Clear→97b485ec; SmartBase White→f5b3110a; Black→d0028a02; Kit SmartGum→ca5fe32d.

**SmartMake** (barcodes 1030, 1180–1350):
Efeito Mamelon→933b0a63; SM Smart Base Clear→e88407ae; Intensivo Brown→30bc3c40; Mahogany→42d45eb9; Ocre→db583637; Kit Completo (1245)→5fcb0cb6; Smart Seal→447e3b1a; SHADE A→b94f167d; B→078c0cf5; C→8cf3466e; D→3146d946; Wash→ffa5ca72; Stain Black→398bf12a; Blue→a6e4aeb4; Violet→3d4d114a; White→d6fecf02.

**Resinas 3D 250/500/1000g** — cada barcode vira uma variação com `presentation='grs'` + `presentation_qty` (250, 500 ou 1000):
- Bio Bite Splint (100g/1kg/250g/500g barcodes 1399–1429) → sem produto próprio; Bio Bite Splint +Flex → 4aa4c2de; Bio Bite Splint Clear → c3b1d47d (barcodes de Bite Splint puro sem +Flex/Clear ficam sem match → **skip**).
- Bio Clear Guide (1436–1467) → 6cd6d356
- Bio Denture (1474–1498) → 6d491d65; Bio Denture Trans 1kg → 87873f75
- Bio Temp B1 (1542–1573) → 02f0843c
- Modelo Universal Salmão (1580–1610) → d82a23e0
- Modelo DLP Salmão (1627–1634) → **sem produto próprio → skip**
- Modelo DLP Ocre (1641–1665) → 43d4ed21
- Try-In Calcinável (1672–1689) → 1e8e2967
- Gengiva 250g (1382) → 49d1ae3a
- Modelo Precision (1351–1375) → ddc7990c
- Modelo L'Aqua (1146–1160) → 84bce10e

**GlazeON** (881 glaze on) → 0e1e3597 (Splint). "glaze+flex" (888) → sem produto → **skip**.
**NanoClean PoD** (856) → 19bc59de. "Nanoclean Pen" (889) → sem produto → **skip**.
**Model Plus** (866) → f6722ecd.

### Barcodes que ficarão fora (produto inexistente — reportados no final)
- ATOS BLOCK LT/HT (barcodes 1025–1124) — só existe "ATOS Block - caixa com 5 unidades" genérico
- ATOS BODY 4g/1g (1278–1483) — família nova
- Kit Atos Academic 10 cores (0998), Kit SmartMake Biotech Edition (4927), Kit SmartMake Introdutório (5238)
- Smart Print Aligner 250/500/1kg (4972–4996)
- Bio Hybrid A2 250/500/1kg (5511–5535)
- Vitality A2/A3/B1/Bleach HT + Vitality 250g/BL/A2/A3/B1 avulsas (4804–4835, 4972, 5009, 5016, 5122, 5191)
- MiiCraft BV012 250g (5139)
- GOCLEAR 250/500/1kg (4934–4958)
- Nanoclean Pen (4880), glaze+flex (4873)
- SM STAIN RED (5337)
- Unikk LV (1131)
- Bio Bite Splint puro sem +Flex/Clear (1399, 1405, 1412, 1429)
- Modelo DLP Salmão (5627, 5634)

## Execução

Uma única chamada `supabase--insert` com um `WITH incoming(gtin,catalog_product_id,qty) AS (VALUES ...)` e:

```sql
INSERT INTO catalog_product_variations (catalog_product_id, gtin_ean, presentation, presentation_qty, source)
SELECT i.catalog_product_id, i.gtin, 'grs', i.qty, 'barcode-import-2026-07'
FROM incoming i
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_product_variations v
  WHERE regexp_replace(v.gtin_ean,'^0+','') = regexp_replace(i.gtin,'^0+','')
)
ON CONFLICT (catalog_product_id, presentation_qty) DO NOTHING;
```

Para itens sem gramatura (kits, cimentos, SmartMake/Gum unitários), uso `presentation='Item'`, `presentation_qty='1'` — mas se já existir uma variação `('produto', '1')` sem GTIN, atualizo o gtin com um `UPDATE` separado para não bloquear pelo unique.

## Critério de aceitação
- Aprox. 90–100 novas linhas em `catalog_product_variations` com `gtin_ean` preenchido e vinculadas ao produto certo.
- Nenhum barcode existente é sobrescrito.
- Nenhum novo produto em `system_a_catalog`.
- Reporto a lista final de barcodes não importados (com motivo) ao término.

## Fora do escopo
- Preços (`price_brl`), `weight_kg`, `ncm_hs`, imagens, tradução.
- Criar produtos novos (ATOS Body, ATOS Block LT/HT, GOCLEAR etc.) — sob demanda numa próxima rodada.
- Alterações em código/UI.
