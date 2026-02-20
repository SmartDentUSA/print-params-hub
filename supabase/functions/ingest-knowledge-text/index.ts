import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY")!;

// ── Chunk split (900 chars, 150 overlap) ─────────────────────────────────────
function splitIntoChunks(text: string, size = 900, overlap = 150): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return chunks;
}

// ── Generate Gemini embedding (768 dims) ─────────────────────────────────────
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Parse body ────────────────────────────────────────────────
    const body = await req.json();
    const entries: Array<{
      title: string;
      category: string;
      source_label?: string;
      content: string;
    }> = body.entries || [];

    if (!entries.length) {
      return new Response(JSON.stringify({ error: "No entries provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validCategories = ["sdr", "comercial", "workflow", "suporte", "faq", "objecoes", "onboarding", "geral"];
    const results: Array<{ title: string; saved: boolean; chunks_created: number; indexed: number; error?: string }> = [];
    let totalSaved = 0;
    let totalChunks = 0;
    let totalIndexed = 0;

    for (const entry of entries) {
      try {
        if (!entry.title || !entry.content) throw new Error("title and content are required");
        if (!validCategories.includes(entry.category)) throw new Error(`Invalid category: ${entry.category}`);

        // ── Upsert into company_kb_texts ──────────────────────────
        const { data: kbRow, error: upsertError } = await supabase
          .from("company_kb_texts")
          .upsert(
            {
              title: entry.title,
              category: entry.category,
              source_label: entry.source_label || null,
              content: entry.content,
              active: true,
            },
            { onConflict: "title,source_label", ignoreDuplicates: false }
          )
          .select("id")
          .single();

        if (upsertError) throw new Error(`DB upsert error: ${upsertError.message}`);
        const kbTextId = kbRow.id;
        totalSaved++;

        // ── Delete old chunks for this kb_text_id ─────────────────
        await supabase
          .from("agent_embeddings")
          .delete()
          .eq("source_type", "company_kb")
          .contains("metadata", { kb_text_id: kbTextId });

        // ── Split content into chunks ─────────────────────────────
        const parts = splitIntoChunks(entry.content, 900, 150);
        let entryIndexed = 0;

        for (let i = 0; i < parts.length; i++) {
          const slice = parts[i];
          const chunkText = `[${entry.category.toUpperCase()}] ${entry.title}${parts.length > 1 ? ` (parte ${i + 1}/${parts.length})` : ""} | ${slice}`;

          try {
            const embedding = await generateEmbedding(chunkText);

            const { error: insertError } = await supabase.from("agent_embeddings").insert({
              source_type: "company_kb",
              chunk_text: chunkText,
              metadata: {
                title: entry.title,
                category: entry.category,
                source_label: entry.source_label || null,
                kb_text_id: kbTextId,
                chunk_part: i + 1,
                total_parts: parts.length,
              },
              embedding: JSON.stringify(embedding),
            });

            if (insertError) console.warn(`[insert-chunk] ${insertError.message}`);
            else entryIndexed++;

            // Rate limit: 2s between embedding calls
            if (i < parts.length - 1) await sleep(2000);
          } catch (embErr: any) {
            console.warn(`[embed-chunk ${i + 1}] ${embErr.message}`);
          }
        }

        totalChunks += parts.length;
        totalIndexed += entryIndexed;

        // ── Update chunks_count and indexed_at ────────────────────
        await supabase
          .from("company_kb_texts")
          .update({ chunks_count: entryIndexed, indexed_at: new Date().toISOString() })
          .eq("id", kbTextId);

        results.push({ title: entry.title, saved: true, chunks_created: parts.length, indexed: entryIndexed });
      } catch (entryErr: any) {
        results.push({ title: entry.title || "?", saved: false, chunks_created: 0, indexed: 0, error: entryErr.message });
      }
    }

    return new Response(
      JSON.stringify({
        saved: totalSaved,
        chunks_created: totalChunks,
        indexed: totalIndexed,
        errors: results.filter((r) => r.error).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ingest-knowledge-text]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
