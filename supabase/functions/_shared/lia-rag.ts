/**
 * LIA RAG Pipeline — search functions for knowledge base, catalog, protocols,
 * parameters, articles, authors, company KB, and content direct search.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STOPWORDS_PT } from "./lia-guards.ts";

type SupabaseClient = ReturnType<typeof createClient>;

// ── Topic context re-ranking weights ──
export const TOPIC_WEIGHTS: Record<string, Record<string, number>> = {
  parameters: { parameter_set: 1.5, resin: 1.3, resin_document: 1.3, processing_protocol: 1.4, article: 0.9, video: 0.7, catalog_product: 0.5, company_kb: 0.3, author: 0.4, faq_autoheal: 0.8 },
  products:   { parameter_set: 0.4, resin: 1.4, resin_document: 1.5, processing_protocol: 1.2, article: 1.3, video: 1.0, catalog_product: 1.4, company_kb: 0.5, author: 0.6, faq_autoheal: 1.1 },
  commercial: { parameter_set: 0.2, resin: 0.8, resin_document: 1.0, processing_protocol: 0.3, article: 1.2, video: 0.8, catalog_product: 1.8, company_kb: 1.5, author: 1.0, faq_autoheal: 1.0 },
  support:    { parameter_set: 0.6, resin: 0.7, resin_document: 1.4, processing_protocol: 0.8, article: 1.3, video: 1.2, catalog_product: 0.5, company_kb: 0.4, author: 0.5, faq_autoheal: 1.2 },
};

export function applyTopicWeights<T extends { source_type: string; similarity: number }>(
  results: T[],
  topicContext: string | undefined | null
): T[] {
  if (!topicContext || !TOPIC_WEIGHTS[topicContext]) return results;
  const weights = TOPIC_WEIGHTS[topicContext];
  return results
    .map(r => ({ ...r, similarity: Math.min(r.similarity * (weights[r.source_type] ?? 1.0), 1.0) }))
    .sort((a, b) => b.similarity - a.similarity);
}

// ── ILIKE search on knowledge_contents ──
export async function searchByILIKE(supabase: SupabaseClient, query: string, siteBaseUrl: string) {
  const words = query.toLowerCase().replace(/[?!.,;:]/g, '').split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS_PT.includes(w)).slice(0, 6);
  if (!words.length) return [];
  const orFilter = words.map((w) => `title.ilike.%${w}%,excerpt.ilike.%${w}%,ai_context.ilike.%${w}%`).join(',');
  const { data } = await supabase.from('knowledge_contents').select('id, title, slug, excerpt, ai_context, category_id, knowledge_categories:knowledge_categories(letter)').eq('active', true).or(orFilter).limit(20);
  const sorted = (data || []).sort((a: { title: string }, b: { title: string }) => {
    const scoreA = words.filter(w => a.title.toLowerCase().includes(w)).length;
    const scoreB = words.filter(w => b.title.toLowerCase().includes(w)).length;
    return scoreB - scoreA;
  });
  return sorted.slice(0, 5).map((a: { id: string; title: string; slug: string; excerpt: string; ai_context: string | null; knowledge_categories: { letter: string } | null }) => {
    const letter = a.knowledge_categories?.letter?.toLowerCase() || '';
    const matchedWords = words.filter(w => a.title.toLowerCase().includes(w)).length;
    const similarityScore = words.length > 0 ? (matchedWords / words.length) * 0.4 + 0.1 : 0.15;
    return {
      id: a.id, source_type: 'article',
      chunk_text: `${a.title} | ${a.excerpt}${a.ai_context ? ' | ' + a.ai_context : ''}`,
      metadata: { title: a.title, slug: a.slug, category_letter: letter, url_publica: letter ? `${siteBaseUrl}/base-conhecimento/${letter}/${a.slug}` : null },
      similarity: similarityScore,
    };
  });
}

// ── Company KB text search ──
export async function searchCompanyKB(supabase: SupabaseClient, query: string, history: Array<{ role: string; content: string }>) {
  const combinedText = `${history.slice(-4).map(h => h.content).join(' ')} ${query}`;
  const words = combinedText.toLowerCase().replace(/[?!.,;:™]/g, '').split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS_PT.includes(w)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
  if (!words.length) return [];
  const orFilter = words.map(w => `title.ilike.%${w}%,content.ilike.%${w}%`).join(',');
  const { data } = await supabase.from('company_kb_texts').select('id, title, content, category, source_label').eq('active', true).or(orFilter).limit(3);
  if (!data?.length) return [];
  console.log(`[searchCompanyKB] Found ${data.length} results from company_kb_texts`);
  return data.map((d: { id: string; title: string; content: string; category: string; source_label: string | null }) => ({
    id: d.id, source_type: 'company_kb',
    chunk_text: `${d.title} | ${d.content.slice(0, 800)}`,
    metadata: { title: d.title, source_label: d.source_label },
    similarity: (() => {
      const titleWords = d.title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
      const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
      const matchCount = titleWords.filter((w: string) => queryWords.some((q: string) => w.includes(q) || q.includes(w))).length;
      return matchCount > 0 ? Math.min(matchCount / Math.max(titleWords.length, 1) * 0.4 + 0.3, 0.75) : 0.30;
    })(),
  }));
}

// ── Content Direct Search (with exact + FTS cache) ──
export const CONTENT_REQUEST_REGEX = /v[ií]deo|video|tutorial|assistir|watch|mostrar|documento|apostila|manual|artigo|publica[çc][ãa]o|material|conte[úu]do|explica[çc][ãa]o|tem algo sobre/i;

export async function searchContentDirect(
  supabaseClient: SupabaseClient,
  userMessage: string,
  siteBaseUrl: string,
  sessionId?: string,
  leadId?: string | null
): Promise<Array<{ source_type: string; similarity: number; chunk_text: string; metadata: Record<string, unknown> }>> {
  const queryNormalized = userMessage.toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éèê]/g, "e").replace(/[íìî]/g, "i")
    .replace(/[óòôõ]/g, "o").replace(/[úùû]/g, "u").replace(/[ç]/g, "c")
    .replace(/[^\w\s]/g, "").trim();

  const results: Array<{ source_type: string; similarity: number; chunk_text: string; metadata: Record<string, unknown> }> = [];

  // ETAPA 1: Cache check — exact first (UNIQUE index), FTS fallback
  try {
    const { data: exactHit } = await supabaseClient
      .from("agent_internal_lookups")
      .select("id, results_json, results_count, hit_count, last_hit_at")
      .eq("query_normalized", queryNormalized)
      .single();

    if (exactHit) {
      const hoursSinceHit = (Date.now() - new Date(exactHit.last_hit_at).getTime()) / 3600000;
      const isCacheValid = exactHit.results_count > 0
        ? hoursSinceHit < (24 * 30)
        : hoursSinceHit < 24;

      if (isCacheValid) {
        console.log(`[searchContentDirect] Cache EXACT HIT: ${exactHit.results_count} results (age: ${Math.round(hoursSinceHit)}h)`);
        supabaseClient.rpc("increment_lookup_hit", { lookup_id: exactHit.id }).then(() => {});
        return (exactHit.results_json as typeof results) || [];
      }
    }

    const tsQuery = queryNormalized.split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(" & ");
    if (tsQuery) {
      const { data: cached } = await supabaseClient
        .from("agent_internal_lookups")
        .select("id, results_json, results_count, hit_count, last_hit_at")
        .textSearch("query_normalized", tsQuery, { type: "plain", config: "simple" })
        .gte("last_hit_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("hit_count", { ascending: false })
        .limit(3);

      if (cached && cached.length > 0) {
        const best = cached.find(c => c.results_count > 0) || cached[0];
        const hoursSinceHit = (Date.now() - new Date(best.last_hit_at).getTime()) / 3600000;
        const isCacheValid = best.results_count > 0 ? hoursSinceHit < (24 * 30) : hoursSinceHit < 24;

        if (isCacheValid) {
          console.log(`[searchContentDirect] Cache FTS HIT: ${cached.length} entries, returning ${best.results_count} results`);
          supabaseClient.rpc("increment_lookup_hit", { lookup_id: best.id }).then(() => {});
          return (best.results_json as typeof results) || [];
        }
      }
    }
  } catch (e) {
    console.warn("[searchContentDirect] Cache check failed:", e);
  }

  // ETAPA 2: Direct table search
  const searchTerms = queryNormalized.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
  const searchPattern = `%${searchTerms.join("%")}%`;

  // Videos (FTS) — resolve internal URL via content parent
  try {
    const tsQuery = searchTerms.join(" & ");
    if (tsQuery) {
      const { data: videos } = await supabaseClient
        .from("knowledge_videos")
        .select("id, title, description, thumbnail_url, url, embed_url, content_id, panda_tags, knowledge_contents(slug, knowledge_categories(letter))")
        .textSearch("search_vector", tsQuery, { type: "plain", config: "portuguese" })
        .limit(5);
      if (videos) {
        for (const v of videos as any[]) {
          let videoUrl = v.url || v.embed_url;
          if (v.content_id && v.knowledge_contents?.slug) {
            const letter = v.knowledge_contents.knowledge_categories?.letter?.toLowerCase() || '';
            videoUrl = letter
              ? `${siteBaseUrl}/base-conhecimento/${letter}/${v.knowledge_contents.slug}`
              : `${siteBaseUrl}/base-conhecimento/${v.knowledge_contents.slug}`;
          }
          results.push({ source_type: "video", similarity: 0.75, chunk_text: `${v.title}${v.description ? ` — ${v.description.slice(0, 200)}` : ""}`, metadata: { title: v.title, thumbnail_url: v.thumbnail_url, url_interna: videoUrl, embed_url: v.embed_url, panda_tags: v.panda_tags } });
        }
      }
    }
  } catch (e) { console.warn("[searchContentDirect] Videos search failed:", e); }

  // Articles (ILIKE) — resolve category letter for correct URL
  try {
    const { data: articles } = await supabaseClient.from("knowledge_contents").select("id, title, excerpt, slug, category_id, knowledge_categories(letter)").eq("active", true).or(`title.ilike.${searchPattern},excerpt.ilike.${searchPattern}`).limit(5);
    if (articles) {
      for (const a of articles as any[]) {
        const letter = a.knowledge_categories?.letter?.toLowerCase() || '';
        const articleUrl = letter ? `${siteBaseUrl}/base-conhecimento/${letter}/${a.slug}` : `${siteBaseUrl}/base-conhecimento/${a.slug}`;
        results.push({ source_type: "article", similarity: 0.70, chunk_text: `${a.title} — ${a.excerpt?.slice(0, 200) || ""}`, metadata: { title: a.title, slug: a.slug, category_letter: letter, url_publica: articleUrl } });
      }
    }
  } catch (e) { console.warn("[searchContentDirect] Articles search failed:", e); }

  // Documents (ILIKE)
  try {
    const { data: docs } = await supabaseClient.from("catalog_documents").select("id, document_name, document_description, file_url, document_category").eq("active", true).or(`document_name.ilike.${searchPattern},document_description.ilike.${searchPattern}`).limit(5);
    if (docs) {
      for (const d of docs) {
        results.push({ source_type: "article", similarity: 0.65, chunk_text: `[DOCUMENTO] ${d.document_name}${d.document_description ? ` — ${d.document_description.slice(0, 200)}` : ""}`, metadata: { title: d.document_name, category: d.document_category, url_publica: d.file_url } });
      }
    }
  } catch (e) { console.warn("[searchContentDirect] Documents search failed:", e); }

  // Resins (ILIKE)
  try {
    const { data: resins } = await supabaseClient.from("resins").select("id, name, slug, clinical_indication, biocompatibility_class").ilike("name", searchPattern).limit(3);
    if (resins) {
      for (const r of resins) {
        results.push({ source_type: "resin", similarity: 0.70, chunk_text: `Resina ${r.name} — Indicação: ${r.clinical_indication || "uso geral"}. Biocompatibilidade: ${r.biocompatibility_class || "N/A"}`, metadata: { title: r.name, slug: r.slug, url_publica: `${siteBaseUrl}/resinas/${r.slug}` } });
      }
    }
  } catch (e) { console.warn("[searchContentDirect] Resins search failed:", e); }

  // Resin Documents (IFUs, MSDS, manuais técnicos, estudos) — ILIKE em nome/descrição/extracted_text
  try {
    const isIfuIntent = /\b(ifu|instru[cç][õo]es de uso|instructions for use|bula|manual|msds|fispq|ficha t[ée]cnica|certificado)\b/i.test(queryNormalized);
    const docOrFilter = [
      `document_name.ilike.${searchPattern}`,
      `document_description.ilike.${searchPattern}`,
      `extracted_text.ilike.${searchPattern}`,
      `document_type.ilike.${searchPattern}`,
    ].join(",");

    const { data: resinDocs } = await supabaseClient
      .from("resin_documents")
      .select("id, document_name, document_description, file_url, document_type, document_category, language, extracted_text, resin_id, resins(name, slug)")
      .eq("active", true)
      .or(docOrFilter)
      .limit(8);

    if (resinDocs) {
      for (const d of resinDocs as any[]) {
        const isIfu = (d.document_type || "").toLowerCase().includes("ifu") ||
                      (d.document_name || "").toLowerCase().includes("ifu");
        const baseSim = isIfuIntent && isIfu ? 0.88 : (isIfu ? 0.78 : 0.72);
        const resinName = d.resins?.name || "";
        const resinSlug = d.resins?.slug || "";
        const tag = isIfu ? "[IFU]" : "[DOC RESINA]";
        const snippet = (d.extracted_text || d.document_description || "").slice(0, 350);
        results.push({
          source_type: "resin_document",
          similarity: baseSim,
          chunk_text: `${tag} ${d.document_name}${resinName ? ` (Resina ${resinName})` : ""} — ${snippet}`,
          metadata: {
            title: d.document_name,
            url_publica: d.file_url,
            document_type: d.document_type,
            document_category: d.document_category,
            language: d.language,
            resin_name: resinName,
            resin_slug: resinSlug,
            resin_url: resinSlug ? `${siteBaseUrl}/resinas/${resinSlug}` : null,
          },
        });
      }
    }
  } catch (e) { console.warn("[searchContentDirect] Resin documents search failed:", e); }

  // Testimonials (depoimentos de clientes)
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
      for (const t of testimonials as any[]) {
        results.push({
          source_type: "testimonial", similarity: 0.70,
          chunk_text: `DEPOIMENTO DE CLIENTE: ${t.name} — ${t.description?.slice(0, 300) || ""}`,
          metadata: { title: t.name, slug: t.slug, url_publica: `${siteBaseUrl}/depoimentos/${t.slug}`, thumbnail_url: t.image_url },
        });
      }
    }
  } catch (e) { console.warn("[searchContentDirect] Testimonials search failed:", e); }

  // Cache upsert (fire-and-forget)
  const resultTypes = [...new Set(results.map(r => r.source_type))];
  supabaseClient.from("agent_internal_lookups").upsert({
    query_normalized: queryNormalized, query_original: userMessage, source_function: "dra-lia",
    results_json: results, results_count: results.length, result_types: resultTypes,
    hit_count: 1, last_hit_at: new Date().toISOString(), session_id: sessionId || null, lead_id: leadId || null,
  }, { onConflict: "query_normalized" }).then(({ error }) => {
    if (error) console.warn("[searchContentDirect] Cache upsert failed:", error.message);
    else console.log(`[searchContentDirect] Cached ${results.length} results for "${queryNormalized.slice(0, 50)}..."`);
  });

  console.log(`[searchContentDirect] Direct search found ${results.length} results (${resultTypes.join(", ")})`);
  return results;
}

// ── Catalog Products Search ──
const PRODUCT_INTEREST_KEYWORDS = [
  /impressora|printer|impresora/i, /scanner|escaner/i, /equipamento|equipment|equipo/i,
  /op[çc][õo]es|opcoes|options|opciones/i, /quais (vocês )?t[eê]m|o que (vocês )?t[eê]m|what do you have|qué tienen/i,
  /quero (comprar|ver|conhecer|saber)/i, /cat[áa]logo|catalog/i,
  /combo|kit|solu[çc][ãa]o|chairside|chair side/i, /p[óo]s.?impress[ãa]o|post.?print|lavadora|cura uv/i,
];

export async function searchCatalogProducts(supabase: SupabaseClient, message: string, history: Array<{ role: string; content: string }>, siteBaseUrl: string) {
  const combinedText = `${history.slice(-6).map(h => h.content).join(' ')} ${message}`.toLowerCase();
  if (!PRODUCT_INTEREST_KEYWORDS.some(p => p.test(combinedText))) return [];

  const categories: string[] = [];
  if (/impressora|printer|impresora|imprimir|imprim/i.test(combinedText)) categories.push('IMPRESSÃO 3D');
  if (/scanner|escaner|escanear|escaneamento|intraoral/i.test(combinedText)) categories.push('SCANNERS 3D');
  if (/p[óo]s.?impress|lavadora|cura uv|limpeza|post.?print/i.test(combinedText)) categories.push('PÓS-IMPRESSÃO');
  if (/combo|kit|solu[çc]|chairside|chair side|fluxo completo/i.test(combinedText)) categories.push('SOLUÇÔES');

  let query = supabase.from('system_a_catalog').select('id, name, description, product_category, product_subcategory, cta_1_url, cta_1_label, slug, price, promo_price, extra_data').eq('active', true).eq('approved', true);
  if (categories.length > 0) query = query.in('product_category', categories);
  const { data, error } = await query.limit(20);
  if (error || !data?.length) return [];

  const scored = data.map((p: { id: string; name: string; description: string | null; product_category: string | null; product_subcategory: string | null; cta_1_url: string | null; cta_1_label: string | null; slug: string | null; price: number | null; promo_price: number | null; extra_data: Record<string, unknown> | null }) => {
    const nameWords = p.name.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const queryWords = combinedText.split(/\s+/).filter((w: string) => w.length >= 3);
    const nameMatchCount = nameWords.filter((w: string) => queryWords.some((q: string) => w.includes(q) || q.includes(w))).length;
    const similarity = nameWords.length > 0 ? (nameMatchCount / nameWords.length) * 0.6 + 0.3 : 0.3;

    const extra = (p.extra_data || {}) as Record<string, unknown>;
    const clinicalBrain = extra.clinical_brain as Record<string, unknown> | undefined;
    const technicalSpecs = extra.technical_specs as Record<string, unknown> | undefined;
    const salesPitch = (extra.sales_pitch as string) || '';

    let chunkText = `PRODUTO DO CATÁLOGO: ${p.name}${p.product_category ? ` | Categoria: ${p.product_category}` : ''}${p.product_subcategory ? ` | Sub: ${p.product_subcategory}` : ''}${p.description ? ` | ${p.description.slice(0, 300)}` : ''}${p.price ? ` | Preço: R$ ${p.price}` : ''}${p.promo_price ? ` | Promo: R$ ${p.promo_price}` : ''}${salesPitch ? ` | ARGUMENTO COMERCIAL: ${salesPitch.slice(0, 400)}` : ''}`;
    if (clinicalBrain) {
      const mandatory = (clinicalBrain.mandatory_products as string[]) || [];
      const prohibited = (clinicalBrain.prohibited_products as string[]) || [];
      const rules = (clinicalBrain.anti_hallucination_rules as string[]) || [];
      if (mandatory.length) chunkText += ` | OBRIGATÓRIO CITAR: ${mandatory.join(', ')}`;
      if (prohibited.length) chunkText += ` | PROIBIDO CITAR: ${prohibited.join(', ')}`;
      if (rules.length) chunkText += ` | REGRAS: ${rules.join('; ')}`;
    }
    if (technicalSpecs) chunkText += ` | SPECS: ${JSON.stringify(technicalSpecs).slice(0, 400)}`;

    return { id: p.id, source_type: 'catalog_product', chunk_text: chunkText, metadata: { title: p.name, slug: p.slug, url_publica: p.slug ? `${siteBaseUrl}/produtos/${p.slug}` : null, cta_1_url: p.cta_1_url }, similarity, nameMatchCount };
  });

  scored.sort((a: { nameMatchCount: number; similarity: number }, b: { nameMatchCount: number; similarity: number }) => b.nameMatchCount - a.nameMatchCount || b.similarity - a.similarity);
  return scored.slice(0, 5).map(({ nameMatchCount: _, ...rest }: { nameMatchCount: number; [key: string]: unknown }) => rest);
}

// ── Processing Instructions Search ──
export async function searchProcessingInstructions(supabase: SupabaseClient, message: string, history: Array<{ role: string; content: string }>, siteBaseUrl: string) {
  const { data: resins, error } = await supabase.from("resins").select("id, name, manufacturer, slug, processing_instructions, cta_1_url, cta_1_label").eq("active", true).not("processing_instructions", "is", null);
  if (error || !resins?.length) return [];

  const combinedText = `${history.slice(-8).map(h => h.content).join(' ')} ${message}`.toLowerCase();
  const words = combinedText.split(/\s+/).filter(w => w.length > 3);

  const scored = resins.map((r: { id: string; name: string; manufacturer: string; slug: string | null; processing_instructions: string; cta_1_url: string | null; cta_1_label: string | null }) => {
    const text = `${r.name} ${r.manufacturer}`.toLowerCase();
    const score = words.filter(w => text.includes(w)).length;
    return { resin: r, score };
  }).sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const matched = scored.filter((x: { score: number }) => x.score > 0);
  if (matched.length === 0) return [];

  return matched.slice(0, 3).map(({ resin: r }: { resin: { id: string; name: string; manufacturer: string; slug: string | null; processing_instructions: string; cta_1_url: string | null; cta_1_label: string | null } }) => ({
    id: r.id, source_type: "processing_protocol",
    chunk_text: `${r.name} (${r.manufacturer}) — Instruções de Pré e Pós Processamento:\n${r.processing_instructions}`,
    metadata: { title: `Protocolo de Processamento: ${r.name}`, resin_name: r.name, cta_1_url: r.cta_1_url, url_publica: r.slug ? `${siteBaseUrl}/resina/${r.slug}` : null },
    similarity: (() => {
      const resinWords = `${r.name} ${r.manufacturer}`.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      const queryWords = combinedText.split(/\s+/).filter((w: string) => w.length > 3);
      const matchedCount = resinWords.filter((w: string) => queryWords.some((q: string) => q.includes(w) || w.includes(q))).length;
      return matchedCount > 0 ? Math.min(matchedCount / Math.max(resinWords.length, 1) * 0.5 + 0.5, 0.95) : 0.40;
    })(),
  }));
}

// ── Parameter Sets Search ──
export async function searchParameterSets(supabase: SupabaseClient, message: string, history: Array<{ role: string; content: string }>, siteBaseUrl: string) {
  const combinedText = `${history.slice(-8).map(h => h.content).join(" ")} ${message}`.toLowerCase();
  const { data: brands } = await supabase.from("brands").select("id, slug, name").eq("active", true);
  if (!brands?.length) return [];

  const mentionedBrands = (brands as Array<{ id: string; slug: string; name: string }>).filter(b => combinedText.includes(b.name.toLowerCase()) || combinedText.includes(b.slug.replace(/-/g, " ")));
  if (!mentionedBrands.length) return [];

  const paramResults: Array<{ id: string; source_type: string; chunk_text: string; metadata: Record<string, unknown>; similarity: number }> = [];

  for (const brand of mentionedBrands.slice(0, 2)) {
    const { data: models } = await supabase.from("models").select("slug, name").eq("brand_id", brand.id).eq("active", true);
    if (!models?.length) continue;
    const mentionedModels = (models as Array<{ slug: string; name: string }>).filter(m => {
      const nameWords = m.name.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
      const matches = nameWords.filter(w => combinedText.includes(w)).length;
      return matches >= 1 && matches >= Math.ceil(nameWords.length * 0.5);
    });

    for (const model of mentionedModels.slice(0, 2)) {
      const { data: params } = await supabase.from("parameter_sets").select("id, resin_name, layer_height, cure_time, light_intensity, bottom_layers, bottom_cure_time, lift_speed, lift_distance, retract_speed, notes").eq("brand_slug", brand.slug).eq("model_slug", model.slug).eq("active", true).limit(15);
      if (!params?.length) continue;

      type ParamRow = { id: string; resin_name: string; layer_height: number; cure_time: number; light_intensity: number; bottom_layers: number | null; bottom_cure_time: number | null; lift_speed: number | null; lift_distance: number | null; retract_speed: number | null; notes: string | null };
      const typedParams = params as ParamRow[];
      const resinMatched = typedParams.find(p => p.resin_name.toLowerCase().split(/\s+/).filter(w => w.length >= 4).some(w => combinedText.includes(w)));
      const targetParams = resinMatched ? typedParams.filter(p => resinMatched.resin_name.toLowerCase().split(/\s+/).filter(w => w.length >= 4).some(w => p.resin_name.toLowerCase().includes(w))) : typedParams.slice(0, 5);

      for (const p of targetParams.slice(0, 5)) {
        const lines = [
          `Parâmetros de impressão confirmados: ${brand.name} ${model.name} + ${p.resin_name}`,
          `• Altura de camada: ${p.layer_height}mm`, `• Tempo de cura: ${p.cure_time}s`, `• Intensidade de luz: ${p.light_intensity}%`,
          p.bottom_layers != null ? `• Camadas iniciais: ${p.bottom_layers} x ${p.bottom_cure_time}s` : "",
          p.lift_speed != null ? `• Lift speed: ${p.lift_speed}mm/min | Lift distance: ${p.lift_distance}mm` : "",
          p.retract_speed != null ? `• Retract speed: ${p.retract_speed}mm/min` : "",
          p.notes ? `• Observações: ${p.notes}` : "",
        ].filter(Boolean).join("\n");

        paramResults.push({
          id: p.id, source_type: "parameter_set", chunk_text: lines,
          metadata: { title: `${brand.name} ${model.name} + ${p.resin_name}`, url_publica: `${siteBaseUrl}/${brand.slug}/${model.slug}` },
          similarity: (() => {
            const resinWords = p.resin_name.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
            const queryWords = combinedText.split(/\s+/).filter((w: string) => w.length >= 3);
            const matchCount = resinWords.filter((w: string) => queryWords.some((q: string) => w.includes(q) || q.includes(w))).length;
            const baseScore = resinMatched ? 0.55 : 0.35;
            return matchCount > 0 ? Math.min(baseScore + (matchCount / Math.max(resinWords.length, 1)) * 0.35, 0.90) : baseScore;
          })(),
        });
      }
    }
  }
  return paramResults;
}

// ── Meta-article / Author Search ──
export async function searchArticlesAndAuthors(supabase: SupabaseClient, message: string, siteBaseUrl: string) {
  const results: Array<{ id: string; source_type: string; chunk_text: string; metadata: Record<string, unknown>; similarity: number }> = [];
  const { data: articles } = await supabase.from('knowledge_contents').select('id, title, slug, excerpt, category_id, author_id, knowledge_categories:knowledge_categories(letter, name)').eq('active', true).order('created_at', { ascending: false }).limit(15);

  if (articles?.length) {
    const queryWords = message.toLowerCase().replace(/[?!.,;:]/g, '').split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS_PT.includes(w));
    for (const a of articles as Array<{ id: string; title: string; slug: string; excerpt: string; author_id: string | null; knowledge_categories: { letter: string; name: string } | null }>) {
      const letter = a.knowledge_categories?.letter?.toLowerCase() || '';
      const categoryName = a.knowledge_categories?.name || '';
      const matchCount = queryWords.filter(w => a.title.toLowerCase().includes(w)).length;
      const similarity = queryWords.length > 0 && matchCount > 0 ? Math.min(0.5 + (matchCount / queryWords.length) * 0.4, 0.9) : 0.45;
      results.push({ id: a.id, source_type: 'article', chunk_text: `PUBLICAÇÃO: ${a.title} | Categoria: ${categoryName} | Resumo: ${a.excerpt}`, metadata: { title: a.title, slug: a.slug, category_letter: letter, url_publica: letter ? `${siteBaseUrl}/base-conhecimento/${letter}/${a.slug}` : null }, similarity });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    results.splice(8);
  }

  if (/\b(kol|kols|autor|autora|autores|especialista|colunista|quem escreve|quem escreveu)\b/i.test(message)) {
    const { data: authors } = await supabase.from('authors').select('id, name, specialty, mini_bio, photo_url, website_url, instagram_url, youtube_url, lattes_url').eq('active', true).order('order_index');
    if (authors?.length) {
      for (const author of authors as Array<{ id: string; name: string; specialty: string | null; mini_bio: string | null; photo_url: string | null; website_url: string | null; instagram_url: string | null; youtube_url: string | null; lattes_url: string | null }>) {
        const socialLinks = [author.website_url ? `Site: ${author.website_url}` : '', author.instagram_url ? `Instagram: ${author.instagram_url}` : '', author.youtube_url ? `YouTube: ${author.youtube_url}` : '', author.lattes_url ? `Lattes: ${author.lattes_url}` : ''].filter(Boolean).join(' | ');
        results.push({ id: author.id, source_type: 'author', chunk_text: `KOL/AUTOR: ${author.name}${author.specialty ? ` — ${author.specialty}` : ''}${author.mini_bio ? ` | ${author.mini_bio}` : ''}${socialLinks ? ` | ${socialLinks}` : ''}`, metadata: { title: author.name, specialty: author.specialty, photo_url: author.photo_url }, similarity: 0.85 });
      }
    }
  }
  return results;
}

// ── Main Knowledge Search (vector + FTS + ILIKE) ──
export async function searchKnowledge(
  supabase: SupabaseClient,
  query: string,
  lang: string,
  topicContext: string | undefined,
  history: Array<{ role: string; content: string }> | undefined,
  siteBaseUrl: string,
  generateEmbeddingFn: (text: string) => Promise<number[] | null>
) {
  let augmentedQuery = query;
  if (history && history.length > 0) {
    const recentText = history.slice(-4).map(h => h.content).join(' ');
    const productMentions = recentText.match(/\b(NanoClean[^\s.!?\n]{0,20}|Edge Mini[^\s.!?\n]{0,15}|Vitality[^\s.!?\n]{0,15}|ShapeWare[^\s.!?\n]{0,15}|Rayshape[^\s.!?\n]{0,15}|Scanner BLZ[^\s.!?\n]{0,15}|Asiga[^\s.!?\n]{0,15}|Chair Side[^\s.!?\n]{0,15}|MiiCraft[^\s.!?\n]{0,15}|Medit[^\s.!?\n]{0,15})/gi);
    if (productMentions && productMentions.length > 0) {
      const uniqueProducts = [...new Set(productMentions.map(p => p.trim().slice(0, 30)))];
      augmentedQuery = `${uniqueProducts.join(' ')} ${query}`;
      console.log(`[searchKnowledge] Query augmented with history products: "${augmentedQuery}"`);
    }
  }

  // Vector search
  const embedding = await generateEmbeddingFn(augmentedQuery);
  if (embedding) {
    const { data, error } = await supabase.rpc("match_agent_embeddings", { query_embedding: embedding, match_threshold: 0.65, match_count: 10 });
    if (!error && data && data.length > 0) {
      const reranked = applyTopicWeights(data, topicContext);
      return { results: reranked, method: "vector", topSimilarity: reranked[0]?.similarity || 0 };
    }
  }

  // FTS fallback
  const langCode = lang.split("-")[0];
  const { data: articles, error: artError } = await supabase.rpc("search_knowledge_base", { search_query: query, language_code: langCode });
  const ftsResults = (!artError && articles && articles.length > 0)
    ? articles.slice(0, 8).map((a: { content_id: string; content_type: string; title: string; excerpt: string; slug: string; category_letter: string; relevance: number }) => ({
        id: a.content_id, source_type: a.content_type, chunk_text: `${a.title} | ${a.excerpt}`,
        metadata: { title: a.title, slug: a.slug, category_letter: a.category_letter, url_publica: `${siteBaseUrl}/base-conhecimento/${a.category_letter}/${a.slug}` },
        similarity: a.relevance,
      }))
    : [];

  const ftsIsWeak = ftsResults.length === 0 || (ftsResults.length <= 2 && (ftsResults[0]?.similarity ?? 0) < 0.25);
  if (ftsIsWeak) {
    const ilikeResults = await searchByILIKE(supabase, query, siteBaseUrl);
    if (ilikeResults.length > 0) {
      const merged = [...ilikeResults, ...ftsResults.filter(f => f.similarity >= 0.15)];
      const reranked = applyTopicWeights(merged, topicContext);
      return { results: reranked, method: "ilike", topSimilarity: reranked[0]?.similarity || 0.3 };
    }
  }

  if (ftsResults.length > 0) {
    const reranked = applyTopicWeights(ftsResults, topicContext);
    return { results: reranked, method: "fulltext", topSimilarity: reranked[0]?.similarity || 0 };
  }

  // Keyword fallback on videos
  const recentContext = (history || []).slice(-6).map(h => h.content).join(' ');
  const fullText = `${recentContext} ${query}`;
  const keywords = fullText.split(/\s+/).filter(w => w.length > 3 && !STOPWORDS_PT.includes(w.toLowerCase())).map(w => w.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);

  if (keywords.length > 0) {
    const { data: videos } = await supabase.from("knowledge_videos").select("id, title, description, embed_url, thumbnail_url, content_id, pandavideo_id, url").or(keywords.map(k => `title.ilike.%${k}%`).join(",")).limit(5);
    if (videos && videos.length > 0) {
      const contentIds = videos.filter((v: { content_id: string | null }) => v.content_id).map((v: { content_id: string }) => v.content_id);
      let contentMap: Record<string, { slug: string; category_letter: string }> = {};
      if (contentIds.length > 0) {
        const { data: contents } = await supabase.from("knowledge_contents").select("id, slug, category_id, knowledge_categories:knowledge_categories(letter)").in("id", contentIds);
        if (contents) for (const c of contents as Array<{ id: string; slug: string; knowledge_categories: { letter: string } | null }>) {
          const letter = c.knowledge_categories?.letter?.toLowerCase() || "";
          if (letter) contentMap[c.id] = { slug: c.slug, category_letter: letter };
        }
      }
      const results = videos.map((v: { id: string; title: string; description: string | null; embed_url: string | null; thumbnail_url: string | null; content_id: string | null; url: string | null }) => {
        const mapped = v.content_id ? contentMap[v.content_id] : null;
        const internalUrl = mapped ? `${siteBaseUrl}/base-conhecimento/${mapped.category_letter}/${mapped.slug}` : null;
        return {
          id: v.id, source_type: "video", chunk_text: `${v.title} ${v.description || ""}`,
          metadata: { title: v.title, embed_url: v.embed_url, thumbnail_url: v.thumbnail_url, video_id: v.id, url_interna: internalUrl, has_internal_page: !!internalUrl, youtube_url: v.url || null },
          similarity: (() => {
            const titleWords = v.title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
            const matchCount = keywords.filter(k => titleWords.some((tw: string) => tw.includes(k) || k.includes(tw))).length;
            const baseSim = matchCount > 0 ? Math.min(0.30 + (matchCount / Math.max(keywords.length, 1)) * 0.35, 0.70) : 0.25;
            return mapped ? baseSim : Math.min(baseSim, 0.40);
          })(),
        };
      });
      // Also search articles via ILIKE to prioritize content with internal pages
      const articleResults = await searchByILIKE(supabase, query, siteBaseUrl);
      if (articleResults.length > 0) {
        results.push(...articleResults.map(a => ({ ...a, similarity: Math.max(a.similarity, 0.50) })));
      }
      const reranked = applyTopicWeights(results, topicContext);
      return { results: reranked, method: "keyword", topSimilarity: reranked[0]?.similarity || 0.5 };
    }
  }

  return { results: [], method: "none", topSimilarity: 0 };
}

// ── Build Structured Context ──
export function buildStructuredContext(
  results: Array<{ source_type: string; chunk_text: string; metadata: Record<string, unknown> }>,
  isCommercialRoute: boolean
): string {
  const formatItem = (m: { source_type: string; chunk_text: string; metadata: Record<string, unknown> }) => {
    const meta = m.metadata as Record<string, unknown>;
    let part = `[${m.source_type.toUpperCase()}] ${m.chunk_text}`;
    if (meta.url_publica) part += ` | URL: ${meta.url_publica}`;
    if (meta.url_interna) part += ` | VIDEO_INTERNO: ${meta.url_interna}`;
    else if (meta.youtube_url) part += ` | VIDEO_YOUTUBE: ${meta.youtube_url}`;
    else if (meta.embed_url) part += ` | VIDEO_SEM_PAGINA: sem página interna disponível`;
    if (meta.thumbnail_url) part += ` | THUMBNAIL: ${meta.thumbnail_url}`;
    if (meta.cta_1_url) part += ` | COMPRA: ${meta.cta_1_url}`;
    return part;
  };

  if (!isCommercialRoute) return results.map(formatItem).join("\n\n---\n\n");

  // Commercial route: group by semantic function
  const products: string[] = [];
  const expertise: string[] = [];
  const articles: string[] = [];
  const authors: string[] = [];
  const videos: string[] = [];
  const params: string[] = [];

  const testimonials: string[] = [];

  for (const m of results) {
    const formatted = formatItem(m);
    switch (m.source_type) {
      case 'catalog_product': case 'resin': products.push(formatted); break;
      case 'company_kb': expertise.push(formatted); break;
      case 'article': articles.push(formatted); break;
      case 'author': authors.push(formatted); break;
      case 'video': videos.push(formatted); break;
      case 'testimonial': testimonials.push(formatted); break;
      case 'parameter_set': case 'processing_protocol': params.push(formatted); break;
      default: articles.push(formatted);
    }
  }

  const sections: string[] = [];
  if (products.length > 0) sections.push(`## PRODUTOS RECOMENDADOS (use para sugestões e apresentação)\n${products.join("\n\n")}`);
  if (expertise.length > 0) sections.push(`## ARGUMENTOS DE VENDA E EXPERTISE (use para persuasão e objeções)\n${expertise.join("\n\n")}`);
  if (articles.length > 0) sections.push(`## ARTIGOS E PUBLICAÇÕES (cite quando relevante ou solicitado)\n${articles.join("\n\n")}`);
  if (authors.length > 0) sections.push(`## KOLs E AUTORES (apresente quando perguntado sobre autores/especialistas)\n${authors.join("\n\n")}`);
  if (videos.length > 0) sections.push(`## VÍDEOS DISPONÍVEIS (mencione APENAS se solicitado)\n${videos.join("\n\n")}`);
  if (params.length > 0) sections.push(`## PARÂMETROS TÉCNICOS (cite apenas se perguntado)\n${params.join("\n\n")}`);
  if (testimonials.length > 0) sections.push(`## DEPOIMENTOS DE CLIENTES (use como prova social quando relevante)\n${testimonials.join("\n\n")}`);

  if (sections.length === 0) return "";
  return sections.join("\n\n---\n\n");
}

// ── Testimonial Intent Detection ──
export const TESTIMONIAL_INTENT = /depoimento|testemunho|experi[êe]ncia|relato|quem (j[aá] )?comprou|na minha cidade|caso real|prova social|treinamento.*como [eé]|como foi|algu[eé]m.*(usa|comprou|tem)|resultado.*real/i;

// ── Standalone Testimonials Search ──
export async function searchTestimonials(
  supabase: SupabaseClient,
  message: string,
  siteBaseUrl: string
): Promise<Array<{ source_type: string; similarity: number; chunk_text: string; metadata: Record<string, unknown> }>> {
  const words = message.toLowerCase().replace(/[?!.,;:]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS_PT.includes(w)).slice(0, 6);
  if (!words.length) return [];
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

  return data.map((t: any) => ({
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
