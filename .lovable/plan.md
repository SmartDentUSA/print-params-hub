## Diagnóstico

A régua de auto-avanço (que rodou em massa entre 04 e 08/06) moveu **cross-pipeline** centenas de deals do Funil de Vendas (18784) para o Funil Estagnados (72938). A função anterior só revertia transições dentro do pipeline 18784 — por isso pegou apenas 69 deals.

Snapshot de 06/06 vs hoje confirma o impacto:
- **Contato Feito**: 806 → 122 (684 perdidos)
- **C1**: 391 → 53 (338 perdidos)
- **Em Contato**: 263 → 80 (183 perdidos)
- **Apresentação/Visita**: 44 → 16
- **Fechamento → CS Onboarding** (254 deals) = legítimo, **NÃO mexer**.

## Objetivo

Restaurar ao Funil de Vendas (18784) todos os deals que:
1. Estavam em uma etapa produtiva (C1, C2, C3, Contato Feito, Em Contato, SDR / Nutrição, Apresentação/Visita, Proposta enviada, Negociação) em **06/06/2026**.
2. Hoje estão no Funil Estagnados (72938) **OU** em etapa regressiva dentro do 18784.
3. Devolver à etapa exata que ocupavam em 06/06, **sem alterar proprietário, valor ou custom_fields**.

## Escopo

**Incluído:**
- Pipelines de origem candidato: `72938` (Estagnados) e `18784` (Funil de Vendas).
- Etapas-alvo de restauração: C1, C2, C3, Contato Feito, Em Contato, SDR / Nutrição, Apresentação/Visita, Proposta enviada, Negociação.
- PUT `/deals/{id}` apenas com `pipeline_id: 18784` + `stage_id` (resolvido a partir do nome 06/06).

**Excluído (intocado):**
- Deals que hoje estão em **CS Onboarding (83896)** — promoções de fechamento legítimas.
- Deals fechados ganhos/perdidos (`status = won` ou `lost`).
- Deals que em 06/06 estavam em Fechamento (já correto, ou foram para CS).
- Deals atualmente em "Novos Leads" do 18784 (preservar conforme regra anterior).
- Proprietário, valor, custom_fields, título — nada disso é tocado.

## Passos

1. **Carregar mapa nome → stage_id** do pipeline 18784 via PipeRun API (`GET /stages?pipeline_id=18784`). Cachear o mapping (`{ 'C1': xxx, 'C2': xxx, ... }`).

2. **Construir lista de candidatos** com SQL:
   ```sql
   WITH snap AS (
     SELECT DISTINCT ON (deal_id) deal_id, stage_to_name AS stage_0606
     FROM piperun_stage_transitions
     WHERE pipeline_id = 18784
       AND created_at <= '2026-06-06 23:59:59+00'
     ORDER BY deal_id, created_at DESC
   )
   SELECT s.deal_id, s.stage_0606, d.pipeline_id, d.stage_name, d.status
   FROM snap s
   JOIN deals d ON d.piperun_deal_id::text = s.deal_id
   WHERE s.stage_0606 IN ('C1','C2','C3','Contato Feito','Em Contato',
                          'SDR / Nutrição','Apresentação/Visita',
                          'Proposta enviada','Negociação')
     AND d.pipeline_id IN (18784, 72938)
     AND d.pipeline_id <> 83896  -- nunca puxar de CS Onboarding
     AND COALESCE(d.status,'') NOT IN ('won','lost','ganha','perdida')
     AND (d.stage_name IS NULL OR d.stage_name <> s.stage_0606);
   ```

3. **Edge function `smart-ops-restore-vendas-snapshot`**:
   - Inputs: `?dry_run=1` (default), `?snapshot_date=2026-06-06`, `?limit=2000`.
   - Para cada candidato: resolver `target_stage_id` no mapa; PUT no PipeRun com `{ pipeline_id: 18784, stage_id }`; espelho local; log em `system_health_logs`.
   - Throttle 5 req/s (120ms). Idempotente (skip noop).
   - Resposta: `{ stats: { candidates, restored, skipped_*, failed }, sample, errors }`.

4. **Execução faseada** (timeout 60s ≈ 480 deals por chamada):
   - Chamada 1: `?dry_run=1` → revisar contagem total (esperado ~900) e amostra.
   - Você aprova → chamadas reais sucessivas em loop até `restored=0` (idempotência cobre).

5. **Pré-requisito crítico:** a régua do Funil Estagnados precisa estar **pausada no painel PipeRun**. Se não estiver, no próximo ciclo ela move tudo de novo.

## Detalhes técnicos

- Reaproveita o helper `piperunPut` de `_shared/piperun-field-map.ts`.
- Espelho local: `UPDATE deals SET pipeline_id=18784, pipeline_name='Funil de vendas', stage_id=?, stage_name=?, last_stage_updated_at=now() WHERE piperun_deal_id=?`.
- Audit: `system_health_logs` com `function_name='smart-ops-restore-vendas-snapshot'`, `error_type='restore_vendas_snapshot'`, severity `info`.
- **Sem mudanças** em `lia-assign`, `sync-piperun`, webhook, Golden Rule, owners.

## O que NÃO faremos

- Não tocar em deals do CS Onboarding (83896).
- Não restaurar Fechamento (já correto via promoção CS).
- Não alterar owner_id de ninguém.
- Não restaurar deals com status won/lost.
- Não mexer em deals fora do snapshot 06/06.
