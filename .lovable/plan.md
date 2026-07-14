# Plano: Valor em R$ por Produto na seção "Unidades vendidas"

Adicionar o **valor total em reais** vendido de cada produto na seção *Unidades vendidas — pós-compra da impressora*, ao lado das unidades já exibidas.

## Backend

Atualizar `fn_rayshape_product_units()` para retornar também `revenue numeric`:

- No CTE `post_items`, incluir `COALESCE((item->>'total')::numeric, 0) AS total`.
- No `SELECT` final, `SUM(mt.total)` agregado por produto → coluna `revenue`.
- Assinatura passa a: `TABLE(product_key, product_label, units, leads, revenue, ord)`.

## Frontend (`src/components/SmartOpsRayshape.tsx`)

1. Ampliar o state `productUnits` para incluir `revenue: number`.
2. Mapear `revenue: Number(r.revenue) || 0` no `load`.
3. Nos cards da seção, adicionar linha extra abaixo das unidades com o valor em BRL formatado (`fmtBRL`).
4. No cabeçalho da seção, exibir também o **total em R$** de todos os produtos ao lado do total de unidades.
5. Ordenação continua por `units` desc (com desempate por `ord`) — o valor é informação adicional, não muda a ordem.

## Fora do escopo

- Não tocar em outros KPIs.
- Não mexer em `fn_rayshape_owners`.
