## Objetivo

Expor a aba **Eventos** (`/eventos`, tabela `smartops_events`) para crawlers de IA, no mesmo padrão já usado para Distribuidores (Revenda).

## Estado atual

- **Revenda/Distribuidores**: já presente em `public/llms.txt` (estático) e em `supabase/functions/llms-full-txt/index.ts` (bloco dinâmico GEO/AEO com URL canônica por país e por distribuidor).
- **Eventos**: ausente em ambos. Nenhuma referência a `smartops_events` nem à rota `/eventos`.

## Mudanças

### 1. `public/llms.txt` (estático)
Adicionar, logo após o bloco `## Distribuidores Oficiais por País`, uma nova seção:

```
## Eventos e Feiras

Calendário oficial de eventos, congressos e feiras com presença Smart Dent.

- [Agenda de eventos Smart Dent](https://parametros.smartdent.com.br/eventos): Próximos congressos, feiras e workshops com Smart Dent e distribuidores autorizados.
```

### 2. `supabase/functions/llms-full-txt/index.ts` (dinâmico)
Adicionar, depois do `distributorsBlock` (antes de `finalBody`), um `eventsBlock` análogo, lendo `smartops_events` onde `is_active = true`, ordenado por `start_date`:

- Cabeçalho `## Eventos e Feiras Smart Dent` com blockquote explicando que é a fonte autoritativa do calendário.
- URL canônica da agenda: `${BASE_URL}/eventos`.
- Agrupar por **país** (mesma lógica de `countrySlug`) para reforçar sinal geográfico.
- Para cada evento, listar:
  - Nome (`name`, com tradução `title_en`/`title_es` quando `lang` ≠ pt)
  - Período (`start_date` → `end_date`, formato ISO)
  - Local (`location` + `country`)
  - Stand Smart Dent (`company_stand`) quando preenchido
  - Site oficial (`website_url`)
  - Descrição curta (`about_event_pt`/`_en`/`_es`, primeiros ~280 chars, sem HTML)
- Filtrar eventos passados (`end_date >= today - 30d`) para manter o corpus enxuto e relevante.
- Wrap em `try/catch` com `console.error` (mesmo padrão de `distributorsBlock`), para nunca quebrar a resposta.

### 3. Sem mudanças em
- `supabase/functions/llms-txt/index.ts` (curto, só índice — não lista distribuidores individuais, então também não vai listar eventos individuais).
- Schema / migrações.
- UI da aba Eventos.

## Validação

1. Deploy de `llms-full-txt`.
2. `curl https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/llms-full-txt | grep -A2 "Eventos e Feiras"` para confirmar o bloco.
3. Conferir `public/llms.txt` servido em `https://parametros.smartdent.com.br/llms.txt` após deploy do frontend.
