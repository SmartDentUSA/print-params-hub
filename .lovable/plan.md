

## Plano: Corrigir erro `.catch is not a function` na Dra. L.I.A.

### Problema
O Supabase JS v2 `.from().insert()` retorna um `PostgrestFilterBuilder`, **não** uma Promise nativa. Portanto `.catch()` não existe nesse objeto. Quando o código executa `.insert({...}).catch(() => {})`, ele lança `TypeError: supabase.from(...).insert(...).catch is not a function`, que borbulha até o catch global (linha 4036) e é exibido no chat como mensagem de erro técnica.

### Causa raiz
~20 ocorrências de `.insert({...}).catch(() => {})` e `.insert({...}).then().catch()` no arquivo `dra-lia/index.ts`. O padrão correto no Supabase JS v2 é:
- `const { error } = await supabase.from("x").insert({...})` (verificar `error`)
- Ou `.insert({...}).then(({ error }) => {...})` (o `.then()` do PostgrestBuilder retorna uma Promise real)

### Solução
Editar `supabase/functions/dra-lia/index.ts`:

1. **Substituir todos os `.insert({...}).catch(() => {})`** por `.insert({...}).then(({ error: e }) => { if (e) console.warn(...) })` — são ~6 chamadas fire-and-forget no `system_health_logs`
2. **Corrigir `.update({...}).then().catch()`** (linha 3932) — wrapping correto
3. **Padrão seguro para fire-and-forget**: envolver em `void (async () => { const { error } = await ...; if (error) console.warn(...) })()` ou usar `.then()`

As ~50 ocorrências de `try { await supabase.from("agent_interactions").insert({...}); } catch { }` estão **corretas** — o `await` força a resolução da Promise do PostgrestBuilder, e erros são capturados pelo `try/catch`.

### Linhas afetadas (padrão `.insert().catch()`)
- 517, 526, 535, 557 — `system_health_logs` fire-and-forget no `upsertLead`
- 411, 1657, 1865, 3907 — `logAIUsage().catch(() => {})` (esses já usam uma função que retorna Promise, OK)
- 3931-3932 — `.update().then().catch()` chain

### Arquivo editado
- `supabase/functions/dra-lia/index.ts`

