## Objetivo

Não criar lead em `lia_attendances` quando faltar **nome real**, **email real** ou **telefone real**. O caso reportado (`wa_217071992459498_..._@whatsapp.lead`, 0 deals, ❓) é um lead-fantasma criado pelo `dra-lia-whatsapp` quando o WhatsApp envia apenas um LID interno sem número resolvível.

## Regra de validação (aplicada em todos os pontos de criação)

Um lead só é criado se TODOS forem verdadeiros:
- `nome`: não vazio, não é "Sem nome", não é placeholder tipo `WhatsApp 1234`, com pelo menos 2 caracteres alfabéticos.
- `email`: não vazio, regex válida, **não termina em `@whatsapp.lead`, `@lid`, `@n`** e não é domínio de teste (lista atual).
- `telefone_normalized`: dígitos entre 10 e 15, e o número original **não veio de um LID/JID interno** (não tem `@lid`, não tem mais de 13 dígitos sem resolução).

Quando a validação falhar: NÃO inserir, logar em `system_health_logs` (`severity=info`, `error_type=lead_rejected_missing_identity`, com `details: { missing: [...], source, raw }`) e responder `200 { skipped: true, reason: "missing_identity" }`.

Isso é centralizado em um helper novo `_shared/lead-identity-guard.ts` exportando `validateLeadIdentity({ nome, email, phone, phoneNormalized, rawPhone })`.

## Pontos de criação a corrigir

1. **`supabase/functions/dra-lia-whatsapp/index.ts`** (linhas 282–330)
   - Antes do `insert` placeholder: rodar `validateLeadIdentity`. Se falhar, **não criar** lead nem `whatsapp_inbox` ligado a lead, apenas registrar a mensagem com `lead_id=null` e seguir o fluxo de resposta da Dra. LIA (sessão por `phoneDigits`, sem persistência de identidade).
   - Remove o pattern `wa_{lid}_{ts}@whatsapp.lead` como criação de lead. Esse formato deixa de existir no banco daqui pra frente.

2. **`supabase/functions/smart-ops-wa-inbox-webhook/index.ts`** (linhas 134–157)
   - Quando o LID não for resolvido para telefone real (ramo do `console.warn` "@lid detected but no real phone"): NÃO usar LID como fallback para matching/inserts em `lia_attendances`. Inserir em `whatsapp_inbox` com `lead_id=null` e `matched_by='unresolved_lid'`. Não criar lead novo aqui (já não cria, só confirmar).

3. **`supabase/functions/smart-ops-ingest-lead/index.ts`** (linhas 65–90 e bloco "NEW LEAD" linha 406+)
   - Adicionar validação de **nome real** (rejeitar `Sem nome`, vazios, só números/símbolos) e **telefone presente** ANTES do bloco de match e ANTES do insert.
   - Para leads **existentes** (merge), manter comportamento atual — só bloqueamos a CRIAÇÃO, não o enrichment.

4. **`supabase/functions/smart-ops-sellflux-webhook/index.ts`**
   - Mesma regra antes de qualquer `insert` em `lia_attendances`. Apenas bloquear criação; updates de leads existentes seguem.

5. **`supabase/functions/smart-ops-piperun-webhook/index.ts`** (criação por sync Piperun)
   - Mesma regra: se Piperun mandar um person sem email real ou sem telefone, não criar lead local; logar e seguir.

## Limpeza (opcional, recomendado)

Migration de **soft-cleanup** marcando os leads-fantasmas existentes como `merged_into = NULL` + `lead_status = 'descartado_sem_identidade'` para sair das queries canônicas, sem apagar:

```sql
UPDATE lia_attendances
SET lead_status = 'descartado_sem_identidade'
WHERE merged_into IS NULL
  AND (
    email LIKE 'wa_%@whatsapp.lead'
    OR email LIKE '%@lid'
    OR nome ILIKE 'WhatsApp ____'
    OR nome = 'Sem nome'
  )
  AND total_deals_all = 0
  AND total_messages <= 1;
```

Antes de rodar, faço um `SELECT count(*)` pra mostrar o impacto e confirmar com você.

## Validação pós-deploy

1. Reenviar payload do LID `217071992459498` para `dra-lia-whatsapp` → resposta `200 skipped`, **nenhum** novo registro em `lia_attendances`, mensagem registrada em `whatsapp_inbox` com `lead_id=null`.
2. `SELECT count(*) FROM lia_attendances WHERE email LIKE '%@whatsapp.lead' AND created_at > now() - interval '5 min'` → 0.
3. Conferir `system_health_logs` mostra entradas `lead_rejected_missing_identity` com motivos.

## Arquivos alterados

- `supabase/functions/_shared/lead-identity-guard.ts` (novo)
- `supabase/functions/dra-lia-whatsapp/index.ts`
- `supabase/functions/smart-ops-wa-inbox-webhook/index.ts`
- `supabase/functions/smart-ops-ingest-lead/index.ts`
- `supabase/functions/smart-ops-sellflux-webhook/index.ts`
- `supabase/functions/smart-ops-piperun-webhook/index.ts`
- (opcional) migration de cleanup