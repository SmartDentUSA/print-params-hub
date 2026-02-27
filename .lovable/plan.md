

## Problem

ChatCenter sends webhook payloads as "contact/conversation card updates" — NOT "new message" events. The payload contains `chat`, `customer`, `combinedCardCustomer` but the `lastMessage` field is **empty**, so `extractFields` finds no message text and returns `400 "message is required"`.

From the logs, the ChatCenter payload structure is:
```text
{
  chat: "5519992612348@c.us",
  customer: { phone, name, ... },
  combinedCardCustomer: { lastMessage: "", ... },
  channelId, timestamp, to
}
```

## Solution: Two changes in `dra-lia-whatsapp/index.ts`

### 1. Expand `extractFields` to dig deeper into ChatCenter payload

Add extraction from:
- `body.combinedCardCustomer?.lastMessage`
- `body.customer?.name` for sender name
- Strip `@c.us` / `@s.whatsapp.net` suffixes from phone fields like `chat`

### 2. Gracefully ignore "empty message" webhooks

ChatCenter fires webhooks for multiple event types (contact created, conversation assigned, message received). When there's no message content, this is likely a non-message event — return `200 { ignored: true, reason: "no_message_content" }` instead of `400`.

This prevents error noise while still processing real messages when ChatCenter does include them.

### Implementation steps

1. **Update `extractFields`** in `dra-lia-whatsapp/index.ts`:
   - Add `body.combinedCardCustomer` as a nested source
   - Check `nested.lastMessage` path
   - Strip `@c.us` / `@s.whatsapp.net` from extracted phone values

2. **Change empty-message handling** from `400 error` to `200 ignored`:
   - When message is empty but phone is valid, return `{ ignored: true, reason: "no_message_content" }` so ChatCenter doesn't retry

3. **Deploy** the updated edge function

