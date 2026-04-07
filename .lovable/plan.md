

## Fix: L.I.A. deve usar links internos da base de conhecimento + integrar depoimentos

### Problemas identificados

**1. URLs erradas nos resultados de vídeo (lia-rag.ts, linha 154)**
Quando um vídeo tem `content_id`, a URL gerada é `${siteBaseUrl}/base-de-conhecimento/${v.content_id}` — usando o UUID do content e a rota errada (`base-de-conhecimento` em vez de `base-conhecimento`). Deveria resolver o `slug` e `category_letter` do artigo pai para montar `/base-conhecimento/{letter}/{slug}`.

**2. URLs erradas nos artigos do searchContentDirect (linha 166)**
Artigos usam `${siteBaseUrl}/base-de-conhecimento/${a.slug}` — rota errada e sem `category_letter`. Deveria ser `/base-conhecimento/{letter}/{slug}`.

**3. Depoimentos não existem no RAG**
A L.I.A. não busca depoimentos (`system_a_catalog` com `category = 'video_testimonial'`). Quando um lead pergunta sobre treinamentos, experiências de outros clientes ou se alguém na cidade dele comprou, a L.I.A. não tem como recomendar depoimentos com link interno (`/depoimentos/{slug}`).

**4. Copilot não utiliza conteúdos da base de conhecimento**
O Copilot deveria poder referenciar artigos, vídeos e depoimentos ao montar briefings e respostas.

### Correções

**Arquivo 1: `supabase/functions/_shared/lia-rag.ts`**

**1a. Fix URLs de vídeo (linha 143-158)**
No bloco de vídeos do `searchContentDirect`, quando o vídeo tem `content_id`, fazer JOIN com `knowledge_contents` para obter `slug` e `category_letter`:

```typescript
// Buscar vídeos COM artigo pai para resolver URL correta
const { data: videos } = await supabaseClient
  .from("knowledge_videos")
  .select("id, title, description, thumbnail_url, url, embed_url, content_id, panda_tags, knowledge_contents(slug, knowledge_categories(letter))")
  .textSearch("search_vector", tsQuery, { type: "plain", config: "portuguese" })
  .limit(5);

for (const v of videos) {
  let videoUrl = v.url || v.embed_url;
  if (v.content_id && v.knowledge_contents?.slug) {
    const letter = v.knowledge_contents.knowledge_categories?.letter?.toLowerCase() || '';
    videoUrl = letter 
      ? `${siteBaseUrl}/base-conhecimento/${letter}/${v.knowledge_contents.slug}`
      : `${siteBaseUrl}/base-conhecimento/${v.knowledge_contents.slug}`;
  }
  // ... rest unchanged, use videoUrl as url_interna
}
```

**1b. Fix URLs de artigos (linha 160-168)**
No bloco de artigos, adicionar JOIN com `knowledge_categories` para obter a letter:

```typescript
const { data: articles } = await supabaseClient
  .from("knowledge_contents")
  .select("id, title, excerpt, slug, category_id, knowledge_categories(letter)")
  .eq("active", true)
  .or(...)
  .limit(5);

// URL correta: /base-conhecimento/{letter}/{slug}
const letter = a.knowledge_categories?.letter?.toLowerCase() || '';
const url = letter 
  ? `${siteBaseUrl}/base-conhecimento/${letter}/${a.slug}` 
  : `${siteBaseUrl}/base-conhecimento/${a.slug}`;
```

**1c. Adicionar busca de depoimentos (novo bloco após resins, ~linha 189)**

```typescript
// Testimonials (depoimentos)
try {
  const { data: testimonials } = await supabaseClient
    .from("system_a_catalog")
    .select("id, name, slug, description, image_url, extra_data")
    .eq("category", "video_testimonial")
    .eq("active", true)
    .eq("approved", true)
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
    .limit(5);
  if (testimonials) {
    for (const t of testimonials) {
      results.push({
        source_type: "testimonial",
        similarity: 0.70,
        chunk_text: `DEPOIMENTO: ${t.name} — ${t.description?.slice(0, 300) || ""}`,
        metadata: {
          title: t.name,
          slug: t.slug,
          url_publica: `${siteBaseUrl}/depoimentos/${t.slug}`,
          thumbnail_url: t.image_url,
        },
      });
    }
  }
} catch (e) { console.warn("[searchContentDirect] Testimonials search failed:", e); }
```

**1d. Fix `searchByILIKE` (linha 47)**
Mesma correção de URL: usar `/base-conhecimento/{letter}/{slug}` em vez de `/base-conhecimento/${letter}/${slug}` (que já está correto — confirmar apenas consistência).

**1e. Adicionar detecção de intenção de depoimento no RAG principal**
No `searchKnowledge` ou no `searchContentDirect`, adicionar regex para detectar quando o lead quer social proof:

```typescript
const TESTIMONIAL_INTENT = /depoimento|testemunho|experi[êe]ncia|relato|quem (j[aá] )?comprou|na minha cidade|caso real|prova social|treinamento.*como [eé]|como foi/i;
```

Quando detectado, buscar depoimentos automaticamente.

**Arquivo 2: `supabase/functions/dra-lia/index.ts`**

**2a. Adicionar busca de depoimentos no pipeline principal (~linha 3314)**
Após o `searchContentDirect`, adicionar busca de depoimentos quando a intenção for detectada:

```typescript
const wantsTestimonials = TESTIMONIAL_INTENT.test(message) || 
  /treinamento|training|entrenamiento/i.test(message);

if (wantsTestimonials) {
  const testimonialResults = await searchTestimonials(supabase, message, SITE_BASE_URL);
  if (testimonialResults.length > 0) {
    allResults.push(...testimonialResults);
  }
}
```

**2b. Atualizar instrução do prompt (linha 3667)**
Adicionar regra para depoimentos:

```
21. Ao encontrar um DEPOIMENTO: Gere um link Markdown [📝 Ver depoimento](URL) 
    apontando para a página interna /depoimentos/{slug}. 
    Use depoimentos para responder perguntas sobre experiências de clientes, 
    treinamentos, resultados reais e prova social.
```

**Arquivo 3: `supabase/functions/_shared/lia-rag.ts`**

**3a. Exportar função `searchTestimonials`**

```typescript
export async function searchTestimonials(
  supabase: SupabaseClient, 
  message: string, 
  siteBaseUrl: string
) {
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 6);
  const searchPattern = `%${words.join("%")}%`;
  
  const { data } = await supabase
    .from("system_a_catalog")
    .select("id, name, slug, description, image_url, extra_data")
    .eq("category", "video_testimonial")
    .eq("active", true)
    .eq("approved", true)
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
    .limit(5);
  
  if (!data?.length) return [];
  
  return data.map(t => ({
    source_type: "testimonial",
    similarity: 0.72,
    chunk_text: `DEPOIMENTO DE CLIENTE: ${t.name}\n${t.description?.slice(0, 400) || ""}`,
    metadata: {
      title: t.name,
      slug: t.slug,
      url_publica: `${siteBaseUrl}/depoimentos/${t.slug}`,
      thumbnail_url: t.image_url,
    },
  }));
}
```

**3b. Atualizar `buildStructuredContext` (linha 498)**
Adicionar case para `testimonial`:

```typescript
case 'testimonial': articles.push(formatted); break;
// Ou criar seção separada:
// const testimonials: string[] = [];
// case 'testimonial': testimonials.push(formatted); break;
```

### Escopo

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/_shared/lia-rag.ts` | Fix URLs de vídeo e artigo, adicionar `searchTestimonials`, atualizar `buildStructuredContext` |
| `supabase/functions/dra-lia/index.ts` | Integrar busca de depoimentos, adicionar regra no prompt |

### Resultado
- Links de vídeo e artigo apontam para páginas internas corretas (`/base-conhecimento/{letter}/{slug}`)
- Depoimentos são buscados e recomendados quando o lead pergunta sobre experiências, treinamentos ou prova social
- Todos os links gerados pela L.I.A. levam para páginas internas do site
- O Copilot herda os mesmos dados via RAG compartilhado

