## Diagnóstico

O fluxo foi agendado corretamente: a campanha `Nova campanha` está `active` e tem 2 itens em `wa_message_queue` com `scheduled_at = 2026-05-29 15:04:00+00` (12:04 BRT), ainda `pending`.

A causa provável do não disparo é que o cron ativo chama uma função que não existe no código:

```text
cron job: wa-group-dispatcher
chama: /functions/v1/wa-group-dispatcher
função existente: wa-dispatcher
logs de wa-dispatcher: nenhum
```

Ou seja: a fila está pronta, mas o worker real (`wa-dispatcher`) não está sendo invocado automaticamente.

## Plano de correção

1. Corrigir o agendamento do cron no Supabase
   - Substituir/remover o cron `wa-group-dispatcher` que chama `/functions/v1/wa-group-dispatcher`.
   - Criar ou ajustar um cron para chamar `/functions/v1/wa-dispatcher` a cada minuto.
   - Usar `pg_net` com headers adequados para chamar a Edge Function.

2. Validar a função `wa-dispatcher`
   - Invocar `wa-dispatcher` manualmente uma vez.
   - Verificar se ela consome os itens `pending` vencidos da campanha.
   - Conferir se a fila muda para `sent` ou, caso a Evolution rejeite o envio, para `pending/failed` com erro real em `error_message`.

3. Melhorar observabilidade mínima
   - Se necessário, ajustar a resposta/log da `wa-dispatcher` para retornar quantos itens estavam elegíveis e quantos foram processados, sem alterar a lógica comercial.

4. Confirmar no banco
   - Checar `wa_message_queue`, `wa_send_log` e `wa_campaigns` após o disparo.
   - Confirmar se `next_send_at/current_node_index/status` refletem o estado real da campanha.

## Arquivos previstos

Nenhuma alteração de UI é necessária. Pode ser necessário editar somente:

- `supabase/functions/wa-dispatcher/index.ts` — apenas se a validação mostrar falta de logs/resposta clara.

A principal correção será no cron do banco, não no frontend.