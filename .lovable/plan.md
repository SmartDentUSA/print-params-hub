

## Fix: Astron validation probe returning 400 instead of 200

### Problem
The logs show Astron sends a POST with only `{"key": "..."}` as a validation probe. The current code reaches the email check and returns 400 because there's no email. Astron requires 200 to mark the URL as valid.

### Solution
In `supabase/functions/astron-postback/index.ts`, add a check **before** the email validation: if the payload has no `event` field and no email, treat it as a validation probe and return 200.

```typescript
// After token validation (line 70), before event extraction (line 73):

// Validation probe: Astron sends {"key":"..."} to test the URL
if (!body.event && !body.event_type && !body.email && !body.user_email) {
  console.log("[astron-postback] Validation probe received, returning 200");
  return new Response(
    JSON.stringify({ status: "ok", service: "astron-postback" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

This single addition (4 lines) ensures:
- Validation probes with no event/email get 200
- Real event payloads (with `event` + `email`) continue through normal processing
- No other logic is affected

