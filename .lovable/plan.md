## Diagnóstico

Lead `clinicamontesclaros@yahoo.com` (Andre Almeida) está com:
- `telefone_raw = 553898475101` (12 dígitos)
- `telefone_normalized = +553898475101` (12 dígitos)

Origem: `piperun_webhook` (campo `person.contact_phones[0].number` veio sem o 9). A nota do Deal e a mensagem WhatsApp da L.I.A. apenas leem `lead.telefone_normalized` (`smart-ops-lia-assign` linha 915, `seller-summary.ts` linha 57), então o erro está **na ingestão**, não na geração da nota.

Regra atual (errada) em `smart-ops-piperun-webhook` (linhas 406-411), `smart-ops-ingest-lead` (linhas 11-18) e similares:

```ts
if (digits.length >= 12 && digits.length <= 13) phoneNormalized = "+" + digits;
```

Aceita 12 dígitos como válido, perpetuando o número truncado. ANATEL exige 9 dígitos pós-DDD para celulares (prefixo "9").

## Correção

### 1. Criar helper único `normalizeBrazilianPhone` em `_shared/phone-normalize.ts`

Regras:
- Strip non-digits, remover `0` inicial.
- Se não tiver `55`, prefixar.
- Após `55 + DDD(2)`:
  - **9 dígitos** começando com `9` → válido (celular).
  - **8 dígitos** começando com `6/7/8/9` → inserir `9` na frente → vira 9 dígitos. (Cobre o caso atual: `38 9847-5101` → `38 9 9847-5101`.)
  - **8 dígitos** começando com `2/3/4/5` → fixo, manter.
  - DDD fora de `11-99` → retornar `null`.
- Validar resultado: 12 (fixo) ou 13 (móvel) dígitos. Caso contrário, `null`.
- Retornar `+` + dígitos.

### 2. Substituir todas as normalizações duplicadas

Arquivos que reimplementam a lógica e devem importar o helper:
- `supabase/functions/smart-ops-piperun-webhook/index.ts` (linhas 406-411 e 635-640)
- `supabase/functions/smart-ops-ingest-lead/index.ts` (linhas 11-18)
- demais funções listadas com `normalizePhone` própria (`piperun-full-sync`, `import-leads-csv`, `astron-postback`, `sync-loja-integrada-clients`, `sync-astron-members`, `omie-lead-enricher`, `smart-ops-cs-processor`, `smart-ops-ecommerce-webhook`, `smart-ops-wa-inbox-webhook`, `smart-ops-proactive-outreach`, `create-technical-ticket`).

Manter assinatura `(raw) => string | null` para evitar refactor amplo.

### 3. Backfill do lead afetado e similares

Migration única + script de remediação:
```sql
UPDATE lia_attendances
SET telefone_normalized = '+55' || substring(regexp_replace(telefone_normalized,'\D','','g') from 3 for 2) || '9' || substring(regexp_replace(telefone_normalized,'\D','','g') from 5)
WHERE merged_into IS NULL
  AND length(regexp_replace(telefone_normalized,'\D','','g')) = 12
  AND substring(regexp_replace(telefone_normalized,'\D','','g') from 5 for 1) ~ '[6789]';
```

E re-publicar contato para PipeRun via `piperun-person-contact-backfill` em `mode: remediate_silent_rejects` para os IDs afetados (a função já usa `updatePersonFields → verifyAndRecoverPersonContact`).

### 4. Validação

- Rodar a normalização em alguns exemplos:
  - `+55 (38) 9847-5101` → `+5538998475101` ✅
  - `+55 (38) 99847-5101` → `+5538998475101` ✅
  - `(11) 3456-7890` → `+551134567890` ✅ (fixo, não insere 9)
  - `+1 415 555 1234` → `null` (não-BR) — manter passthrough simples? **Decisão:** se não começar com `55` e tiver 10-11 dígitos assumir BR; senão preservar como dígitos com `+` se entre 8-15 dígitos.

- SQL de auditoria pós-deploy:
```sql
SELECT count(*) FROM lia_attendances
WHERE merged_into IS NULL
  AND length(regexp_replace(telefone_normalized,'\D','','g')) = 12
  AND substring(regexp_replace(telefone_normalized,'\D','','g') from 5 for 1) ~ '[6789]';
```
Esperado: 0.

### 5. Memória

Salvar `mem://architecture/brazilian-phone-normalization.md` com a regra do 9º dígito e o helper canônico, marcando como Core (qualquer ingestão de telefone deve usar o helper compartilhado).
