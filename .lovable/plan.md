# Plano: KPIs de Unidades Vendidas por Produto (Rayshape Donos)

Adicionar, na aba "Impressora 3D Rayshape Edge Mini — Donos", uma nova seção de KPIs mostrando **quantas unidades** de cada produto foram vendidas para os donos da Rayshape (somando apenas compras **após** a compra da impressora).

## Escopo

- Universo: todos os leads listados em `fn_rayshape_owners()` (auto + manual).
- Fonte: `deal_items` dos `deals` daqueles leads, com `deal_date > printer_date_iso` e status ganho (mesma regra usada hoje para `total_post`).
- Métrica: **soma de `quantity`** (unidades), não soma de valor.
- Produtos exibidos: a lista de 22 grupos fornecida pelo usuário (cada linha vira 1 card).
  - Itens "qualquer item X" (SmartMake, SmartGum, Atos resina composta, Cimento UNIKK Veneer) agrupam por padrão (ILIKE).
  - Demais itens fazem match por nome exato / ILIKE do rótulo.

## Backend (nova RPC)

Criar `fn_rayshape_product_units()` retornando `TABLE(product_key text, product_label text, units numeric, leads int)`:

- CTE `owners` = leads de `fn_rayshape_owners` com `printer_date_iso`.
- CTE `post_items` = `deal_items JOIN deals` filtrando `deal.lead_id IN owners`, `deal.won/status = ganho`, `deal.deal_date > owners.printer_date_iso`, e removendo o item da própria impressora.
- CTE `matchers(product_key, product_label, pattern)` VALUES com os 22 grupos e padrões ILIKE:
  - Ex.: `('smartmake', 'SmartMake (qualquer item)', '%smartmake%')`, `('bio_bite_splint_flex', 'Resina 3D Smart Print Bio Bite Splint +Flex', '%bio bite splint%+flex%')` etc.
- `SELECT product_key, product_label, SUM(qty), COUNT(DISTINCT lead_id) FROM matchers JOIN post_items ON name ILIKE pattern GROUP BY 1,2`.

GRANTs padrão para `authenticated` + `service_role`.

## Frontend

Em `src/components/SmartOpsRayshape.tsx`:

1. Novo state `productUnits: { product_label: string; units: number; leads: number }[]`.
2. Carregar via `supabase.rpc("fn_rayshape_product_units")` dentro do `load()` existente (paralelo com `fn_rayshape_owners`).
3. Realtime: o canal atual em `deals` já dispara o reload — reaproveitar.
4. Renderizar nova seção **abaixo do grid de KPIs atuais**:
   - Título "Unidades vendidas — pós-compra da impressora".
   - Grid responsivo (`grid-cols-2 md:grid-cols-3 xl:grid-cols-4`) de `<Card>` compactos: label do produto (2 linhas, truncado), número grande de unidades, e `N leads` abaixo.
   - Ordenar por `units` desc; produtos com 0 aparecem em cinza no fim (ou ocultos — decidir na implementação: manter todos para transparência).

## Fora do escopo

- Não alterar tabela `deals`/`deal_items`.
- Não mudar a lista/tabela de donos, filtros, ou o painel do lead.
- Não incluir preço/receita por produto (usuário pediu apenas unidades).

## Arquivos

- **Nova migration**: `fn_rayshape_product_units` (SECURITY DEFINER, search_path=public).
- **Editar**: `src/components/SmartOpsRayshape.tsx` (load + render da seção).
