

# Correção da Integração WaLeads - Formato de Payload e Endpoint

## Problemas Identificados

1. **Endpoint incorreto**: O código usa `/public/message/{tipo}` mas a documentação indica `/api-public/messages/send`
2. **Telefone com "+"**: A API espera `5547999999999` (apenas dígitos), mas o código envia `+5547999999999`
3. **Campo `isGroup` ausente**: A API exige `isGroup: false` no payload
4. **Logs insuficientes**: Não estamos logando o corpo da resposta de erro da API

## Mudanças

### 1. `supabase/functions/smart-ops-send-waleads/index.ts`

- Alterar endpoint de `${WALEADS_BASE_URL}/public/message/${tipo}` para `${WALEADS_BASE_URL}/api-public/messages/send`
- Remover o `+` do telefone antes de enviar: `phone.replace(/\+/g, "")`
- Adicionar `isGroup: false` ao payload
- Adicionar `console.log` do body enviado e da resposta completa para depuração
- Formato do payload corrigido:

```text
{
  "phone": "5519992612348",
  "message": "Olá, sou o consultor...",
  "isGroup": false
}
```

### 2. `supabase/functions/smart-ops-cs-processor/index.ts`

- Mesmas correções de endpoint, formato de telefone e campo `isGroup`

## Detalhes Tecnicos

### Endpoint corrigido
```text
POST https://waleads.roote.com.br/api-public/messages/send
```

### Normalizacao do telefone
```typescript
const cleanPhone = phone.replace(/\+/g, "");
// "+5519992612348" -> "5519992612348"
```

### Payload para mensagem de texto
```typescript
apiBody = { phone: cleanPhone, message: finalMessage, isGroup: false };
```

### Payload para midia (imagem, video, etc)
```typescript
apiBody = { phone: cleanPhone, url: media_url, isGroup: false };
if (finalCaption) apiBody.caption = finalCaption;
```

### Logs de depuracao adicionados
```typescript
console.log("[send-waleads] Request body:", JSON.stringify(apiBody));
console.log("[send-waleads] Response:", waRes.status, waData.slice(0, 500));
```

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| `supabase/functions/smart-ops-send-waleads/index.ts` | Corrigir endpoint, payload e logs |
| `supabase/functions/smart-ops-cs-processor/index.ts` | Mesmas correcoes de endpoint e payload |
