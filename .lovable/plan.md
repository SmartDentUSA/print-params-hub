## Aba "Catálogo de Produtos" — edição inline + Preço em R$/USD/EUR + Ativar/Desativar

E ajustes na aba "Tabela de Preço" (% Desc digitado + desconto por categoria).

---

### 1. Banco — novas colunas em `system_a_catalog`

Migration adicionando 4 colunas (nullable) para não afetar dados existentes:

- `price_usd numeric` — preço tabela em dólar (opcional)
- `price_eur numeric` — preço tabela em euro (opcional)
- `ncm text` — NCM/HS canônico (hoje só existe dentro de `extra_data`)
- `gtin text` — GTIN/EAN canônico

O campo `price` (BRL) e `active` já existem — serão reutilizados. `extra_data.ncm/gtin` continua sendo lido como fallback quando as colunas novas estiverem vazias.

**Aviso importante**: `system_a_catalog` é sincronizado do System A. Edições feitas aqui podem ser sobrescritas em próximas syncs, dependendo da lógica do bridge. Vou tratar como edição direta na master (comportamento pedido); se quiser proteger campos editados manualmente, faço em plano separado.

### 2. `DealerCatalogGrid.tsx` — lista base com edição inline

Layout continua tabela. Mudanças:

- **Remover** o filtro fixo `.eq("active", true)` — passa a listar ativos e inativos.
- **Nova coluna "Status"** com um `Switch` (shadcn) que faz `UPDATE system_a_catalog SET active = ... WHERE id = ...`. Linhas inativas ficam com opacidade reduzida.
- **Colunas editáveis** (`Input` inline, debounce ~600ms → salva no Supabase, `toast` de sucesso/erro):
  - `NCM/HS` → grava em `ncm` (fallback de leitura: `extra_data.ncm`)
  - `GTIN/EAN` → grava em `gtin` (fallback: `extra_data.gtin`/`ean`)
  - **Preço tabela**: uma coluna única com 3 inputs empilhados/lado-a-lado com prefixo `R$`, `US$`, `€`, gravando em `price`, `price_usd`, `price_eur`. Formato numérico livre; vazio = null.
- **Coluna "Ações"** permanece com o botão "Adicionar" quando `onAddToPriceList` está definido.
- Só usuários já autenticados (mesma RLS atual) podem editar — nenhuma mudança de permissão.

### 3. `DealerPriceTable.tsx` — % Desc. digitado + bulk por categoria

- **% Desc. sem spinners**: trocar `<Input type="number">` por `type="text" inputMode="decimal"` com máscara simples (aceita `,` e `.`, faixa 0–100). Comportamento de cálculo permanece — ao sair do campo, recalcula `price_dealer`.
- **Bulk desconto por categoria**: no cabeçalho de cada grupo (`grouped.map`, hoje mostra só o `<h4>` da categoria), adicionar à direita:
  - Um input `% Desc. categoria` (mesmo padrão texto/decimal)
  - Botão `Aplicar` que chama `updateField` em todos os `it.id` daquele grupo com o desconto informado, recalculando `price_dealer` e marcando `dirtyIds` para salvar depois com o botão global "Salvar".
- Traduzir os labels ("Desconto da categoria" / "Category discount" / "Descuento de categoría" / "Aplicar" / "Apply" / "Aplicar") via o dicionário `I18N` existente.

### Fora do escopo

- Conversão automática BRL↔USD↔EUR (usuário digita cada moeda).
- Alteração da lógica de sync do System A → System B.
- Mudanças no `DealerProposalWizard` e no snapshot histórico.

### Diagrama do fluxo de edição

```text
Catálogo (system_a_catalog)
  ├─ Switch active  ──▶  UPDATE active
  ├─ Input NCM      ──▶  UPDATE ncm
  ├─ Input GTIN     ──▶  UPDATE gtin
  └─ Inputs R$/US$/€ ─▶ UPDATE price / price_usd / price_eur

Tabela de Preço (dealer_price_items)
  ├─ % Desc. (texto)         ──▶  updateField discount_pct
  └─ Aplicar % por categoria ──▶  loop rows do grupo → updateField
                                    → salvar com botão global existente
```
