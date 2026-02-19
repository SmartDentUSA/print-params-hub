import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

const BATCH_SIZE = 5;
const DELAY_MS = 2000; // 2s between batches to avoid rate limits

async function generateEmbedding(text: string): Promise<number[]> {
  const modelsToTry = [
    { model: "models/gemini-embedding-001", version: "v1beta" },
  ];

  for (const { model, version } of modelsToTry) {
    const modelId = model.replace("models/", "");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${version}/models/${modelId}:embedContent?key=${GOOGLE_AI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const values = data.embedding?.values || [];
      if (values.length > 0) return values;
    } else {
      const err = await response.text();
      console.log(`${model}@${version}: ${response.status} - ${err.slice(0, 100)}`);
      if (response.status !== 404 && response.status !== 429) {
        throw new Error(`Embedding API error ${response.status}: ${err}`);
      }
    }
  }

  throw new Error("All embedding models failed. Check logs for details.");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Chunk {
  content_id?: string;
  source_type: "article" | "video" | "resin" | "parameter";
  chunk_text: string;
  metadata: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate GOOGLE_AI_KEY upfront — fail fast with a clear error
  if (!GOOGLE_AI_KEY) {
    return new Response(
      JSON.stringify({
        error: "GOOGLE_AI_KEY secret not configured. Add it in Supabase Dashboard > Settings > Edge Functions > Secrets.",
        hint: "Get your key at https://aistudio.google.com/app/apikey",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "full"; // 'full' | 'incremental'

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const chunks: Chunk[] = [];

    // ── 1. ARTICLES ─────────────────────────────────────────────
    const { data: articles, error: artError } = await supabase
      .from("knowledge_contents")
      .select("id, title, slug, excerpt, meta_description, keywords, category_id, content_html, og_image_url")
      .eq("active", true);

    if (artError) throw artError;

    for (const a of articles || []) {
      const chunkText = [
        a.title,
        a.excerpt,
        a.meta_description,
        (a.keywords || []).join(", "),
        // Include first 800 chars of content_html stripped of tags
        a.content_html
          ? a.content_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      chunks.push({
        content_id: a.id,
        source_type: "article",
        chunk_text: chunkText,
        metadata: {
          title: a.title,
          slug: a.slug,
          category_id: a.category_id,
          og_image_url: a.og_image_url,
          url_publica: `/base-conhecimento/A/${a.slug}`,
        },
      });
    }

    // ── 2. VIDEOS (all with transcripts — all will be published) ─
    const { data: videos, error: vidError } = await supabase
      .from("knowledge_videos")
      .select("id, title, description, video_transcript, embed_url, thumbnail_url, content_id, pandavideo_id")
      .not("video_transcript", "is", null)
      .neq("video_transcript", "");

    if (vidError) throw vidError;

    for (const v of videos || []) {
      const transcript = v.video_transcript || "";
      // Split long transcripts into 2 chunks with overlap
      const CHUNK_LIMIT = 1200;
      const OVERLAP = 150;

      if (transcript.length <= CHUNK_LIMIT) {
        const chunkText = [v.title, v.description, transcript].filter(Boolean).join(" | ");
        chunks.push({
          content_id: v.content_id || undefined,
          source_type: "video",
          chunk_text: chunkText,
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            pandavideo_id: v.pandavideo_id,
            video_id: v.id,
          },
        });
      } else {
        // Chunk 1
        const part1 = transcript.slice(0, CHUNK_LIMIT);
        chunks.push({
          content_id: v.content_id || undefined,
          source_type: "video",
          chunk_text: [v.title, v.description, part1].filter(Boolean).join(" | "),
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            pandavideo_id: v.pandavideo_id,
            video_id: v.id,
            chunk_part: 1,
          },
        });
        // Chunk 2 (with overlap)
        const part2 = transcript.slice(CHUNK_LIMIT - OVERLAP);
        chunks.push({
          content_id: v.content_id || undefined,
          source_type: "video",
          chunk_text: [v.title, part2].filter(Boolean).join(" | "),
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            pandavideo_id: v.pandavideo_id,
            video_id: v.id,
            chunk_part: 2,
          },
        });
      }
    }

    // ── 3. RESINS ────────────────────────────────────────────────
    const { data: resins, error: resinError } = await supabase
      .from("resins")
      .select("id, name, manufacturer, description, processing_instructions, slug, cta_1_url, keywords")
      .eq("active", true);

    if (resinError) throw resinError;

    for (const r of resins || []) {
      const chunkText = [
        `${r.manufacturer} ${r.name}`,
        r.description,
        r.processing_instructions,
        (r.keywords || []).join(", "),
      ]
        .filter(Boolean)
        .join(" | ");

      chunks.push({
        source_type: "resin",
        chunk_text: chunkText,
        metadata: {
          name: r.name,
          manufacturer: r.manufacturer,
          slug: r.slug,
          cta_1_url: r.cta_1_url,
          url_publica: r.slug ? `/resinas/${r.slug}` : null,
        },
      });
    }

    // ── 4. PARAMETERS ────────────────────────────────────────────
    const { data: params, error: parError } = await supabase
      .from("parameter_sets")
      .select("id, brand_slug, model_slug, resin_name, resin_manufacturer, layer_height, cure_time, light_intensity, bottom_layers, bottom_cure_time, notes")
      .eq("active", true);

    if (parError) throw parError;

    for (const p of params || []) {
      const chunkText = [
        `Parâmetros ${p.brand_slug} ${p.model_slug} - Resina: ${p.resin_manufacturer} ${p.resin_name}`,
        `Altura de camada: ${p.layer_height}mm`,
        `Tempo de cura: ${p.cure_time}s`,
        `Intensidade de luz: ${p.light_intensity}%`,
        `Camadas base: ${p.bottom_layers}`,
        p.bottom_cure_time ? `Tempo de adesão: ${p.bottom_cure_time}s` : "",
        p.notes || "",
      ]
        .filter(Boolean)
        .join(" | ");

      chunks.push({
        source_type: "parameter",
        chunk_text: chunkText,
        metadata: {
          brand_slug: p.brand_slug,
          model_slug: p.model_slug,
          resin_name: p.resin_name,
          resin_manufacturer: p.resin_manufacturer,
          layer_height: p.layer_height,
          cure_time: p.cure_time,
          url_publica: `/${p.brand_slug}/${p.model_slug}`,
        },
      });
    }

    // ── FILTER incremental: skip already indexed ─────────────────
    let chunksToIndex = chunks;
    if (mode === "incremental") {
      const { data: existing } = await supabase
        .from("agent_embeddings")
        .select("chunk_text");
      const existingTexts = new Set((existing || []).map((e: { chunk_text: string }) => e.chunk_text));
      chunksToIndex = chunks.filter((c) => !existingTexts.has(c.chunk_text));
    } else {
      // Full mode: clear all embeddings first
      await supabase.from("agent_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    console.log(`Mode: ${mode} | Total chunks: ${chunks.length} | To index: ${chunksToIndex.length}`);

    // ── PROCESS in batches ───────────────────────────────────────
    let indexed = 0;
    let errors = 0;

    for (let i = 0; i < chunksToIndex.length; i += BATCH_SIZE) {
      const batch = chunksToIndex.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (chunk) => {
          const embedding = await generateEmbedding(chunk.chunk_text);
          const { error } = await supabase.from("agent_embeddings").insert({
            content_id: chunk.content_id || null,
            source_type: chunk.source_type,
            chunk_text: chunk.chunk_text,
            embedding,
            metadata: chunk.metadata,
            embedding_updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") indexed++;
        else {
          errors++;
          console.error("Chunk error:", r.reason);
        }
      }

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${indexed} indexed, ${errors} errors`);

      if (i + BATCH_SIZE < chunksToIndex.length) {
        await sleep(DELAY_MS);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        total_chunks: chunks.length,
        indexed,
        errors,
        skipped: chunks.length - chunksToIndex.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("index-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
