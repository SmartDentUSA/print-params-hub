

## Plano: Atualizar tracking_pixels e injetar GTM nas páginas SSR

### 1. Atualizar dados no banco
UPDATE no `system_a_catalog` (company_info) para gravar a config de tracking_pixels com GTM enabled + fallback pixels disabled.

### 2. Injetar GTM no seo-proxy (páginas SSR para bots)
Atualmente o `seo-proxy/index.ts` gera ~12 tipos de página HTML completas para bots (homepage, brand, model, resin, artigos, categorias, etc.) mas **nenhuma inclui tracking pixels**. 

Criar uma função helper `buildTrackingPixels()` que retorna:
- GTM `<script>` no `</head>` 
- GTM `<noscript>` no `<body>`
- Opcionalmente Meta/TikTok se `enable_fallback_pixels` estiver true

Injetar chamada dessa função em todos os pontos de geração HTML (antes de `</head>` e após `<body>`).

**Abordagem**: Como o GTM container ID já é hardcoded no `index.html`, e o seo-proxy é server-side, vou usar o mesmo ID `GTM-NZ64Q899` diretamente (lido da constante). Não precisa fetch do banco em cada request — o container ID é estático.

### 3. Arquivos modificados
- `supabase/functions/seo-proxy/index.ts` — adicionar `buildGTMHead()` e `buildGTMBody()` helpers, injetar em todas as funções `generate*HTML`
- Banco: UPDATE via insert tool para `system_a_catalog`

### 4. index.html — já tem GTM e Meta Pixel
Nenhuma mudança necessária. O `index.html` já serve o SPA com GTM + Meta Pixel hardcoded.

