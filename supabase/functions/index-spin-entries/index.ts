import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY")!;

function splitIntoChunks(text: string, size = 900, overlap = 150): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_AI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 768,
      }),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  const values = data.embedding?.values || [];
  if (values.length === 0) throw new Error("Empty embedding returned");
  return values;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch unindexed SPIN entries
    const { data: entries, error: fetchError } = await supabase
      .from("company_kb_texts")
      .select("*")
      .eq("source_label", "apostila-spin-competitive-edge")
      .is("indexed_at", null);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ message: "No unindexed SPIN entries found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${entries.length} unindexed SPIN entries`);

    let totalChunks = 0;
    let totalIndexed = 0;
    const results: Array<{ title: string; chunks: number; indexed: number }> = [];

    for (const entry of entries) {
      // Delete old embeddings for this entry
      await supabase
        .from("agent_embeddings")
        .delete()
        .eq("source_type", "company_kb")
        .contains("metadata", { kb_text_id: entry.id });

      const parts = splitIntoChunks(entry.content, 900, 150);
      let entryIndexed = 0;

      for (let i = 0; i < parts.length; i++) {
        const chunkText = `[${entry.category.toUpperCase()}] ${entry.title}${parts.length > 1 ? ` (parte ${i + 1}/${parts.length})` : ""} | ${parts[i]}`;

        try {
          const embedding = await generateEmbedding(chunkText);

          const { error: insertError } = await supabase.from("agent_embeddings").insert({
            source_type: "company_kb",
            chunk_text: chunkText,
            metadata: {
              title: entry.title,
              category: entry.category,
              source_label: entry.source_label,
              kb_text_id: entry.id,
              chunk_part: i + 1,
              total_parts: parts.length,
            },
            embedding: JSON.stringify(embedding),
          });

          if (insertError) console.warn(`[insert] ${insertError.message}`);
          else entryIndexed++;

          if (i < parts.length - 1) await sleep(2000);
        } catch (embErr: any) {
          console.warn(`[embed ${i + 1}] ${embErr.message}`);
        }
      }

      // Update entry
      await supabase
        .from("company_kb_texts")
        .update({ chunks_count: entryIndexed, indexed_at: new Date().toISOString() })
        .eq("id", entry.id);

      totalChunks += parts.length;
      totalIndexed += entryIndexed;
      results.push({ title: entry.title, chunks: parts.length, indexed: entryIndexed });
      console.log(`✓ ${entry.title}: ${entryIndexed}/${parts.length} chunks indexed`);

      // Wait between entries
      if (entries.indexOf(entry) < entries.length - 1) await sleep(2000);
    }

    // Log batch embedding usage
    if (totalIndexed > 0) {
      const estimatedTokens = totalIndexed * 200;
      await logAIUsage({
        functionName: "index-spin-entries",
        actionLabel: "embed-spin-batch",
        model: "embedding-001",
        promptTokens: estimatedTokens,
        completionTokens: 0,
      });
    }

    return new Response(
      JSON.stringify({ entries: entries.length, totalChunks, totalIndexed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[index-spin-entries]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
