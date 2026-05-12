---
name: Brazilian Phone Normalization
description: Canonical helper for Brazilian phones; auto-inserts the mandatory 9th digit on legacy 8-digit mobile numbers
type: feature
---

All phone ingestion (PipeRun webhook, lead form, CSV imports, Sellflux, Astron, Loja Integrada, etc.) MUST use `normalizeBrazilianPhone` from `supabase/functions/_shared/phone-normalize.ts`.

**Rule (ANATEL):** Brazilian mobiles must be `+55 DDD 9XXXX-XXXX` (13 digits total). When upstream delivers the legacy 8-digit form (`+55 38 9847-5101`), the helper inserts the mandatory `9` → `+5538998475101`.

**Behavior:**
- Strip non-digits, drop leading `0`, prepend `55` when missing.
- DDD must be 11–99.
- Subscriber 9 digits starting with `9` → mobile, valid.
- Subscriber 8 digits starting with `6/7/8/9` → legacy mobile, prepend `9`.
- Subscriber 8 digits starting with `2/3/4/5` → landline, valid.
- Anything else → `null`.

**Why:** PipeRun's `person.contact_phones` and several legacy lead sources still carry 12-digit numbers without the 9. Storing them raw broke WhatsApp links, deal notes (`📱 Tel: …`) and Person dedup in PipeRun.

**Backfill applied:** `UPDATE lia_attendances` migration 20260512 patched all canonical leads with 12-digit mobile-shaped numbers.