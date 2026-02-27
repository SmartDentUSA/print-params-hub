

## Diagnosis

The logs confirm **two critical problems** with the WaLeads → dra-lia-whatsapp integration:

### Problem 1: WaLeads is sending literal template strings instead of actual values
```
[dra-lia-wa] Received: phone= msg="{{message}}"
[dra-lia-wa] Created new lead: {{name}}
```
The variables `{{message}}`, `{{phone}}`, `{{name}}` are NOT being interpolated by WaLeads. This means the webhook body configuration in WaLeads is using the wrong variable syntax. WaLeads likely uses a different format (e.g., `{phone}`, `${phone}`, or specific variable names from their platform).

**Action needed from you**: In the WaLeads webhook body configuration screen, check what variables are actually available. Look for a "variables" dropdown or documentation. The correct variable names might be different (e.g., `{contact.phone}`, `{lastMessage}`, `{contact.name}`).

### Problem 2: WaLeads native AI is responding instead of the webhook
The conversation shows WaLeads' built-in AI answering with generic responses ("A Consultora Patricia já está acompanhando...") rather than Dra. L.I.A.'s RAG-powered responses. This means either:
- "Enviar retorno da ação na conversa" is disabled (so webhook response is ignored)
- The native AI is configured to respond AND the webhook fires, but the native AI wins
- The webhook action is set as a secondary action, not the primary response

### Problem 3: Edge function bugs when phone is empty
When phone arrives empty, two cascading errors occur:
- `wa_@whatsapp.lead` email collision (duplicate key)
- WaLeads reply fails with `INVALID_PHONE_NUMBER` and `chat must be longer than 11 characters`

---

## Plan

### Step 1: Fix edge function to handle empty/template-literal inputs gracefully
- Add validation: reject requests where phone or message still contain `{{` (unresolved templates)
- Fix duplicate email collision by using `upsert` or appending a timestamp to placeholder emails
- Return a clear error message indicating "WaLeads variables not resolved"

### Step 2: Add flexible field mapping in the webhook
- Accept additional field names that WaLeads might use: `from`, `sender`, `text`, `body`, `contact_phone`, `contact_name`, `lastMessage`
- Log all received body keys to help diagnose the correct WaLeads variable names

### Step 3: Configuration guidance
After deploying the fix, you'll need to:
1. Check WaLeads' available variables list in the webhook body editor
2. Update the JSON body to use the correct variable syntax
3. Disable the WaLeads native AI or set the webhook as the primary responder

### Technical Details

**Edge function changes** (`supabase/functions/dra-lia-whatsapp/index.ts`):

1. Add template-literal detection at the top of the handler:
```typescript
// Reject unresolved WaLeads templates
if (messageText.includes("{{") || phone.includes("{{")) {
  console.warn("[dra-lia-wa] Unresolved template variables detected", { phone, message: messageText });
  return new Response(JSON.stringify({ 
    error: "template_variables_not_resolved",
    hint: "WaLeads is sending literal {{variable}} strings. Check variable syntax in webhook config.",
    received_keys: Object.keys(body)
  }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

2. Log all incoming body keys for debugging:
```typescript
console.log("[dra-lia-wa] Body keys:", Object.keys(body).join(", "));
```

3. Expand field mapping to try more WaLeads-specific field names:
```typescript
const phone = body.phone || body.from || body.sender || body.contact_phone || body.chatId || body.chat || "";
const messageText = body.message || body.text || body.body || body.lastMessage || body.content || "";
const senderName = body.sender_name || body.name || body.contact_name || body.pushName || "";
```

4. Fix duplicate email by appending timestamp:
```typescript
const placeholderEmail = `wa_${phoneDigits}_${Date.now()}@whatsapp.lead`;
```

