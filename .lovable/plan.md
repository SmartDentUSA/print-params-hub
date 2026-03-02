
## Diagnóstico Completo: Por que Thiago Nicoletti não aparece corretamente

### Problema encontrado: **Duplicata por case-sensitivity do email**

Existem **2 registros** em `lia_attendances` para o mesmo usuário:

| ID | Email | Status | Messages | PipeRun |
|---|---|---|---|---|
| dc79c9eb | `THIAGO.NICOLETTI@SMARTDENT.COM.BR` (uppercase) | sem_contato | 0 | null |
| 154d5b9b | `thiago.nicoletti@smartdent.com.br` (lowercase) | novo | 8 | 33706074 |

**Causa-raiz**: O índice único `lia_attendances_email_key` é `btree(email)` — **case-sensitive**. Quando o Thiago digitou o email em MAIÚSCULAS na primeira vez (23/Feb), criou um registro. Na segunda vez (26/Feb) em minúsculas, criou outro. O `onConflict: "email"` no upsert também é case-sensitive, então não detecta o conflito.

### Consequências em cascata

1. **total_messages = 8** mas a sessão de hoje teve **13 interações** — o counter incrementou o registro lowercase mas a race condition (select→increment→update sem lock) perdeu contagens
2. **lead_status = "novo"** — nunca foi atualizado para "em_atendimento" porque o handoff depende do fluxo de `lia-assign`, que já tinha rodado anteriormente para o PipeRun deal 33706074
3. **Nenhuma mensagem enviada** — `message_logs` está vazio para ambos os IDs, indicando que o handoff proativo não disparou nesta sessão (o `proprietario_lead_crm` é o próprio Thiago Nicoletti, então o sistema pode estar evitando enviar mensagem ao próprio lead)
4. **Cognitive analysis gerada** — funcionou corretamente para o registro lowercase (confidence: 95, stage: SAL_comparador)

### Plano de correção (3 mudanças)

#### 1. Migration: Normalizar emails para lowercase e prevenir duplicatas futuras

```sql
-- Merge duplicates: update lowercase record with any data from uppercase
-- Delete uppercase duplicate
-- Add citext extension for case-insensitive email
CREATE EXTENSION IF NOT EXISTS citext;

-- Merge and clean duplicates
UPDATE lia_attendances SET email = LOWER(email) WHERE email != LOWER(email);

-- Change email column to citext for case-insensitive uniqueness
ALTER TABLE lia_attendances ALTER COLUMN email TYPE citext;
```

Isso garante que futuros upserts com `THIAGO@...` e `thiago@...` sejam tratados como o mesmo registro.

#### 2. Edge Function `dra-lia/index.ts`: Normalizar email na entrada

Em todos os pontos onde `leadState.email` é usado para queries/upserts, normalizar para lowercase:
- Na detecção do email (onde `leadState` é construído), adicionar `email = email.toLowerCase()`
- Isso previne duplicatas mesmo sem citext

#### 3. Edge Function `dra-lia/index.ts`: Usar `ILIKE` ou `.ilike()` nas queries de lookup

Nas queries que fazem `.eq("email", leadState.email)`, trocar para `.ilike("email", leadState.email)` como fallback de segurança.

### Ação imediata: Limpar duplicata existente

A migration vai:
1. Mesclar os dados do registro uppercase no lowercase (se houver campos preenchidos no uppercase que faltem no lowercase)
2. Deletar o registro uppercase duplicado
3. Alterar a coluna para `citext`

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migration SQL | citext extension, merge duplicatas, alterar coluna email |
| `supabase/functions/dra-lia/index.ts` | `toLowerCase()` no email ao construir leadState |
