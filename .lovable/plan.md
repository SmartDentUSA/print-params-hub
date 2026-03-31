

# Cron Jobs para Sync Omie — 09:00 e 17:30

## O que será feito

Criar 2 cron jobs via `pg_cron` para chamar a edge function `omie-lead-enricher` diariamente:

- **09:00 BRT** (12:00 UTC) — sync matinal
- **17:30 BRT** (20:30 UTC) — sync fim de expediente

## Implementação

Uma única execução SQL (via SQL Editor, não migration) com dois `cron.schedule()`:

```sql
-- 09:00 BRT = 12:00 UTC
SELECT cron.schedule('omie-sync-morning', '0 12 * * *', $$...$$);

-- 17:30 BRT = 20:30 UTC  
SELECT cron.schedule('omie-sync-evening', '30 20 * * *', $$...$$);
```

Cada job chama `net.http_post` para `omie-lead-enricher` com o anon key, seguindo o mesmo padrão dos cron jobs existentes (ex: `sync-loja-integrada-clients`).

## Arquivos

Nenhum arquivo alterado — apenas SQL executado no banco.

