

# Correcao Final WaLeads - Endpoints Dinamicos e Log de Testes

## Problema atual

Os logs mostram repetidamente:
```text
Response: 404 {"message":"Cannot POST /api-public/messages/send","error":"Not Found","statusCode":404}
```

O endpoint `/api-public/messages/send` nao existe. Alem disso, `test_mode: true` pula o registro no `message_logs`, impedindo qualquer visibilidade no painel.

## Correcoes

### 1. `supabase/functions/smart-ops-send-waleads/index.ts`

**Endpoint**: trocar a linha do fetch de:
```text
fetch(`${WALEADS_BASE_URL}/api-public/messages/send`, {
```
para:
```text
fetch(`${WALEADS_BASE_URL}/public/message/${tipo}`, {
```

**Log de testes**: remover o `if (!test_mode)` que envolve o insert em `message_logs`. Sempre registrar, usando tipo diferenciado quando for teste:
```typescript
const logTipo = test_mode ? `waleads_${tipo}_test` : `waleads_${tipo}`;
await supabase.from("message_logs").insert({
  lead_id: lead_id || null,
  team_member_id: member.id,
  whatsapp_number: member.whatsapp_number,
  tipo: logTipo,
  mensagem_preview: ...,
  status: messageStatus,
  error_details: errorDetails,
});
```

**Sanitizacao do tipo**: validar que `tipo` e um dos valores aceitos antes de chamar a API:
```typescript
const VALID_TIPOS = ["text", "image", "audio", "video", "document"];
const tipoNormalized = VALID_TIPOS.includes(tipo.toLowerCase()) ? tipo.toLowerCase() : "text";
```

### 2. `supabase/functions/smart-ops-cs-processor/index.ts`

**Endpoint**: trocar de:
```text
fetch(`${WALEADS_BASE_URL}/api-public/messages/send`, {
```
para:
```text
fetch(`${WALEADS_BASE_URL}/public/message/${waleadsTipo}`, {
```

## Resumo

| Arquivo | Mudanca |
|---|---|
| `smart-ops-send-waleads/index.ts` | Endpoint `/public/message/${tipo}`, sanitizacao do tipo, sempre registra log com sufixo `_test` |
| `smart-ops-cs-processor/index.ts` | Endpoint `/public/message/${waleadsTipo}` |

Apos deploy, o botao "Testar WL" deve retornar status 200 e o log aparecera na aba de Logs com tipo `waleads_text_test`.

