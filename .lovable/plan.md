# Rastreadores unificados (site + formulários)

## Diagnóstico
- `index.html` hoje tem apenas **GTM-NZ64Q899** (duplicado, está injetado 2x) e **Meta Pixel 167413567155597**.
- **Não há GA4** (`G-1411Z6YVPY`) instalado — por isso `/f/-formulario-exocad-ia` (e nenhuma outra página) aparece no Google Analytics.
- **Não há TikTok Pixel** (`D05CI83C77UE5QUU9FR0`).
- `PublicFormPage` só faz `dataLayer.push({event:'generate_lead'})`; não dispara `fbq('track','Lead')`, GA4 `generate_lead` direto, nem TikTok `SubmitForm`.
- `usePageTracking` já roda em todas as rotas públicas (via `App.tsx`), então basta corrigir as tags base e os formulários herdarão.

## Mudanças

### 1. `index.html` — base de rastreamento global
- Remover o bloco GTM duplicado (está repetido no `<head>` e no fim do `<body>`).
- Adicionar **GA4 gtag** (`G-1411Z6YVPY`) no fim do `<body>` (defer, sem bloquear LCP).
- Adicionar **TikTok Pixel** (`D05CI83C77UE5QUU9FR0`) no fim do `<body>`.
- Manter `<noscript>` dos pixels no `<body>` (regra do projeto: noscript-img não pode ficar no head).

### 2. Migration — defaults editáveis por formulário
Adicionar à `smartops_forms`:
```
tracking_gtm_id          text default 'GTM-NZ64Q899'
tracking_ga4_id          text default 'G-1411Z6YVPY'
tracking_meta_pixel_id   text default '167413567155597'
tracking_tiktok_pixel_id text default 'D05CI83C77UE5QUU9FR0'
tracking_extra_head      text  -- opcional, snippet livre
```
Backfill nas linhas existentes com os mesmos defaults para que TODOS os formulários atuais já saiam rastreados.

### 3. `SmartOpsFormEditor` — nova seção "Rastreadores"
Bloco colapsável "Rastreadores & Pixels" com 4 inputs (placeholder mostrando o default Smart Dent) + textarea opcional `tracking_extra_head`. Botão "Restaurar padrão Smart Dent" repopula com os IDs oficiais.

### 4. `PublicFormPage.tsx`
- Após carregar `form`, injetar dinamicamente (apenas se IDs diferirem dos já presentes em `index.html`, deduplicando por ID) os scripts de GTM/GA4/Meta/TikTok específicos do formulário. Isso permite que uma campanha use um pixel próprio sem perder o global.
- No `handleSubmit` (success) disparar em paralelo aos eventos existentes:
  - `fbq('track','Lead',{ content_name: form.name })`
  - `ttq.track('SubmitForm',{ content_name: form.name })`
  - `gtag('event','generate_lead',{ form_name: form.name })`
  - manter `dataLayer.push('generate_lead', …)` atual.
- Envolver tudo em `try/catch` (silencioso se o pixel não estiver carregado).

### 5. Páginas de conteúdo
Nada a fazer no código das páginas — `usePageTracking` já registra page_view em `lead_page_views` e empurra `page_view` no `dataLayer`. Com GA4 e TikTok agora carregados em `index.html`, todas as rotas (`/base-conhecimento/...`, `/produtos/...`, `/depoimentos/...`, `/f/...`, etc.) passam a aparecer no GA4 e TikTok automaticamente.

## Detalhe técnico
- IDs publicáveis (pixel/GA/GTM) podem ficar no código e no DB sem risco.
- TikTok Pixel ID `D05CI83C77UE5QUU9FR0` — usar snippet oficial `ttq.load(...)`.
- Para evitar conflito de SPA, o GA4 será inicializado com `send_page_view: false` e `usePageTracking` chamará `gtag('event','page_view',{page_path})` em cada mudança de rota (forma correta com React Router).
- Nenhuma alteração em `usePageTracking` além de adicionar a chamada gtag.

## Fora de escopo
- Server-side tracking / Conversion API.
- Consent banner (LGPD) — pode ser próximo passo se desejado.
