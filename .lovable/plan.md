# ⭐ Avaliações Google — 100% Automático (Vitrine) + Cascata de IA

Resposta automática por IA, sem interação humana após o setup. Frontend é só leitura. `google-reviews-respond` tem cascata de 3 provedores.

## Fluxo

```text
Cron 3d (0 9 */3 * *)
   └─► google-reviews-pull
          ├─ refresh token se expirado
          ├─ lista accounts → locations → reviews
          └─ p/ review NOVO (UNIQUE review_id):
                 INSERT
                 → invoke google-reviews-respond
                        ├─ Cascata IA: gemini-2.5-flash → deepseek-chat → claude-sonnet
                        ├─ PUT no Google
                        └─ UPDATE response_status='published'
```

## 1. Migration

- `google_oauth_tokens`: spec original.
- `google_reviews`: spec original + UNIQUE(review_id), índices em `create_time DESC` e `response_status`.
- RLS: `SELECT` para `authenticated` (vitrine read-only). `service_role` gerencia tudo.
- GRANTS: `SELECT` para `authenticated`, `ALL` para `service_role` em ambas as tabelas.
- Trigger `updated_at` usando `public.update_updated_at_column()`.

Cron registrado via `supabase--insert` (não migration, porque embute service role key).

## 2. Edge Functions

`_shared/google-oauth.ts`: `getValidAccessToken()` — lê último token, refresh via `https://oauth2.googleapis.com/token` se expirado, persiste, preserva `refresh_token` antigo com COALESCE.

### a) `google-oauth-callback` (`verify_jwt=false`)
- Recebe `?code=`, troca por tokens (`grant_type=authorization_code`), INSERT em `google_oauth_tokens`.
- 302 → `/social/avaliacoes?connected=true`.

### b) `google-reviews-pull` (`verify_jwt=false`, chamado pelo cron)
1. `getValidAccessToken()`.
2. `GET mybusinessaccountmanagement.googleapis.com/v1/accounts`.
3. Para cada account → `locations?readMask=name,title,storefrontAddress`.
4. Para cada location → `mybusiness.googleapis.com/v4/{account}/{location}/reviews?pageSize=50&orderBy=updateTime desc`.
5. Para cada review:
   - `INSERT ... ON CONFLICT (review_id) DO NOTHING RETURNING id`.
   - Se novo: `EdgeRuntime.waitUntil(supabase.functions.invoke('google-reviews-respond', { body: { review_id }}))`.
   - Se existente e `reviewReply.comment` mudou no Google: UPDATE `reply_text` + `reply_time`.
6. Retorna `{ new_reviews, updated, errors }`.

### c) `google-reviews-respond` (interna)
- Body: `{ review_id: uuid }`.
- Carrega review do banco.
- Monta prompt exatamente como spec (nome, agradecimento específico, regras por estrela, assinatura "Equipe Smart Dent 💙", WhatsApp (16) 98115-8403 nos 1-2★, sem "Ficamos felizes"/"É um prazer", máx. 150 palavras, PT-BR).

**Cascata de IA** (helper `callLovableAI(model, prompt)` que chama `https://ai.gateway.lovable.dev/v1/chat/completions` com `Authorization: Bearer ${LOVABLE_API_KEY}`, retorna texto ou throw):

```ts
const providers = [
  'google/gemini-2.5-flash',
  'deepseek/deepseek-chat',
  'poe/claude-sonnet',
];
let response: string | null = null;
let lastError: Error | null = null;
let usedProvider: string | null = null;

for (const provider of providers) {
  try {
    response = await callLovableAI(provider, prompt);
    if (response) { usedProvider = provider; break; }
  } catch (err) {
    lastError = err as Error;
    console.error(`[reviews-respond] ${provider} falhou:`, (err as Error).message);
    continue;
  }
}

if (!response) {
  await supabase.from('google_reviews').update({
    response_status: 'error',
    error_message: 'Todos os provedores de IA falharam: ' + (lastError?.message ?? 'desconhecido'),
  }).eq('id', review_id);
  return { success: false };
}
```

- Cada chamada chama `logAIUsage` (padrão do projeto) com o modelo efetivamente usado.
- `PUT mybusiness.googleapis.com/v4/{account}/{location}/reviews/{reviewId}/reply` com `{ comment: response }` e Bearer token.
- Sucesso → UPDATE `ai_response_draft`, `reply_text`, `reply_time=now()`, `response_status='published'`.
- Erro de publicação → UPDATE `response_status='error'`, `error_message`. Sem throw.

## 3. Frontend — `/social/avaliacoes`

- Rota lazy em `src/App.tsx` dentro de `<Route path="/social" element={<SocialLayout />}>`.
- Item **"⭐ Avaliações"** em `SocialSidebar.tsx` (ícone `Star`).
- Componente `src/components/social/reviews/SocialReviews.tsx` + hook `useGoogleReviews.ts`.

### Estado 1 — Não conectado
- Card centralizado, explicação curta, único botão **"Conectar Google Business Profile"**.
- Click → URL OAuth Google com `client_id` de `VITE_GOOGLE_CLIENT_ID`, scopes `business.manage openid email`, `access_type=offline`, `prompt=consent`, `redirect_uri` apontando para a edge `google-oauth-callback`.

### Estado 2 — Conectado (vitrine pura)
- Header: rating médio, total de reviews, "Última sincronização: {MAX(updated_at)}".
- **Tabela única** (shadcn `<Table>`), ordenada por `create_time DESC`:

| Coluna | Conteúdo |
|---|---|
| Usuário | Avatar + reviewer_name |
| Avaliação | ⭐ × star_rating (badge colorido) |
| Mensagem do usuário | comment (truncate + tooltip) |
| Resposta publicada | reply_text (truncate); `pending` → "⏳ Gerando…"; `error` → badge vermelho com `error_message` |
| Data da avaliação | dd/MM/yyyy |
| Data da resposta | dd/MM/yyyy ou "—" |

**Zero botões de ação.** Sem sync manual, sem regenerar, sem editar, sem aprovar.

Realtime opcional (`postgres_changes` em `google_reviews`) para atualização ao vivo quando o cron rodar.

## Ordem de execução

1. Migration (tabelas + RLS read-only + grants + índices + trigger).
2. `supabase--insert` registrando cron `google-reviews-pull-3days`.
3. `_shared/google-oauth.ts` + 3 edge functions.
4. `supabase/config.toml`: `verify_jwt=false` em `google-oauth-callback` e `google-reviews-pull`.
5. Adicionar `VITE_GOOGLE_CLIENT_ID` no `.env`.
6. Sidebar item + rota + `SocialReviews.tsx` + `useGoogleReviews.ts`.

Aprovando, parto direto para o build.
