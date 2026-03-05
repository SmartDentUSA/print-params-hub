

## Configurar cron job de 5 minutos para polling da Loja Integrada

### Acao unica

Executar SQL via insert tool (nao migration) para agendar o `poll-loja-integrada-orders` a cada 5 minutos usando `pg_cron` + `pg_net`.

O SQL usara:
- URL: `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/poll-loja-integrada-orders`
- Auth: `Authorization: Bearer` com a anon key do projeto (disponivel no contexto)
- Body: `{"batch_size": 50}`
- Schedule: `*/5 * * * *`

Sera uma unica execucao de SQL no banco, sem alteracoes em arquivos.

