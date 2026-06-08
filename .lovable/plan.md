## Contexto

A análise atual (snapshot 06/06 × hoje, pipeline 18784, apenas `deal_status = 0` = abertos, excluindo "Sem contato"):

| Etapa em 06/06 | Abertos 06/06 | OK mesma etapa | Em Estagnados | No 18784 outra etapa | Won | Lost | CS Onb |
|---|---|---|---|---|---|---|---|
| Contato Feito | 803 | 323 | **336** | 125 | 0 | 29 | 0 |
| C1 | 388 | 29 | **340** | 12 | 0 | 41 | 0 |
| Em Contato | 258 | 125 | **84** | 44 | 0 | 10 | 0 |
| SDR / Nutrição | 91 | 19 | **69** | 2 | 0 | 6 | 0 |
| Apresentação/Visita | 44 | 19 | **21** | 3 | 0 | 1 | 0 |
| Proposta enviada | 63 | 24 | **22** | 12 | 5 | 2 | 5 |
| Proposta enviada (TEMP) | 26 | 15 | **11** | 0 | 0 | 2 | 0 |
| Negociação | 99 | 69 | 0 | 1 | 22 | 0 | 22 |
| C2 | 77 | 74 | 1 | 2 | 0 | 4 | 0 |
| C3 | 72 | 72 | 0 | 0 | 0 | 1 | 0 |
| Fechamento | 264 | 12 | 1 | 1 | 231 | 0 | 227 |

**~884 deals ainda em Estagnados (72938)** que estavam abertos em 06/06. O restore anterior (721) **não cobriu todos** — provavelmente filtros do RPC `vendas_snapshot_at` perderam parte da população (não filtra por `deal_status`, mapeamento de nomes incompleto, etc.).

## Objetivo

Restaurar ao Funil de Vendas (18784) **apenas deals que estavam abertos em 06/06** (`deal_status = 0`) e que hoje:
- estão em **Estagnados (72938)**, OU
- estão em outra etapa do 18784 considerada **regressão** vs. 06/06.

**Não mexer** em: primeira etapa ("Sem contato" / Novos Leads), won/lost (hoje), CS Onboarding (83896), e deals que avançaram legitimamente (ex.: 06/06 em "C1", hoje em "Negociação").

## Escopo

**Incluído:**
- População-base: snapshot 06/06 com `deal_status = 0` e `stage_to_name` em: C1, Contato Feito, Em Contato, SDR/Nutrição, Apresentação/Visita, Proposta enviada, Proposta enviada (TEMP), Negociação, C2, C3, Fechamento.
- Origem hoje: pipeline 72938 (Estagnados) **ou** 18784 em etapa de menor ordem que a do 06/06.
- Restauração: PUT no PipeRun apenas com `pipeline_id=18784` + `stage_id` da etapa de 06/06.

**Excluído (intocado):**
- Primeira etapa "Sem contato" / Novos Leads (ordem mais baixa do pipeline) — não mexer em nada que estava lá em 06/06 nem que está lá hoje.
- Deals hoje com `status` won/lost ou `deal_status` 1/2.
- Deals hoje em CS Onboarding (83896) — promoções legítimas de Fechamento.
- Deals que avançaram (hoje em etapa de ordem maior que a do 06/06 dentro do 18784).
- Proprietário, valor, custom_fields, título — **nada disso é tocado**.

## Passos

1. **Reescrever o RPC `vendas_snapshot_at`** para incluir `deal_status` e todos os `stage_to_name` da população-base. Retornar `(deal_id, stage_0606, deal_status_0606)`.

2. **Construir hierarquia de ordem das etapas do 18784** (mapa `stage_name → ordem`) carregada do PipeRun `GET /stages?pipeline_id=18784` e cacheada no início da função. Define "regressão" e bloqueia "avanço".

3. **Refatorar `smart-ops-restore-vendas-snapshot`**:
   - Filtra snapshot por `deal_status = 0`.
   - Para cada candidato, decide ação:
     - hoje em 72938 → **restaurar** para etapa 06/06.
     - hoje em 18784, etapa atual de **ordem menor** que 06/06 → **restaurar**.
     - hoje em 18784, etapa atual de ordem **≥** 06/06 → **skip (avanço legítimo)**.
     - hoje em 83896 (CS) ou won/lost → **skip**.
     - hoje em "Sem contato" → **skip** (primeira etapa preservada).
   - PUT no PipeRun + espelho local + log em `system_health_logs`.
   - Throttle 120ms, `?dry_run=1` default, paginação por `?offset`/`?limit`.

4. **Execução faseada**:
   - Chamada 1: `?dry_run=1` → confirmar contagem esperada (~360 restantes, possivelmente até ~900 se a operação anterior não tiver coberto).
   - Após aprovação, rodar real em lotes de ~400 (60s timeout) até `candidates=0`.

5. **Pré-requisito**: régua do Funil Estagnados **continua pausada** no PipeRun.

## Detalhes técnicos

- Atualização do RPC `vendas_snapshot_at(cutoff timestamptz)` para retornar coluna extra `deal_status`.
- Mapa de ordem do 18784 carregado uma vez por invocação via `piperunGet("stages", { pipeline_id: 18784 })`.
- Aliases de etapa preservados: "Contato Feito" = "C1" (mesmo `stage_id` lógico); "Em Contato" = "SDR/Nutrição".
- "Proposta enviada (TEMP)" → restaurar para "Proposta enviada" (ordem equivalente).
- Resposta da função: `{ stats: { snapshot_open, candidates, restored, skipped_advanced, skipped_won_lost, skipped_cs, skipped_sem_contato, failed }, sample, errors }`.
- Audit: `function_name='smart-ops-restore-vendas-snapshot'`, `error_type='restore_open_0606'`.

## O que NÃO faremos

- Não tocar em "Sem contato" / Novos Leads (nenhuma direção).
- Não reverter avanços legítimos (deal hoje em etapa de ordem maior).
- Não restaurar deals que em 06/06 já estavam fechados (`deal_status ≠ 0`).
- Não tocar em owner, valor, custom_fields, título, status.
- Não mexer em pipelines diferentes de 18784/72938 (CS, Reativação, etc.).
