

## Plano: Adicionar secrets Astron e implementar integracao

### Passo 1 — Adicionar secrets
- `ASTRON_AM_KEY` = `19177`
- `ASTRON_AM_SECRET` = `qrPsJjLGeAsFgESYOfAsKBBxohyCTsPA`

### Passo 2 — Migration SQL
Adicionar 14 colunas `astron_*` em `lia_attendances`:
- `astron_user_id` integer
- `astron_status` text
- `astron_nome` text
- `astron_email` text
- `astron_phone` text
- `astron_plans_active` text[]
- `astron_plans_data` jsonb
- `astron_courses_access` jsonb
- `astron_courses_total` integer DEFAULT 0
- `astron_courses_completed` integer DEFAULT 0
- `astron_login_url` text
- `astron_created_at` timestamptz
- `astron_last_login_at` timestamptz
- `astron_synced_at` timestamptz

Indice em `astron_user_id`.

### Passo 3 — Edge function `sync-astron-members`
- Basic Auth com `am_key:am_secret`
- `listClubUsers` paginado → para cada aluno busca `listClubUserPlans`
- Match por email em `lia_attendances` → UPDATE ou INSERT novo lead
- Registrar em `config.toml` com `verify_jwt = false`

### Passo 4 — Edge function `astron-member-lookup`
- Consulta real-time por email/lead_id
- Retorna dados cacheados se `astron_synced_at` < 24h, senao consulta API
- Registrar em `config.toml`

### Passo 5 — Atualizar `import-leads-csv`
- Adicionar campos `astron_*` ao `allowedColumns`

### Passo 6 — Atualizar `dra-lia`
- Injetar contexto Astron no system prompt quando lead identificado

