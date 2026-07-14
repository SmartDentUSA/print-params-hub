## Alinhar Catálogo com Tabela de Preço + preço por moeda no import + filtro Ativos/Inativos

### 1. Novos campos no `system_a_catalog`

Migration adicionando (nullable, sem default):

- `presentation text` (Pres — g/Kg/ml/mg/Unid)
- `presentation_qty numeric` (Pres # — quantidade da apresentação)
- `quantity_multiplier numeric` (Unid × — multiplicador de preço)

`ncm`, `gtin`, `price`, `price_usd`, `price_eur` já existem.

### 2. `DealerCatalogGrid.tsx` — nova estrutura de colunas + filtro ativos

Substituir as colunas atuais para bater 1:1 com a tabela de preço:

```
Status | Foto | COD | Produto | Pres # | Pres | NCM/HS | GTIN/EAN | Unid (×) | Preço tabela (R$ / US$ / €) | Ações
```

- **COD**: read-only, mostra `extra_data.sku || external_id`.
- **Pres #**: `Input` texto/decimal → grava em `presentation_qty` (onBlur).
- **Pres**: `Select` com `PRESENTATION_OPTIONS` (`g`, `Kg`, `ml`, `mg`, `Unid`) → grava em `presentation`. Placeholder quando vazio, sem forçar `Unid`.
- **Unid (×)**: `Input` texto/decimal (default 1) → grava em `quantity_multiplier` (onBlur).
- **NCM/HS**, **GTIN/EAN**, **Preço R$/US$/€**, **Switch Ativar** — permanecem.

**Filtro Ativos/Inativos:**

- Adicionar toggle `Switch` no topo do grid: `"Mostrar inativos"` (default **off**).
- Estado padrão: `filtered` mostra somente `active === true`.
- Ao ligar o toggle: exibe também inativos, com a linha em `opacity-50` (comportamento visual atual).
- Query do Supabase continua trazendo todos os itens (necessário para não recarregar quando o usuário liga o toggle) — o filtro é aplicado no `useMemo filtered`.

### 3. Import do catálogo para a tabela do distribuidor com moeda selecionada

Em `DealerPriceTable.importCatalog`:

- Buscar `price, price_usd, price_eur, presentation, presentation_qty, quantity_multiplier, ncm, gtin, extra_data` (mantém `.eq("active", true)`).
- `currency = list.currency || distributor.preferred_currency || 'BRL'`.
- `price_base` conforme moeda:
  ```
  BRL → p.price
  USD → p.price_usd ?? p.price
  EUR → p.price_eur ?? p.price
  ```
  Fallback para `p.price` se a moeda-alvo estiver vazia (com `toast` avisando quantos itens caíram no fallback).
- Herdar do catálogo:
  - `cod` ← `extra_data.sku || external_id`
  - `ncm_hs` ← `p.ncm ?? extra_data.ncm`
  - `gtin_ean` ← `p.gtin ?? extra_data.gtin/ean`
  - `presentation` ← `p.presentation ?? 'Unid'`
  - `presentation_qty` ← `p.presentation_qty ?? null`
  - `quantity_multiplier` ← `p.quantity_multiplier ?? 1`

### 4. Troca de moeda re-populando preços existentes

Botão **"Recalcular preços do catálogo"** ao lado do Select de moeda (não automático, para preservar ajustes manuais). Ao clicar:

1. Busca em batch os produtos por `catalog_product_id`.
2. Sobrescreve `price_base` conforme moeda escolhida (mesmo fallback), recalcula `price_dealer` mantendo `discount_pct`, marca todos `dirty` para salvar com o botão global.

### 5. I18N

Adicionar chaves em PT/ES/EN:
- Cabeçalhos do catálogo: `catStatus`, `catPhoto`, `catCod`, `catProduct`, `catPresQty` (`"Pres #"`), `catPres`, `catNcm`, `catGtin`, `catUnit` (`"Unid (×)"` / `"Qty (×)"`), `catTablePrice`.
- Toggle: `showInactive` (`"Mostrar inativos"` / `"Mostrar inactivos"` / `"Show inactive"`).
- Botão: `recalcFromCatalog` (`"Recalcular preços do catálogo"` / `"Recalcular precios del catálogo"` / `"Recalculate prices from catalog"`).

### Fora do escopo

- Conversão de câmbio automática.
- Sync de edições do catálogo para tabelas já salvas (só afeta novo import ou recálculo explícito).
- Alteração em snapshots antigos.
