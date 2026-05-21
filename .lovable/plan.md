## Regra de negócio (nova)

Um lead **nunca** responde duas vezes à mesma combinação `(meta_form_id + identidade)` no Lead Ads. Toda reentrega do cron Meta com mesmo `form_id` + (`email` ou `phone`) deve ser **descartada de forma definitiva**, sem janela de tempo, sem novo evento na timeline, sem update em `lia_attendances`.

## Diagnóstico

Hoje `smart-ops-ingest-lead` tem 3 camadas de dedupe:

1. **HARD_DEDUPE** por `platform_lead_id` (leadgen_id) — funciona, mas Meta entrega leadgen_id novo a cada ciclo.
2. **FAMILY_DEDUPE** por `(platform_form_id + email/phone)` — correto, mas tem **janela de 24h** (`created_at >= now() - 24h`). Após 24h o mesmo form volta a criar evento.
3. **ACTIVITY_LOG dedupe** por `entity_id` — janela 6h.

O caso Miguel Monte mostra 3 form_ids alternando a cada 2 min: cada par `(form_id, email)` cai no FAMILY_DEDUPE dentro de 24h, mas após esse período o ciclo "reabre" e gera novos `form_submission`. Além disso, em UPDATEs subsequentes o trigger antigo registrava timeline a cada troca de `form_name`. O patch de timeline já cobriu o sintoma — agora precisamos cortar o **vetor raiz**.

## Mudanças propostas

### 1. `supabase/functions/smart-ops-ingest-lead/index.ts` — FAMILY_DEDUPE vitalício

- Remover o filtro `.gte("created_at", now-24h)` na consulta de FAMILY_DEDUPE.
- Manter `merged_into IS NULL` e `platform_form_id = X` + OR(email, phone).
- Comentar claramente: "lead Meta nunca responde a mesma combinação form+identidade mais de uma vez — dedupe lifetime".
- Continuar arquivando o novo `leadgen_id` em `raw_payload.previous_platform_lead_ids` para o HARD_DEDUPE pegar nas próximas reentregas.
- Retornar `dedupe_via: "family_key_lifetime"` para auditoria.

### 2. Mesmo arquivo — HARD_DEDUPE também vitalício

- A query atual em `platform_lead_id` já não tem janela temporal — confirmar e manter.

### 3. Telemetria

- Adicionar `system_health_logs` insert (severity `info`, event_type `meta_family_dedupe_lifetime`) quando o lifetime guard rejeitar, para conseguirmos medir reduções no log de "Entrada".

### 4. Validação

- Após deploy, monitorar `system_health_logs` por 30 min: esperar zero novos `form_submission` para Miguel Monte (lead `543af551-…`) e Ubiratan Araujo (exemplo do usuário) mesmo com o cron Meta rodando a cada 2 min.
- Consulta de verificação:
  ```sql
  SELECT lead_id, count(*) 
  FROM lead_activity_log 
  WHERE event_type='form_submission' 
    AND source_channel='meta_lead_ads' 
    AND event_timestamp > now() - interval '1 hour'
  GROUP BY 1 ORDER BY 2 DESC;
  ```

## Fora de escopo

- Não mexer no trigger SQL `fn_log_form_submission_to_timeline` (já corrigido na migração anterior com janela 24h — agora vira segunda linha de defesa).
- Não tocar em frontend `SmartOpsLogs`.
- Não alterar fluxo de leads orgânicos / formulário site.

Posso aplicar?
