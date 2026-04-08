

## Rebranding de Meta Tags: "PrinterParams" → "Smart Dent | Fluxo Digital"

### Problema

Todos os HTML do sistema usam branding antigo "PrinterParams Smart Dent" com descrições focadas apenas em "parâmetros de impressão". O novo posicionamento é **"Smart Dent | Fluxo Digital"** com foco em fluxo digital odontológico completo. Além disso, o footer do formulário público tem dados hardcoded errados (CNPJ, endereço).

### Arquivos afetados (9 arquivos)

**1. `index.html`**
- Linha 6: title → `"Hub de Fluxo Digital e Parâmetros 3D | Smart Dent"`
- Linha 7: description → nova description sobre fluxo digital
- Linha 8: keywords → novos keywords
- Linha 40: apple-mobile-web-app-title → `"Smart Dent"`
- Linhas 142-152: Substituir todos os OG/Twitter tags pelos novos valores fornecidos (og-fluxo-digital.jpg)

**2. `src/components/SEOHead.tsx`**
- Linha 156: title default → `"Hub de Fluxo Digital e Parâmetros 3D | Smart Dent"`
- Linha 157: description default → nova
- Linha 644: `og:site_name` → `"Smart Dent | Fluxo Digital"`
- Twitter tags mantêm o padrão dinâmico mas com site_name atualizado

**3. `src/components/KnowledgeSEOHead.tsx`**
- Linhas 416, 458, 1095: `og:site_name` → `"Smart Dent | Fluxo Digital"`

**4. `src/components/AboutSEOHead.tsx`**
- Linha 123: `og:site_name` → `"Smart Dent | Fluxo Digital"`
- OG image fallback → `og-fluxo-digital.jpg`

**5. `src/components/TestimonialSEOHead.tsx`**
- Linha 172: `og:site_name` → `"Smart Dent | Fluxo Digital"`

**6. `src/pages/ProductPage.tsx`**
- Linha 161: `og:site_name` → `"Smart Dent | Fluxo Digital"`

**7. `src/pages/CategoryPage.tsx`**
- Linha 112: `og:site_name` → `"Smart Dent | Fluxo Digital"`

**8. `src/components/SmartOpsFormBuilder.tsx`**
- Linha 387: `og:site_name` → `"Smart Dent | Fluxo Digital"`
- Linhas 390-393: Geo tags com dados errados (Florianópolis) → corrigir para São Carlos

**9. `supabase/functions/seo-proxy/index.ts`**
- Todas as referências a `og-image.jpg` → `og-fluxo-digital.jpg` como fallback
- Titles e descriptions do homepage generator → novo branding

**10. `src/pages/PublicFormPage.tsx` (footer hardcoded)**
- Linhas 608-668: Remover todos os fallbacks hardcoded errados (CNPJ, endereço, telefone). Renderizar condicionalmente apenas dados vindos do `company` (Sistema B)

### Dados do Sistema B (company)

Os dados corretos da empresa (endereço, telefone, social media) já vêm via `useCompanyData()` que lê `system_a_catalog` com `category = 'company_info'`. Os componentes já usam esse hook — o problema é apenas os **fallbacks hardcoded** e o **branding textual antigo**.

### Novos valores padrão

| Meta Tag | Valor |
|----------|-------|
| `og:site_name` | `Smart Dent \| Fluxo Digital` |
| `og:title` (homepage) | `Hub de Fluxo Digital e Parâmetros 3D \| Smart Dent` |
| `og:description` (homepage) | `Domine o fluxo digital odontológico: de parâmetros de impressão validados a estratégias de escaneamento e design. A inteligência que seu laboratório ou clínica precisam.` |
| `og:image` (fallback) | `https://parametros.smartdent.com.br/og-fluxo-digital.jpg` |
| `twitter:title` (homepage) | `Smart Dent: Inteligência em Fluxo Digital` |
| `twitter:description` (homepage) | `Sincronize resinas, impressoras e processos com os protocolos oficiais da Smart Dent.` |
| `description` (homepage) | `Central de conhecimento Smart Dent para o Fluxo Digital. Parâmetros de impressão 3D, guias de aplicação clínica e protocolos de alta performance para odontologia.` |
| `keywords` | `fluxo digital odontologia, smart dent, impressão 3d dental, parâmetros resina, cad/cam odontológico, produtividade dental, I.A. na Odontologia` |

### Escopo
- 10 arquivos alterados (search & replace em strings)
- 1 edge function redeployada (seo-proxy)
- Sem breaking changes — apenas texto e URLs de imagem OG

