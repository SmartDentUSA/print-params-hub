

# Fix: Name detection regex fails due to markdown bold formatting

## Root Cause

When the user sends their name after clicking a button, the system checks if the previous assistant message asked for the name using this regex:

```text
/qual (o seu |seu )?nome|what's your name|cuál es tu nombre/i
```

But the contextAck response (added in the last fix) wraps the text in markdown bold:

```text
"Antes de começarmos, **qual o seu nome?**"
```

The `**` before "qual" breaks the regex match, so the system thinks it never asked for the name and asks again.

## Fix

### File: `supabase/functions/dra-lia/index.ts`

**Option A (simpler, recommended): Remove markdown from contextAck responses**

Change lines ~1475-1479 from:
```text
"pt-BR": `Que ótimo que você entrou em contato! ... **qual o seu nome?**`
```
to:
```text
"pt-BR": `Que ótimo que você entrou em contato! ... qual o seu nome?`
```

Same for "en" and "es" variants. This keeps consistency with the GREETING_RESPONSES which also don't use markdown bold.

**Option B (alternative): Make regex tolerate markdown**

Update the regex to optionally match `**` around the text. This is more fragile long-term.

## Changes

1. Remove `**` from all three contextAck strings (pt-BR, en, es) in the needs_name response block (~lines 1473-1479)
2. Deploy edge function `dra-lia`

## Expected Result

- User clicks button -> LIA asks name (without bold)
- User sends name -> `detectLeadCollectionState` correctly matches the "qual o seu nome" text in history
- State returns `needs_email` -> LIA asks for email
- No more duplicate name requests

