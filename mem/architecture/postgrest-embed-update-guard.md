---
name: PostgREST embed-update guard
description: lia-assign sanitizes updateFields to drop non-scalar values (objects/arrays) before .update() to prevent 42703 column "value" does not exist
type: constraint
---
**Rule**: Any code path that builds an `updateFields` dict for `supabase.from("lia_attendances").update(...)` MUST pass only primitives (string|number|boolean|null) for non-JSONB columns.

**Why**: PostgREST treats nested objects as embedded resource updates and tries to UPDATE the value's keys as columns of an embedded table. Piperun custom_fields shaped `{value: "..."}` leaking into updateFields produced `column "value" does not exist` (42703) and aborted the entire UPDATE for 3 leads on 2026-05-11 (ESTÉTICA AVANÇADA, Viviane Soares Fonseca, Dr.Valente).

**How to apply**: In `smart-ops-lia-assign/index.ts` the sanitizer logs dropped keys to `system_health_logs.error_type='non_scalar_update_fields_dropped'`. When extending updateFields elsewhere, verify the value type is primitive or explicitly stringify with JSON.stringify for jsonb columns.
