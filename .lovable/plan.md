## Fase 3 — Autoridade Global: Schema rico, backlinks bidirecionais, RAG e argumentação comercial

Fases 1 e 2 já entregaram páginas SSR por país/distribuidor, sitemap, llms.txt, selo PNG e Kit de Divulgação multilíngue. Esta fase fecha a teia de autoridade semântica que você descreveu.

---

### 1. Schema.org enriquecido (LocalBusiness + Brand + Wikidata)

**Onde:** `src/pages/DistributorDetailPage.tsx` e `supabase/functions/seo-proxy/index.ts` (renderizador de distribuidor, hoje em ~linha 2333).

**Mudanças no JSON-LD de cada distribuidor:**

- `brand` e `parentOrganization` ganham `sameAs: ["https://www.wikidata.org/wiki/Q138636902"]` — amarra cada distribuidor à entidade Smart Dent já validada no Wikidata.
- `areaServed` deixa de ser uma string e passa a ser um array de objetos `AdministrativeArea` (país + cidades/estados/regiões cadastradas), alimentado por uma nova coluna `service_areas jsonb` em `distributors` (ver §4).
- `makesOffer` lista cada linha autorizada (SmartMake, Vitality, NanoClean, etc.) como `Offer` com `itemOffered.brand` Smart Dent → treina IAs a responder "onde comprar Vitality nos EUA".
- `knowsAbout` mapeia o `authorized_scope` para as entidades já existentes em `ENTITY_INDEX` do seo-proxy (CAD/CAM, Impressão 3D, Resina Composta…) com seus respectivos Wikidata IDs.
- Hub global `/distribuidores` ganha um `Organization` Smart Dent com `subOrganization` listando todos os distribuidores ativos + `sameAs` Wikidata — consolida a visão "fabricante com capilaridade global".

**Página do hub `/distribuidores/{pais}`:** acrescentar `Place` com `containedInPlace` (continente) para reforçar contexto geográfico.

---

### 2. Backlinks bidirecionais rastreáveis

**Objetivo do Fábio:** transformar o item "linkar de volta para smartdent.com.br" em obrigação contratual verificável.

**Entregas:**

- Nova coluna `backlink_url text` + `backlink_verified_at timestamptz` + `backlink_status text` em `distributors`.
- Edge function `verify-distributor-backlink` (cron diário): para cada distribuidor com `site_url`, faz fetch da home, procura por `smartdent.com.br` (qualquer URL), grava status (`found` / `missing` / `unreachable`) e a URL exata encontrada. Sem scraping invasivo — só HEAD + GET da raiz e da `/about`/`/sobre`.
- Painel em `SmartOpsDistributors`: badge verde/amarelo/vermelho por distribuidor com tooltip da última verificação. Lista "Distribuidores sem backlink" para o Fábio cobrar.
- No Kit de Divulgação (já entregue na Fase 2) adicionar um 4º snippet: **logo Smart Dent linkado** (HTML pronto) com `rel="noopener"` e UTM `?utm_source=distribuidor&utm_medium=backlink&utm_campaign={slug}` — para rastrear tráfego real no GA.

---

### 3. Integração com a Dra. LIA (RAG em tempo real)

A LIA hoje não tem contexto de distribuidores. Quando um lead internacional pergunta "onde comprar Vitality no Chile?", ela responde genericamente.

**Entrega:** novo bloco de contexto injetado no system prompt da Dra. LIA (em `supabase/functions/dra-lia/index.ts`), seguindo o mesmo padrão de `Dynamic Context Enrichment` já existente.

- Detector de intenção `where_to_buy` (regex: "where can i buy", "donde comprar", "onde comprar", "distribuidor", "comprar em/no/na", nome de país).
- Quando dispara, faz `SELECT * FROM distributors WHERE active = true AND (pais ILIKE '%{pais}%' OR service_areas @> '...')` e injeta um bloco markdown:
  ```
  ## Distribuidores oficiais relevantes
  - {nome} — {cidade/país} — WhatsApp +{ddi}{tel} — {site} — linhas: {scope}
    Página oficial: {canonical}
  ```
- Se não houver distribuidor no país: resposta padrão "atendemos via export direto" + link `/distribuidores` + e-mail do Fábio.
- Caching leve: lista de distribuidores em memória da edge function por 5 min (já há padrão de cache nas outras tools da LIA).

Sem alterar o fluxo de qualificação progressiva — só enriquece o contexto.

---

### 4. Captura ampliada no formulário público

Para alimentar o schema rico, o formulário `PublicDistributorRegister` e o `DistributorForm` interno ganham:

- `service_areas` (multi-input): países + estados/províncias + cidades que o parceiro cobre. Render como tags.
- `linhas_representadas` (multi-select a partir de `system_a_catalog`): SmartMake, Vitality, NanoClean, kits, etc. — alimenta `makesOffer`.
- `wikidata_id` (opcional, só admin): caso o distribuidor já tenha entidade própria.
- `language_preference` (pt/es/en): usado pelo seo-proxy para escolher a `inLanguage` da página.

Migração SQL:
```sql
ALTER TABLE public.distributors
  ADD COLUMN service_areas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN linhas_representadas text[] DEFAULT '{}',
  ADD COLUMN wikidata_id text,
  ADD COLUMN language_preference text DEFAULT 'pt',
  ADD COLUMN backlink_url text,
  ADD COLUMN backlink_status text,
  ADD COLUMN backlink_verified_at timestamptz;
```
RLS atual em `distributors` permanece (2 policies já existentes). Grants já existem.

---

### 5. One-pager comercial para o Fábio

Novo arquivo `docs/PITCH_DISTRIBUIDORES_FABIO.md` (markdown puro, fácil de imprimir ou colar em PDF) com:

1. **4 argumentos de venda** já redigidos na sua mensagem (visibilidade imediata, controle de portfólio, fim do gargalo TI/marketing, bônus B2B), reescritos em linguagem direta para uso em ligação/proposta.
2. **Roteiro de e-mail** PT/ES/EN pronto para o Fábio mandar ao distribuidor pedindo o preenchimento + a contrapartida do backlink.
3. **Checklist de onboarding do distribuidor** (formulário preenchido → página publicada → selo instalado → backlink verificado).
4. **Métricas de sucesso** que o Fábio pode mostrar internamente: nº de páginas indexadas, nº de backlinks verificados, queries de IA respondidas, tráfego inbound dos sites parceiros (via UTM).

Sem rota nova no app — é um documento interno consumível por humanos.

---

### Arquivos tocados

- `supabase/migrations/` — 1 migração nova (colunas adicionais).
- `src/pages/DistributorDetailPage.tsx` — schema enriquecido + `inLanguage`.
- `src/pages/DistributorCountryPage.tsx` — `Place`/`containedInPlace`.
- `supabase/functions/seo-proxy/index.ts` — mesmo schema enriquecido no SSR.
- `supabase/functions/llms-full-txt/index.ts` — incluir `makesOffer`/`service_areas` no bloco markdown.
- `supabase/functions/verify-distributor-backlink/index.ts` — nova edge function + cron.
- `supabase/functions/dra-lia/index.ts` — bloco `where_to_buy` no system prompt.
- `src/components/smartops/DistributorForm.tsx` + `PublicDistributorRegister.tsx` — novos campos.
- `src/components/smartops/SmartOpsDistributors.tsx` — badge de backlink + filtro "sem backlink".
- `src/components/smartops/DistributorKitDialog.tsx` — 4º snippet (logo Smart Dent com UTM).
- `docs/PITCH_DISTRIBUIDORES_FABIO.md` — one-pager.

### Fora de escopo

- Submissão automática a Wikidata (manual via curador).
- Google Business Profile OAuth (continua adiada).
- Tradução completa das páginas de distribuidor para EN/ES (apenas `inLanguage` + bloco de descrição traduzido; UI permanece PT por ora).
- Reescrita do fluxo de qualificação da Dra. LIA — só injeção de contexto.

### Validação

- `curl -A "Googlebot" /distribuidores/chile/biotech-chile` mostra `makesOffer`, `parentOrganization.sameAs` com Wikidata e `areaServed` como array.
- Rich Results Test aceita o LocalBusiness expandido.
- Edge function `verify-distributor-backlink` corre manualmente e popula `backlink_status` para os distribuidores atuais.
- Mensagem em PT/ES/EN "onde comprar resina no Chile" para a Dra. LIA retorna Biotech Chile com link canônico.
