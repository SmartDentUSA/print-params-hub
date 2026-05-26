## Expandir Whitelist de Crawlers de IA

### Escopo
Atualizar as duas fontes de whitelist de bots no projeto para capturar crawlers de IA emergentes (SearchGPT, Meta AI, Apple Intelligence, Amazon, Mistral, Perplexity/Phind, etc.).

### Arquivos a modificar

1. **`vercel.json`** (linha 70)
   - Expandir regex do rewrite bot-catcher para incluir:
     - `oai-searchbot` (OpenAI SearchGPT)
     - `meta-externalagent`, `meta-externalfetcher` (Meta AI)
     - `amazonbot` (Amazon Alexa/AI)
     - `applebot-extended` (Apple Intelligence)
     - `youbot` (You.com)
     - `diffbot` (Diffbot)
     - `mistralai-user` (Mistral AI Le Chat)
     - `google-cloudvertexbot` (Vertex AI)
     - `duckassistbot` (DuckDuckGo AI)
     - `kagibot`, `phindbot`, `timpibot`, `iaskbot` (Perplexity/Phind/iAsk)
   - Validar regex com teste Node.js local antes de commit

2. **`api/middleware-bot.ts`** (linhas 3-10)
   - Sincronizar array `BOTS` com os mesmos novos identificadores
   - Garantir que ambas as listas (Vercel rewrite + Edge middleware) estejam consistentes

### Mitigações aplicadas
- Regex validada offline com script Node.js contra UAs reais antes do merge
- Se malformada, preview Vercel falha com 404 — revert via branch
- `middleware-bot.ts` tem fallback natural: se não match, serve SPA (não quebra)

### Pós-deploy
- Curl com 3 UAs (Googlebot, GPTBot, OAI-SearchBot) para confirmar que `seo-proxy` responde com 200 + HTML
