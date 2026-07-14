## Objetivo

1. **Blindar** o catálogo da Base de Conhecimento: seus cards vêm exclusivamente do **Painel Administrativo → Gestão de Catálogo de Produtos** (`system_a_catalog` com `active + approved + visible_in_ui`). Nada em **Distribuição — Tabelas de Preço & Propostas** pode alterar esses registros.
2. Tornar o toggle **Ativo/Inativo** dentro da Distribuição um filtro **puramente local** (só define se o produto aparece na lista da tabela de preço daquele distribuidor).
3. Adicionar botão **Excluir** em cada linha do **Historial de cotizaciones** (snapshots).

---

## Mudanças

### 1. Base de Conhecimento — reforçar regra (verificação, sem alteração funcional)
Arquivo: `src/components/knowledge/KbTabCatalogo.tsx`
- Já filtra `active=true AND approved=true AND visible_in_ui=true` em `system_a_catalog` (linhas 423‑427). Adicionar comentário `// REGRA: cards só vêm de system_a_catalog gerenciado no Painel Admin. NENHUMA escrita a partir de módulos externos (Distribuição, Propostas).` para travar a regra em revisão.

### 2. Distribuição — isolar Ativo/Inativo do catálogo mestre
Novo campo local em `dealer_price_items`:

```sql
ALTER TABLE public.dealer_price_items
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
```

Arquivo: `src/components/smartops/distributors/DealerPriceTable.tsx`
- `importCatalog()` (linha 175): remover o filtro `.eq("active", true)` do `system_a_catalog` — importar **todos** os produtos aprovados. Assim, ligar/desligar um item na Distribuição não depende (nem afeta) o catálogo mestre.
- Adicionar coluna **Ativo** com `Switch` na tabela por linha; grava só em `dealer_price_items.is_active`.
- Adicionar filtro no topo "Mostrar inativos" (default: off) que filtra localmente `is_active=false`.
- Confirmar que **nenhuma escrita** deste componente atinge `system_a_catalog` (grep de verificação no fim).

Arquivo: `src/components/smartops/distributors/types.ts`
- Adicionar `is_active: boolean` em `DealerPriceItem`.

Arquivo: `src/components/smartops/distributors/DealerCatalogGrid.tsx`
- Já é somente leitura desde a última rodada. Adicionar comentário topo do arquivo: `// READ-ONLY: nunca escrever em system_a_catalog. Fonte da verdade é o Painel Admin → Gestão de Catálogo.`

### 3. Historial de cotizaciones — botão excluir
Arquivo: `src/components/smartops/distributors/DealerPriceTable.tsx` (linhas 579‑597)
- Adicionar ao lado do botão **Restaurar** um botão **Excluir** (ícone `Trash2`) com `AlertDialog` de confirmação.
- Handler: `deleteSnapshot(id)` → `supabase.from("dealer_price_list_snapshots").delete().eq("id", id)` → `reloadSnapshots()` → toast de sucesso.
- Adicionar traduções (`pt/es/en`): `deleteSnapshot`, `confirmDeleteSnapshot`, `snapshotDeleted`.

### 4. Verificação final
- `rg "system_a_catalog" src/components/smartops/distributors/` — deve mostrar apenas leituras (`.select`), zero `.update/.insert/.delete/.upsert`.
- Typecheck.

## Fora de escopo
- Sincronização Sistema A externa; alterações em Painel Admin; FX badge; sync com `products_catalog`.

## Diagrama

```text
Painel Admin (Gestão de Catálogo)
        │  (única fonte de escrita)
        ▼
   system_a_catalog  ──►  Base de Conhecimento (read-only, filtra active+approved+visible_in_ui)
        │
        └─► Distribuição/Tabelas de Preço (read-only import)
                    │
                    ▼
             dealer_price_items.is_active  ◄── toggle LOCAL do distribuidor
             dealer_price_list_snapshots   ◄── histórico com botão Excluir
```
