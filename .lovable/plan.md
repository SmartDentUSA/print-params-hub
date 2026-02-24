
# Auditoria e Refatoracao: Ferramentas SEO / GEO / Indexacao / IA Regenerativa

## Escopo auditado

22 edge functions + 8 componentes React + 5 sitemaps + robots.txt + vercel.json + llms.txt

---

## PROBLEMAS ENCONTRADOS

### 1. CORS incompletos (14 edge functions)

Todas as funcoes abaixo usam CORS sem os headers do Supabase client platform:

| Funcao | Linhas |
|---|---|
| `seo-proxy/index.ts` | 3-6 |
| `ai-generate-og-image/index.ts` | 4-7 |
| `ai-metadata-generator/index.ts` | 5-7 |
| `ai-content-formatter/index.ts` | 5-8 |
| `ai-orchestrate-content/index.ts` | 8-11 |
| `enrich-article-seo/index.ts` | 5-8 |
| `reformat-article-html/index.ts` | 5-8 |
| `auto-inject-product-cards/index.ts` | 4-7 |
| `translate-content/index.ts` | 4-7 |
| `backfill-keywords/index.ts` | 4-7 |
| `generate-sitemap/index.ts` | 3-6 |
| `generate-knowledge-sitemap/index.ts` | 3-6 |
| `generate-documents-sitemap/index.ts` | 3-6 |
| `generate-knowledge-sitemap-en/index.ts` | CORS incompleto (verificar) |
| `generate-knowledge-sitemap-es/index.ts` | CORS incompleto (verificar) |

**Correcao:** Padronizar para:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### 2. URLs hardcoded para projeto Supabase errado (`pgfgripuanuwwolmtknn`)

Encontradas **45 referencias** ao projeto `pgfgripuanuwwolmtknn` em 3 funcoes:

| Funcao | Tipo | Linha | Impacto |
|---|---|---|---|
| `seo-proxy/index.ts` | Logo URL (7x) | 133, 482, 566, 672, 822, 1039, 1605 | Referencia a storage de outro projeto para logo |
| `sync-knowledge-base/index.ts` | API URL | 65 | Busca knowledge-base de projeto errado |
| `index-embeddings/index.ts` | API URL | 16 | Busca knowledge-base de projeto errado |

**Analise critica:**
- As URLs de logo (`/storage/v1/object/public/product-images/...`) apontam para o storage do projeto `pgfgripuanuwwolmtknn`. Se a imagem existir la, funciona. Mas e fragil pois depende de outro projeto.
- As URLs de API (`/functions/v1/knowledge-base`) nas funcoes `sync-knowledge-base` e `index-embeddings` buscam dados de um projeto diferente, similar ao bug ja corrigido na `dra-lia`.

**Correcao para APIs:**
```typescript
// sync-knowledge-base/index.ts (linha 65)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const apiUrl = new URL(`${SUPABASE_URL}/functions/v1/knowledge-base`);

// index-embeddings/index.ts (linha 16)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const EXTERNAL_KB_URL = `${SUPABASE_URL}/functions/v1/knowledge-base`;
```

**Correcao para Logo no seo-proxy:**
Extrair a URL do logo para uma constante no topo do arquivo. Se o storage do projeto correto tiver a mesma imagem, usar `${SUPABASE_URL}/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png`. Caso contrario, manter a URL atual como fallback (a imagem ja existe no outro projeto e funciona).

**Decisao recomendada:** Manter a URL do logo como esta (funcional) e corrigir apenas as APIs. Migrar a imagem pode ser feito depois.

### 3. `seo-proxy/index.ts` - Publisher Schema com logo hardcoded

Na funcao `buildPublisherSchema` (linha 133), o logo usa URL do projeto errado:
```typescript
"url": "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
```

**Correcao:** Usar constante LOGO_URL no topo do arquivo para facilitar manutencao futura.

### 4. Sitemaps: `generate-knowledge-sitemap-en` e `generate-knowledge-sitemap-es`

Precisam verificacao de CORS (nao foram lidos em detalhe, mas seguem o mesmo padrao das outras funcoes).

### 5. `robots.txt` - Referencia a sitemap de documentos

O robots.txt referencia `generate-documents-sitemap` que esta correto e funcional. Todas as 5 entradas de Sitemap estao consistentes:
- generate-sitemap (principal)
- generate-knowledge-sitemap (PT)
- generate-knowledge-sitemap-en (EN)
- generate-knowledge-sitemap-es (ES)
- generate-documents-sitemap (PDFs)

**Status: OK** - nenhuma correcao necessaria.

### 6. `vercel.json` - Rewrite de seo-proxy

A regex de user-agent no vercel.json esta correta e cobre todos os bots listados em `seo-proxy/index.ts`. **Status: OK**.

### 7. Componentes React SEO - Verificacao

| Componente | Status |
|---|---|
| `SEOHead.tsx` | OK - usa baseUrl correto |
| `AboutSEOHead.tsx` | OK |
| `KnowledgeSEOHead.tsx` | OK |
| `TestimonialSEOHead.tsx` | OK |
| `OrganizationSchema.tsx` | OK |
| `VideoSchema.tsx` | OK |
| `ArticleMeta.tsx` | OK |

**Status: OK** - sem alteracoes necessarias nos componentes React.

---

## PLANO DE CORRECOES

### Prioridade 1 - Bug fix (APIs apontando para projeto errado)

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/sync-knowledge-base/index.ts` | Usar `SUPABASE_URL` env var em vez de URL hardcoded (linha 65) |
| `supabase/functions/index-embeddings/index.ts` | Usar `SUPABASE_URL` env var em vez de URL hardcoded (linha 16) |

### Prioridade 2 - Padronizacao CORS (14 funcoes)

Atualizar `corsHeaders` em todas as 14 funcoes listadas na secao 1 para incluir os headers completos do Supabase client.

Funcoes a atualizar:
1. `seo-proxy/index.ts`
2. `ai-generate-og-image/index.ts`
3. `ai-metadata-generator/index.ts`
4. `ai-content-formatter/index.ts`
5. `ai-orchestrate-content/index.ts`
6. `enrich-article-seo/index.ts`
7. `reformat-article-html/index.ts`
8. `auto-inject-product-cards/index.ts`
9. `translate-content/index.ts`
10. `backfill-keywords/index.ts`
11. `generate-sitemap/index.ts`
12. `generate-knowledge-sitemap/index.ts`
13. `generate-documents-sitemap/index.ts`
14. `generate-knowledge-sitemap-en/index.ts`
15. `generate-knowledge-sitemap-es/index.ts`

### Prioridade 3 - Constante LOGO_URL no seo-proxy

Extrair a URL do logo para uma constante `LOGO_URL` no topo do `seo-proxy/index.ts` para facilitar manutencao futura. A URL continua apontando para o projeto `pgfgripuanuwwolmtknn` onde a imagem existe.

### Deploy

Apos as correcoes, deploy de todas as funcoes modificadas.

---

## RESUMO

| Tipo | Quantidade | Impacto |
|---|---|---|
| APIs apontando para projeto errado | 2 funcoes | Alto - dados de outro projeto |
| CORS incompletos | ~15 funcoes | Medio - pode causar falha em clients Supabase |
| Logo hardcoded (outro projeto) | 7 ocorrencias | Baixo - funciona mas fragil |
| Componentes React | 0 problemas | OK |
| Sitemaps/robots.txt | 0 problemas | OK |
| vercel.json | 0 problemas | OK |
