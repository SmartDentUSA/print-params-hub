## Objetivo
Dentro do card **Resina 3D Smart Print Bio Vitality** (seção "Unidades vendidas — pós-compra da impressora"), exibir a quebra por tonalidade: BL1, B1, A2, A3, BL1 HT, B1 HT, A2 HT — cada uma com a quantidade vendida.

Obs.: nos dados reais existe **A3** (não A3.5). Usarei **A3**, mantendo a ordem pedida (BL1, B1, A2, A3, BL1 HT, B1 HT, A2 HT). Se preferir esconder a linha A3, é só avisar.

## Backend
Nova RPC `public.fn_rayshape_vitality_shades()` — mesma base de `fn_rayshape_product_units` (owners com impressora + deals ganhos pós-impressora), filtrando itens que combinam com `%vitality%` e classificando por shade via regex/`ILIKE`:

```text
shade_key | label   | pattern
bl1_ht    | BL1 HT  | %vitality%bl1%ht%
b1_ht     | B1 HT   | %vitality%b1%ht%   (excluindo bl1)
a2_ht     | A2 HT   | %vitality%a2%ht%
bl1       | BL1     | %vitality%bl1%  (sem HT)
b1        | B1      | %vitality%b1%   (sem HT e sem bl1)
a2        | A2      | %vitality%a2%   (sem HT)
a3        | A3      | %vitality%a3%
```

Retorno: `TABLE(shade_key text, shade_label text, units numeric, ord int)`, ordenado como acima.

## Frontend (`src/components/SmartOpsRayshape.tsx`)
1. Novo state `vitalityShades: { shade_key; shade_label; units; ord }[]`.
2. Carregar via `supabase.rpc('fn_rayshape_vitality_shades')` no mesmo bloco `loadAll` que já busca `productUnits`.
3. No `.map` dos cards, quando `p.product_key === 'bio_vitality'`, renderizar abaixo dos totais um bloco compacto:
   ```
   BL1 — 12
   B1  — 8
   A2  — 5
   A3  — 3
   BL1 HT — 4
   B1 HT  — 2
   A2 HT  — 1
   ```
   Estilo: `text-[11px]`, `ul` sem bullet, valores alinhados à direita, `opacity-50` quando `units===0`.

## Fora de escopo
- Não altero `fn_rayshape_product_units` nem outros cards.
- Sem breakdown por shade em outros produtos.
- Sem valor R$ por shade (só quantidade, como pedido).