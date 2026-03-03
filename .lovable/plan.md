

# Diagnóstico: Por que o Willian (techdentidigital@gmail.com) não foi inserido na lia_attendances

## Causa Raiz

O lead `techdentidigital@gmail.com` foi inserido corretamente na tabela `leads` (legacy), mas a sincronização para `lia_attendances` **falhou silenciosamente** na função `upsertLead` (linha 1149 do `dra-lia/index.ts`).

O código usa:
```typescript
await supabase.from("lia_attendances").upsert({...}, { onConflict: "email" });
```

Porém, a tabela `lia_attendances` **não tem uma UNIQUE CONSTRAINT** na coluna `email`. Ela tem apenas:
- Um **index regular**: `idx_lia_attendances_email`
- Um **unique index**: `lia_attendances_email_ci_key` em `lower(email)`

O Supabase/PostgREST requer uma **UNIQUE CONSTRAINT** (não apenas um unique index) para que `onConflict` funcione. Quando não encontra o constraint, o upsert falha silenciosamente ou lança um erro que é capturado pelo `catch` genérico (linha 1162), logando apenas um `warn` que já expirou dos logs.

## Consequência em Cascata

1. **lia_attendances vazio** → `notifySellerHandoff` busca o lead por email em `lia_attendances` (linha 1452-1456), não encontra, e retorna imediatamente (linha 1458-1460: `"No attendance found"`)
2. **Sem vendedor** → nenhuma notificação enviada ao vendedor
3. **Sem PipeRun** → `smart-ops-lia-assign` nunca foi chamado porque depende do lead existir em `lia_attendances`
4. **Sem mensagem** → sem telefone normalizado no registro, sem envio via WaLeads

## Correção

### 1. Migration: Adicionar UNIQUE CONSTRAINT real na coluna email

```sql
ALTER TABLE lia_attendances 
ADD CONSTRAINT lia_attendances_email_unique UNIQUE (email);
```

Isso permitirá que o `onConflict: "email"` funcione corretamente no upsert.

Nota: se houver emails duplicados existentes, será necessário deduplicar antes. Verificaremos isso.

### 2. Fallback no `dra-lia/index.ts` — upsertLead

Adicionar lógica de fallback: se o upsert falhar, tentar INSERT direto. E se falhar por duplicata, fazer UPDATE. Isso torna o código resiliente independente do tipo de constraint.

```typescript
// Fallback: try insert, if conflict do update
const { error: upsertErr } = await supabase.from("lia_attendances").upsert({...}, { onConflict: "email" });
if (upsertErr) {
  // Fallback: manual insert-or-update
  const { data: existing } = await supabase.from("lia_attendances").select("id").eq("email", normalizedEmail).maybeSingle();
  if (existing) {
    await supabase.from("lia_attendances").update({...}).eq("id", existing.id);
  } else {
    await supabase.from("lia_attendances").insert({...});
  }
}
```

### 3. Inserir o Willian agora manualmente

Após a migration, inserir o lead `techdentidigital@gmail.com` em `lia_attendances` e disparar o `smart-ops-lia-assign` para sincronizar com o PipeRun.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | `ADD CONSTRAINT lia_attendances_email_unique UNIQUE (email)` |
| `supabase/functions/dra-lia/index.ts` | Fallback resiliente no `upsertLead` para lia_attendances |

