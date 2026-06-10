## Diagnóstico

A página `https://parametros.smartdent.com.br/f/terceirizacao-projetos-cad` carrega o HTML (200 OK), mas fica em branco. O console mostra a causa real:

```
TypeError: Failed to fetch dynamically imported module:
https://parametros.smartdent.com.br/assets/PublicFormPage-DM9DQ1Uk.js
```

O navegador (ou um Service Worker / cache de CDN) está com um `index.html` antigo que aponta para um chunk JS (`PublicFormPage-DM9DQ1Uk.js`) que não existe mais no deploy atual — o Vite gerou um novo hash. Como o `PublicFormPage` agora é carregado via `React.lazy()` (mudança recente para reduzir bundle), o `import()` dinâmico falha, o `<Suspense>` não tem fallback de erro, e o React quebra silenciosamente → tela branca.

Esse problema acontece toda vez que publicamos uma nova versão e um visitante já tem o HTML antigo em cache. Não é exclusivo de `/f/...` — atinge qualquer rota lazy (Knowledge Base, Admin, Social, etc.) após um deploy.

## O que vai ser feito

1. **Boundary de erro com auto-reload em falha de chunk** (`src/components/ChunkErrorBoundary.tsx`, novo)
   - Captura `TypeError: Failed to fetch dynamically imported module` e `ChunkLoadError`.
   - Marca uma flag em `sessionStorage` para evitar loop e faz `window.location.reload()` uma vez, com cache busting (`?v=timestamp`).
   - Se já tentou recarregar e falhou de novo, mostra uma tela amigável com botão "Recarregar agora" em vez de página branca.
   - Envolver o `<Suspense>` em `src/App.tsx` e também o `DraLIAGlobal`.

2. **Headers de cache no Vercel** (`vercel.json`)
   - Garantir `Cache-Control: no-cache, must-revalidate` para `/index.html` e para a raiz `/`, e `public, max-age=31536000, immutable` para `/assets/*` (que já têm hash no nome).
   - Isso impede que o HTML fique cacheado em CDN/browser apontando para chunks que já não existem.

3. **Pré-carregar o chunk do PublicFormPage no link do bot/usuário** (opcional, leve)
   - Adicionar `link rel="modulepreload"` dinâmico no `PublicFormPage` lazy import para reduzir TTFB do formulário no primeiro acesso.

4. **Validação**
   - Após deploy: abrir a URL em janela anônima, confirmar que o formulário renderiza.
   - Forçar reload com cache antigo (DevTools → Disable cache off) e confirmar que o boundary recarrega sozinho.
   - Verificar que o Googlebot continua recebendo o HTML SSR do `seo-proxy` (já configurado no `vercel.json`).

## Detalhes técnicos

- O HTML responde 200 em 1.876ms e baixa o bundle principal `index-aZChSVV-.js`, mas o `import()` do chunk antigo retorna 404 silencioso (Vercel responde com `index.html` por causa do SPA fallback, e o browser tenta interpretar HTML como JS → `TypeError`).
- O fix do ErrorBoundary é o padrão recomendado pela documentação do Vite para o problema "stale chunk after deploy".
- Os headers do Vercel atualmente só cobrem favicons/manifest/sitemaps — falta a regra explícita para `index.html` e `/assets/*`.
- Não há mudança de lógica de negócio nem de UI; apenas resiliência de carregamento.

## Riscos

- Loop de reload: mitigado pela flag de uma única tentativa em `sessionStorage`.
- Headers do Vercel afetarem outras rotas: a regra é específica para `/index.html`, `/` e `/assets/(.*)`.
