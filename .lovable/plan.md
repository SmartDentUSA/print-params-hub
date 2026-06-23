Vou aplicar uma correção emergencial com foco em parar imediatamente as notas automáticas e remover qualquer caminho que esteja reabrindo/movendo leads sem nova conversão real.

1. Cortar a origem do spam de notas no PipeRun
   - Remover o envio das notas:
     - `Re-entrega Meta ... throttled (72h). Sem novo deal.`
     - `Re-entrega Meta ... deduplicada. Deal preservado.`
     - `Deal VENDAS anterior preservado...`
     - `duplicado(s) em VENDAS fechado(s) como Perdido...`
   - Manter apenas log interno em `lead_activity_log`, sem aparecer no CRM.
   - A função `smart-ops-lia-assign` nunca mais deve chamar `addDealNote` em rotas de re-entrega/deduplicação/throttle.

2. Bloquear re-entrega Meta sem nova conversão real
   - Em `smart-ops-ingest-lead`, quando for redelivery/dedup do mesmo lead/form/leadgen_id, não chamar `smart-ops-lia-assign`.
   - Resultado esperado: apenas enriquecimento interno do CDP quando houver campo novo; nenhum deal, nenhuma nota, nenhum Round Robin, nenhuma movimentação.

3. Proibir qualquer automação de tocar em deals do Funil de Vendas
   - Remover fechamento automático de duplicados em VENDAS.
   - Remover alteração de owner, pipeline, stage ou status de deal existente em VENDAS.
   - Remover lógica que muda `piperun_id` para um deal novo/mais recente em `Sem contato`.
   - Exceção única: criação inicial de deal quando existe uma conversão nova comprovada e ainda não existe deal comercial aberto/canônico.

4. Proibir qualquer automação de tocar em funis CS
   - Blindar CS, CS Onboarding e Ganhos Aleatórios CS contra fechamento, reabertura, owner change, stage change e recriação automática.
   - Webhooks desses funis serão somente leitura/auditoria.

5. Regra global: sem nova origem de conversão, sem ação comercial
   - Criar/usar um guard único antes de qualquer ação em PipeRun.
   - Só permite ação comercial quando houver prova de nova conversão real:
     - novo `leadgen_id`/`platform_lead_id`;
     - novo envio real de formulário com identificador/timestamp próprio;
     - novo inbound WhatsApp;
     - novo pedido e-commerce;
     - override manual explícito.
   - Não conta como conversão: webhook PipeRun, nota, atividade, automação, sync, backfill, cron, reentrega Meta repetida, edição de campo.

6. Deixar `smart-ops-piperun-webhook` read-only para jornada comercial
   - Webhook do PipeRun não promove deal para canônico.
   - Webhook não posta resumo automático no deal.
   - Webhook não dispara `lia-assign`.
   - Webhook registra auditoria/histórico, mas não reabre nem move lead.

7. Parar notas também no caminho `smart-ops-deal-form-note`
   - Não postar nota em deal existente quando o envio for redelivery/dedup/reentrada sem conversão nova.
   - Para conversão realmente nova, manter nota somente se necessário e protegida por lock; caso contrário, apenas log interno.

8. Origem PipeRun: não criar origens novas automaticamente
   - Ajustar resolução de origem para reutilizar origem existente por nome normalizado.
   - Se não encontrar origem existente, usar fallback estável e registrar auditoria interna.
   - Nunca criar nova origem PipeRun por execução automática.

Arquivos principais que serão alterados:
- `supabase/functions/smart-ops-lia-assign/index.ts`
- `supabase/functions/smart-ops-ingest-lead/index.ts`
- `supabase/functions/smart-ops-deal-form-note/index.ts`
- `supabase/functions/smart-ops-piperun-webhook/index.ts`
- `supabase/functions/_shared/piperun-primary-deal.ts` ou novo helper compartilhado, se necessário
- `supabase/functions/smart-ops-lia-join/index.ts`, se confirmar que é o ponto de criação de origem

Validação após implementar:
- Redelivery Meta repetida: sem nota no PipeRun, sem deal novo, sem reabrir.
- Lead em VENDAS: nenhuma automação fecha, move, troca owner ou volta para `Sem contato`.
- Lead em CS: nenhuma automação toca.
- Webhook PipeRun de nota/atividade: somente auditoria interna.
- Novo formulário real com novo identificador: segue fluxo comercial permitido, sem criar origem duplicada.