

## Diagnosis

The `whatsapp_inbox` table has two phone columns:
- `phone`: full number `5511999887766` (correct for WaLeads API)
- `phone_normalized`: short form `999887766` (used for grouping conversations)

The `SmartOpsWhatsAppInbox` component groups by `phone_normalized` and sends that value to `smart-ops-send-waleads`. WaLeads rejects it because it needs 11+ characters.

## Fix

### File: `src/components/SmartOpsWhatsAppInbox.tsx`

1. **Add `phone_raw` to the `Conversation` interface** — store the original full phone number alongside `phone_normalized`
2. **In `loadConversations`**, capture the first `phone` value (the full number) for each conversation group
3. **In `handleSend`**, use the full `phone` (e.g. `5511999887766`) instead of `phone_normalized` when calling the edge function

Specifically:
- Add `phone_raw: string` to `Conversation` interface
- In the grouping loop, set `phone_raw: msg.phone` when creating a new conversation entry
- In `handleSend`, look up `conv.phone_raw` and pass that as the `phone` parameter to `smart-ops-send-waleads`

This is a ~3-line change. No database or edge function changes needed.

