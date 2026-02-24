

# Correcao WaLeads - Campo `chat` no payload

## Problema

A API WaLeads retorna 400 com estas mensagens:
```text
"Chat is required when not using customerId"
"chat must be a string"
"INVALID_PHONE_NUMBER"
```

O codigo atual envia `phone` no body, mas a API espera o campo **`chat`** para o numero do destinatario.

## Correcao

### `supabase/functions/smart-ops-send-waleads/index.ts`

Nas linhas 88-92, trocar `phone: cleanPhone` por `chat: cleanPhone` no objeto `apiBody`:

**Texto (atual):**
```typescript
apiBody = { phone: cleanPhone, message: finalMessage, isGroup: false };
```
**Texto (corrigido):**
```typescript
apiBody = { chat: cleanPhone, message: finalMessage, isGroup: false };
```

**Midia (atual):**
```typescript
apiBody = { phone: cleanPhone, url: media_url, isGroup: false };
```
**Midia (corrigido):**
```typescript
apiBody = { chat: cleanPhone, url: media_url, isGroup: false };
```

### `supabase/functions/smart-ops-cs-processor/index.ts`

Mesma correcao: trocar `phone` por `chat` no objeto enviado a API WaLeads.

## Resumo

| Arquivo | Mudanca |
|---|---|
| `smart-ops-send-waleads/index.ts` | `phone` -> `chat` no payload da API |
| `smart-ops-cs-processor/index.ts` | `phone` -> `chat` no payload da API |

Apenas 2 linhas mudam em cada arquivo. O campo `chat` recebe o numero no formato `5519992612348` (sem +).
