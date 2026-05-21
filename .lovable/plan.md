## Diagnóstico confirmado

O loop do Miguel não é apenas visual no frontend. O banco está recebendo eventos repetidos em `lead_activity_log`:

- Lead canônico: `543af551-93a1-4b9f-803b-1a4ce3cdc1a2`
- Repetições encontradas:
  - `BLZ- Smart Dent`: 663 eventos
  - `# - Impresoras - Smart Dent`: 661 eventos
  - `# - FACE - INTRAORAL MEDIT`: 76 eventos
- Total no lead: 1.401 eventos `form_submission` vindos de `meta_lead_ads`
- O padrão continua ativo: 3 novos eventos a cada ~2 minutos.

Causa provável:

1. O trigger `trg_log_lead_timeline` em `lia_attendances` grava `form_submission` sempre que `form_name` muda.
2. O `form_name` do lead está alternando entre campanhas/forms da Meta.
3. A função `fn_log_form_submission_to_timeline()` grava esses eventos sem `entity_id`, então o `ON CONFLICT DO NOTHING` não deduplica nada.
4. O guard atual em `smart-ops-ingest-lead` protege bem `meta_ads_lead_entry`, mas não bloqueia esse log gerado pelo trigger quando o `form_name` oscila.

## Plano de correção

### 1. Travar o loop na origem do timeline

Atualizar a função SQL `public.fn_log_form_submission_to_timeline()` para:

- Não gravar `form_submission` repetido para o mesmo `lead_id + source_channel + form_name` dentro de uma janela curta, inicialmente 24h.
- Preencher `entity_id` com uma chave determinística quando possível:
  - `platform_lead_id` ou `raw_payload.latest_payload.meta_leadgen_id` quando existir.
  - fallback seguro baseado em `lead_id + source + form_name`.
- Manter os logs legítimos de `deal_created` e `seller_assigned` intactos.
- Adicionar `SET search_path = public` na função por segurança, já que ela é `SECURITY DEFINER`.

### 2. Reforçar idempotência na ingestão Meta

Atualizar `supabase/functions/smart-ops-ingest-lead/index.ts` para adicionar um segundo guard antes do merge:

- Para `source='meta_lead_ads'`, se já existir um evento recente do mesmo lead, mesmo formulário/campanha e mesma identidade por email/telefone, retornar `duplicate_skipped` sem atualizar `form_name`.
- Cobrir casos onde o `leadgen_id` vem ausente, falso, alternando ou genérico.
- Não alterar a Golden Rule do PipeRun nem sobrescrever owner/stage.

### 3. Limpar o spam já criado no Log de Chegada

Criar uma migration de limpeza controlada para `lead_activity_log`:

- Remover duplicatas de `form_submission` do lead Miguel, mantendo o primeiro evento de cada formulário por dia.
- Antes/depois, registrar a contagem afetada para validação.
- Não alterar o schema de `lead_activity_log`.

### 4. Melhorar a visualização do log

Atualizar `SmartOpsLogs.tsx` para evitar que qualquer resíduo polua a tela:

- Agrupar eventos idênticos recentes no frontend como uma linha única quando vierem do mesmo `lead + form_name + fonte` em janela curta.
- Opcionalmente mostrar contador discreto, por exemplo `repetido 12x`, sem ocultar eventos únicos legítimos.

### 5. Validação

Depois de implementar:

- Consultar Miguel novamente e confirmar que novos eventos pararam.
- Verificar `lead_activity_log` nos últimos 10 minutos para garantir que não chegam mais 3 eventos a cada 2 minutos.
- Conferir logs da Edge Function `smart-ops-ingest-lead` para respostas `duplicate_skipped`.
- Validar que formulários reais continuam criando lead/deal normalmente.