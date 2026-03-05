

## Fixes de Alta Prioridade — Plano de Implementacao

### Fix 1: Deduplicacao no `smart-ops-ecommerce-webhook/index.ts`

Inserir bloco de deduplicacao apos linha 546 (apos `numeroPedido` estar definido), antes do enrichment (linha 548).

**Logica:**
- Query `message_logs` por `tipo = 'ecommerce_' || eventType` com `mensagem_preview ILIKE '%pedido=' || numeroPedido || '%'` e `created_at > now() - 1 hora`
- Se encontrar: retorna 200 com `{ skipped: true, reason: "duplicate" }` e loga
- Se query falhar: loga warning e continua (fail-open)

**Codigo (~15 linhas) inserido entre linhas 546-548:**
```typescript
// ─── Deduplication check ───
if (numeroPedido) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: dupeCheck } = await supabase
      .from("message_logs")
      .select("id")
      .eq("tipo", `ecommerce_${eventType}`)
      .ilike("mensagem_preview", `%pedido=${numeroPedido}%`)
      .gte("created_at", oneHourAgo)
      .limit(1);
    if (dupeCheck && dupeCheck.length > 0) {
      console.log(`[ecommerce-webhook] Duplicate detected: pedido=${numeroPedido} event=${eventType}, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: "duplicate", pedido: numeroPedido }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.warn("[ecommerce-webhook] Dedupe check failed, proceeding:", e);
  }
}
```

### Fix 2: `smart-ops-wa-inbox-webhook/index.ts` — ANON_KEY → SERVICE_ROLE_KEY

Duas alteracoes simples:
- **Linha 196:** `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
- **Linha 231:** `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY`

### Migration

Indice para performance da query de dedupe:
```sql
CREATE INDEX IF NOT EXISTS idx_message_logs_dedupe 
ON message_logs (tipo, created_at DESC);
```

### Deploy (manual conforme memoria do projeto)
```bash
supabase functions deploy smart-ops-ecommerce-webhook smart-ops-wa-inbox-webhook \
  --project-ref okeogjgqijbfkudfjadz
```

