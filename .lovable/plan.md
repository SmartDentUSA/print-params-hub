## Diagnóstico

Lead exemplo `9837dbad… (Thaís Mendonça)` está com `proprietario_lead_crm` alternando entre dois vendedores a cada hora, em ciclo:

```
XX:20  → "102594"      (deal 60434744)
XX:30  → "Lucas Silva" (deal 60237308)
```

Cada flip dispara o trigger `fn_log_form_submission_to_timeline`, que insere um novo `seller_assigned` em `lead_activity_log`. Como o dedupe é por `(lead_id, entity_name=seller, 1h)` e o **nome muda a cada flip**, o dedupe nunca casa. Resultado: 150 eventos `seller_assigned` em 3 h e a timeline parece um loop infinito.

### Causa raiz (duas, somadas)

1. **Lead tem 2 deals ativos no PipeRun** (60434744 + 60237308) com donos diferentes. `smart-ops-piperun-webhook` (linhas 798–800) **sobrescreve `proprietario_lead_crm` sempre que QUALQUER deal vinculado é tocado**, sem checar se é o deal canônico (`piperun_id`). Como a integração nativa do PipeRun + crons (`smart-ops-piperun-funnel-reconciler` `*/20`, `smart-ops-piperun-retry-failed-leads` `*/15`, etc.) tocam ambos os deals dentro da mesma hora, o dono alterna determinístico entre os dois.
2. **`ids.ownerName` chega como string numérica `"102594"`** (ID do usuário PipeRun cru). A linha 799 grava esse valor sem validar, produzindo `proprietario_lead_crm = "102594"` — que então aparece como "vendedor" na timeline.

Sem dados perdidos; é poluição de timeline + flapping inútil. O mesmo padrão se repete para Marcia Veraldi, Dr. Cauê Navarro, Adriano Leite, Dra Marcela Rabelo, etc. (todos com múltiplos deals).

## Correção

### 1. Migration — guardar contra nome numérico no trigger

Editar `fn_log_form_submission_to_timeline`: antes de inserir `seller_assigned`, rejeitar quando `NEW.proprietario_lead_crm ~ '^\d+$'`. Não mascara o problema upstream, mas impede que strings tipo `"102594"` virem evento de timeline mesmo se algum writer falhar no futuro.

Também: dedupe **adicional** por `(lead_id, 10 min)` independente do nome — qualquer `seller_assigned` no mesmo lead nos últimos 10 min bloqueia novo log. Reassignments reais não acontecem em janelas tão curtas; flapping cron sim.

### 2. `smart-ops-piperun-webhook` — só atualizar owner quando o deal é o primário do lead

Na rota de UPDATE (linhas 777–803), trocar:

```ts
if (ids.ownerName) updateData.proprietario_lead_crm = ids.ownerName;
else if (ids.ownerId && PIPERUN_USERS[ids.ownerId]) updateData.proprietario_lead_crm = PIPERUN_USERS[ids.ownerId].name;
```

por:

```ts
// Só sobrescreve owner do LEAD quando o webhook é do deal canônico
// (lead.piperun_id === dealId). Caso contrário, owner do sibling fica só
// no piperun_deals_history; lead.proprietario_lead_crm permanece estável.
const isPrimaryDeal = String(currentLead?.piperun_id ?? "") === String(dealId);
const candidateOwner =
  ids.ownerName ??
  (ids.ownerId ? PIPERUN_USERS[ids.ownerId]?.name : null);

if (isPrimaryDeal && candidateOwner && !/^\d+$/.test(String(candidateOwner))) {
  updateData.proprietario_lead_crm = candidateOwner;
}
// piperun_owner_id continua sendo gravado abaixo (linha 813) p/ histórico.
```

Idem para o ramo "novo lead" (linha 618): rejeitar nome puramente numérico (`candidateOwner.match(/^\d+$/) ? null : candidateOwner`).

### 3. Higienização one-off (mesma migration)

```sql
-- Limpa "vendedores" numéricos que já vazaram
UPDATE public.lia_attendances
   SET proprietario_lead_crm = NULL
 WHERE proprietario_lead_crm ~ '^\d+$';

-- Purga seller_assigned com entity_name numérico das últimas 48 h
DELETE FROM public.lead_activity_log
 WHERE event_type = 'seller_assigned'
   AND entity_name ~ '^\d+$'
   AND created_at > now() - interval '48 hours';
```

## Validação pós-deploy

1. Consultar lead `9837dbad…` após o próximo ciclo (`:20`/`:30`): `proprietario_lead_crm` deve manter um único valor.
2. `SELECT COUNT(*) FROM lead_activity_log WHERE event_type='seller_assigned' AND created_at > now() - interval '1 hour'` deve cair de ~50/h para dezenas por dia.
3. Nenhum `entity_name` numérico em novos `seller_assigned`.
4. Reassignments reais (mudança manual de vendedor no PipeRun para o deal primário) continuam sendo logados.

## Fora de escopo

- Resolver o `PIPERUN_USERS[102594]` faltando (adicionar mapping) — pode ser feito depois; o guard numérico já protege.
- Diagnosticar por que o lead tem 2 deals abertos (consolidação de duplicates já roda em outro pipeline).
- Bug `function row_to_jsonb(record) does not exist` e fix do `fn_notify_treinamento_agendado` (já tratados em planos anteriores).
- Nenhuma mudança de frontend.
