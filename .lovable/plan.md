## Diagnóstico

Lead `04f7e07e... Luciana Boggian` recebe `seller_assigned` a cada ~1.5 min (mesmo dado, sem novo formulário desde 22:18). Confirmado em `lead_activity_log` + edge logs.

**Cadeia:**
1. Meta re-entrega o mesmo `leadgen_id` a cada ~2 min para 2 formulários (`# - FACE - SCAN BANCADA MEDIT` e `# - Impresoras - Smart Dent`).
2. `smart-ops-ingest-lead` tem 3 camadas de dedupe (HARD/FAMILY/activity-log), mas **todas falham** para este lead:
   - `platform_lead_id = NULL` na linha → HARD_DEDUPE não casa.
   - `platform_form_id = NULL` → FAMILY_KEY não casa.
   - `lead_activity_log.entity_id` é a string sintética `lead:UUID|source:...|form:...`, não o `leadgen_id` → 3ª camada não casa.
3. `ingest-lead` então dispara `smart-ops-lia-assign` com `trigger="sdr_captacao_reativacao"`.
4. Em `lia-assign` a guarda de idempotência (≤5 min) exige `proprietario_lead_crm && piperun_id && updated_at`. Os edge logs mostram "Round Robin assigned: Adriano" → no momento da leitura `proprietario_lead_crm` está **vazio** (re-setado para Marcela pelo GOLDEN RULE só no final), então a guarda não dispara e o fluxo completo roda toda vez.

Resultado: 2 invocações por ciclo, ~30 por hora, escrevendo `seller_assigned`, atualizando PipeRun, publicando contato, etc.

## Correções

### 1. `smart-ops-ingest-lead` — dedupe robusto para leads Meta sem `platform_lead_id`/`platform_form_id`

Adicionar uma 4ª camada de dedupe **antes** do dispatch para lia-assign, específica para `source='meta_lead_ads'`:

- Resolver o lead canônico por email/telefone (já existe).
- Se existir, consultar `lead_activity_log` por `(lead_id = canonical, event_type='form_submission', entity_name = form_name, event_timestamp > now() - 12h)`.
- Se houver hit → tratar como re-entrega: arquivar `meta_leadgen_id` em `raw_payload.previous_platform_lead_ids`, gravar `platform_lead_id`/`platform_form_id` no lead canônico (backfill) e retornar `duplicate_skipped:true`. **Não** dispara lia-assign nem registra novo `form_submission`.

Isso fecha o loop sem depender de campos nulos legados.

### 2. `smart-ops-ingest-lead` — backfill obrigatório de identificadores Meta

Sempre que processar um payload Meta e o lead canônico estiver com `platform_lead_id` ou `platform_form_id` nulos, preencher imediatamente com os valores do payload atual. Garante que, a partir da próxima entrega, HARD_DEDUPE/FAMILY_KEY funcionem normalmente.

### 3. `smart-ops-lia-assign` — guarda de idempotência à prova de race

Substituir a condição `lead.proprietario_lead_crm && lead.piperun_id && lead.updated_at` por uma checagem mais resiliente:

- Se `piperun_id` existir **e** `updated_at` for < 3 min → SKIP (independente de `proprietario_lead_crm`, que pode estar transitoriamente vazio durante o GOLDEN RULE).
- Manter o bypass por `force=true` / `force_new_deal=true`.

Isso impede que uma janela momentânea sem `proprietario_lead_crm` (re-atribuição em andamento) abra brecha para reprocessamento.

### 4. Limpeza one-shot do lead Luciana (e similares)

Backfill imediato em `lia_attendances` para o lead `04f7e07e-…`: setar `platform_lead_id`, `platform_form_id` e arquivar o `leadgen_id` em `raw_payload.previous_platform_lead_ids` para parar a entrega corrente. Mesmo processo via SQL para qualquer outro lead Meta canônico que tenha `platform_lead_id IS NULL` e mais de 1 `form_submission` nas últimas 24h.

## Entregáveis

1. Patch em `supabase/functions/smart-ops-ingest-lead/index.ts` (camada 4 + backfill).
2. Patch em `supabase/functions/smart-ops-lia-assign/index.ts` (idempotency).
3. Migration de limpeza one-shot para os leads em loop ativo.
4. Memória `mem://architecture/meta-redelivery-loop-fix.md` atualizada com a 4ª camada e o ajuste da guarda.

## Validação

- Edge logs de `smart-ops-lia-assign` filtrando por `04f7e07e` devem parar de mostrar novas execuções após o deploy.
- Novo evento `meta_family_dedupe_by_form_history` em `system_health_logs` confirma a 4ª camada funcionando.
- `lead_activity_log` para a Luciana não deve receber novos `seller_assigned` sem novo `form_submission` real.
