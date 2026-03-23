

# Fix: Greeting Loop Still Happening — Lead ID Mismatch Between `leads` and `lia_attendances`

## Problem
The previous migration correctly changed the FK on `agent_sessions.lead_id` to reference `lia_attendances`, but the **lookup logic** in `dra-lia/index.ts` (lines 1757-1764) still checks the `leads` table FIRST. When Danilo is found in `leads` with ID `77b33ad0...`, that ID is used for the session upsert — but it doesn't exist in `lia_attendances`, causing FK violation. The session never persists, and the greeting repeats.

```text
Current flow (still broken):
  1. User sends email → detectLeadCollectionState returns "needs_name"
  2. Lookup: leads table → finds Danilo with ID 77b33ad0 (legacy)
  3. Session upsert with lead_id=77b33ad0 → FK FAILS (not in lia_attendances)
  4. Next message → session lookup → NULL → greeting again
```

## Root Cause
Lines 1757-1764: `lia_attendances` is the canonical table, but `leads` is checked first. The `leads.id` ≠ `lia_attendances.id` for the same email.

## Fix (1 file change)

### `supabase/functions/dra-lia/index.ts` — Reverse lookup priority

Change the lead lookup order to check `lia_attendances` FIRST (the canonical table), and only fall back to `leads` if not found. When found in `leads`, cross-reference with `lia_attendances` to get the correct ID.

**Lines 1756-1776** — Replace with:

```typescript
let existingLead: { id: string; name: string } | null = null;

// Check lia_attendances FIRST (canonical table, FK target)
const { data: liaLead } = await supabase
  .from("lia_attendances")
  .select("id, nome")
  .eq("email", leadState.email)
  .maybeSingle();
if (liaLead && liaLead.nome) {
  existingLead = { id: liaLead.id, name: liaLead.nome };
}

// Fallback: check legacy leads table (use name only, ID from lia_attendances)
if (!existingLead) {
  const { data: legacyLead } = await supabase
    .from("leads")
    .select("id, name")
    .eq("email", leadState.email)
    .maybeSingle();
  if (legacyLead && legacyLead.name) {
    // Try to find/create matching lia_attendances record
    existingLead = { id: legacyLead.id, name: legacyLead.name };
  }
}
```

This ensures that when the session upsert runs at line 2031 with `lead_id: leadId`, the ID always comes from `lia_attendances` (the FK target), not the legacy `leads` table.

## Impact
- Fixes the greeting loop for ALL leads that exist in both `leads` and `lia_attendances` with different IDs
- No migration needed — code-only fix
- Backwards compatible: leads only in `leads` table still work via fallback

