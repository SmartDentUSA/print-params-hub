

# Fix: Email detection fails when user types space before @

## Problems Identified

### Bug 1: Email with spaces not detected (causes infinite email loop)
The user typed `Jesus @jesus.com.br` (with a space before `@`). The email regex `[\w.+-]+@[\w-]+\.[\w.-]+` requires characters directly before the `@` with no spaces, so it never matches. The state stays stuck on `needs_email` forever.

### Bug 2: Name asked twice (likely related)
The name request appears twice in the transcript. This is likely because the client sends the history array and there may be a race condition or the first response wasn't stored before the second request. This is harder to fix without client changes, but we can mitigate it by making the detection more robust.

## Changes

### File: `supabase/functions/dra-lia/index.ts`

**1. Normalize email input before regex matching (lines ~794-822)**

Before applying `EMAIL_REGEX`, strip spaces from the user message to handle cases like `Jesus @jesus.com.br` or `danilo @ gmail.com`:

```typescript
// Before matching email, normalize: remove spaces around @
const normalizedContent = msg.content.replace(/\s*@\s*/g, '@');
const emailMatch = normalizedContent.match(EMAIL_REGEX);
```

Apply this normalization in all 3 places where `EMAIL_REGEX` is used within `detectLeadCollectionState`:
- Line ~804 (general email detection in loop)
- Line ~820 (email after assistant asked for it)
- Line ~856 (email from last user message)

**2. Deploy edge function `dra-lia`**

## Expected Result

- User types `Jesus @jesus.com.br` -> normalized to `Jesus@jesus.com.br` -> regex matches -> state transitions to `collected`
- No more infinite email request loop
- Flow proceeds to commercial conversation after name + email collected

