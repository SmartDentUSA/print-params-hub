## Diagnóstico

Olhando os **network requests** atuais: as chamadas a `smart-ops-copilot` estão retornando **HTTP 200** com SSE válido. O Copilot **não está quebrado** — o que aparece como "Rebuilding" é o **LLM ecoando** mensagens antigas do histórico do chat (o usuário envia "s", "ss", "e", "de" — entradas vazias — e o Gemini repete o último padrão de assistente que vê: o erro antigo de "Rebuilding").

Causa raiz real do problema original (que poluiu o histórico):

1. Em `supabase/functions/smart-ops-copilot/index.ts`, `isOutOfCreditsError` (linhas 104–113) só dispara cascata para **402 / "credits"**. Quando o Lovable AI Gateway retorna **`HTTP 503 {"error":"Rebuilding - please redeploy from Lovable"}`**, a função trata como "erro real", não cascateia para DeepSeek/Claude, e devolve o corpo bruto ao frontend.
2. O backend devolve esse erro no campo `reply`, mas `SmartOpsCopilot.tsx:232` lê `data.content || data.error` — então mostra o JSON cru `❌ Erro: {"error":"Rebuilding..."}`.
3. Essas mensagens ficam salvas em `localStorage` e são reenviadas a cada turno, fazendo o LLM imitar o padrão.

## Correção

Editar apenas `supabase/functions/smart-ops-copilot/index.ts`:

1. **Nova função `isTransientGatewayError(status, bodyText)`** — retorna `true` para:
   - `503` + corpo contendo `rebuilding`, `redeploy`, `unavailable`, `bad gateway`
   - `502`, `504`
2. **`callChatWithFallback`** — tratar resultado transiente igual a `out_of_credits`: escalona para o próximo provedor da cadeia (não devolve no `attempts[0]`). Loga em `system_health_logs` como `error_type: "provider_transient"`.
3. **Mensagem final** quando toda a cadeia falha por motivo transitório: `content: "⚠️ Provedores de IA temporariamente indisponíveis (Gateway em reconstrução). Tente novamente em ~30s."`, `error: "all_providers_transient"`.
4. **Normalizar contrato com frontend** — trocar `reply:` por `content:` nas linhas 2657–2672 (e qualquer outro retorno JSON de erro) para que `data.content || data.error` no frontend exiba a mensagem amigável em vez do JSON técnico.

Validação:
- Redeploy de `smart-ops-copilot`.
- Verificar com `curl_edge_functions` enviando uma pergunta simples.
- Pedir ao usuário para **limpar o histórico do Copilot** (botão "Novo chat" ou apagar `localStorage["copilot-chat-history"]`) para parar o eco das mensagens antigas.

### Fora de escopo
- Sem mudanças em UI (apenas o contrato de campo), schema, secrets, ou outras edge functions.
- Sem mudança na ordem de cascata.
