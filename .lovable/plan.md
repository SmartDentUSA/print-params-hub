## Problema

O componente `src/components/admin/RelatorioMensalComercial.tsx` consome `fn_relatorio_mes_kpis(ano, mes)`, mas espera nomes de coluna que não existem no retorno da função. Resultado: todos os KPIs principais aparecem zerados, mesmo quando há dados (ex.: mai/2026 tem `deals_criados=2010` e `funil_ativo=27828` no banco; só o `funil_ativo` aparece porque é o único nome coincidente).

## Mapeamento atual vs. real

| Interface `Kpis` (frontend) | Coluna real da RPC |
|---|---|
| `total_deals` | `deals_ganhos` |
| `receita_total` | `receita_won` |
| `leads_criados_mes` | `deals_criados` |
| `vendedores_ativos` | não retornado pela RPC |
| `ticket_medio` | `ticket_medio` ✓ |
| `funil_ativo` | `funil_ativo` ✓ |
| `perdidas_mes` | `perdidas_mes` ✓ |
| `enviados_estagnados` | `enviados_estagnados` ✓ |
| `clientes_unicos` | `clientes_unicos` ✓ |

## Mudanças (apenas frontend)

Arquivo: `src/components/admin/RelatorioMensalComercial.tsx`

1. Atualizar a interface `Kpis` para refletir as colunas reais: renomear `total_deals → deals_ganhos`, `receita_total → receita_won`, `leads_criados_mes → deals_criados`. Adicionar `taxa_conversao` (já retornada pela RPC) e remover `vendedores_ativos`.
2. Ajustar os pontos de leitura:
   - `totalGanhos`, card "Receita (P&S)" e subtítulo "X deals ganhos" → `deals_ganhos` / `receita_won`.
   - `totalLeads` e card "Oportunidades criadas" → `deals_criados`.
   - Card "Ticket médio": substituir o subtítulo `vendedores ativos: N` por algo derivado dos dados existentes (ex.: contar nomes distintos retornados por `fn_relatorio_mes_vendedor`) ou simplesmente ocultar o subtítulo até existir uma fonte para esse número.
   - `conversaoMes`: continuar derivando localmente (ganhos/criados) — coerente com `taxa_conversao` da RPC.

Sem alterações de banco, RLS, edge functions ou outras telas. O comportamento de cohort/timezone permanece o mesmo, só os números deixam de cair em `undefined → 0`.

## Validação

- Selecionar mai/2026: cards devem mostrar `Oportunidades criadas = 2.010`, `Funil ativo = 27.828` e demais valores reais da RPC (ainda 0 se realmente não houve deal ganho no mês).
- Trocar para meses anteriores e conferir que `Receita`, `Deals ganhos`, `Ticket médio` e `Conversão` passam a apresentar números coerentes.
