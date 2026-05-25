## Diagnóstico

O código do `manychat-lia-bridge` está chamando o endpoint correto (`/fb/sending/sendContent`) e usando `Authorization: Bearer`, mas o payload está no formato de Messenger/Facebook e não declara o canal Instagram.

Para Instagram, a documentação/respostas de suporte do ManyChat indicam que o bloco `data.content` precisa incluir:

```json
{
  "type": "instagram",
  "messages": [...],
  "actions": [],
  "quick_replies": []
}
```

Hoje o código envia apenas:

```json
{
  "messages": [...]
}
```

Isso explica o comportamento de fallback/erro no canal Instagram, mesmo com token atualizado.

## Plano de implementação

1. Ajustar `supabase/functions/manychat-lia-bridge/index.ts`:
   - Incluir `type: "instagram"` dentro de `payload.data.content` no `sendToManychat`.
   - Manter `messages`, `actions` e `quick_replies` no mesmo bloco para compatibilidade com dynamic response v2.
   - Manter o padrão assíncrono atual: resposta imediata vazia ao ManyChat + envio real pela Send API.

2. Melhorar o log de falha do envio sem expor segredo:
   - Registrar endpoint/canal e tamanho do chunk.
   - Não registrar token completo.

3. Deploy e validação:
   - Fazer deploy da Edge Function `manychat-lia-bridge`.
   - Testar novamente com o `subscriber_id` real `888640279`.
   - Confirmar em `system_health_logs` se aparece `manychat_send_ok` ou, se houver erro, capturar a nova resposta do ManyChat.

## Resultado esperado

A resposta da Dra. LIA deixa de cair no fallback do ManyChat e passa a ser entregue como DM Instagram pelo próprio ManyChat após o processamento assíncrono.