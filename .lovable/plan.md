Diagnóstico confirmado para este lead

- O deal legítimo já aberto era `#61251873` em `Funil de vendas / C3`.
- Um novo deal `#61258968` foi criado no PipeRun em `Sem contato` às 15:45:38 por fluxo externo/automação do PipeRun, não pelo `smart-ops-lia-assign`.
- O `smart-ops-piperun-webhook` recebeu esse novo deal e atualizou o lead canônico para o deal mais novo, porque o seletor atual de deal primário usa “open mais recente vence”. Isso violou a regra de ouro na camada do webhook: o sistema passou a apontar para o deal duplicado/reaberto.
- Depois disso, o Guard B da re-entrega Meta adicionou a nota “throttled (72h)” no deal novo porque escolhe o VENDAS mais recente, não o deal canônico legítimo.

Plano de correção

1. Blindar `smart-ops-piperun-webhook` contra duplicata criada fora
   - Detectar quando chega um webhook de deal novo/diferente do `piperun_id` atual para a mesma Pessoa.
   - Se já existir deal aberto em VENDAS ou CS para o lead/pessoa, preservar o deal existente.
   - Não sobrescrever `piperun_id`, owner, etapa ou funil do lead com um novo deal em `Sem contato` criado por automação externa.
   - Registrar o evento como duplicata/quarentena em `system_health_logs` e `lead_activity_log`.

2. Corrigir o seletor de deal primário
   - Atualizar `_shared/piperun-primary-deal.ts` para aceitar o deal atual/canônico como contexto.
   - Nova regra: se o deal atual está aberto em VENDAS/CS, ele permanece primário; um novo `Sem contato` não pode vencer apenas por ser mais recente.
   - Só trocar o primário quando o deal atual estiver fechado ou inexistente, ou quando houver uma transição manual real para outro deal legítimo.

3. Impedir que webhooks de “atividade/nota” mudem CRM snapshot
   - No `smart-ops-piperun-webhook`, quando `event_action.trigger_type = "Ao criar uma atividade"`, tratar como evento informativo.
   - Não recalcular deal primário, não postar seller summary e não alterar owner/funil/etapa do lead por causa de nota adicionada.

4. Corrigir o alvo das notas de throttle/re-entrega
   - Em `smart-ops-lia-assign`, Guard B deve postar a nota no deal canônico preservado (`lead.piperun_id` validado em VENDAS/CS), não no VENDAS mais recente.
   - Se o canônico não for válido, usar o seletor protegido, nunca “latestVendas” puro.

5. Opcional, mas recomendado: fechar somente o duplicado recém-criado
   - Quando o webhook detectar duplicata externa em `Sem contato`, fechar apenas o deal novo duplicado como `Perdido` com motivo `duplicado_automacao_piperun`.
   - Não tocar no deal legítimo em VENDAS/CS.
   - Se preferir zero escrita no PipeRun, manter apenas quarentena local; porém o duplicado continuará visível no CRM.

6. Validação pós-implementação
   - Reconsultar o lead `elbtonjhonds@yahoo.com.br` e confirmar que o primário volta/permanece no deal legítimo `#61251873` ou no deal aberto avançado correto.
   - Verificar logs dos próximos webhooks: atividade/nota não pode criar reprocessamento de primário.
   - Confirmar que novas re-entregas Meta geram no máximo nota no deal canônico, sem novo deal, sem Round Robin e sem alteração de funil/etapa.