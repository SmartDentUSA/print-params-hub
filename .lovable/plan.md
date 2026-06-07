## Plano: Limpar logs antigos para liberar espaço

Executar 2 limpezas via tool de dados (auto-commit por statement):

1. **`system_health_logs`** — `DELETE WHERE created_at < now() - interval '90 days'`
   - Mantém últimos 90 dias para troubleshooting
   - Libera ~150 MB

2. **`lead_enrichment_audit`** — `DELETE WHERE true`
   - Tabela já vazia em uso, só tem dead tuples (~535 MB)
   - Libera ~535 MB após autovacuum

### Total estimado liberado: ~685 MB

### Observação sobre VACUUM FULL

O `DELETE` apenas marca linhas como mortas — o autovacuum do Postgres recupera o espaço em segundo plano (alguns minutos). Para liberação **imediata** de disco, é necessário `VACUUM FULL`, que **não pode rodar dentro de migration** (Postgres exige fora de transação).

**Caminho recomendado**: após eu executar os DELETEs, você roda no SQL Editor do Supabase (1 clique):

```sql
VACUUM FULL public.lead_enrichment_audit;
VACUUM FULL public.system_health_logs;
```

Isso é seguro e libera o espaço na hora — destravando o banco do modo read-only.

### O que NÃO será tocado

- Qualquer tabela de negócio (`lia_attendances`, `deals`, `people`, `companies`, `message_logs`, `lead_activity_log`)
- Logs dos últimos 90 dias
