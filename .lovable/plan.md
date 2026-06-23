## Regra de ouro (não-negociável)

**Não mexer em deals existentes nos funis VENDAS e CS** (CS_ONBOARDING, GANHOS_ALEATORIOS_CS). Nenhum fechamento, reabertura, mudança de stage ou alteração de owner em deals históricos. Só prevenir criação futura indevida.

## Escala do problema (60d)

54 leads em loop, 3.314 deals criados via re-entrega, 3.209 excedentes. Top ofensores acumulam centenas/milhares de deals em poucos dias — evidência de bypass do dedup atual.

## Plano (2 fases, só prevenção)

### Fase 1 — Investigação (read-only, sem alterar código)

Antes de qualquer edit, confirmar onde o dedup está furando:

1. Query agregando os top 5 ofensores por `flow_type`/`source_channel` e Δt entre eventos consecutivos. Se a maioria das criações está em intervalo < 4h, o `cutoff4h` (L2081) não estava ativo na época OU outro caminho ignora ele.
2. `rg` em `supabase/functions` por chamadas a `enrichment-route` / `runEnrichmentRoute` / `route=enrichment` — mapear todos os pontos de entrada.
3. Verificar `system_health_logs` no período para correlacionar com deploys de `lia-assign`.

Resultado dessa fase: relatório curto identificando o(s) caminho(s) que precisam do guard.

### Fase 2 — Guards de prevenção em `smart-ops-lia-assign/index.ts`

Tudo é **bloqueio de criação nova** — nada toca em deals existentes.

**Guard A — Lock atômico por pessoa (anti-loop sub-minuto)**
Na entrada do enrichment-route, usar `cognitive_lead_locks` (já existe) com TTL de 60s por `pessoa_piperun_id`. Concorrências sequer entram na lógica. Try/finally garante release.

**Guard B — Throttle por pessoa (anti-loop diário/semanal)**
Antes de qualquer CASE de criação, contar em `lead_activity_log` quantos `deal_reativado_via_redelivery` ocorreram para o `pessoa_piperun_id` nas últimas **72h**. Se ≥ 1, abortar com `flow_type: throttled_redelivery_per_person` e apenas adicionar nota no último deal (sem reabrir, sem mover, sem mudar owner).

**Guard C — Ampliar `cutoff4h` → 24h**
L2081: cobrir ciclo diário Meta×vendedor.

**Guard D — Reconhecer "último deal VENDAS Perdido" sem reabrir**
Hoje L1915 só olha deals abertos → cai em CASE C e cria novo + Round Robin. Mudar para: se existe **qualquer deal VENDAS** (aberto OU Perdido nos últimos 30d) para a pessoa, **não cria novo deal, não roda Round Robin**, apenas adiciona nota de re-entrega no deal mais recente (independente do status). Respeita regra de ouro: não reabre, não move, não muda owner.

Efeito combinado: pessoa que já passou por VENDAS nunca recebe segundo deal automático. Re-entregas viram só nota.

## Decisões pendentes do usuário

1. **Guard D — confirmação**: aceita "1 pessoa = no máximo 1 deal VENDAS na vida" (re-entregas viram apenas notas no deal existente)? Ou prefere janela menor (ex: 90d em vez de 30d)?
2. **Guard C**: subir cutoff curto para 24h, ou manter 4h e confiar no throttle de 72h (Guard B)?
3. **Notas de re-entrega**: agrupar (1 nota por dia consolidando N re-entregas) ou 1 nota por evento? Agrupar evita poluir o deal com 50 notas iguais.

## Não alterar

- Deals existentes em VENDAS e CS (regra de ouro)
- Pipelines CS_ONBOARDING / GANHOS_ALEATORIOS_CS (já protegidos)
- `ingest-lead`, `FAMILY_DEDUPE`, `piperun-webhook`
- Schema de `lia_attendances`, `lead_activity_log`, `deals`
- Frontend, LeadDetailPanel, contratos PipeRun/SellFlux
- Qualquer outra edge function além de `smart-ops-lia-assign`