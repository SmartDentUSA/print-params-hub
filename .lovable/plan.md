
# Corrigir formato do numero de telefone no WaLeads

## Problema

O codigo atual remove o `+` do telefone (linha 84 do `send-waleads`):
```
const cleanPhone = phone.replace(/\+/g, "");
```

A API WaLeads retorna status 201 (MESSAGE_SENT) mas a mensagem nao chega ao destinatario. Isso pode ser falha silenciosa por formato incorreto do numero.

## Solucao

Testar enviando o numero **com** o prefixo `+` no campo `chat`, ja que e assim que o WhatsApp identifica numeros internacionalmente.

### Arquivo: `supabase/functions/smart-ops-send-waleads/index.ts`

- **Remover** a linha que faz `phone.replace(/\+/g, "")` 
- Enviar o telefone **como recebido** (com `+55...`) no campo `chat`
- Ou seja, mudar de `cleanPhone` para usar o `phone` original diretamente

Antes:
```typescript
const cleanPhone = phone.replace(/\+/g, "");
// ...
apiBody = { chat: cleanPhone, message: finalMessage, isGroup: false };
```

Depois:
```typescript
// Enviar com formato original (+55...)
apiBody = { chat: phone, message: finalMessage, isGroup: false };
```

### Arquivo: `supabase/functions/smart-ops-cs-processor/index.ts`

- Mesma correcao: remover o `.replace(/\+/g, "")` do telefone ao montar o payload WaLeads
- Usar `lead.telefone_normalized` diretamente (que ja vem com `+55`)

### Resumo

| Arquivo | Mudanca |
|---|---|
| `smart-ops-send-waleads/index.ts` | Parar de remover o `+` do telefone |
| `smart-ops-cs-processor/index.ts` | Mesma correcao no telefone |

Apos o deploy, sera feito um novo teste de envio para confirmar a entrega.
