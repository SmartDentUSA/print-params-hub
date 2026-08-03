# Painel Comercial Smart Dent — dashboard de TV

Nova tela full-screen para a sala comercial, em rota própria `/painel-comercial`, alimentada 100% por dado real do Supabase (views que já existem em Relatórios/BI). Sem header, sem legenda, sem notas explicativas em nenhum ponto da tela — o único sinal de qualidade é a pill `ok` / `parcial` / `gap` no título de cada card, painel ou coluna. Dado inexistente aparece como `—` com badge `gap`.

## Estrutura da tela

1. **8 cards no topo** (grid 8 col): receita do mês, vs. mês anterior, leads gerados, leads no funil de vendas, leads perdidos (entrada em Estagnados), leads reativados, % receita equipamentos, % receita insumos.
2. **Mid grid (480px + 1fr)**
   - Esquerda: funil de conversão em barras horizontais afuniladas, gradiente azul→roxo→verde, com etapa, atual, tempo médio na etapa, % perda, cumulativo e `↓ XX% passagem` entre barras (maior gargalo em vermelho).
   - Direita: tabela **Performance por vendedor** (18 colunas) e, abaixo, **Atividades realizadas por vendedor** (11 colunas).
3. **Origem dos leads** — dois painéis empilhados (Inbound / Outbound), 11 colunas cada.
4. **Top 5 produtos por etapa** — grid de 7 colunas do workflow, com pills roxas de subcategoria; subcategoria sem venda mostra "sem venda no período".

## Princípio de trajetória contínua do lead

Todo cálculo de tempo/histórico percorre a jornada completa do lead entre pipelines (Vendas → CS quando ganho, Vendas → Estagnados quando perdido, Estagnados → Vendas quando reativado), nunca só o pipeline atual. Reativação não conta como lead novo nas métricas de aquisição. Lead Time Vendas→CS fica sempre com badge `parcial` até existir a chave técnica `deal_origem_id`.

## Fontes de dado (verificadas no banco)

| Bloco | View / tabela |
| --- | --- |
| Cards de receita e leads | `v_relatorio_mes_kpis` (receita_total, leads_criados_mes, mes_ref) |
| Funil / etapas | `v_bi_stage_transitions`, `v_bi_funil_mensal` |
| Vendedor | `v_bi_performance_vendedor` + `v_relatorio_mes_vendedor` |
| Atividades | `v_bi_atividades_unnested` (tipo_atividade, vendedor_atividade, deal_id, status_oportunidade) |
| Origem | `v_bi_origem_conversao` (+ `v_relatorio_mes_origem`) |
| Produtos e categoria | `product_taxonomy` (workflow_stage, subcategory) × `vw_vendas_por_produto` / `vw_produtos_faturados` |
| Perdidos / reativados / funil atual | `deals` + `piperun_stage_transitions` por pipeline |

## Badges de qualidade por métrica

- `ok`: receita do mês, vs. mês anterior, leads gerados, funil atual, origem, produtos por etapa, atividades por vendedor.
- `parcial`: Lead Time (falta `deal_origem_id`), Apresentações (usa Reunião como proxy), Conversão de apresentação, receita insumos LTV / novos clientes / upsell, reconciliação CRM×Omie.
- `gap`: meta comercial, %Meta por vendedor, origem segmentada (Indicações/KOLs/Congressos/Cursos).

## Detalhes técnicos

- `src/pages/PainelComercial.tsx` + rota em `App.tsx`; sem layout admin, ocupando a viewport inteira.
- Tokens do painel isolados em `src/styles/painel-comercial.css` com escopo em um wrapper (`.painel-comercial`), usando as custom properties informadas (`--bg`, `--surface`, `--accent`…) para não afetar o design system global. Fontes Inter + Space Grotesk via Google Fonts.
- Componentes em `src/components/painel/`: `StatusBadge`, `KpiCard`, `FunnelPanel`, `SellerPerformanceTable`, `SellerActivityTable`, `OriginPanel`, `TopProductsByStage`.
- Um hook por bloco em `src/hooks/painel/`, com React Query, `staleTime` de 5 min e `refetchInterval` de 15 min (modo TV). Agregações que as views não entregam prontas (receita por categoria/tipo de cliente, atividades por tipo, reativação) são calculadas no cliente a partir das linhas das views, sem criar migração nesta etapa.
- Grid responsivo conforme os breakpoints: <1200px (8→3 col, mid-grid 1 col, stages 4 col) e <700px (2 col, stages 2 col).
- Nenhum número mockado no código final: todo valor vem de consulta; ausência de dado renderiza `—`.

## Fora do escopo

Tabelas de metas, tipo de atividade "Apresentação", chave `deal_origem_id`, categoria canônica de origem e view de reconciliação CRM×Omie não são criados agora — apenas aparecem como `gap`/`parcial`.
