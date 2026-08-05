# Auditoria — Discrepâncias de dados do Painel Comercial (Sistema B)

**Data da verificação**: 05/08/2026, entre 18:10 e 18:25 UTC
**Projeto**: Sistema B — `okeogjgqijbfkudfjadz`
**Escopo**: `/painel-comercial` (`src/pages/PainelComercial.tsx`, `src/hooks/painel/usePainelComercial.ts`, `src/components/painel/*`) e as funções `painel_*` no Postgres.
**Natureza deste documento**: diagnóstico (parte 1) + registro das correções aplicadas (última seção).
**Status**: corrigido em 05/08/2026 — ver "Correções aplicadas" no fim do arquivo. As seções de
diagnóstico descrevem o estado ANTES da correção e ficam como referência.

---

## Como o painel é alimentado

```
cron jobid 162  "painel-comercial-refresh"  */5 * * * *
  └─ painel_comercial_refresh_all(mês corrente)
       ├─ painel_comercial_refresh   → grava blocos kpis + (versões LEGADAS de vendedores/atividades/origens) + top_produtos
       │    └─ painel_funil_refresh  → grava bloco funil
       ├─ painel_vendedores_refresh  → SOBRESCREVE bloco vendedores
       ├─ painel_origens_refresh     → SOBRESCREVE bloco origens
       └─ painel_atividades_refresh  → SOBRESCREVE bloco atividades
                                   ↓
                        public.painel_comercial_cache (bloco, mes, payload)
                                   ↓
   painel_comercial_kpis_cache / _funil / _vendedores / _atividades / _origens / _top_produtos
                                   ↓
              usePainelComercial.ts (react-query, refetch 5 min)
```

O front **nunca** calcula nada: lê o cache. Toda discrepância nasce no cache ou nas funções que o escrevem.

---

## Resumo das discrepâncias

| # | Discrepância | Impacto medido | Gravidade |
|---|---|---|---|
| 1 | Receita do mês oscila entre dois valores a cada refresh | R$ 24.342,00 (23%) | 🔴 crítica |
| 2 | Blocos do mesmo refresh enxergam estados diferentes do banco | R$ 24.342,00 dentro do mesmo cache | 🔴 crítica |
| 3 | Cache de meses anteriores congelado em versões antigas das funções | jul: +R$ 688.772,21 (+24%); cards de composição somam 142%–216% da receita | 🔴 crítica |
| 4 | "Leads no funil" tem 3 valores diferentes na mesma tela | 982 / 1.062 / 1.238 | 🟠 alta |
| 5 | "Leads" da tabela de vendedores são negócios, não leads | ago: 419 × 486; jul: 385 × 2.270 | 🟠 alta |
| 6 | Classificação de receita diferente entre KPI e tabela de vendedores | R$ 6.653,26 trocam de classe; R$ 12.758,13 de software/serviço somem | 🟠 alta |
| 7 | Filtro de vendedores ativos esconde receita da tabela mas não do KPI | jul: R$ 75.230,00 | 🟠 alta |
| 8 | Origens: conversão acima de 100% | KOL Indicação 128,6%; linhas com 0 leads e receita | 🟡 média |
| 9 | Top Produtos vem do faturamento Omie, o resto do CRM PipeRun | ago −36%; jul +33% | 🟡 média |
| 10 | Base de rateio do mix (itens de proposta) ≠ valor do negócio | +65,4% | 🟡 média |
| 11 | "% perda" do funil mede coisa diferente de "Leads perdidos" | Negociação e Fechamento com 0,0% de perda | 🟡 média |
| 12 | Código legado duplicado dentro de `painel_comercial_refresh` | risco em backfill de meses passados | 🟡 média |

---

## 1. 🔴 A receita do mês oscila entre R$ 105.796,44 e R$ 130.138,44

Mesmo mês, mesma função, minutos de diferença:

| Hora (UTC) | `painel_comercial_kpis('2026-08-01')` ao vivo | Valor no cache (o que o painel mostra) |
|---|---|---|
| 18:11 | 105.796,44 | 105.796,44 (refresh 18:10) |
| 18:16 | **130.138,44** | 105.796,44 (refresh 18:15) |
| 18:21 | 105.796,44 | **130.138,44** (refresh 18:20) |
| 18:23 | 105.796,44 | **130.138,44** (refresh 18:20) |

Neste momento o painel exibe **R$ 130.138,44 enquanto o CRM produz R$ 105.796,44** — 23% a mais.

Negócios ganhos no recorte de agosto: **53 → 51** entre 18:16 e 18:23.
Toda a diferença está concentrada em **um vendedor**:

| Vendedor | Cache (bloco vendedores) | Recomputado ao vivo | Δ |
|---|---|---|---|
| Lucas Silva | 71.440,46 | 47.098,46 | **24.342,00** |

### Causa

A tabela `deals` é reescrita continuamente pelos sincronizadores do PipeRun:

- **1.785 linhas** de `deals` atualizadas nos últimos 5 minutos; **4.918** na última hora (de 43.334).
- Os crons de sync rodam em `:05`, `:15`, `:20`, `:25`, `:30`… e o refresh do painel roda em `:00, :05, :10, :15, :20…` levando **47–80 s** (média 49,1 s). Colisão garantida.
- Há linhas em estado internamente inconsistente durante a janela — negócios com `closed_at` preenchido e `status='aberta'`:
  - `62031933` — R$ 61.070 — "Apresentação/Visita" — `closed_at = 05/08 14:58`
  - `62330220` — R$ 28.000 — "Fechamento" — `closed_at = 04/08 09:58`
- `painel_comercial_kpis` usa `coalesce(closed_at, piperun_created_at)` como data do ganho: qualquer negócio ganho que fique momentaneamente sem `closed_at` é atribuído ao mês de criação.

**Ação recomendada**: (a) desalinhar o cron do painel dos crons de sync (ex.: `2,7,12,17,...` em vez de `*/5`); (b) identificar e corrigir o writer que grava `closed_at` sem `status` correspondente; (c) considerar `status='ganha' AND closed_at IS NOT NULL` em vez do fallback por `piperun_created_at`.

---

## 2. 🔴 Blocos do mesmo refresh enxergam estados diferentes do banco

No cache gravado às **18:15** (uma única execução de `painel_comercial_refresh_all`):

| Bloco | Receita do mês |
|---|---|
| `kpis` (card "Receita do mês") | **105.796,44** |
| `vendedores` (coluna Total) | **130.138,44** |
| `origens` (coluna Receita) | **130.138,44** |

O painel mostra os três ao mesmo tempo, com Δ de R$ 24.342,00 entre o card e as tabelas logo abaixo.

### Causa

`painel_comercial_refresh_all` roda numa transação **READ COMMITTED** de ~50 s. Cada comando pega um snapshot novo: `painel_comercial_kpis` executa no segundo 1, `painel_vendedores_refresh`/`painel_origens_refresh` executam no segundo ~30–45. Commits do sync no meio da janela aparecem para uns blocos e não para outros.

**Ação recomendada**: rodar o refresh sob snapshot único —
`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;` como primeiro comando do cron, antes do `SELECT public.painel_comercial_refresh_all();`.

---

## 3. 🔴 Meses anteriores estão congelados em versões antigas das funções

O cron chama `painel_comercial_refresh_all()` **sem argumento** → só o mês corrente é recalculado. Os meses passados guardam o resultado da versão do código que existia quando foram gravados pela última vez (mai e jun em 04/08 23:14–23:20, jul em 05/08 03:30). As funções foram reescritas depois disso (exclusão de pipelines não comerciais, classe software/serviço, rateio por `deal_items`).

### Receita do mês — cache × recomputado hoje

| Mês | Cache (exibido) | Ao vivo | Δ |
|---|---|---|---|
| jul/26 | 3.532.576,63 | 2.843.804,42 | **+688.772,21 (+24,2%)** |
| jun/26 | 2.145.684,29 | 2.002.616,18 | +143.068,11 (+7,1%) |
| mai/26 | 2.938.003,81 | 2.369.809,19 | **+568.194,62 (+24,0%)** |

### Cards de composição somam mais que a receita exibida

`receita_produtos_total` ficou congelado com um valor diferente de `receita_mes`, e os percentuais na tela são calculados sobre ele:

| Mês | Receita do mês (card) | Base da composição | Equipamentos | Insumos | Software/serviço | Soma dos 3 ÷ receita |
|---|---|---|---|---|---|---|
| ago/26 | 105.796,44 | 105.796,44 | 39.282,73 | 54.429,35 | 12.084,35 | **100%** ✅ |
| jul/26 | 3.532.576,63 | 5.004.890,10 | 3.164.290,15 | 1.840.599,95 | — | **141,7%** ❌ |
| jun/26 | 2.145.684,29 | 4.624.497,54 | 3.385.778,22 | 1.238.719,32 | — | **215,5%** ❌ |
| mai/26 | 2.938.003,81 | 5.868.132,32 | 4.201.427,83 | 1.666.704,49 | — | **199,7%** ❌ |

Em jun/26 o card "Receita equipamentos" (R$ 3.385.778,22) é **maior que a receita total do mês** (R$ 2.145.684,29).

### Card "Receita software/serviço" vazio fora do mês corrente

`receita_software_servico` é `null` no cache de mai, jun e jul. Recomputado hoje: jul R$ 172.100,16 · jun R$ 50.263,39 · mai R$ 36.619,52.

### Seletor de meses oferece 24 opções, o cache tem 4

`painel_comercial_cache` só contém 2026-05, 2026-06, 2026-07 e 2026-08. Os outros 20 meses do seletor caem no `coalesce(..., '{}')` e a tela fica em branco com "sem dados para este mês", sem distinguir "mês sem venda" de "mês nunca calculado".

**Ação recomendada**: recalcular os meses históricos sempre que as funções mudarem (ex.: um passo diário `painel_comercial_refresh_all` para os últimos N meses), e distinguir no front "sem cache" de "sem dados".

---

## 4. 🟠 "Leads no funil" tem três valores diferentes na mesma tela

Snapshot do cache de 18:15 (agosto):

| Onde aparece | Valor | O que realmente conta |
|---|---|---|
| KPI "Leads no funil de vendas" | **982** | leads distintos com negócio aberto em pipeline `%vendas%`, criados nos últimos 12 meses |
| Coluna "Hoje" do funil (soma das 9 etapas) | **1.062** | **negócios** abertos, mesmo corte de 12 meses |
| Coluna "No funil" da tabela de vendedores (soma) | **1.238** | **negócios** abertos, **sem corte de data** (1.308 antes do filtro de vendedores ativos) |

Confirmação direta no banco: 1.062 negócios abertos / 982 leads distintos nos 12 meses; 1.308 negócios / 1.093 leads sem corte.

O comentário dentro de `painel_comercial_kpis` documenta a correção de leads × negócios e o corte de 12 meses — mas ela foi aplicada **só ao KPI**; `painel_vendedores_refresh` continua com `count(*) FILTER (WHERE d.status='aberta')` sem filtro de data.

---

## 5. 🟠 "Leads" na tabela de vendedores são negócios criados, não leads

| Mês | KPI "Leads gerados" (`lia_attendances`) | Soma "Leads" por vendedor (negócios criados no pipeline de vendas) |
|---|---|---|
| ago/26 | 486 | 419 |
| jul/26 | 2.270 | 385 |

Mesmo rótulo, entidades diferentes. Em julho a tabela mostra 17% do KPI.

---

## 6. 🟠 KPI e tabela de vendedores classificam receita com regras diferentes

Ambos partiram da mesma base de R$ 130.138,44:

| Classe | KPI (`painel_classifica_item`) | Tabela de vendedores (regra inline) |
|---|---|---|
| Equipamentos | 57.792,52 | 51.139,26 |
| Insumos | 59.587,79 | **78.999,18** |
| Software/serviço | 12.758,13 | *(não existe)* |

- **R$ 12.758,13** de software/serviço/curso ficam embutidos em "Insumos" na tabela de vendedores.
- **R$ 6.653,26** classificados como equipamento pelo KPI viram insumo na tabela: a regra inline só olha `subcategory IN (...)`, sem as regras por nome de `painel_classifica_item` (`shapecure`, `wash & cure`, `cuba ultrassônica`, `fresadora`, `forno de sinterização`, `licença`, `curso`…) e sem a subcategoria `pos_impressao`.

**Ação recomendada**: `painel_vendedores_refresh` passar a usar `painel_classifica_item` e ganhar a coluna software/serviço.

---

## 7. 🟠 O filtro de vendedores ativos esconde receita da tabela, mas não do KPI

`painel_filtrar_ativos` é aplicado a **vendedores** e **atividades**, e não a **kpis**, **funil** e **origens**. Quem não está em `team_members.ativo = true` some da tabela levando a receita junto.

| Mês | Linhas no cache | Linhas exibidas | Total bruto | Total exibido | Receita escondida |
|---|---|---|---|---|---|
| jul/26 | 15 | 10 | 2.843.804,42 | 2.768.574,42 | **75.230,00** |
| ago/26 | 15 | 10 | 130.138,44 | 130.138,44 | 0,00 |

Removidos em julho: Thiago Nicoletti (R$ 65.000,00), Alexandre (R$ 10.230,00), Danilo Pereira, Fabio Rinaldi, Danilo Ricardo Soares da Silva (R$ 0,00).

Resultado: em julho a tabela de vendedores soma R$ 75.230,00 a menos que o KPI de receita.

---

## 8. 🟡 Origens: conversão acima de 100% e linhas com receita sem leads

Agosto:

| Origem | Campanha | Leads | Ganhos | Conversão | Receita |
|---|---|---|---|---|---|
| # - KOL - Indicação | # - KOL - Indicação | 14 | 18 | **128,6%** | 55.823,95 |
| Lista Clientes Internos | # - LTV - Recompra carteira | 7 | 8 | **114,3%** | 13.189,86 |
| # - FACE - INTRAORAL MEDIT | idem | 0 | 1 | — | 4.109,00 |
| interno | # - KOL - Indicação | 0 | 1 | — | 159,86 |

Em `painel_origens_refresh`, `leads/ativos/perdidos` são a **coorte do mês** (leads com `data_primeiro_contato` no mês), enquanto `ganhos/receita` são **negócios fechados no mês**, independentemente de quando o lead entrou. `pct_conversao = ganhos / leads` divide duas populações distintas.

---

## 9. 🟡 Top Produtos vem do faturamento Omie; todo o resto vem do CRM

`painel_comercial_refresh` monta `top_produtos` a partir de `vw_produtos_faturados` (faturamento Omie). KPIs, vendedores, origens e funil usam `deals.value` (PipeRun).

| Mês | Faturamento Omie | Receita CRM | Δ |
|---|---|---|---|
| ago/26 | 82.832,90 | 130.138,44 | **−36,3%** |
| jul/26 | 3.775.271,31 | 2.843.804,42 | **+32,8%** |

Além da fonte diferente, o bloco corta **top 5 por subcategoria** — o grid soma R$ 82.432,90 dos R$ 82.832,90 faturados em agosto e R$ 3.720.828,00 dos R$ 3.775.271,31 de julho. Nada na tela indica que a receita do grid não é a mesma receita dos cards.

---

## 10. 🟡 A base de rateio do mix não bate com o valor dos negócios

Agosto: 53 negócios ganhos valendo **R$ 130.138,44** no CRM, cujas linhas de proposta (`v_deal_items_dedup`) somam **R$ 215.229,10** (+65,4%). Nenhum negócio ficou sem itens; 1 item não classificado (R$ 0,00).

O rateio (`valor_do_negócio × classe ÷ base_de_itens`) fecha o total, mas a **proporção** entre equipamento/insumo/software vem de linhas de proposta que não correspondem ao que foi efetivamente vendido. Está documentado no comentário da função; fica registrado aqui como limitação conhecida do dado, não como bug.

---

## 11. 🟡 "% perda" do funil e "Leads perdidos" medem coisas diferentes

`painel_funil_refresh` calcula perda com `deals.status='perdida'` dentro do pipeline de vendas:

| Etapa | Alcançaram | Perdidas | % perda exibido |
|---|---|---|---|
| Sem contato | 1.061 | 261 | 24,6% |
| C1 | 914 | 201 | 22,0% |
| Negociação | 204 | **0** | **0,0%** |
| Fechamento | 63 | **0** | **0,0%** |

Já o KPI "Leads perdidos (estagnados)" (208 em agosto) vem de transições para o pipeline **Estagnados**. Negócios que saem do funil migram de pipeline em vez de virar `perdida`, então o funil subestima a perda nas etapas finais.

O mesmo vale para os ganhos: dos 51 negócios ganhos de agosto, **49 estão em "CS Onboarding" (R$ 67.693,44)** e apenas **2 em "Funil de vendas" (R$ 38.103,00)**. Ou seja, o card "Receita do mês" é majoritariamente CS/pós-venda, enquanto funil e tabela de vendedores só enxergam `pipeline_name ILIKE '%vendas%'`.

---

## 12. 🟡 Código legado duplicado dentro de `painel_comercial_refresh`

`painel_comercial_refresh` ainda contém versões antigas dos blocos **vendedores**, **atividades** e **origens** (coorte por `created_at`, receita por `vw_produtos_faturados`, atividades sem filtro de concluída, sem exclusão de pipelines de teste). Em `painel_comercial_refresh_all` elas são sobrescritas logo em seguida — mas qualquer chamada direta a `painel_comercial_refresh(mes)` (backfill manual de um mês antigo, por exemplo) grava as versões legadas no cache e o painel passa a exibi-las.

---

## Ordem sugerida de correção

1. **Snapshot único no refresh** (#2) — `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` no comando do cron. Elimina a incoerência entre card e tabelas.
2. **Desalinhar o cron do painel dos syncs + investigar `closed_at` sem `status`** (#1).
3. **Recalcular meses históricos** e distinguir "sem cache" de "sem dados" no seletor (#3).
4. **Unificar as definições** de funil (#4), de "leads" (#5) e de classificação de receita (#6) entre KPI e tabela de vendedores.
5. **Decidir o escopo do filtro de vendedores ativos** (#7) — ou aplicar a todos os blocos, ou a nenhum, ou exibir uma linha "outros".
6. **Separar coorte de fechamento** no bloco de origens (#8).
7. **Rotular a fonte** do Top Produtos e do corte top-5 (#9, #10).
8. **Remover os blocos legados** de `painel_comercial_refresh` (#12) e alinhar a perda do funil ao pipeline de Estagnados (#11).

---

## Correções aplicadas — 05/08/2026

Migrations no projeto `okeogjgqijbfkudfjadz` (consolidadas em
`supabase/migrations/20260805184546_painel_comercial_discrepancias.sql`):
`painel_comercial_fix_kpis_e_funil`, `_fix_vendedores_origens_filtro`,
`_fix_refresh_e_cron`, `_rateio_por_negocio`, `_base_composicao_explicita`.

| # | O que foi feito | Verificação (cache de 18:57 UTC, ago/26) |
|---|---|---|
| 1 | Receita passa a usar só `closed_at` (fim do fallback para `piperun_created_at`) e o cron saiu de `*/5` para `2,7,12,…,57` — fora dos minutos dos syncs do PipeRun | receita estável em R$ 105.796,44 em refreshes consecutivos (antes alternava com R$ 130.138,44) |
| 2 | `painel_comercial_refresh_all` roda sob `REPEATABLE READ` (snapshot único) | os 6 blocos gravam com o mesmo `updated_at` e os mesmos totais |
| 3 | 6 meses recalculados (03–08/2026) + job diário `painel-comercial-refresh-historico` (06:40 UTC, 6 meses) + `painel_comercial_meses_disponiveis()` alimentando o seletor | seletor passa a listar só meses existentes no cache |
| 4 | "No funil" vira leads distintos com corte de 12 meses no KPI, no funil e na tabela de vendedores | 983 / 998 / 987 (antes 982 / 1.062 / 1.238) |
| 5 | Coluna "Leads" da tabela de vendedores renomeada para "Negócios" (é contagem de negócios criados) | rótulo + `title` explicando |
| 6 | Tabela de vendedores passa a usar `painel_classifica_item` e ganha a coluna "Soft/Serv." | equipamentos: KPI = tabela = R$ 28.713,72 |
| 7 | `painel_filtrar_ativos` só esconde vendedor inativo **sem** movimento no mês | jul/26: tabela volta a somar R$ 2.843.804,42 = KPI (antes R$ 2.768.574,42) |
| 8 | Conversão por origem calculada sobre a própria coorte (`ganhos_coorte`), inclusive no merge do front | conversão máxima 100,0% (antes 128,6%) |
| 9 | Top Produtos ganha o rótulo da fonte ("faturamento (Omie) · top 5 por subcategoria") | continua sendo outra fonte, agora declarada |
| 10 | Mix rateado **por negócio** (não mais sobre a base global/por vendedor) e base da composição explícita: `receita_produtos_total` (coberto), `receita_sem_composicao`, `receita_nao_classificada` | equip + insumos + soft + não classificado = base; base + sem composição = receita, em todos os meses |
| 11 | Perda do funil passa a contar a saída para o pipeline Estagnados; a base inclui os negócios que migraram para lá | Negociação 21,7% e Fechamento 31,8% (antes 0,0%) |
| 12 | Blocos legados de vendedores/atividades/origens removidos de `painel_comercial_refresh` | a função grava só kpis, funil e top_produtos |

### Efeitos colaterais esperados (números que mudaram de verdade)

- **Composição de receita**: o rateio por negócio muda o mix. Ago/26 saiu de
  equip R$ 38.511,37 / insumos R$ 53.360,56 / soft R$ 13.924,51 (rateio global) para
  equip R$ 28.713,72 / insumos R$ 72.896,44 / soft R$ 4.186,28.
- **Cobertura da composição**: onde não há linha de proposta, não há composição.
  Abr/26 tem R$ 1.327.853,33 de R$ 1.855.914,99 em negócios sem proposta detalhada — o
  painel agora informa isso em vez de projetar o mix dos 28% restantes sobre o total.
- **Volumes do funil**: com os negócios que foram para Estagnados de volta na base, o
  volume acumulado da primeira etapa passou de 1.346 para 3.533 leads, e a perda por
  etapa deixou de ser artificialmente baixa.
- **Meses anteriores**: as receitas caíram para o valor recomputado (jul/26 de
  R$ 3.532.576,63 para R$ 2.843.804,42) — o valor antigo vinha de uma versão anterior
  das funções, congelada no cache.

### Reincidência às 19h de 05/08 — a causa raiz era fora do painel

Depois das correções acima a receita voltou a oscilar, sempre com a **mesma diferença de
R$ 24.342,00** (cache R$ 139.124,44 × recomputo R$ 163.466,44, às 19:16 UTC), e sempre
concentrada em um único vendedor. Rastreando até a linha:

O negócio **62330220** existe uma vez só em `deals` (há índice único em `piperun_deal_id`)
e alternava entre dois estados completos:

| | pipeline | etapa | status | valor | `piperun_updated_at` |
|---|---|---|---|---|---|
| A (18:20) | Funil de vendas | Fechamento | aberta | R$ 28.000 | 03/08 17:25 |
| B (19:15) | CS Onboarding | Em espera | **ganha** | R$ 24.000 | 04/08 11:24 |

`piperun_stage_transitions` mostra o que aconteceu de verdade: em 04/08 09:59 o negócio
passou de "Fechamento" (Funil de vendas) para "Novos clientes" e depois "Em espera", já no
CS Onboarding — **mudou de pipeline mantendo o mesmo `deal_id`**. B é o estado atual; A é o
estado de 03/08.

O que reescrevia A por cima de B: `fn_sync_normalized_from_lead` aplica cada snapshot de
`lia_attendances.piperun_deals_history` em `deals` com `ON CONFLICT (piperun_deal_id) DO
UPDATE` **sem comparar recência**. O sync do pipeline de origem (`sync-piperun-vendas-1h`,
minuto :05, e o incremental de 30 min) ainda devolve o negócio com o estado antigo; o sync
do destino (`sync-piperun-cs-1h`, minuto :15) devolve o atual. Vencia quem rodasse por
último — e a receita do mês oscilava junto. O par que compunha a diferença: 62330220
(R$ 24.000) + 62386695 (R$ 342) = **R$ 24.342,00**.

Correção (migration `deals_upsert_nao_regride_snapshot_antigo`): o `DO UPDATE` ganhou um
`WHERE` que só aceita snapshot igual ou mais recente que o gravado. A mesma guarda foi
aplicada em `upsertDealHistory` (`supabase/functions/_shared/piperun-field-map.ts`), que
protege o histórico do próprio lead — **essa metade só passa a valer no próximo deploy das
edge functions**; a guarda no banco já está ativa e é a que o painel enxerga.

Vale notar: os itens 1 e 2 desta auditoria (fallback de `closed_at` e snapshot único) eram
problemas reais e continuam corrigidos, mas não eram *esta* causa — eles mascaravam parte do
sintoma. A oscilação só parou com a guarda no upsert de `deals`.

### O que ficou de fora

- **#9 fonte do Top Produtos**: continua vindo de `vw_produtos_faturados` (Omie) enquanto o
  resto do painel vem do CRM. Unificar exigiria decidir qual é a fonte oficial de receita
  por produto — decisão de negócio, não de código. Por ora está rotulado na tela.
- **Base de rateio**: as linhas de proposta somam mais que o valor do negócio (ago/26:
  R$ 215.229,10 contra R$ 130.138,44). O rateio preserva o total, mas a proporção continua
  vindo da proposta, não do faturado.

---

## Consultas usadas na verificação

```sql
-- cache × recomputo ao vivo, por mês
select c.mes, c.updated_at,
       c.payload->>'receita_mes'            as cache_receita,
       public.painel_comercial_kpis(c.mes)->>'receita_mes' as live_receita
from public.painel_comercial_cache c
where c.bloco = 'kpis' order by c.mes desc;

-- coerência entre blocos do mesmo refresh
select (public.painel_comercial_kpis_cache('2026-08-01')->>'receita_mes')::numeric as kpi,
       (select sum((x->>'total_vendas')::numeric)
          from jsonb_array_elements(public.painel_comercial_vendedores('2026-08-01')) x) as vendedores,
       (select sum((x->>'receita')::numeric)
          from jsonb_array_elements(public.painel_comercial_origens('2026-08-01')) x)    as origens;

-- três definições de "funil"
select (public.painel_comercial_kpis_cache('2026-08-01')->>'funil_atual')::int as kpi,
       (select sum((x->>'atual')::int)
          from jsonb_array_elements(public.painel_comercial_funil('2026-08-01')) x)      as funil,
       (select sum((x->>'funil_atual')::int)
          from jsonb_array_elements(public.painel_comercial_vendedores('2026-08-01')) x) as vendedores;

-- receita escondida pelo filtro de vendedores ativos
select sum((x->>'total_vendas')::numeric)
from jsonb_array_elements(public.painel_comercial_bloco('vendedores','2026-07-01')) x
where public.painel_nome_norm(x->>'vendedor')
      not in (select nome_norm from public.painel_vendedores_ativos());

-- churn da tabela deals
select count(*) filter (where updated_at >= now() - interval '5 minutes') as tocados_5min,
       count(*) filter (where updated_at >= now() - interval '1 hour')    as tocados_1h,
       count(*) as total
from public.deals;
```
