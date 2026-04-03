

## Problem

When the user is inside the **support ticket flow** (multi-step diagnostic), every message is blindly captured as an answer to the current step. The bot doesn't check if the user is asking an unrelated question (e.g., "Quantos chamados eu tenho?", "Quantos formulários eu respondi?") or trying to exit the flow.

The `isSupportInfoQuery` guard and other guards are never evaluated because the `supportFlowStage` block returns early before reaching them.

## Solution

Add an **escape hatch** at the top of the `supportFlowStage` block that checks if the user's message matches known non-answer patterns before processing it as a diagnostic answer.

### Changes to `supabase/functions/dra-lia/index.ts`

Inside the `if (supportFlowStage)` block (line ~2778), before processing any stage, add:

```typescript
// Check if the user is asking something unrelated to the support flow
const isEscapingFlow = 
  isSupportInfoQuery(message) ||       // "quantos chamados eu tenho"
  isGreeting(message) ||                // "oi"
  isPromptInjection(message) ||         // security
  PRICE_INTENT_PATTERNS.some(p => p.test(message)) ||
  /\b(cancelar|sair|parar|cancel|exit|stop|voltar|back)\b/i.test(message) ||
  // Detect questions that are clearly not diagnostic answers
  /^(quantos?|quais?|como|onde|quando|por ?qu[eê])\b/i.test(message.trim());

if (isEscapingFlow) {
  // Clear support flow state so the message is processed normally
  const clearedEnt = { ...supportEnt };
  delete clearedEnt.support_flow_stage;
  delete clearedEnt.support_equipment;
  delete clearedEnt.support_answers;
  await supabase.from("agent_sessions").upsert({
    session_id, extracted_entities: clearedEnt, last_activity_at: new Date().toISOString(),
  }, { onConflict: "session_id" });
  // Fall through to normal processing below (don't return)
}
```

Then wrap the existing stage processing in `else { ... }` so it only runs when NOT escaping.

### Also update `lia-guards.ts`

Add a pattern to `SUPPORT_INFO_QUERY` to also catch "quantos formulários":

```typescript
const SUPPORT_INFO_QUERY = /\b(quantos?|quais?|ver|listar|consultar|hist[oó]rico|status|meus?|[uú]ltimo|n[uú]mero)\b.{0,25}\b(chamado|ticket|ocorr[eê]ncia|formul[aá]rio)/i;
```

### Summary of behavior change

- If the user asks a question (starts with "quantos", "como", "quando", etc.) while in the support flow, the flow is cancelled and the question is processed normally
- If the user says "cancelar"/"sair"/"voltar", the flow is also cancelled
- Security guards (prompt injection) are respected even mid-flow
- Existing diagnostic flow behavior is unchanged for actual answers

