## Objetivo
Confirmar se as **respostas automáticas Google Business Profile** estão de fato funcionando ou ainda travadas por aprovação da API.

## Estado atual verificado
- ✅ Edge function `google-reviews-respond` implementada (cascata Gemini → DeepSeek → Claude + PUT em `mybusiness.googleapis.com/v4`).
- ✅ Edge function `google-reviews-pull` agendada via cron (`0 9 */3 * *`) e invoca `google-reviews-respond` automaticamente para cada review novo sem reply.
- ✅ 1 token OAuth em `google_oauth_tokens`.
- ❌ Tabela `google_reviews` **vazia** — nenhum review importado, logo nenhuma resposta foi publicada ainda.
- ⚠️ UI (`SocialReviews.tsx`) ainda exibe "Em breve" e "serão liberadas quando aprovação chegar", desalinhada do backend.

## Diagnóstico
1. **Invocar `google-reviews-pull` manualmente** via `supabase--curl_edge_functions` (POST `{}`).
2. **Ler logs** com `supabase--edge_function_logs` (`google-reviews-pull` e `google-reviews-respond`) para confirmar:
   - Se o token retorna `accounts` (ou 403 PERMISSION_DENIED da Business Profile API).
   - Se reviews são importados em `google_reviews`.
   - Se `google-reviews-respond` é disparado e publica com sucesso.
3. **Reconsultar** `SELECT response_status, COUNT(*) FROM google_reviews` para validar.

## Reportar ao usuário
- Se 403 → aprovação Google ainda pendente; UI permanece como está.
- Se reviews importados + replies publicadas → ajustar copy da UI (remover "Em breve" / "serão liberadas quando aprovação chegar").
- Se erro intermediário → expor causa exata.

## Fora do escopo
- Nenhuma mudança de schema, código de função ou UI nesta etapa — apenas diagnóstico. Ajustes virão num plano seguinte conforme resultado.