# Popular Catálogo — Resina Smart Print Bio Vitality

## Estado atual (verificado)

- **`system_a_catalog`**: 1 registro pai — `Resina 3D Smart Print Bio Vitality` (id `fc3b3928-ac28-46c5-a7f0-6ede5ff7230c`, categoria `3. IMPRESSÃO 3D`). Sem Anvisa/FDA preenchidos.
- **`catalog_product_variations`**: **13 linhas** ligadas ao pai. Nenhuma tem `sku`. Só 1 tem `color` ('A2'). 5 linhas estão vazias (sem GTIN, sem NCM, sem cor) → duplicatas fantasma.
- **`resins`**: sem linha "Bio Vitality" cadastrada.

## Mapeamento confirmado pelo usuário

| Linha | Cor | SKU | GTIN candidato no banco |
|---|---|---|---|
| Classic 250g | A2 | 1736 | `756014744965` (única com color='A2') |
| Classic 250g | A3 | 1645 | um dos GTIN `...4804 / ...4811 / ...4828 / ...4835` |
| Classic 250g | B1 | 1266 | idem |
| Classic 250g | BL1 | 1644 | idem |
| HT 250g | A2 HT | 2230 | um dos GTIN `756014745009 / 745016 / 745122` |
| HT 250g | A3 HT | 2231 | idem |
| HT 250g | B1 HT | 2233 | idem |
| HT 250g | BL1 HT | 2232 | idem |

**Ponto que precisa da sua confirmação antes de eu gravar** — o banco tem GTINs mas não sei qual pertence a qual cor. Ver "Pergunta pendente" no fim.

## Execução

### 1. Deletar as 5 variações vazias
Linhas sem `gtin_ean` e sem `sku` (ids: `ec2c6e04`, `c4abef7c`, `68ffc71d`, `080fe1b1`, `0c875af4`) — ruído puro.

### 2. UPDATE nas 8 variações restantes
Preencher em cada linha (match por GTIN existente):
- `sku` (1736/1645/1266/1644/2230/2231/2233/2232)
- `color` ('A2', 'A3', 'B1', 'BL1', 'A2 HT', ...)
- `presentation` = '250g'
- `price_brl` = 1859 (onde ainda está null)
- `ncm_hs` = '3906.90.49' (onde está null)
- `extra_data.line` = 'Classic' | 'HT'

### 3. Enriquecer o produto pai `system_a_catalog`
UPDATE em `fc3b3928-...`:
- `anvisa_registration` = '81835969003'
- `fda_510k` = 'Regulation 872.3760' (campo textual)

### 4. Criar linha em `public.resins` como fonte canônica
Espelho técnico (mem `resins-canonical-mirror` diz que `resins` é canônico e `system_a_catalog` espelha). Inserir 1 linha com `name='Smart Print Bio Vitality'`, `slug` casando com o catálogo, `technical_specs` JSONB:
```json
{
  "mechanical": {
    "flexural_strength_mpa": 147,
    ...demais props que você me mandou
  },
  "presentation_g": 250,
  "certifications": { "anvisa": "81835969003", "fda": "872.3760" }
}
```
(uso exatamente os valores que você enviou na mensagem original do dia 20/07 — reaproveito sem inventar.)

### 5. Nada no frontend
`AdminCatalogTable` já lê `catalog_product_variations` via `useCatalogVariations`. Com SKU + cor preenchidos, as 8 variações aparecem organizadas automaticamente.

## Pergunta pendente (crítica antes de rodar)

Não consigo mapear cor↔GTIN sozinho. Preciso de UMA das duas coisas:

- **(a)** Você me manda a tabela GTIN→cor completa (8 linhas), OU
- **(b)** Eu apago as 13 variações atuais (todas duplicadas/incompletas) e insiro 8 novas do zero apenas com SKU + cor + preço + NCM, deixando GTIN vazio para você preencher depois no admin.

Opção (b) é mais limpa e não perde dado real (as linhas atuais estão praticamente todas em branco). Confirma qual caminho.

## Fora do escopo desta task

- Documentos/artes no Drive (aba Mídias & Artes) — em plano separado.
- Migração para novos campos de `resins` (compatibilidade de impressoras, etc.) — só se você me pedir.
