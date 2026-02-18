import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Normalize a name for fuzzy matching: lowercase, remove accents, strip punctuation
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Check if product name matches resin name (bidirectional substring match)
function namesMatch(productName: string, resinName: string): boolean {
  const np = normalizeName(productName);
  const nr = normalizeName(resinName);

  // Remove common prefixes from product names ("resina 3d ", "resina ")
  const npClean = np
    .replace(/^resina 3d\s+/, "")
    .replace(/^resina\s+/, "")
    .trim();

  // Product contains resin name OR resin contains cleaned product name
  if (np.includes(nr) || nr.includes(np)) return true;
  if (npClean.includes(nr) || nr.includes(npClean)) return true;

  // Word-level overlap: ≥3 meaningful words in common
  const pWords = npClean.split(" ").filter((w) => w.length >= 3);
  const rWords = nr.split(" ").filter((w) => w.length >= 3);
  const common = pWords.filter((w) => rWords.includes(w));
  if (common.length >= 2 && pWords.length >= 2) return true;

  return false;
}

// Build rich ai_context from apostila product data
function buildAiContext(product: any): string {
  const sections: string[] = [];

  const keywords = [
    ...(product.keywords || []),
    ...(product.market_keywords || []),
    ...(product.bot_trigger_words || []),
  ];
  if (keywords.length > 0) {
    sections.push(`Palavras-chave: ${keywords.join(", ")}`);
  }

  if (product.benefits && product.benefits.length > 0) {
    sections.push(`Benefícios: ${product.benefits.join(". ")}`);
  }

  if (product.features && product.features.length > 0) {
    sections.push(`Características: ${product.features.join(". ")}`);
  }

  if (product.target_audience) {
    sections.push(`Público-alvo: ${product.target_audience}`);
  }

  if (product.technical_specifications && product.technical_specifications.length > 0) {
    const specs = product.technical_specifications
      .map((s: any) => `${s.label}: ${s.value}`)
      .join(" | ");
    sections.push(`Especificações técnicas: ${specs}`);
  }

  // Extract from document transcriptions
  if (product.document_transcriptions && product.document_transcriptions.length > 0) {
    for (const doc of product.document_transcriptions) {
      const ed = doc.extracted_data;
      if (!ed) continue;

      if (ed.keywords && ed.keywords.length > 0) {
        sections.push(`Palavras-chave PDF: ${ed.keywords.join(", ")}`);
      }
      if (ed.benefits && ed.benefits.length > 0) {
        sections.push(`Benefícios PDF: ${ed.benefits.slice(0, 5).join(". ")}`);
      }
      if (ed.usage_instructions) {
        sections.push(`Instruções de uso: ${String(ed.usage_instructions).slice(0, 400)}`);
      }
      break; // Only first document to keep context concise
    }
  }

  // FAQs as context
  if (product.faq && product.faq.length > 0) {
    const faqText = product.faq
      .slice(0, 3)
      .map((f: any) => `P: ${f.question} R: ${f.answer}`)
      .join(" | ");
    sections.push(`FAQ: ${faqText}`);
  }

  return sections.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse body — supports both full apostila JSON and pre-extracted products array
    const body = await req.json();
    const rawData = body.data || body;

    // Accept products from new apostila format (data.products) or legacy format
    const apostilaProducts: any[] = rawData.products || body.products || [];

    if (!apostilaProducts || apostilaProducts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No products found in JSON. Send { data: { products: [...] } }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📦 Apostila products received: ${apostilaProducts.length}`);

    // Fetch all active resins from DB
    const { data: resins, error: resinErr } = await supabase
      .from("resins")
      .select("id, name, manufacturer, description, ai_context, meta_description, keywords, processing_instructions")
      .eq("active", true);

    if (resinErr) throw resinErr;
    console.log(`💊 Resins in DB: ${resins?.length ?? 0}`);

    const results = {
      matched: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      matches: [] as Array<{ resin: string; product: string; fields_updated: string[] }>,
    };

    for (const rawProduct of apostilaProducts) {
      // Support both { product: {...} } and flat product object
      const product = rawProduct.product || rawProduct;

      if (!product.name) continue;

      // Find matching resin
      const matchedResin = (resins || []).find((r) => namesMatch(product.name, r.name));

      if (!matchedResin) {
        console.log(`⚠️ No match for: ${product.name}`);
        results.skipped++;
        continue;
      }

      results.matched++;
      console.log(`✅ Match: "${product.name}" → "${matchedResin.name}"`);

      // Build update payload — never overwrite processing_instructions
      const updates: Record<string, any> = {};
      const fieldsUpdated: string[] = [];

      // description: use sales_pitch if available, fallback to description
      const newDescription = product.sales_pitch || product.description;
      if (newDescription && newDescription !== matchedResin.description) {
        updates.description = newDescription;
        fieldsUpdated.push("description");
      }

      // meta_description: use seo_description_override
      const newMeta = product.seo_description_override || product.meta_description;
      if (newMeta && newMeta !== matchedResin.meta_description) {
        updates.meta_description = newMeta;
        fieldsUpdated.push("meta_description");
      }

      // keywords: merge existing with new
      const existingKeywords: string[] = matchedResin.keywords || [];
      const newKeywords: string[] = product.keywords || [];
      const mergedKeywords = [...new Set([...existingKeywords, ...newKeywords])];
      if (mergedKeywords.length > existingKeywords.length) {
        updates.keywords = mergedKeywords;
        fieldsUpdated.push("keywords");
      }

      // ai_context: always rebuild from rich apostila data
      const newAiContext = buildAiContext(product);
      if (newAiContext && newAiContext !== matchedResin.ai_context) {
        updates.ai_context = newAiContext;
        fieldsUpdated.push("ai_context");
      }

      if (Object.keys(updates).length === 0) {
        console.log(`⏭️ No changes for: ${matchedResin.name}`);
        results.skipped++;
        continue;
      }

      updates.updated_at = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("resins")
        .update(updates)
        .eq("id", matchedResin.id);

      if (updateErr) {
        console.error(`❌ Update error for ${matchedResin.name}:`, updateErr);
        results.errors++;
      } else {
        results.updated++;
        results.matches.push({
          resin: matchedResin.name,
          product: product.name,
          fields_updated: fieldsUpdated,
        });
        console.log(`💾 Updated "${matchedResin.name}": ${fieldsUpdated.join(", ")}`);
      }
    }

    // Also enrich system_a_catalog products with richer descriptions from apostila
    // Update description from sales_pitch when description is empty
    const catalogUpdates: Array<{ external_id: string; name: string; fields: string[] }> = [];

    for (const rawProduct of apostilaProducts) {
      const product = rawProduct.product || rawProduct;
      if (!product.id || !product.name) continue;

      const catalogUpdate: Record<string, any> = {};
      const fields: string[] = [];

      // Enrich description with sales_pitch
      if (product.sales_pitch) {
        catalogUpdate.description = product.sales_pitch;
        fields.push("description");
      }

      // Add technical specs and FAQs to extra_data
      if (product.technical_specifications || product.faq || product.benefits || product.features || product.document_transcriptions) {
        catalogUpdate.extra_data = {
          technical_specifications: product.technical_specifications || [],
          faq: product.faq || [],
          benefits: product.benefits || [],
          features: product.features || [],
          document_transcriptions: (product.document_transcriptions || []).map((d: any) => ({
            document_name: d.document_name,
            extracted_data: d.extracted_data,
          })),
          sales_pitch: product.sales_pitch,
        };
        fields.push("extra_data");
      }

      if (fields.length > 0) {
        await supabase
          .from("system_a_catalog")
          .update(catalogUpdate)
          .eq("external_id", String(product.id))
          .eq("source", "system_a");

        catalogUpdates.push({ external_id: String(product.id), name: product.name, fields });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        apostila_products: apostilaProducts.length,
        resins_db: resins?.length ?? 0,
        results,
        catalog_enriched: catalogUpdates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-resins-from-apostila error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
