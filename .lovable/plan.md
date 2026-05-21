# GA4 não enxerga `/f/-formulario-exocad-ia`

## Diagnóstico (não é falta de UTM)

UTM não é requisito para o GA4 registrar a visita — UTM só classifica *de onde veio* o tráfego. O motivo real de você não ver o formulário é uma combinação destes pontos:

1. **A tag GA4 ainda não está em produção.** `G-1411Z6YVPY` foi adicionado no `index.html` na iteração anterior, mas mudanças de frontend só vão pro ar com **Publish → Update**. Hoje, abrindo `parametros.smartdent.com.br` o script `gtag/js?id=G-1411Z6YVPY` **não está sendo carregado**.
2. **Quando entrar no ar**, o `usePageTracking` dispara `gtag('event','page_view', { page_path, page_title, page_location })` em cada rota — porém **sem** repassar UTMs e sem `page_referrer`. Resultado: toda visita ao formulário aparece como **Direct / (none)** mesmo quando veio de Meta/Google Ads.
3. O `usePageTracking` tem **debounce de 2s**; em Realtime do GA4 isso atrasa o card aparecer, mas não impede.
4. Ad-blocker / Brave / extensões podem bloquear `googletagmanager.com` — testar em aba anônima limpa.

## Ações

### 1. Publicar (você)
Clicar **Publish → Update**. Validar:
- DevTools → Network → filtrar `gtag/js?id=G-1411Z6YVPY` (deve aparecer 200).
- GA4 → Admin → DebugView (com extensão *GA Debugger* ativa) → entrar em `/f/-formulario-exocad-ia` e ver `page_view` chegar.
- GA4 → Realtime → ver a página listada em "Páginas e telas".

### 2. Enriquecer o `page_view` GA4 com UTM + referrer
Em `src/hooks/usePageTracking.ts`, na chamada `gtag('event','page_view', …)`, passar também:
```ts
gtag('event','page_view', {
  page_path: path,
  page_title: document.title,
  page_location: window.location.href,
  page_referrer: document.referrer || undefined,
  campaign_source: utms.utm_source || undefined,
  campaign_medium: utms.utm_medium || undefined,
  campaign_name: utms.utm_campaign || undefined,
  campaign_content: utms.utm_content || undefined,
  campaign_term: utms.utm_term || undefined,
});
```
Isso resolve a atribuição: tráfego de campanhas com `?utm_source=meta&utm_medium=cpc&utm_campaign=exocad_ia` passa a aparecer em **Acquisition → Traffic acquisition** corretamente.

### 3. Disparar `page_view` imediato no formulário (sem esperar 2s)
Em `PublicFormPage.tsx`, logo após carregar o `form`, fazer um `gtag('event','page_view',{ page_path: location.pathname, form_slug: form.slug, form_name: form.name })` adicional. O debounce de 2s do hook continua para gravar `lead_page_views`, mas o GA4 recebe o hit na hora.

### 4. (Opcional) Garantir que campanhas usem UTM na URL pública do formulário
Padrão sugerido para anúncios apontando para `/f/-formulario-exocad-ia`:
`?utm_source={ad_platform}&utm_medium=paid&utm_campaign={campaign_name}&utm_content={ad_id}`.
Sem isso, GA4 atribui a "Direct" — não é bug, é falta de marcação na campanha.

## Fora de escopo
- Conversion API server-side (Meta/GA4 Measurement Protocol).
- Banner de consentimento LGPD.
- Trocar de gtag direto para GTM-only (hoje convivem; ok).

## Detalhe técnico
- O `gtag('config', …, { send_page_view:false })` em `index.html` está **correto** para SPA: evita pageview duplicado, deixando o hook controlar.
- O bloco de injeção de GA4 dentro de `PublicFormPage` checa `html.includes(tracking_ga4_id)` — como o default do form é o mesmo `G-1411Z6YVPY` global, ele **não** reinjeta (correto, sem duplicidade).
- `lead_page_views` continua independente e já está rico em UTM/device — não muda nada nele.
