

# Plan: Update mairabragantini@hotmail.com with Astron CSV Data + Fix Academy Display

## Current State
- Lead `c93a74d2-2357-430b-8d11-f31034d8955e` has all Astron fields empty/null
- `astron_status = 'not_found'`, `astron_courses_total = 0`, `astron_user_id = NULL`
- Academy section shows "Nenhum curso na Academy" because `astron_courses_total = 0`

## CSV Data Available (exact mapping)

| CSV Field | Value | DB Column | Notes |
|-----------|-------|-----------|-------|
| Nome Completo | Maira Bragantini Duarte Dutra | `astron_nome` | |
| Email | mairabragantini@hotmail.com | `astron_email` | |
| Telefone | +553291391111 | `astron_phone` | |
| Data de Cadastro | 12/08/2024 09:24 | `astron_created_at` | → `2024-08-12T09:24:00-03:00` |
| Data de Último Login | 21/07/2025 21:12 | `astron_last_login_at` | → `2025-07-21T21:12:00-03:00` |
| Percentual de Conclusão | 15% | No exact column exists | See below |

## Problem: "Percentual de Conclusão" has no direct column

The DB has `astron_courses_total` (int) and `astron_courses_completed` (int) but the CSV gives a single percentage (15%). We do NOT know the exact course count. Per "NÃO INVENTE NADA", we will NOT fabricate course counts.

**Solution**: Store the completion percentage in `astron_courses_access` (JSONB) as `{"percentual_conclusao": 15}` and set `astron_status = 'active'`. The UI Academy section condition is `astronCourses.length > 0 || ld.astron_courses_total > 0` — so we need a small UI tweak to also check for `astron_status === 'active'` or presence of `astron_created_at`, so the section renders even without exact course counts.

## Changes

### 1. Data Update (via Supabase query tool)
Update `lia_attendances` for this lead with all mapped CSV fields:
- `astron_status` → `'active'`
- `astron_nome` → `'Maira Bragantini Duarte Dutra'`
- `astron_email` → `'mairabragantini@hotmail.com'`
- `astron_phone` → `'+553291391111'`
- `astron_created_at` → `'2024-08-12T09:24:00-03:00'`
- `astron_last_login_at` → `'2025-07-21T21:12:00-03:00'`
- `astron_login_url` → `'https://smartdentacademy.astronmembers.com/'`
- `astron_courses_access` → `[{"source": "csv_import", "percentual_conclusao": 15}]`
- `astron_synced_at` → now()

### 2. UI Fix (LeadDetailPanel.tsx — ADDITIVE only)

Change the Academy section render condition (line 1005) from:
```
(astronCourses.length > 0 || ld.astron_courses_total > 0)
```
to:
```
(astronCourses.length > 0 || ld.astron_courses_total > 0 || ld.astron_status === 'active')
```

Add a "Percentual de Conclusão" display when we have it but don't have individual course data. Show:
- Registration date, last login, status (already implemented)
- Overall completion percentage from the JSONB data
- Login URL link

### 3. Verify after update
Query the DB to confirm all fields are populated and the UI renders correctly.

**Files changed**: 1 (`src/components/smartops/LeadDetailPanel.tsx`)
**Backend changes**: None
**Nothing removed**: All existing sections preserved

