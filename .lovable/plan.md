## Diagnóstico

- O loop está em `lead_activity_log` com `event_type = seller_assigned`.
- Nas últimas 6h há 167 eventos desse tipo para apenas 40 leads.
- Alguns leads estão alternando vendedor repetidamente, exemplo: Dr. Cauê Navarro teve 26 eventos em ~6h.
- A origem mais provável é a combinação de:
  - cron jobs do PipeRun rodando em vários pipelines;
  - updates recorrentes em `lia_attendances.proprietario_lead_crm`;
  - trigger `fn_log_form_submission_to_timeline()` gravando “seller_assigned” sempre que o proprietário muda;
  - janela atual de dedupe curta demais: bloqueia só por ~10 min para vendedor diferente.

## Plano de correção

### 1. Endurecer o trigger da timeline

Atualizar `public.fn_log_form_submission_to_timeline()` para impedir spam de `seller_assigned`:

- ignorar owner numérico ou vazio;
- deduplicar por `lead_id + vendedor + piperun_link` em janela maior;
- bloquear qualquer novo `seller_assigned` do mesmo lead por uma janela anti-loop maior, exceto quando for claramente um novo deal real;
- manter logs legítimos de primeira atribuição e reativação real.

Resultado esperado: mesmo que cron/webhook fique reprocessando o lead, a timeline não será inundada.

### 2. Corrigir `smart-ops-lia-assign` para não redistribuir lead já processado

Ajustar a edge function para:

- aumentar o kill-switch de redelivery de 10 min para uma janela mais segura;
- pular redistribuição quando o lead já tem `piperun_id`/vendedor e a chamada não representa novo formulário/deal real;
- não sobrescrever `proprietario_lead_crm` com novo round-robin em reprocessamentos repetidos;
- preservar a Golden Rule: se há deal aberto em VENDAS, o owner do PipeRun continua sendo a fonte da verdade.

### 3. Reduzir write-amplification do sync PipeRun

Ajustar `smart-ops-sync-piperun` para evitar que deals históricos/fechados façam o snapshot principal do lead oscilar:

- antes de atualizar `proprietario_lead_crm`, validar se o deal escolhido continua sendo o deal primário;
- evitar update se o owner final efetivo não mudou;
- manter `piperun_deals_history` íntegro, sem apagar histórico.

### 4. Limpeza conservadora dos logs duplicados recentes

Depois do fix, remover apenas ruído operacional recente:

- apagar duplicatas de `seller_assigned` geradas pelo loop nas últimas 24h;
- preservar pelo menos o evento mais recente por lead/deal/vendedor;
- não tocar em leads, negócios, mensagens, CRM, faturamento, Astron ou histórico comercial real.

### 5. Validação

Conferir após aplicar:

- contagem de `seller_assigned` por hora caiu drasticamente;
- leads problemáticos não alternam mais vendedor em loop;
- novos formulários ainda geram atribuição normal;
- eventos de PipeRun/Astron/formulário continuam aparecendo na timeline.