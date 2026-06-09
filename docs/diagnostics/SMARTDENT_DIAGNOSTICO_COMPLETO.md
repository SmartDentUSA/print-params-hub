# DIAGNÓSTICO COMPLETO — SMARTDENT
> Última atualização: 2026-06-09 | Compilado por Claude Code (sessão ativa)
> Este arquivo agrega todos os dados de configuração coletados para análise e plano de ação.

---

## ÍNDICE
1. [Google Search Console — Todos os Domínios](#1-google-search-console--todos-os-domínios)
2. [Loja Integrada — Configurações](#2-loja-integrada--configurações)
3. [Google Cloud Run](#3-google-cloud-run)
4. [Google Analytics 4 (GA4)](#4-google-analytics-4-ga4)
5. [Meta Business / Pixel](#5-meta-business--pixel)
6. [Google Tag Manager (GTM)](#6-google-tag-manager-gtm)
7. [Google Ads](#7-google-ads)
8. [Plano de Ação Prioritário](#8-plano-de-ação-prioritário)

---

## 1. GOOGLE SEARCH CONSOLE — TODOS OS DOMÍNIOS

**Dados coletados em:** 08/06/2026 | Última atualização GSC: 28/05/2026

### Domínios na conta (13 propriedades)

| Domínio | Indexadas | Não Indexadas | Cliques (28d) | Impressões (28d) | CTR | Posição | Sitemap |
|---------|-----------|---------------|---------------|------------------|-----|---------|---------|
| parametros.smartdent.com.br | 1.266 | 3.450 | 469 | 19.900 | 2,4% | 8,1 | ❌ 47 erros |
| blzdental.com.br | 2 | 101 | 1 | 149 | 0,7% | 7,1 | ✅ |
| dentala.com.br | 87 | 278 | 14 | 724 | 1,9% | 9,5 | ✅ |
| eodonto.com | 15 | 162 | 0 | 71 | 0% | 39,0 | ✅ |
| labtechdent.com.br | 1 | 16 | 7 | 577 | 1,2% | 7,0 | ✅ |
| mediti600.com.br | 1 | 3 | 5 | 231 | 2,2% | 8,2 | ❌ não busca |
| mediti700.com.br | 1 | 1 | 0 | 206 | 0% | 9,2 | ❌ não busca |
| mediti900.com | 1 | 60 | 0 | 2 | 0% | 33,0 | ✅ |
| minivat.com | 24 | 43 | 444 | 3.070 | 14,5% | 4,1 | ✅ |
| rayshape.com.br | 1 | 110 | 3 | 222 | 1,4% | 7,7 | ✅ |
| rayshape3d.com.br | 3 | 12 | 0 | 38 | 0% | 6,5 | ✅ |
| smartdent.com.br | 1.530 | 4.500 | 2.480 | 87.600 | 2,8% | 7,5 | ❌ 47 erros + não busca |
| truioconnect.com.br | 1 | 85 | 0 | 1 | 0% | 4,9 | ✅ |

### Detalhes — parametros.smartdent.com.br (Sistema B)

- **Status**: ✅ Verificada (DNS)
- **Indexadas**: 1.270 páginas
- **Não indexadas**: 3.450 páginas
- **Razões de não-indexação**:
  - Página alternativa com tag canônica: 1.340
  - Cópia sem página canônica: 480
  - Página com redirecionamento: 563
  - Não encontrado (404): 156
  - Outros: 311
- **Sitemap**: `/sitemap.xml` — ⚠️ 47 erros (leitura: 7 jun 2026)
- **Desempenho 28d**: 469 cliques | 19.900 impressões | CTR 2,4% | Posição 8,1
- **🔴 ALERTA CRÍTICO**: LCP 100% de páginas com carregamento lento

### Alertas por domínio

- **Sitemaps quebrados**: mediti600, mediti700, smartdent.com.br (não consegue buscar)
- **Alta taxa de 404**: blzdental (77), eodonto (64), rayshape (85), truioconnect (75)
- **Domínios "fantasmas"** (1 página indexada): labtechdent, mediti600, mediti700, mediti900, rayshape, truioconnect
- **minivat.com**: NÃO é proprietário verificado direto — acesso por permissão delegada
- **Melhor performance**: smartdent.com.br (2.480 cliques) e minivat.com (CTR 14,5%)

---

## 2. LOJA INTEGRADA — CONFIGURAÇÕES

**Domínio**: loja.smartdent.com.br ✅ | Subdomínio LI: smart-dent.lojaintegrada.com.br

### Apps instalados na Loja Integrada (confirmados em 08/06/2026)

| App | Status | Observação |
|-----|--------|------------|
| Login Social via Google | ✅ Instalado | — |
| Google Wallet | ✅ Instalado | — |
| Google Analytics 4 (GA4) | ✅ Instalado | Botão "Configurar" disponível |
| Google Search Console | ✅ Instalado | — |
| Facebook Verificação de Domínio | ✅ Instalado | — |
| Facebook Anúncios Dinâmicos | ✅ Instalado | Feed XML para catálogo |
| Google Merchant Center | ✅ Instalado | — |
| **Meta Pixel** | ❌ **NÃO instalado** | Rastreado apenas via GTM server-side |
| **Google Tag Manager** | ❌ **NÃO instalado** | Instalado manualmente via HTML |

**Impacto das integrações faltantes:**
- Sem Meta Pixel nativo → eventos de e-commerce podem não ser enviados corretamente → EMQ baixo (3.7–5.1/10)
- Sem GTM nativo → risco de conflito/perda de dados em deploys da LI

### Google Tag Manager
- **Container ID**: GTM-MNPGDCH
- **Instalação**: Manual via HTML personalizado (app GTM não instalado)
- **Código HTML ID 1629270**: snippet `<script>` GTM-MNPGDCH — Todas as páginas
- **Código HTML ID 1665635**: `<noscript>` GTM-MNPGDCH — Todas as páginas

### Google Analytics
- **App GA4**: Instalado
- `GA_MEASUREMENT_ID`: vazio (intencional — GA4 gerenciado via GTM)
- `AW-CONVERSION_ID`: AW-18143771674
- `AW-CONVERSION_LABEL`: 14KUCNSimbscEJr4z8tD

### Facebook / Meta
- **Verificação de domínio**: `2ke0xj70y5ybb2rh586dietv3lo8gn`
- **Anúncios Dinâmicos**: Feed XML configurado (catálogo de produtos)
- **Pixels via GTM**: 167413567155597 | 837797892060098
- **API de Conversões**: via GTM server-side (GTM-MFN4T8P4) — não via app LI

### Integrações via API (Webhooks)
| App | Chave de Acesso |
|-----|----------------|
| Integrando.se | bcf304755ff82a8ea2ce |
| Bling | 2956ca905bfc98a39704 |
| SellFlux | 727c5d9264de7343cc15 |
| Bonifiq | 927ae5b32224cb3ac817 |
| SCHEMA_SITE_NOVO | 9d3a3f52db958d237235 |
| PRODUTOS_API | 6575198e3019b51a5bfa |
| baixar | 93a9fd3ea44b89f6f9c3 |
| SmartBrain | 11296af237256b2be978 |

### Google Shopping / Merchant Center
- **Domínio verificado**: https://loja.smartdent.com.br ✅
- **Merchant Center ID**: 445684234
- **Produtos**: 290 reprovados | 0 ativos | 0 pendentes
- **Google Ads vinculado**: AW-18143771674 ⚠️ (conta possivelmente suspensa — verificar)
- **Política de trocas**: ✅ | **Pagamento**: ✅

### Scripts HTML Personalizados (7 códigos)

| ID | Nome | Tipo | Página | Observação |
|----|------|------|--------|------------|
| 1684761 | lojaintegrada-google-shopping | HTML | Todas | Meta tag GSC verification |
| 1629270 | GTM-MNPGDCH | HTML | Todas | Snippet GTM `<script>` |
| 1665635 | GTM Noscript - Loja | HTML | Todas | `<noscript>` GTM |
| 1670778 | LI - GTM | HTML | Finalização do pedido | Purchase Tracker v6.0 — ✅ ATUALIZADO |
| 1678070 | lEAD INTERCEPT | HTML | Todas exceto checkout | Interceptação de formulários de lead |
| 1631484 | COD SMA | JavaScript | Todas exceto checkout | ~446 linhas — ⚠️ referência "Moda Masculina" |
| 1669966 | pinterest | HTML | Todas | Meta tag Pinterest verify |

**Purchase Tracker v6.0 (ID 1670778)**:
- `window.dataLayer.push({event: 'purchase', ...})` ✅
- Campos: transaction_id, value, tax, shipping, currency, coupon, items, user_data.email_address
- Chama `sdFbqPurchase()` (fbq) e `sdTtqPurchase()` (ttq) com eventID para deduplicação
- Gatilho: `$(document).on('li_purchase', ...)`

### IDs e Tokens consolidados (LI)

| Plataforma | ID/Token | Origem |
|------------|----------|--------|
| GTM (loja) | GTM-MNPGDCH | HTML personalizado |
| GA4 (via app) | vazio | App LI — intencional |
| Google Ads | AW-18143771674 | App GA4 LI |
| Google Ads Label | 14KUCNSimbscEJr4z8tD | App GA4 LI |
| Meta Pixel 1 | 167413567155597 | GTM |
| Meta Pixel 2 | 837797892060098 | GTM |
| FB Domain Verify | 2ke0xj70y5ybb2rh586dietv3lo8gn | App LI |
| Pinterest Verify | 78427e145f5669327e67500971c5d0d5 | HTML personalizado |
| URL da loja | loja.smartdent.com.br | — |

---

## 3. GOOGLE CLOUD RUN

**Projeto GCP**: gtm-mfn4t8p4-yjg4m

| Serviço | Região | URL | CPU | Memória | Max Instâncias | Status |
|---------|--------|-----|-----|---------|----------------|--------|
| server-side-tagging | us-central1 | https://server-side-tagging-958674344002.us-central1.run.app | 1 | 512MiB | 1 | ✅ Ativo |
| server-side-tagging-preview | us-central1 | https://server-side-tagging-preview-958674344002.us-central1.run.app | 1 | 512MiB | 1 | ✅ Ativo |
| smartdent-bot-proxy | us-central1 | https://smartdent-bot-proxy-958674344002.us-central1.run.app | 1 | 256MiB | 10 | ✅ Ativo |

- **Mapeamento**: `parametros.smartdent.com.br` → `smartdent-bot-proxy`
- **server-side-tagging-preview**: `RUN_AS_PREVIEW_SERVER=true`
- **URL do servidor GTM server-side**: https://server-side-tagging-eeaflmcg6a-uc.a.run.app

---

## 4. GOOGLE ANALYTICS 4 (GA4)

**Conta**: Smart Dent Institucional (ID: 172679486)
**Propriedade**: Smart Dent Institucional – GA4 (ID: 347862608)

### Fluxo de dados
- **Nome**: Smart Dent Institucional – GA4
- **URL configurada**: https://smartdent.com.br ⚠️ (deveria incluir parametros.smartdent.com.br)
- **ID de Medição**: G-59WWJQN34P
- **ID do fluxo**: 4390994688
- **Status**: ✅ Recebendo tráfego nas últimas 48h
- **Medição otimizada**: ✅ Ativada (page views, scroll, cliques de saída + 4 automáticos)

### Integrações
- **Google Ads**: ❌ 0 contas vinculadas ← problema crítico
- **BigQuery**: ✅ Vinculado (Projeto: smartdent-analytics-hub | ID: 703993304245)

### Status atual
- Usuários ativos (30 min): 0
- Usuários ativos (5 min): 0
- Conversões Purchase: nenhum dado de streaming

---

## 5. META BUSINESS / PIXEL

**Conta**: Smart Dent (ID: 1946666208937443)

### Pixel principal
- **Nome**: Pixel de Smart Dent
- **Pixel ID**: 167413567155597
- **Status**: ✅ Ativo | Última atividade: ~1 hora atrás
- **API de Conversões**: ✅ Ativada
- **Pixel JavaScript**: ✅ Ativo
- **GTM**: Conectado

### Eventos recebidos (últimas 24h)

| Evento | Volume | EMQ (Qualidade) |
|--------|--------|-----------------|
| PageView | 265.800 | 5.1/10 |
| scroll | 54.900 | 3.9/10 |
| user_engagement | 46.700 | 3.8/10 |
| involve.me_ProjectLoaded | 22.400 | 6.1/10 |
| click | 10.800 | 5.6/10 |
| form_submit | 3.800 | 4.0/10 |
| Purchase | 750 | 6.1/10 |
| Lead | 659 | ⚠️ Atualização recomendada |
| Pesquisar | 442 | — |
| **Total (28d)** | **~532.700** | **BAIXA** |

### Domínios verificados (13)
smartdent.com.br, loja.smartdent.com.br, idpnp.involve.me, dentala.com.br, minivat.com, eodonto.com, labtechdent.com.br, mediti600.com.br, rayshape.com.br, e outros.

### Alertas
- 🔴 Pontuação de qualidade de dados: **BAIXA**
- EMQ médio: 3.7–5.1/10 — impacta diretamente custo por conversão nos anúncios

---

## 6. GOOGLE TAG MANAGER (GTM) — Análise Completa dos 3 Containers

### Container 1: GTM-NZ64Q899 (www.smartdent.com.br) — v52

**Conta GTM**: 6315186944 | Container: 231172453

#### Tags — Status completo

| Tag ID | Nome | Tipo | GA4 ID / Config | Gatilho | Status |
|--------|------|------|-----------------|---------|--------|
| 5 | GA4 - Tag do Google (G-59WWJQN34P) Global | googtag | G-59WWJQN34P | Initialization All Pages | ✅ Ativo |
| 6 | Ads - Vinculador de Conversões | gclidw | — | Initialization All Pages | ✅ Ativo |
| 7 | Ads - Remarketing Global | sp | **AW-1203384992** ⚠️ | Initialization All Pages | ✅ Ativo |
| 9 | GA4 - Evento Lead (generate_lead) | gaawe | **G-1411Z6YVPY** | Sucesso Lead (/obrigado-lead) | ✅ Ativo |
| 11 | GA4 - Tag do Google (Base Unificada) | googtag | **G-1411Z6YVPY** | Initialization All Pages | ✅ Ativo |
| 15 | Tag GA4 - Evento Compra (Purchase) UNIFICADO | gaawe | G-1411Z6YVPY | CE - purchase | ✅ Ativo (setupTag!) |
| 24 | GA4 - Event - view_item | gaawe | G-1411Z6YVPY | CE - view_item | ✅ Ativo |
| 25 | GA4 - Event - add_to_cart | gaawe | G-1411Z6YVPY | CE - add_to_cart | ✅ Ativo |
| 26 | GA4 - Event - begin_checkout | gaawe | G-1411Z6YVPY | CE - begin_checkout | ✅ Ativo |
| 27 | Meta Pixel - Base. | html | Pixel 167413567155597 | All Pages (consent) | ⚠️ **PAUSADA** |
| 41 | FB_CONVERSIONS_API-167413567155597-Web-Tag-Pixel_Setup | html | Pixel 167413567155597 | DOM Ready | ✅ Ativo |
| 42 | FB_CONVERSIONS_API-167413567155597-Web-Tag-ParamBuilder | html | capiParamBuilder | DOM Ready | ✅ Ativo |
| 45 | **LI - Capturar User Data** | html | user_data push | /finalizacao (pageview) | 🔴 **PAUSADA + QUEBRADA** |
| 50 | GA4 - SPA Page View (parametros) | gaawe | G-1411Z6YVPY | CE - HISTORY_CHANGE | ✅ Ativo |
| 52 | GA4 - Event - parameter_card_view | gaawe | G-1411Z6YVPY | CE - parameter_card_view | ✅ Ativo |
| 54 | GA4 - Event - parameter_copied | gaawe | G-1411Z6YVPY | CE - parameter_copied | ✅ Ativo |
| 59 | GA4 - Update User Properties | gaawe | **G-59WWJQN34P** | All Pages (consent) | ✅ Ativo |
| 60 | Meta - Push Custom Context to dataLayer | html | — | Initialization All Pages | ✅ Ativo |
| 74 | FB_CONVERSIONS_API-837797892060098-Web-Tag-GA4_Config | googtag | **G-59WWJQN34P** | DOM Ready (pixel 837…) | ✅ Ativo |
| 75 | FB_CONVERSIONS_API-837797892060098-Web-Tag-GA4_Event | gaawe | **G-59WWJQN34P** | DOM Ready + Custom Events | ✅ Ativo |
| 77 | FB_CONVERSIONS_API-837797892060098-Web-Tag-Pixel_Template | cvt | Pixel 837797892060098 | DOM Ready + Custom Events | ✅ Ativo |
| 78 | Meta Pixel ID 837797892060098 | html | Pixel 837797892060098 | All Pages (consent) | ✅ Ativo |
| 79 | [META] Lead Event - Sucesso Lead | html | fbq Lead | /obrigado-lead | ✅ Ativo |

#### Problemas críticos — NZ64Q899

**1. "LI - Capturar User Data" (tag 45) — PAUSADA + FUNDAMENTALMENTE QUEBRADA**
- Gatilho: Page URL contains `/finalizacao`
- Conteúdo usa variáveis LI template: `{customer_email}`, `{customer_phone}`, `{customer_first_name}` etc.
- ⚠️ ESSES TEMPLATES NÃO SÃO PROCESSADOS PELO GTM — o GTM enviaria literalmente a string `{customer_email}` ao dataLayer, não o valor real
- Esta tag está no container ERRADO (NZ64Q899 é para smartdent.com.br, não loja.smartdent.com.br)
- A tag "Tag GA4 - Evento Compra (Purchase) UNIFICADO" tem `setupTag: "LI - Capturar User Data"` — logo o purchase event DEPENDE desta tag quebrada
- **Ação necessária**: Reescrever completamente esta tag (ver plano de ação)

**2. Google Ads Remarketing com ID errado (tag 7)**
- Tag usa: `AW-1203384992`
- Conta real: `AW-18143771674`
- Remarketing está enviando dados para conta errada (possivelmente inativa/antiga)

**3. Duplo GA4 — tags 5 (G-59WWJQN34P) e 11 (G-1411Z6YVPY) ambas em Initialization All Pages**
- Ambas disparam em toda página do smartdent.com.br
- G-59WWJQN34P: vinculado ao BigQuery, fluxo configurado para smartdent.com.br
- G-1411Z6YVPY: usado em todos os eventos (purchase, leads, e-commerce)
- Relação entre as duas propriedades precisa ser esclarecida

---

### Container 2: GTM-MNPGDCH (loja.smartdent.com.br) — v40

**Conta GTM**: 1762238297 | Container: 7477467

#### Tags — Status completo

| Tag ID | Nome | GA4 / Config | Gatilho | Status |
|--------|------|--------------|---------|--------|
| 28 | Tag GA4 - Evento Compra (Purchase) UNIFICADO | G-1411Z6YVPY | CE - purchase | ✅ Ativo |
| 29 | GA4 - Tag do Google (Base Unificada) | G-1411Z6YVPY | Initialization All Pages | ✅ Ativo |
| 46 | FB_CONVERSIONS_API-167413567155597-Web-Tag-GA4_Config | **G-1411Z6YVPY** | DOM Ready | ✅ Ativo |
| 47 | FB_CONVERSIONS_API-167413567155597-Web-Tag-GA4_Event | **G-LJ7X8G61N4** ⚠️ | DOM Ready + Custom | ✅ Ativo |
| 48 | FB_CONVERSIONS_API-167413567155597-Web-Tag-Pixel_Event | fbq Purchase | CE - purchase | ✅ Ativo |
| 49 | FB_CONVERSIONS_API-167413567155597-Web-Tag-Pixel_Setup | Pixel 167413567155597 | DOM Ready | ✅ Ativo |
| 50 | FB_CONVERSIONS_API-167413567155597-Web-Tag-ParamBuilder | capiParamBuilder | DOM Ready | ✅ Ativo |
| 59 | TT-D05CI83C77UE5QUU9FR0-Web-Tag-GA4_Config | G-1411Z6YVPY | All Pages (consent) | ✅ Ativo |
| 60 | TT-D05CI83C77UE5QUU9FR0-Web-Tag-Pixel_Setup | TikTok D05CI83C77UE5QUU9FR0 | All Pages (consent) | ✅ Ativo |
| 61 | TT-D05CI83C77UE5QUU9FR0-Web-Tag-GA4_Event | G-1411Z6YVPY | CE - TT events | ✅ Ativo |
| 62 | TT-D05CI83C77UE5QUU9FR0-Web-Tag-Pixel_Event | TikTok events | CE - TT events | ✅ Ativo |
| 66 | Meta Pixel - PageView (Loja) | fbq PageView | SD - Todas as Paginas | ⚠️ **PAUSADA** |
| 67 | GA4 - Page View (Loja) | G-1411Z6YVPY | SD - Todas as Paginas | ✅ Ativo |
| 68 | TikTok Pixel - PageView (Loja) | ttq.page() | SD - Todas as Paginas | ✅ Ativo |

#### Novos achados — MNPGDCH

**TikTok Pixel identificado**: `D05CI83C77UE5QUU9FR0` — não estava no diagnóstico anterior
- Pixel setup, evento GA4 e Pixel Event configurados
- TikTok Events API (server-side) configurada
- Event name mapper: purchase→PlaceAnOrder, add_to_cart→AddToCart, begin_checkout→InitiateCheckout, view_item→ViewContent, generate_lead→SubmitForm, parameter_card_view→ViewContent, parameter_copied→ClickButton

**GA4 ID fantasma**: `G-LJ7X8G61N4` aparece apenas em tag 47 (FB_CONVERSIONS_API-167413567155597-Web-Tag-GA4_Event)
- Diferente do G-1411Z6YVPY usado no resto da loja
- Possível ID antigo ou de outra propriedade — verificar

**Universal Analytics (morto)**: variável `Analytics` com `UA-69042627-2` — código legado que pode ser removido

#### Mapeamento de eventos TikTok (loja)

| GA4 Event | TikTok Event |
|-----------|-------------|
| purchase | PlaceAnOrder |
| add_to_cart | AddToCart |
| begin_checkout | InitiateCheckout |
| view_item | ViewContent |
| generate_lead | SubmitForm |
| parameter_card_view | ViewContent |
| parameter_copied | ClickButton |

---

### Container 3: GTM-MFN4T8P4 (Server-Side) — v19

**Conta GTM**: 6315186944 | Container: 235374934
**URL**: https://server-side-tagging-eeaflmcg6a-uc.a.run.app

#### Tags server-side

| Tag ID | Nome | Plataforma | Pixel/Token | Gatilho | Status |
|--------|------|------------|-------------|---------|--------|
| 19 | FB_CONVERSIONS_API-167413567155597-Server-Tag | Meta CAPI | 167413567155597 | ALWAYS (todos eventos) | ✅ Ativo |
| 24 | FB_CONVERSIONS_API-837797892060098-Server-Tag | Meta CAPI | 837797892060098 | ALWAYS (todos eventos) | ✅ Ativo |
| 22 | TT-D05CI83C77UE5QUU9FR0-Server-Tag-EAPI_Event | TikTok EAPI | D05CI83C77UE5QUU9FR0 | ALWAYS (todos eventos) | 🔴 **DEBUG MODE** |

**Cookies server-side**: fbp, _fbc, ud.em (email hashed), e outros

**🔴 CRÍTICO — TikTok Server-Side em modo DEBUG**:
- `logType: "debug"` → TikTok não está processando eventos para targeting/atribuição
- Está apenas registrando logs
- **Ação**: Alterar para `logType: "production"` no container server-side

**Tokens de API (server-side)**:
- Meta CAPI 167413567155597: `EAAHspQOb2HMBQ7PyND3...` (token ativo)
- Meta CAPI 837797892060098: `EAAHspQOb2HMBRb9BqDs...` (token ativo)
- TikTok EAPI: `15b2eb4649f7b3680e40f5f8331a5ed33e3a9c08`

---

### Resumo de IDs GA4 identificados nos containers

| Measurement ID | Onde aparece | Papel |
|----------------|-------------|-------|
| G-1411Z6YVPY | NZ64Q899 (Base Unificada, todos eventos) + MNPGDCH (todos eventos) | Principal — tracking de conversões |
| G-59WWJQN34P | NZ64Q899 (Global) + server-side config | Institucional — vinculado ao BigQuery |
| G-LJ7X8G61N4 | MNPGDCH tag 47 apenas | ⚠️ Desconhecido — verificar/remover |

---

### Plano de Correção GTM — Ordem de Execução

#### Fix 1: Reescrever "LI - Capturar User Data" (URGENTE — desbloqueador)

A tag atual está quebrada pois usa variáveis LI (`{customer_email}`) que não funcionam em GTM.
O LI Purchase Tracker v6.0 já envia `user_data.email_address` com o evento purchase.
**Solução**: Remover o `setupTag` da tag Purchase OU mover a coleta de user_data para dentro do trigger do evento purchase.

Tag correta para substituir:
```html
<script>
// Lê user_data já populado pelo LI Purchase Tracker v6.0 via li_purchase event
// Se não disponível, tenta ler do formulário da página
(function() {
  var ud = window.dataLayer && window.dataLayer.reduce(function(acc, item) {
    return item.user_data ? item.user_data : acc;
  }, null);
  if (!ud) {
    var emailEl = document.querySelector('input[name="email"], input[type="email"]');
    if (emailEl && emailEl.value) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ user_data: { email_address: emailEl.value } });
    }
  }
})();
</script>
```
Esta tag deve estar no container MNPGDCH (loja), não NZ64Q899.

#### Fix 2: Corrigir Google Ads Remarketing ID (5 min)
- Tag 7 em NZ64Q899: mudar `AW-1203384992` → `AW-18143771674`

#### Fix 3: TikTok Server-Side — sair de DEBUG (5 min)
- Tag 22 em MFN4T8P4: mudar `logType: "debug"` → `logType: "no_logging"` (produção)

#### Fix 4: Investigar G-LJ7X8G61N4 (10 min)
- Tag 47 em MNPGDCH usa este ID desconhecido
- Verificar no GA4 se existe esta propriedade
- Provavelmente substituir por G-1411Z6YVPY

#### Fix 5: Reativar "Meta Pixel - PageView (Loja)" em MNPGDCH (5 min)
- A tag 66 está pausada mas o fbq já está inicializado pela tag 49 (Pixel_Setup)
- Reativar para garantir PageView em todas as páginas da loja

---

## 7. GOOGLE ADS

**Customer ID**: 124-215-5423
**Nome**: Smart Dent - 2026
**Email**: smartdentcadcam@gmail.com
**Status**: Ativa ⚠️ (verificar se há suspensão oculta — Merchant Center indica suspensão)

### Campanhas

| # | Campanha | Tipo | Orçamento/dia | Status |
|---|----------|------|---------------|--------|
| 1 | Campaign_Resina_3D_Vitality — Geração de Demanda | Geração de demanda | R$ 30,00 | Pausada |
| 2 | Campaign_Resina_3D_Vitality — Display | Display | R$ 10,00 | Pausada — anúncios limitados por política |
| 3 | Resina 3D — Bio Bite Splint +Flex | Pesquisa | R$ 30,00 | Pausada 🔴 Limitada pelo orçamento |
| 4 | Campaign_Resina_3D_Vitality — Busca | Pesquisa | R$ 10,00 | Pausada |
| 5 | Campaign_Resina_3D_Bio_Vitality | Pesquisa | R$ 10,00 | Pausada |
| 6 | Campaign_Resina_3D_Smart_Print_Bio_Bite_Splint+Flex | Pesquisa | R$ 10,00 | Pausada |
| 7 | Campaign_Resina_3D_Bio_Vitality | Pesquisa | R$ 60,00 | **Removida** |
| 8 | Campanha 6078 Loja Integrada | Performance Max | R$ 25,00 | Pausada |
| 9 | Campanha 9374 Loja Integrada | Performance Max | R$ 25,00 | Pausada |

- **Orçamento total alocado**: R$ 210,00/dia
- **Gasto no período** (06/05–08/06/2026): R$ 2.363,40
- **Conversões rastreadas**: 0,00

### Anúncios reprovados

| Anúncio | Campanha | Motivo |
|---------|----------|--------|
| BioVitality_Video_20s | Geração de Demanda | "Não qualificada" — Política de Saúde Especializada |
| [Display] Bio Vitality | Display | "Não qualificada" — Política de Saúde Especializada |

### Conversões configuradas (7 ações)

| Ação | Origem | Status | Principal |
|------|--------|--------|-----------|
| Loja Smart Dent - GA4 (web) | GA4 | ✅ Ativa | ✅ |
| Default Conversion Action | Site | ❌ Inativo | ✅ |
| Visualização de página loja | GA4 | ✅ Ativa | ✅ |
| Local actions - Directions | Google | ✅ Ativa | ✅ |
| YouTube channel subscriptions | YouTube | ✅ Ativa | ✅ |
| Local actions - Other engagements | Google | ✅ Ativa | ✅ |
| YouTube follow-on views | YouTube | ✅ Ativa | ✅ |

### Vinculações de conta

| Produto | Status | Qtd |
|---------|--------|-----|
| Google Analytics 4 | ✅ Ativa | 2 vinculações |
| Google Business Profile | ✅ Ativa | 2 vinculações |
| Google Merchant Center | ✅ Ativa | 1 vinculação |
| Business Manager | ✅ Ativa | 1 vinculação |

### Alertas críticos
- 🔴 "Não há anúncios sendo veiculados"
- 🔴 Sitelinks reprovados — revisar extensões
- 🟡 +3,2% de melhoria potencial com imagens nos anúncios
- 🟡 +5,7% com otimização de orçamentos
- ✅ Verificação do anunciante: completa (13/05/2026)

---

## 8. PLANO DE AÇÃO PRIORITÁRIO

### Cadeia de problemas (raiz → consequência)

```
[1] LI - Capturar User Data (GTM) PAUSADA
         ↓
[2] Purchase events sem email hash / user_data
         ↓
[3] Meta EMQ baixo (3.7–5.1/10) + GA4 sem conversões
         ↓
[4] Meta Ads ineficiente (CPL/CPA alto) + Google Ads sem dados de otimização
         ↓
[5] Merchant Center: 290 produtos reprovados (possível suspensão Ads)
         ↓
[6] R$ 0 de receita paga rodando
```

### Execução — Ordem de Prioridade

| # | Ação | Sistema | Impacto | Tempo |
|---|------|---------|---------|-------|
| 1 | Confirmar status real da conta Google Ads (suspensão oculta?) | Google Ads → Faturamento | Desbloqueador | 5 min |
| 2 | Reativar tag "LI - Capturar User Data" no GTM | GTM container LI | EMQ Meta +30-50% | 5 min |
| 3 | Reativar "Meta Pixel - Base" pausada | GTM GTM-NZ64Q899 | Deduplicação correta | 5 min |
| 4 | Identificar e remover/consolidar G-1411Z6YVPY (GA4 duplicado) | GTM + GA4 | Dados limpos | 15 min |
| 5 | Corrigir 2 anúncios rejeitados (política de saúde) | Google Ads | Permite reativar campanhas | 30 min |
| 6 | Corrigir sitelinks reprovados | Google Ads | Remove bloqueio de extensões | 15 min |
| 7 | Reativar campanhas (Pesquisa + PMax primeiro) | Google Ads | Gera tráfego pago | 10 min |
| 8 | Vincular Google Ads ao GA4 (0 vinculações atualmente) | GA4 → Integrações | Smart Bidding funciona | 10 min |
| 9 | Adicionar parametros.smartdent.com.br como domínio no fluxo GA4 | GA4 | Dados corretos | 5 min |
| 10 | Corrigir sitemap (47 erros) | GSC / Código | Indexação orgânica | 1h |
| 11 | Investigar e corrigir LCP 100% lento | Cloud Run / Vercel | Ranking SEO crítico | 2–4h |
| 12 | Corrigir sitemaps quebrados: mediti600, mediti700, smartdent.com.br | DNS/servidor | Indexação destes domínios | 1h |
| 13 | Configurar redirecionamentos 301 para 404s em massa | Servidores | Link equity | 2h |
| 14 | Revisar script COD SMA (referência "Moda Masculina") | LI HTML | Integridade do tema | 30 min |
| 15 | Avaliar instalação do app Meta Pixel nativo na LI (se disponível na loja) | Loja Integrada | EMQ +20% estimado | 10 min |
| 16 | Avaliar app GTM nativo na LI para substituir instalação manual | Loja Integrada | Reduz risco de deploy | 15 min |

### Metas após correções

| Métrica | Atual | Meta |
|---------|-------|------|
| Meta EMQ médio | 3.7–5.1/10 | 7.0+/10 |
| Google Ads conversões | 0 | Rastreamento funcional |
| Merchant Center produtos ativos | 0 | 290+ aprovados |
| GSC páginas indexadas | 1.270 | 2.000+ |
| LCP lento | 100% | <20% |
| Meta Pixel qualidade | BAIXA | ÓTIMA |

---

## MAPA DE IDs E IDENTIFICADORES

| Plataforma | ID | Observação |
|------------|-----|------------|
| GTM (site) | GTM-NZ64Q899 | Container principal www.smartdent.com.br |
| GTM (loja) | GTM-MNPGDCH | Container loja.smartdent.com.br |
| GTM (server-side) | GTM-MFN4T8P4 | Cloud Run GCP |
| GA4 Measurement ID | G-59WWJQN34P | Principal — vinculado ao BigQuery |
| GA4 ID desconhecido | G-1411Z6YVPY | ⚠️ Investigar qual propriedade |
| GA4 Propriedade | 347862608 | Smart Dent Institucional |
| GA4 Conta | 172679486 | Smart Dent Institucional |
| Google Ads | AW-18143771674 | ⚠️ Verificar suspensão |
| Google Ads Label | 14KUCNSimbscEJr4z8tD | Conversão LI |
| Merchant Center | 445684234 | 290 produtos reprovados |
| Meta Pixel 1 | 167413567155597 | Principal (dataset) |
| Meta Pixel 2 | 837797892060098 | Secundário |
| Meta Business | 1946666208937443 | Smart Dent |
| BigQuery Projeto | smartdent-analytics-hub | ID: 703993304245 |
| GCP Projeto | gtm-mfn4t8p4-yjg4m | Cloud Run server-side |
| Cloud Run (proxy) | smartdent-bot-proxy | parametros.smartdent.com.br |
| Pinterest Verify | 78427e145f5669327e67500971c5d0d5 | Meta tag LI |
| FB Domain Verify | 2ke0xj70y5ybb2rh586dietv3lo8gn | App LI |
| TikTok Pixel | D05CI83C77UE5QUU9FR0 | Container loja (MNPGDCH) + server-side |
| TikTok Access Token | 15b2eb4649f7b3680e40f5f8331a5ed33e3a9c08 | Server-side EAPI |
| GA4 Desconhecido | G-LJ7X8G61N4 | ⚠️ Apenas em MNPGDCH tag 47 — verificar |
| UA (deprecated) | UA-69042627-2 | Variável morta em MNPGDCH |
| Ads Remarketing (ERRADO) | AW-1203384992 | Tag 7 NZ64Q899 — deveria ser AW-18143771674 |

---

---

## 9. DEBUG AO VIVO — COMPRA REAL (Pedido 2602)

**Data**: 2026-06-09 | **Página**: `loja.smartdent.com.br/checkout/2602/finalizacao`
**Pedido de teste**: R$10 | Item: "Teste2" (item_id: 378571260)

### Eventos disparados — confirmados ao vivo

#### ✅ Purchase GA4 — FUNCIONANDO
```
event: "purchase"
sd_event_id: "407a5a00-ab32-4eb0-8776-a4e051bae7d0"
user_data: { email_address: "danilohen@gmail.com" }
transaction_id: "2602"
value: 10
currency: "BRL"
event_id: "b834ab58-2004-4185-a3b7-6409011492b5"
tid: G-1411Z6YVPY → servidor: server-side-tagging-eeaflmcg6a-uc.a.run.app
```
**O user_data com email está chegando** — vem do LI Purchase Tracker v6.0, não da tag "LI - Capturar User Data" (que está parada e não é necessária).

#### ✅ Google Ads Enhanced Conversions — FUNCIONANDO
```
"Sending Google Ads hit"
tid: G-1411Z6YVPY
oid: 2602
value: 10
currency_code: BRL
gclaw: Cj0KCQjwp7jO... (gclid presente — usuário veio de clique pago)
evnid: b834ab58-2004-4185-a3b7-6409011492b5
item: (10*1*378571260**)
em: tv.1~em.gGdWU8rISTb_S_6dP69JhvwFYECsGzMN9gYyknflTww (email hash!)
```
Enhanced Conversions com email hashed enviando para Google Ads ✅

#### ✅ TikTok PlaceAnOrder — FUNCIONANDO
```
event: "PlaceAnOrder"
user_data: { email_address: "danilohen@gmail.com" }
value: 10 | currency: BRL
event_id: "407a5a00-ab32-4eb0-8776-a4e051bae7d0"
tt_contents: [{ item_id, item_name, price, quantity }]
→ server-side: server-side-tagging-eeaflmcg6a-uc.a.run.app
```

### GA4 IDs identificados disparando na página (debug ao vivo)

| Measurement ID | Eventos | Observação |
|----------------|---------|------------|
| G-1411Z6YVPY | page_view, **purchase**, PlaceAnOrder (TT) | ✅ Principal — Enhanced Conv funcionando |
| G-LJ7X8G61N4 | gtm.dom (como "PageView" com dados purchase) | FB CAPI passthrough confirmado |
| G-59WWJQN34P | page_view | ✅ Institucional (BigQuery) |
| G-GXQP9MMK73 | page_view, scroll | ⚠️ Origem desconhecida |
| G-6XFYNQZ1JV | page_view | ⚠️ Origem desconhecida |
| G-LW7Y4JE568 | page_view | ⚠️ Origem desconhecida |
| G-GC471H5WCP | page_view | ⚠️ Origem desconhecida |
| G-R0Q68Y04MV | page_view, scroll | ⚠️ Origem desconhecida |

**8 propriedades GA4 diferentes recebendo hits na página de finalização** — as 5 desconhecidas (G-GXQP9MMK73, G-6XFYNQZ1JV, G-LW7Y4JE568, G-GC471H5WCP, G-R0Q68Y04MV) provavelmente vêm do servidor GTM server-side que roteia para sub-propriedades ou são IDs de parceiros (Facebook CAPI automation, TikTok EAPI automation).

### Estado do user_data no carregamento da página

```
user_data: undefined  ← na config inicial (esperado — usuário ainda não identificado)
```
Torna-se disponível apenas quando o evento `purchase` é disparado pelo LI Purchase Tracker.

### Conclusão do debug ao vivo

| Aspecto | Status | Observação |
|---------|--------|------------|
| Purchase GA4 | ✅ Funcionando | user_data com email presente |
| Google Ads Enhanced Conv | ✅ Funcionando | email hash + gclid + valor |
| TikTok PlaceAnOrder | ✅ Funcionando | user_data presente |
| Meta Purchase (fbq) | ❓ Não aparece no debug | Verificar se fbq disparou fora do log |
| "LI - Capturar User Data" | ✅ Não necessária | Email vem do LI tracker diretamente |
| EMQ Meta baixo | 🔴 Ainda problema | Não é falta de email — outra causa |

*Arquivo gerado automaticamente pela sessão Claude Code — 2026-06-09*
*Próxima atualização: adicionar dados de GEO/Schema.org quando disponíveis*
