# DIAGNÓSTICO COMPLETO — SMARTDENT
> Última atualização: 2026-06-08 | Compilado por Claude Code (sessão ativa)
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

## 6. GOOGLE TAG MANAGER (GTM)

### Container principal (site)
- **Container ID**: GTM-NZ64Q899
- **URL**: www.smartdent.com.br
- **Versão publicada**: 52 (publicada em 08/06/2026)

### Container Loja Integrada
- **Container ID**: GTM-MNPGDCH

### Container Server-Side
- **Container ID**: GTM-MFN4T8P4
- **URL servidor**: https://server-side-tagging-eeaflmcg6a-uc.a.run.app

### Tags — Status

| Tag | ID/Config | Status |
|-----|-----------|--------|
| GA4 - Tag Base Unificada | G-1411Z6YVPY | ⚠️ Investigar origem |
| GA4 - Tag Global | G-59WWJQN34P | ✅ Ativa |
| Meta Pixel | 837797892060098 | ✅ Ativa |
| FB Conversions API (3 tags) | 167413567155597 | ✅ Ativas |
| GA4 - Evento Lead | generate_lead | ✅ Ativa |
| GA4 - SPA Page View | parametros | ✅ Ativa |
| GA4 - Update User Properties | — | ✅ Ativa |
| Ads - Remarketing Global | — | ✅ Ativa |
| Ads - Vinculador de Conversões | — | ✅ Ativa |
| GA4 - Purchase UNIFICADO | — | ✅ Ativa |
| GA4 - add_to_cart/begin_checkout/view_item | — | ✅ Ativas |
| **Meta Pixel - Base** | — | ⚠️ **PAUSADA** |
| **LI - Capturar User Data** | — | ⚠️ **PAUSADA** |

### Gatilhos ativos
- Initialization - All Pages
- Custom Event
- DOM Ready
- Sucesso Lead (evento customizado)
- Compra E-commerce

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

---

*Arquivo gerado automaticamente pela sessão Claude Code — 2026-06-08*
*Próxima atualização: adicionar dados de GEO/Schema.org e configurações de TikTok/YouTube quando disponíveis*
