

## Plano: Unificar envio da LIA com o mesmo fluxo do Card

### Problema
A `dra-lia-whatsapp` tem seu próprio código para chamar a WaLeads API diretamente (linhas 354-366 e 383-395), duplicando a lógica que já existe em `smart-ops-send-waleads`. Apesar de ambos retornarem 201 da API, o card (que usa `send-waleads`) entrega e a LIA (que chama direto) não entrega.

### Diagnóstico
Comparei as duas chamadas WaLeads lado a lado:
- **Card**: `POST /public/message/text?key=<key>` → `{ chat: "5519992612348", message: "...", isGroup: false }` → 201 ✓ → **chega**
- **LIA**: `POST /public/message/text?key=<key>` → `{ chat: "5519992612348", message: "...", isGroup: false }` → 201 ✓ → **não chega**

Mesma API key (Patricia), mesmo channelId, mesmo formato de telefone. A API retorna sucesso em ambos.

### Solução
Eliminar o código duplicado: fazer `dra-lia-whatsapp` chamar `smart-ops-send-waleads` internamente (via fetch inter-function) em vez de chamar a WaLeads API diretamente. Isso garante que **exatamente o mesmo código** é executado em ambos os fluxos.

### Mudanças

1. **`supabase/functions/dra-lia-whatsapp/index.ts`**:
   - Remover as duas chamadas diretas à WaLeads API (linhas 352-367 e 381-395)
   - Substituir por uma única chamada a `smart-ops-send-waleads` via fetch interna
   - Passar `team_member_id`, `phone`, `message` e `lead_id`
   - Isso usa exatamente o mesmo fluxo que o card do WhatsApp Inbox

2. **Teste**: Chamar `dra-lia-whatsapp` novamente com uma mensagem de teste e verificar os logs de `smart-ops-send-waleads` para confirmar que o fluxo unificado funciona

