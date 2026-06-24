## Problema

O botão "Conectar Google Business Profile" só renderiza quando `useGoogleConnection()` retorna `null`. Como já existe uma linha em `google_oauth_tokens` (do dia 16/06, com `refresh_token` revogado/inválido), o hook devolve um objeto truthy e a UI esconde o botão — ficando sem nenhum caminho para reconectar.

## Correção (apenas frontend)

Arquivo: `src/components/social/reviews/SocialReviews.tsx` (com pequeno ajuste em `useGoogleReviews.ts` se preciso, sem mexer em edge functions).

1. Sempre renderizar o bloco de ação no card "Respostas automáticas (Business Profile API)":
   - Se `!connection` → botão **"Conectar Google Business Profile"** (estado atual).
   - Se `connection` existe e `expires_at` no passado (ou ausente) → mostrar aviso amarelo **"Token expirado/revogado — reconecte"** + botão **"Reconectar Google Business Profile"** (mesmo `buildOAuthUrl()`).
   - Se `connection` válida → badge verde **"Conectado"** + link discreto "Reconectar" para casos de troca de conta.

2. O botão usa o `buildOAuthUrl()` já existente (sem alteração) — apontando para `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/google-oauth-callback`, que é o redirect URI que você acabou de cadastrar no Google Cloud.

3. Manter a copy "Em breve" só enquanto `!connection`; quando houver token válido, trocar para "Ativo — respostas automáticas a cada 3 dias".

## Fora de escopo

- Não alterar edge functions (`google-oauth-callback`, `google-reviews-pull`, `google-reviews-respond`).
- Não tocar em `google_oauth_tokens` via SQL — basta o usuário concluir o consent, o callback faz upsert.

## Verificação

Após aplicar, abrir `/social/avaliacoes` → card "Respostas automáticas" deve mostrar o aviso de token expirado + botão Reconectar. Clicar leva ao consent do Google.
