# Gestão de Catálogo — Aba "Mapeamento de SKU" + Kits/Bundles

Duas capacidades novas em **Admin → Produtos → Gestão de Catálogo**, integradas na mesma aba:

1. **Mapeamento de SKU** — normaliza itens brutos vindos de propostas/deals/pedidos ↔ variação canônica do catálogo.
2. **Kits (Bundles)** — quando um item brutо é um kit (ex.: "KIT Starter"), o usuário define os componentes; toda vez que um deal ganho vier com esse item, o sistema expande automaticamente para as linhas dos componentes (resina X + resina Y + nanoClean) que entram no cálculo do mix de produtos.

## Layout

Nova aba no card atual, ao lado da tabela existente:

```text
[ Catálogo ] [ Mapeamento de SKU ]  ← Tabs

Aba Mapeamento de SKU
─────────────────────
Filtros: [Busca] [Origem ▾ deal_items|LI|todos] [Status ▾ Não mapeados|Kits|Mapeados|Todos] [Ordenar ▾ GMV|Ocorr.|A-Z]

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Nome bruto                │ Cód. │ Ocorr │ GMV     │ Tipo ▾   │ Mapear/Componentes  │ SKU final │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Scanner Medit i600        │ 1903 │ 412   │ R$14.2M │ Único    │ [🔎 buscar var.  ▾] │ MEDIT-I600│
│ KIT Starter Anycubic      │  —   │ 187   │ R$ 890k │ **Kit**  │ [Editar componentes]│ KIT-STARTER│
│   └ 1× SmartPrint Model Grey                                                          │
│   └ 1× SmartPrint Cast Purple                                                         │
│   └ 1× NanoClean 1L                                                                   │
│ ATOS Block HT A1 (5un)    │  —   │ 87    │ R$ 260k │ Único    │ ✅ ATOS-HT-A1-5U    │ ATOS-...  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- Coluna **Tipo**: `Único` (default) ou `Kit`. Ao mudar para "Kit", o botão vira **Editar componentes** e abre um modal.
- Modal do Kit: adicionar N linhas `(variação do catálogo, quantidade)` usando `SearchableProductSelect` estendido para variações. Salvar persiste a lista de componentes.
- Badge verde "Mapeado" / azul "Kit configurado" / cinza "Pendente".
- Barra superior: `X de Y itens mapeados · Z kits configurados · GMV coberto R$ …`.

## Persistência

**Mapeamento simples** — reutiliza `produto_aliases`:
- `nome_variante` = nome bruto normalizado (lower + trim).
- `nome_canonico` = nome da variação escolhida.
- `sku_interno` = `catalog_product_variations.sku`.
- `categoria` / `subcategoria` herdadas do parent em `system_a_catalog`.
- Índice único em `LOWER(nome_variante)` para upsert.

**Kits** — nova tabela `catalog_kit_components`:
| coluna | tipo |
|---|---|
| id | uuid pk |
| kit_alias_id | uuid → `produto_aliases(id)` on delete cascade |
| component_variation_id | uuid → `catalog_product_variations(id)` |
| quantity | numeric, default 1 |
| sort_order | int |
| created_at / updated_at | tz |

Flag em `produto_aliases`: coluna nova `is_kit boolean default false`. Quando `is_kit=true`, o alias representa a "casca" do kit e não um SKU único; `sku_interno` guarda um SKU sintético (`KIT-<slug>`) só para exibição.

GRANTs completos + RLS: leitura para `authenticated`, escrita restrita a admin (mesma política de `produto_aliases`).

## Expansão automática no ingest (Ganhos)

Novo helper compartilhado `supabase/functions/_shared/kit-expander.ts`:

```ts
expandKitItems(dealItems) → dealItems + linhas expandidas
```

Regra:
1. Para cada linha do deal, buscar em `produto_aliases` por `nome_variante` (lower/trim) do `product_name`.
2. Se `is_kit=true`, ler `catalog_kit_components` e emitir uma linha extra por componente com:
   - `product_name` = nome canônico do componente;
   - `sku` = SKU da variação;
   - `quantity` = `kit_qty × component_qty`;
   - `unit_value` = 0 (o valor fica no header do kit para não duplicar GMV);
   - `source` = `'kit_expansion'`;
   - `parent_deal_item_id` (nova coluna nullable em `deal_items`) apontando para a linha do kit.
3. A linha original do kit permanece intacta (preserva GMV real e histórico bruto).

Pontos de chamada (leitura, não muda gravação bruta):
- **BI / mix de produtos**: view `v_deal_items_expanded` que faz UNION de `deal_items` originais + expansão via `catalog_kit_components`. Todos os consumidores de mix (`ProfessionalMixSummary`, RFM, upsell) passam a ler dessa view.
- **Ganho novo (webhook PipeRun / Omie)**: função existente que grava em `deal_items` chama `expandKitItems` e insere também as linhas filhas materializadas (para timeline do lead card mostrar os componentes na hora).

O usuário original do card do lead vê:
```
KIT Starter Anycubic — R$ 4.900
  └ SmartPrint Model Grey ×1
  └ SmartPrint Cast Purple ×1
  └ NanoClean 1L ×1
```

## Fonte de dados agregada (inbox)

View `v_sku_mapping_inbox`:
- UNION de `deal_items` e `loja_integrada_order_items`.
- Agrupa por `LOWER(TRIM(product_name))`.
- Agrega `SUM(total_value)` como GMV, `COUNT(*)` como ocorrências, mostra amostra de `product_code`/`sku`.
- LEFT JOIN em `produto_aliases` para trazer status atual (mapeado / kit / pendente).
- GRANT SELECT ao `authenticated`.

## Escopo técnico

**Novos arquivos**
- `src/components/admin/catalog/SkuMappingTab.tsx` — UI da aba.
- `src/components/admin/catalog/KitComponentsDialog.tsx` — modal de composição do kit.
- `src/hooks/useSkuMappingInbox.ts` — fetch da view + upsert em `produto_aliases`.
- `src/hooks/useKitComponents.ts` — CRUD de `catalog_kit_components`.
- `supabase/functions/_shared/kit-expander.ts` — expansão reutilizável.

**Migrations (1 arquivo)**
- `ALTER TABLE produto_aliases ADD COLUMN is_kit boolean default false`.
- `ALTER TABLE deal_items ADD COLUMN parent_deal_item_id uuid REFERENCES deal_items(id) ON DELETE CASCADE`.
- `CREATE TABLE public.catalog_kit_components (...)` + GRANTs (authenticated CRUD, service_role ALL) + RLS + policies.
- `CREATE UNIQUE INDEX IF NOT EXISTS produto_aliases_nome_variante_lower_idx ON produto_aliases (LOWER(nome_variante))`.
- `CREATE OR REPLACE VIEW v_sku_mapping_inbox …` + GRANT.
- `CREATE OR REPLACE VIEW v_deal_items_expanded …` (UNION original + kit expansion) + GRANT.

**Modificações**
- `src/components/AdminCatalog.tsx`: envolver conteúdo em `<Tabs>` com "Catálogo" (default) e "Mapeamento de SKU".
- `src/components/SearchableProductSelect.tsx`: aceitar variações (`variation:<id>`), label `SKU · Nome · Apresentação`.
- Consumidores de mix de produtos (`ProfessionalMixSummary` e afins que hoje leem `deal_items`) passam a ler `v_deal_items_expanded`.
- Edge function que grava novos ganhos: adicionar chamada `expandKitItems` após inserir o item principal.

**Fora de escopo**
- Não altera `AdminCatalogTable` nem regras comerciais (Golden Rule, funis).
- Não reescreve histórico: expansão para deals já existentes acontece via view (BI já enxerga); materialização das linhas filhas em `deal_items` só ocorre em ganhos novos. Um backfill opcional pode ser rodado depois se o usuário pedir.

## Fluxo de uso

1. Admin abre aba **Mapeamento de SKU**, filtro "Não mapeados" por GMV desc.
2. Para "KIT Starter Anycubic" muda Tipo → Kit → abre modal → adiciona 3 componentes com quantidades → Salvar.
3. Próximo deal ganho com "KIT Starter Anycubic":
   - `deal_items` recebe a linha do kit (como hoje);
   - `expandKitItems` insere 3 linhas filhas com `parent_deal_item_id` apontando para o kit;
   - Lead card e Mix de Produtos exibem os 3 componentes separadamente.
4. Deals antigos entram no cálculo de mix automaticamente via `v_deal_items_expanded`.

Sem tocar em Golden Rule, funis, edge functions de merge/assign, RLS de tabelas existentes fora do necessário.
