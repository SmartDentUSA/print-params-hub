## Diagnóstico

A coluna **Bounces** está em `0 (0%)` porque:

- `campaign_send_log`: **0** linhas com `status='bounced'` ou `bounced_at` preenchido (188 logs no total).
- `lia_attendances`: **0** leads com `email_bounced=true`.
- `cron.job`: **nenhum** job agendado para `smart-ops-gmail-bounce-scan`.
- Edge Function logs de `smart-ops-gmail-bounce-scan`: **vazio** — a função nunca foi executada em produção.

Ou seja, o pipeline de UI/RPC/coluna está correto (o `fn_campaign_email_stats` conta corretamente `status='bounced' OR bounced_at IS NOT NULL`). O que falta é o **scanner rodar** para marcar os bounces que estão na inbox do Gmail.

## O que fazer

1. **Rodar 1x manualmente** `smart-ops-gmail-bounce-scan?days=14&max=200` para varrer os últimos 14 dias e marcar retroativamente todos os "mailer-daemon"/"address not found" que já chegaram. Isso vai popular `campaign_send_log.bounced_at`/`status='bounced'` e `lia_attendances.email_bounced=true` para os leads afetados, então a métrica da campanha atual passa a exibir os bounces reais.

2. **Agendar `pg_cron`** para `smart-ops-gmail-bounce-scan` a cada 15 minutos (`*/15 * * * *`) via `net.http_post` com o service role, para que novos bounces sejam capturados automaticamente conforme chegam à inbox — sem esse cron, a métrica ficaria zerada de novo na próxima campanha.

3. **Validar** consultando `campaign_send_log` (contagem por `status='bounced'`) e reabrindo o histórico da campanha para confirmar que a coluna **Bounces** e o badge vermelho **✉︎ inválido** aparecem.

## Fora do escopo

Sem mudanças na UI, na RPC `fn_campaign_email_stats` ou na lógica de envio — tudo isso já está correto; o problema é puramente operacional (scanner desativado).