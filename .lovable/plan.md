

# Plan: Bulk Import Astron CSV → Update All Leads

## What exists
- **4,920 users** in CSV with: Email, Nome, Telefone, CPF, Data Cadastro, Último Login, Percentual Conclusão
- **27,440 leads** in DB, only **64** have `astron_status = 'active'`, only **5** have `astron_created_at`
- UI already handles `astron_status === 'active'` condition (line 1005) and shows percentual from JSONB

## What to build

### Step 1: Create Edge Function `import-astron-csv`
New file: `supabase/functions/import-astron-csv/index.ts`

Logic:
- Receives `{ users: [{email, nome, telefone, cpf, data_cadastro, ultimo_login, percentual}...] }`
- Extracts all emails, bulk-loads matching leads from `lia_attendances` using `.in()` with chunks of 500
- For each match: updates `astron_status`, `astron_nome`, `astron_phone`, `astron_created_at`, `astron_last_login_at`, `astron_login_url`, `astron_synced_at`
- Merges CSV data into `astron_courses_access` JSONB (preserving existing course data, adding `{source: "astronmembers", percentual_conclusao: X, cpf, ...}`)
- Returns `{matched, updated, not_found}`

### Step 2: Register in config.toml
Add `[functions.import-astron-csv]` with `verify_jwt = false`

### Step 3: Deploy and Execute
- Deploy the function
- Parse the CSV (4,920 rows) and call the function in batches of ~200 users
- Verify results with DB query

### Step 4: Verify
- Query DB to confirm updated counts for `astron_status`, `astron_created_at`, `astron_last_login_at`
- Spot-check `mairabragantini@hotmail.com`

**Files created/edited:**
- `supabase/functions/import-astron-csv/index.ts` (new)
- `supabase/config.toml` (add entry)

**Nothing removed. No UI changes needed** — the Academy section already renders for `astron_status === 'active'`.

