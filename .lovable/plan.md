## Objetivo

Devolver, para os 7 vendedores informados, todo lead que em 05/06/2026 estava no Funil de Vendas para:

- o mesmo owner original de 05/06;
- a mesma etapa original de 05/06;
- considerando apenas Funil de Vendas e Funil Estagnados;
- ignorando etapa “Sem contato”;
- sem mexer em CS Onboarding, Ganhos, Ganha ou Perdida.

## Critério de restauração

Usar o último snapshot do negócio em `piperun_stage_transitions` até `2026-06-05 23:59:59` como verdade histórica.

Restaurar somente negócios que:

- tinham `pipeline_id = 18784` em 05/06;
- estavam em etapa diferente de “Sem contato”;
- pertenciam originalmente aos owners dos 7 vendedores:
  - Adriano Oliveira → `100952`
  - Daniel Ferreira → `102594`
  - Evandro Silva → `33626`
  - Janaína Santos → `51616`
  - Lucas Silva → `47802`
  - Paulo Sérgio → `95097`
  - Thiago Godoy → `77312`
- hoje estão abertos em `18784` ou `72938`;
- hoje estão com owner diferente e/ou etapa diferente do snapshot.

## Implementação

1. **Criar/ajustar a RPC de candidatos**
   - Nova função SQL para retornar os candidatos finais com:
     - `deal_id`
     - `lead_id`
     - `snapshot_owner_id`
     - `snapshot_owner_name`
     - `snapshot_stage_id`
     - `snapshot_stage_name`
     - pipeline/owner/etapa atual
   - Filtros fortes:
     - `merged_into IS NULL`
     - somente pipelines atuais `18784` e `72938`
     - excluir “Sem contato”
     - excluir status fechado (`won/lost/ganha/perdida` e códigos fechados quando numéricos)
     - excluir CS Onboarding e Ganhos.

2. **Atualizar `smart-ops-restore-vendas-snapshot`**
   - Mudar de “restaurar só etapa” para “restaurar owner + etapa + pipeline”.
   - Para cada candidato, chamar PipeRun com:
     - `pipeline_id: 18784`
     - `stage_id: snapshot_stage_id`
     - `owner_id: snapshot_owner_id`
     - `freezed: 0`
   - Depois sincronizar localmente:
     - `lia_attendances.piperun_owner_id`
     - `lia_attendances.proprietario_lead_crm`
     - `lia_attendances.piperun_pipeline_id`
     - `lia_attendances.piperun_stage_id`
     - `lia_attendances.piperun_stage_name`
     - tabela `deals`, quando existir registro local.
   - Registrar cada restauração em `system_health_logs` com antes/depois.

3. **Executar primeiro em dry-run**
   - Rodar `smart-ops-restore-vendas-snapshot?dry_run=1&snapshot_date=2026-06-05`.
   - Conferir amostra e totais por vendedor antes de executar.

4. **Executar restauração real em lotes**
   - Rodar com `dry_run=0`, em batches com `limit/offset`, para evitar rate-limit do PipeRun.
   - Validar após execução comparando novamente os 7 vendedores contra 05/06.

5. **Blindagem para não acontecer de novo**
   - Fortalecer `smart-ops-lia-assign` para que qualquer deal aberto no Funil de Vendas seja intocável antes de qualquer round-robin, criação, reativação ou `moveDealToVendas`.
   - Corrigir detecção de status fechado para aceitar tanto texto quanto status numérico.
   - Garantir que, se já existir deal aberto no `18784`, nenhum fluxo automatizado envie `owner_id` diferente para PipeRun.
   - Manter `stagnant-processor-cron` desligado e preservar o guard já adicionado no `smart-ops-stagnant-processor`.

## Validação final

Após executar:

- comparar os 7 vendedores novamente contra 05/06;
- confirmar que os candidatos restaurados voltaram para o owner e etapa originais;
- confirmar que não houve alteração em CS Onboarding/Ganhos/Ganha/Perdida;
- checar logs das Edge Functions para falhas de PipeRun/rate-limit.