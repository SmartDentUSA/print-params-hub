## Problema

A tabela "Vendas por Vendedor — Deals Criados e Ganhos" mostra **Ganhos ≈ 0** para quase todos os vendedores (e por consequência Conversão ≈ 0% e Ticket médio TOTAL = R$ 236.243), mas a coluna **Receita** está correta (Lucas R$ 238k, Janaina R$ 191k, etc.).

## Causa raiz

O componente `RelatorioMensalComercial.tsx` (bloco `vendedoresUnificados`) usa **`detalhe.ganhas`** e **`detalhe.perdidas`** como fonte. A RPC `fn_relatorio_mes_vendedor_detalhe` filtra deals por `pipeline_name IN ('Funil de vendas','Funil Estagnados')`. Quando um deal é **ganho**, o PipeRun move o card para o pipeline **CS Onboarding**, então o `status='ganha'` nunca é contado dentro dos dois pipelines filtrados → `ganhas = 0`.

Confirmação direta da base (JUN/2026):
- `fn_relatorio_mes_vendedor` (correto): Lucas 77 ganhos · Janaina 74 · Paulo Sérgio 39 · Thiago Godoy 40 · Evandro 32 · Adriano 12 · Daniel 1 · Alexandre 1.
- `fn_relatorio_mes_vendedor_detalhe` (errado): Lucas 3 · Janaina 2 · resto 0.

A RPC `fn_relatorio_mes_vendedor` já retorna ganhos/perdidos corretos (não restringe por pipeline, apenas exclui Atos/E-book/Tulip/Exportação/Ganhos Aleatórios).

## Correção

**Frontend apenas** — `src/components/admin/RelatorioMensalComercial.tsx`, no `useMemo` de `vendedoresUnificados`:

- Após mesclar `detalhe` e `vendedores`, **sobrescrever** `cur.ganhos` com `Number(v.deals_ganhos ?? 0)` e `cur.perdidos` com `Number(v.perdidos ?? 0)` (a RPC `fn_relatorio_mes_vendedor` é a fonte canônica para ganhos/perdidos do mês porque acompanha o deal mesmo após mudar de pipeline).
- Recalcular `conv = ganhos / total * 100` com o valor corrigido (já é derivado depois).
- Os totais (`totals.ganhos`, `totals.perdidos`, Conversão TOTAL e Ticket médio TOTAL) passam a refletir os valores corretos automaticamente.

Sem alteração no banco. A coluna "Estagnados" do card de funil (que vem de `detalhe.estagnados`) continua correta porque estagnados ficam no pipeline Funil Estagnados.

## Verificação

Após o fix, JUN/2026 deve mostrar:
- Lucas: 77 ganhos · conv ≈ 34,5% · ticket R$ 3.104
- Janaina: 74 · ≈ 33,8% · R$ 2.583
- Paulo Sérgio: 39 · ≈ 14,9% · R$ 4.785
- TOTAL ganhos ≈ 276 · ticket médio TOTAL ≈ R$ 4.280
