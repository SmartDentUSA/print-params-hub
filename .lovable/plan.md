

# Plano: Sincronização em Tempo Real PipeRun → Kanban

## Diagnóstico

Identifiquei 3 problemas que impedem o tempo real:

1. **`lia_attendances` NÃO está publicada no Supabase Realtime** — a query `pg_publication_tables` retornou vazio. Mesmo que o webhook atualize o banco, o frontend nunca recebe notificação.
2. **O Kanban carrega dados uma única vez** (`useEffect(() => { fetchLeads(); }, [])`) e nunca se atualiza automaticamente.
3. **Não existe cron job para `smart-ops-sync-piperun`** — se o webhook falhar ou um deal for movido manualmente no PipeRun sem disparar webhook, a base fica desatualizada.

## Correções

### 1. Migration SQL — Publicar `lia_attendances` no Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.lia_attendances;
```

Isso permite que o Supabase envie eventos `INSERT`, `UPDATE`, `DELETE` em tempo real para o frontend.

### 2. Adicionar Realtime Subscription ao `SmartOpsKanban.tsx`

Após o `fetchLeads()` inicial, subscrever no canal `lia_attendances`:
- **INSERT**: adicionar lead ao state se o `lead_status` pertence a `ALL_KEYS`
- **UPDATE**: atualizar o lead no state (ou removê-lo se `lead_status` saiu de `ALL_KEYS`)
- **DELETE**: remover do state

Isso garante que qualquer mudança no banco (via webhook PipeRun, sync batch, ou outro componente) apareça instantaneamente no Kanban sem refresh manual.

### 3. Migration SQL — Cron job a cada 30 min

```sql
SELECT cron.schedule(
  'sync-piperun-cron',
  '*/30 * * * *',
  $$ SELECT net.http_post(...smart-ops-sync-piperun...) $$
);
```

Safety net: mesmo que webhooks falhem, o batch sync roda periodicamente.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/SmartOpsKanban.tsx` | Adicionar `supabase.channel()` com `postgres_changes` para `lia_attendances` |
| Nova migration SQL | `ALTER PUBLICATION supabase_realtime ADD TABLE lia_attendances` + cron job |

