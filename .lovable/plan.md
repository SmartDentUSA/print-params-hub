## Plano: Liberar espaço sem perder dados

Executar limpeza conservadora — **zero perda de dados de negócio**.

### Ações

1. **`lead_enrichment_audit` — VACUUM FULL**
   - 0 linhas ativas, 535 MB de "dead tuples"
   - Libera ~535 MB
   - Risco: **nenhum** (tabela já vazia)

2. **`system_health_logs` — DELETE > 90 dias + VACUUM FULL**
   - Logs operacionais (health checks, instrumentação)
   - Libera ~150 MB
   - Risco: **nenhum para negócio** (mantém últimos 90 dias para troubleshooting)

3. **`meta_lead_ingestion_log` — DELETE > 90 dias + VACUUM FULL**
   - Log de debug de ingestão Meta (leads já estão em `lia_attendances`)
   - Libera ~20 MB
   - Risco: **nenhum** (dado já consolidado no CDP)

### Total estimado liberado: ~700 MB

Suficiente para tirar o banco do modo read-only e restaurar o login + recebimento PipeRun.

### O que NÃO vou tocar

- `lia_attendances`, `deals`, `people`, `companies` (CDP/CRM)
- `message_logs`, `lead_activity_log` (histórico de comunicação)
- `lead_state_events`, `piperun_stage_transitions` (analytics de funil)
- `piperun_webhook_events` (audit trail recente)

### Execução (build mode)

Vou criar **1 migration** com:
```sql
VACUUM FULL public.lead_enrichment_audit;
DELETE FROM public.system_health_logs WHERE created_at < now() - interval '90 days';
VACUUM FULL public.system_health_logs;
DELETE FROM public.meta_lead_ingestion_log WHERE created_at < now() - interval '90 days';
VACUUM FULL public.meta_lead_ingestion_log;
```

Nota: `VACUUM FULL` trava a tabela durante execução (segundos a poucos minutos por tabela). Sem janela de manutenção formal, mas tabelas escolhidas têm baixo impacto em runtime.

### Depois da limpeza

- Verificar que o banco saiu do modo read-only (testar login)
- Confirmar que webhooks PipeRun voltaram a gravar em `piperun_webhook_events`
- Se ainda não houver espaço suficiente, avaliar passo 2 (políticas de retenção permanentes via cron).
