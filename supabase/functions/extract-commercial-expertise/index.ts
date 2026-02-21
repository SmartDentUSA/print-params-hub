import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { batch_size = 10, offset = 0 } = await req.json().catch(() => ({}));

    // 1. Fetch catalog products for name matching
    const { data: products } = await supabase
      .from("system_a_catalog")
      .select("id, name, product_category, slug")
      .eq("active", true)
      .eq("approved", true);

    if (!products?.length) {
      return new Response(JSON.stringify({ error: "No catalog products found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productNames = products.map((p: { name: string }) => p.name.toLowerCase());

    // 2. Fetch videos with transcripts that mention products
    const { data: videos, error: videoError } = await supabase
      .from("knowledge_videos")
      .select("id, title, video_transcript, product_id, product_category")
      .not("video_transcript", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + batch_size - 1);

    if (videoError) throw videoError;
    if (!videos?.length) {
      return new Response(JSON.stringify({ message: "No more videos to process", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter videos with sufficient transcript and product mentions
    const relevantVideos = videos.filter((v: { video_transcript: string | null }) => {
      const transcript = v.video_transcript || "";
      if (transcript.length < 500) return false;
      const lower = transcript.toLowerCase();
      return productNames.some((name: string) => lower.includes(name)) || v.product_id;
    });

    if (relevantVideos.length === 0) {
      return new Response(JSON.stringify({ 
        message: `Batch ${offset}-${offset + batch_size}: no product-relevant videos`, 
        processed: 0,
        next_offset: offset + batch_size 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const results: Array<{ video_title: string; status: string; expertise_count: number }> = [];

    for (const video of relevantVideos) {
      try {
        const transcript = (video.video_transcript || "").slice(0, 8000);

        // Find which products are mentioned
        const mentionedProducts = products.filter((p: { name: string }) => 
          transcript.toLowerCase().includes(p.name.toLowerCase())
        );
        const productContext = mentionedProducts.length > 0
          ? mentionedProducts.map((p: { name: string; product_category: string | null }) => `${p.name} (${p.product_category || "geral"})`).join(", ")
          : "produtos Smart Dent (geral)";

        // Call AI with tool calling for structured extraction
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em extrair conhecimento comercial e técnico de transcrições de vídeos sobre odontologia digital. 
Extraia APENAS informações que realmente existem na transcrição — NUNCA invente dados.
Foco em: benefícios para o dentista, objeções respondidas, casos de uso clínico, vantagens competitivas.
Produtos mencionados: ${productContext}`,
              },
              {
                role: "user",
                content: `Analise esta transcrição de vídeo e extraia expertise comercial:\n\nTÍTULO: ${video.title}\n\nTRANSCRIÇÃO:\n${transcript}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_expertise",
                  description: "Extrai conhecimento comercial estruturado de uma transcrição de vídeo sobre odontologia digital",
                  parameters: {
                    type: "object",
                    properties: {
                      product_name: {
                        type: "string",
                        description: "Nome do produto principal discutido no vídeo",
                      },
                      benefits: {
                        type: "array",
                        items: { type: "string" },
                        description: "Benefícios-chave mencionados (para o dentista/laboratório)",
                      },
                      objections_handled: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            objection: { type: "string", description: "A objeção ou dúvida" },
                            response: { type: "string", description: "Como foi respondida/resolvida" },
                          },
                          required: ["objection", "response"],
                        },
                        description: "Objeções respondidas no vídeo",
                      },
                      clinical_cases: {
                        type: "array",
                        items: { type: "string" },
                        description: "Casos de uso clínico citados (ex: próteses, implantes, guias)",
                      },
                      competitive_advantages: {
                        type: "array",
                        items: { type: "string" },
                        description: "Vantagens competitivas vs concorrentes (se mencionadas)",
                      },
                    },
                    required: ["product_name", "benefits"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_expertise" } },
            temperature: 0.1,
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI error for video ${video.id}: ${aiRes.status}`);
          results.push({ video_title: video.title, status: "ai_error", expertise_count: 0 });
          continue;
        }

        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          results.push({ video_title: video.title, status: "no_extraction", expertise_count: 0 });
          continue;
        }

        const expertise = JSON.parse(toolCall.function.arguments);
        const productName = expertise.product_name || "Geral";

        // Build structured content for company_kb_texts
        const contentParts: string[] = [];
        contentParts.push(`# Expertise Comercial: ${productName}\n`);
        contentParts.push(`Fonte: Transcrição de vídeo "${video.title}"\n`);

        if (expertise.benefits?.length > 0) {
          contentParts.push(`\n## Benefícios-chave\n${expertise.benefits.map((b: string) => `- ${b}`).join("\n")}`);
        }

        if (expertise.objections_handled?.length > 0) {
          contentParts.push(`\n## Objeções respondidas`);
          for (const obj of expertise.objections_handled) {
            contentParts.push(`\n**Objeção:** ${obj.objection}\n**Resposta:** ${obj.response}`);
          }
        }

        if (expertise.clinical_cases?.length > 0) {
          contentParts.push(`\n## Casos de uso clínico\n${expertise.clinical_cases.map((c: string) => `- ${c}`).join("\n")}`);
        }

        if (expertise.competitive_advantages?.length > 0) {
          contentParts.push(`\n## Vantagens competitivas\n${expertise.competitive_advantages.map((a: string) => `- ${a}`).join("\n")}`);
        }

        const content = contentParts.join("\n");
        const title = `Expertise: ${productName} — ${video.title.slice(0, 60)}`;
        const sourceLabel = `expertise-video-${productName.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;

        // Upsert into company_kb_texts
        const { error: upsertError } = await supabase
          .from("company_kb_texts")
          .upsert(
            {
              title,
              content,
              category: "comercial",
              source_label: sourceLabel,
              active: true,
            },
            { onConflict: "title,source_label" }
          );

        if (upsertError) {
          console.error(`Upsert error for ${title}:`, upsertError);
          results.push({ video_title: video.title, status: "upsert_error", expertise_count: 0 });
        } else {
          processed++;
          const expertiseCount = (expertise.benefits?.length || 0) + 
            (expertise.objections_handled?.length || 0) + 
            (expertise.clinical_cases?.length || 0) + 
            (expertise.competitive_advantages?.length || 0);
          results.push({ video_title: video.title, status: "success", expertise_count: expertiseCount });
        }
      } catch (err) {
        console.error(`Error processing video ${video.id}:`, err);
        results.push({ video_title: video.title, status: "error", expertise_count: 0 });
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        total_in_batch: relevantVideos.length,
        next_offset: offset + batch_size,
        results,
        message: `Processed ${processed} videos. Call again with offset=${offset + batch_size} for next batch.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[extract-commercial-expertise] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
