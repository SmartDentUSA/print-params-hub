## Bug

Envio de teste falha com 500. Log: `Cannot read properties of null (reading 'id')` na criação da campanha "teste". A tabela `campaigns` está rejeitando o insert com `status='completed'` + `completed_at`, e o código lê `c!.id` sem checar erro.

## Fix

**`supabase/functions/smart-ops-send-gmail/index.ts` — modo `test_email`**

Simplificar: teste NÃO cria linha em `campaigns` nem em `campaign_send_log`. Envia direto para o Gmail com:
- placeholder replacement (`{{nome}}` = "Teste", `{{vendedor_nome}}` = `from_name`, `{{link_wa_vendedor}}` = fallback oficial)
- sem short_links (link direto)
- sem pixel de tracking (é teste, não conta métricas)
- monta o RFC 2822 + `messages/send` do Gmail
- retorna `{ ok, sent, failed, errors }`

Mantém a assinatura pública igual. Nenhuma outra rota é afetada (enqueue, send_one e whoami continuam iguais).

Depois deploy da função.
