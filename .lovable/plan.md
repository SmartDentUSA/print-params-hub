## Encurtador de links interno `s.smartdent.com.br/{code}`

### 1. Migration — tabela + RPC

**Tabela `smartops_short_links`**
- `id uuid PK default gen_random_uuid()`
- `short_code varchar(8) UNIQUE NOT NULL`
- `form_slug varchar NOT NULL`
- `default_target varchar NOT NULL CHECK (default_target in ('form','landing_page'))`
- `click_count int NOT NULL default 0`
- `last_clicked_at timestamptz`
- `created_at timestamptz NOT NULL default now()`
- Índice único composto `(form_slug, default_target)` — garante idempotência.
- GRANT: `SELECT` para `anon` (redirecionador anônimo lê a linha), `SELECT/INSERT/UPDATE` para `authenticated` (UI de admin), `ALL` para `service_role`.
- RLS ON. Policies: leitura pública (ok pois só armazena mapeamento code → slug), escrita apenas para admin autenticado via `has_role(auth.uid(),'admin')` além de service_role bypass.

**RPC `generate_short_link(p_form_slug text, p_target varchar) returns text`**
- SECURITY DEFINER, `set search_path = public`.
- Valida `p_target in ('form','landing_page')`.
- `SELECT short_code` existente para `(form_slug, default_target)` → retorna se achado (idempotente).
- Caso contrário: loop até 3x gerando code de 6 chars do alfabeto `abcdefghijkmnpqrstuvwxyz23456789` (sem `0/O/1/l`), tenta `INSERT`, ignora `unique_violation` no code e refaz.
- Retorna o `short_code` final.
- GRANT EXECUTE para `authenticated`.

### 2. Edge Function `short-link-resolve`

Rota `GET /short-link-resolve?c={code}`:
- Lookup em `smartops_short_links` pelo `short_code`.
- Se não encontrar → 302 `https://parametros.smartdent.com.br/`.
- Se encontrar:
  - Calcula path: `form` → `/f/{form_slug}`, `landing_page` → `/lp/{form_slug}`.
  - Fire-and-forget:
    - `UPDATE smartops_short_links SET click_count = click_count+1, last_clicked_at = now() WHERE id = ...`.
    - `INSERT INTO lead_page_views` com os mesmos campos que `usePageTracking` popula (`session_id` gerado do IP+UA, `page_path = '/f/{slug}'` ou `/lp/{slug}`, `page_type = 'form'|'landing_page'`, `referrer`, `utm_source='short_link'`, `utm_medium='shortlink'`, `utm_campaign=short_code`, `device_type`, `browser` derivados do `User-Agent`, `extra_data = { source: 'short_link', short_code, form_slug }`). Isso faz o clique cair no mesmo agregado de "Visitantes" do card do form (que já lê de `lead_page_views` pelo `page_path`/`extra_data`).
  - Responde `302` para `https://parametros.smartdent.com.br{path}` com `Cache-Control: no-store`.
- Nota: **não** reutilizar `short-link-redirect` existente (esse serve campanhas de email, mexe em `campaign_send_log` — escopo diferente).

### 3. Roteamento host-aware no Vercel

Adicionar em `vercel.json`, **antes** dos rewrites SPA:

```json
{
  "source": "/:code([a-z0-9]{4,8})",
  "has": [{ "type": "host", "value": "s.smartdent.com.br" }],
  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/short-link-resolve?c=:code"
}
```

E um catch-all pro root/desconhecido no mesmo host:

```json
{
  "source": "/:path*",
  "has": [{ "type": "host", "value": "s.smartdent.com.br" }],
  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/short-link-resolve?c=:path*"
}
```

Colocados no topo da lista de `rewrites` para ter prioridade sobre o fallback SPA (`/((?!api/|.*\\.[a-zA-Z0-9]+$).*)`). Domínio `s.smartdent.com.br` já precisa estar adicionado como domain do projeto Vercel (o usuário confirmou que sim).

### 4. UI no `FormMetricsCard`

Abaixo da linha `/f/{form.slug}`, dois blocos condicionais:

- **Form**: se `shortLinks[form.slug]?.form` existe → linha `s.smartdent.com.br/{code}` + ícone copiar + `({click_count})`. Caso contrário → botão pequeno "Gerar link curto".
- **Landing page**: só renderiza se o form tiver landing page publicada (checar campo já existente que a UI usa hoje para `onEditLandingPage`). Mesma lógica com `default_target='landing_page'`.

Fluxo:
- Ao montar a lista, o painel busca `smartops_short_links` para todos os `form_slug` visíveis e passa um map para o card.
- Clique em "Gerar link curto" chama `supabase.rpc('generate_short_link', { p_form_slug, p_target })`, atualiza o estado local com o code retornado, toast de sucesso, copia automaticamente pro clipboard.
- Ícone copiar copia `https://s.smartdent.com.br/{code}`.

### O que não muda
- `short-link-redirect` (campanhas de email) fica intacto.
- Nada em `usePageTracking`; a paridade é replicada dentro da edge function.
- Métricas de visitantes/leads/conversão do card continuam vindas da mesma fonte.

### Arquivos afetados
- Nova migration (tabela + RPC + grants + policies).
- Nova edge function `supabase/functions/short-link-resolve/index.ts`.
- `vercel.json` — 2 rewrites host-aware no topo.
- `src/components/smartops/FormMetricsCard.tsx` — novos props + UI.
- Componente pai que renderiza `FormMetricsCard` (`SmartOpsFormBuilder.tsx` / painel de forms) — carrega o map de short links e passa como prop, mais handler `onGenerateShortLink`.
