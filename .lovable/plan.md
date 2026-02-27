

## Plano: Adicionar secrets Astron Members

### Passo 1 — Adicionar secrets
Solicitar ao usuario as duas credenciais via ferramenta de secrets:
- `ASTRON_AM_KEY` — chave de API da Astron Members
- `ASTRON_AM_SECRET` — senha/secret da API

Estas credenciais sao obtidas em: **central.astronmembers.com.br** → API Keys

### Passo 2 — Criar edge function `sync-astron-members`
- Autenticacao via Basic HTTP Auth (`am_key:am_secret`)
- Base URL: `https://api.astronmembers.com.br/`
- Endpoints: `listClubUsers`, `listClubUserPlans`, `listClubCourses`, `checkClubUserCourseAccess`
- Upsert em `lia_attendances` por email (match) ou INSERT (novo lead)

### Passo 3 — Migration SQL
Adicionar 14 colunas `astron_*` em `lia_attendances`

### Passo 4 — Edge function `astron-member-lookup` (real-time)

### Passo 5 — Atualizar `dra-lia/index.ts` com contexto Astron

Preciso primeiro adicionar os secrets antes de prosseguir com a implementacao.

