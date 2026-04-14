
Objetivo: restaurar imediatamente os textos dos artigos da Base de Conhecimento, com foco no que mudou no último deploy e no ponto real de renderização do `content_html`.

Diagnóstico encontrado:
- O frontend ainda busca `content_html` corretamente: `useKnowledge.fetchContentBySlug()` faz `.select('*, knowledge_categories(*), authors(*)')`.
- O componente de artigo ainda renderiza HTML: `KnowledgeContentViewer` monta `processedHTML` a partir de `displayContent.content_html` e passa isso para `PDFContentRenderer`.
- O render final usa `DirectHTMLRenderer`, que aplica `dangerouslySetInnerHTML`.
- Então o problema não parece ser “campo vazio no banco” nem “remoção do dangerouslySetInnerHTML”.
- O maior suspeito do último deploy é o roteamento no `vercel.json`: hoje `/base-conhecimento/:letter/:slug` está sempre sendo reescrito para `/api/middleware-bot`, inclusive para usuários normais. Isso é perigoso em projeto Vite SPA e combina com o sintoma “sumiu após deploy”.
- Há também um segundo ponto frágil: `PDFContentRenderer` tenta parsear `pdf-viewer-container` com regex muito sensível. Se o HTML tiver blocos de PDF com divs aninhadas, ele pode engolir partes do artigo ou montar `parts` de forma incompleta.

Plano de correção:

1. Corrigir o rewrite do Vercel para não capturar tráfego normal
- Remover o rewrite incondicional:
  - `/base-conhecimento/:letter/:slug -> /api/middleware-bot`
- Deixar o middleware de bot atuar apenas por detecção de bot no `has.user-agent`, ou manter só a regra global já existente para bots.
- Garantir que usuário normal continue indo para `/index.html` e o React Router resolva a página.
- Revisar a ordem dos rewrites para a SPA continuar funcionando.

2. Ajustar `api/middleware-bot.ts`
- Manter a função só para bots/crawlers.
- Para requisição não-bot, evitar `return fetch(request)` como fallback primário para rota SPA.
- Tornar o comportamento explícito:
  - ou o rewrite só acontece para bots;
  - ou a função responde com um redirecionamento/rewrite seguro para a SPA, sem depender de comportamento ambíguo do Edge Runtime.

3. Blindar o renderizador de conteúdo dos artigos
- Simplificar `PDFContentRenderer` para nunca “sumir” com o artigo:
  - se o parse dos PDFs falhar ou ficar duvidoso, renderizar o HTML inteiro via `DirectHTMLRenderer`;
  - evitar regex que tenta capturar containers completos com divs aninhadas de forma frágil;
  - preferir estratégia conservadora: separar apenas quando houver extração confiável, senão mostrar tudo.
- Isso reduz risco de artigos com `pdf-viewer-container` esconderem o resto do `content_html`.

4. Validar o componente de artigo
- Confirmar que `KnowledgeContentViewer` continua usando:
  - `displayContent.content_html`
  - `processedHTML`
  - `PDFContentRenderer`
- Se necessário, adicionar fallback explícito de segurança:
  - quando `processedHTML` existir, sempre renderizar ao menos um `DirectHTMLRenderer`, mesmo que o parser de PDF falhe.

5. Verificação após implementação
- Abrir um artigo afetado e confirmar:
  - hero, vídeo e principalmente corpo do texto visíveis;
  - artigos com e sem bloco de PDF funcionando;
  - rotas `/base-conhecimento/*` abrindo normalmente para usuário real;
  - bots ainda recebendo HTML SEO via proxy.
- Testes prioritários:
  - um artigo sem PDF embutido;
  - um artigo com `pdf-viewer-container`;
  - um acesso simulando bot;
  - um acesso normal no navegador.

Arquivos que pretendo alterar:
- `vercel.json`
- `api/middleware-bot.ts`
- `src/components/PDFContentRenderer.tsx`
- possivelmente `src/components/KnowledgeContentViewer.tsx` (apenas para fallback de segurança)

Resultado esperado:
- os textos dos artigos voltam a aparecer;
- o SEO para bots continua;
- o roteamento SPA da Base de Conhecimento deixa de interferir na renderização normal.

Detalhes técnicos:
```text
Fluxo atual suspeito
usuário normal
  /base-conhecimento/a/slug
    -> vercel rewrite
    -> /api/middleware-bot
    -> fetch(request)
    -> comportamento inconsistente para SPA

Fluxo desejado
usuário normal
  /base-conhecimento/a/slug
    -> /index.html
    -> React Router
    -> KnowledgeBase
    -> fetchContentBySlug
    -> KnowledgeContentViewer
    -> DirectHTMLRenderer

bot
  /base-conhecimento/a/slug
    -> middleware/proxy SEO
    -> seo-proxy
    -> HTML renderizado para crawler
```
