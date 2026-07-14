# Plano: Corrigir Descompasso "Recompraram" × KPIs de Produto (Rayshape)

## Causa

`fn_rayshape_product_units` reconstrói a data da impressora com `((o->>'printer_date_iso')::date)::timestamptz` (meia-noite UTC), enquanto `fn_rayshape_owners.post` usa o timestamptz real (`p.printer_date` em America/Sao_Paulo). Isso faz o filtro `closed_at > printer_date` da RPC de unidades ficar frouxo — deals do próprio dia da impressora (combo, kit chairside com Bio Vitality) entram como "pós-compra" no card de unidades, mas não em `n_post`. Resultado: 98 leads em Vitality mas só 53 marcados como "Recompraram".

## Decisão de negócio (já confirmada)

Manter definição **estrita**: recompra = venda com `closed_at > printer_date` real (data e hora). Itens do combo/kit chairside que saem junto da impressora **não** contam como recompra.

## Correção (backend)

Substituir `fn_rayshape_product_units` para usar o timestamp real:

- Trocar `((o->>'printer_date_iso')::date)::timestamptz` por `(o->>'edge_purchase_at')::timestamptz` no CTE `owners`.
- `edge_purchase_at` já vem no payload de `fn_rayshape_owners`.
- Mantém o resto igual: JOIN em `deals` com `status='ganha'`, `closed_at > printer_date`, exclusão explícita do próprio item da impressora, `qtd` do `deal_items` jsonb.

Efeito esperado: números de "unidades vendidas" e do card de "Produto principal / 2º / 3º" ficam alinhados com o KPI "Recompraram". Vitality deve cair de 98 para ~53 leads.

## Fora do escopo

- Não alterar `fn_rayshape_owners`.
- Não mudar frontend — só a RPC.
- Não tocar em outros KPIs, tabela ou filtros.

## Arquivos

- **Migration**: `CREATE OR REPLACE FUNCTION public.fn_rayshape_product_units()` com o ajuste do timestamp.
