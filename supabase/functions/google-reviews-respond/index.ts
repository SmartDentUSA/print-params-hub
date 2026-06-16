import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getValidAccessToken } from "../_shared/google-oauth.ts";

const PROVIDERS = [
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat",
  "poe/claude-sonnet",
];

async function callLovableAI(model: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`${model} ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${model}: resposta vazia`);
  return text;
}

function buildPrompt(reviewer: string, stars: number, comment: string): string {
  const firstName = (reviewer || "Cliente").split(" ")[0];
  return `Você é um assistente da Smart Dent, uma clínica/empresa odontológica de confiança no Brasil. Sua tarefa é responder uma avaliação no Google Business Profile.

CONTEXTO DO REVIEW:
- Nome: ${reviewer || "cliente"}
- Estrelas: ${stars}/5
- Comentário: "${comment || "(sem comentário)"}"

REGRAS OBRIGATÓRIAS:
1. Português do Brasil, tom humano, próximo e profissional.
2. Comece chamando o cliente pelo primeiro nome: "${firstName}".
3. NUNCA use as frases "Ficamos felizes" ou "É um prazer".
4. Assine ao final exatamente assim: "Equipe Smart Dent 💙".
5. Máximo 150 palavras. Sem hashtags, sem emojis em excesso.
6. Agradeça pontos específicos citados no comentário (quando houver).
7. Comportamento por estrelas:
   - 5 estrelas: agradeça com entusiasmo genuíno, reforce o vínculo.
   - 3-4 estrelas: agradeça e mostre comprometimento em evoluir.
   - 1-2 estrelas: peça desculpas com empatia, valide a frustração e convide ao contato direto pelo WhatsApp (16) 98115-8403 para resolvermos pessoalmente.
8. Não invente serviços, valores, prazos ou produtos. Não inclua preços.
9. Responda APENAS com o texto final da resposta — sem cabeçalho, sem aspas, sem comentários adicionais.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { review_id } = await req.json();
    if (!review_id) {
      return new Response(JSON.stringify({ error: "review_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: review, error: revErr } = await supabase
      .from("google_reviews")
      .select("*")
      .eq("id", review_id)
      .maybeSingle();

    if (revErr || !review) {
      return new Response(JSON.stringify({ error: "review não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(review.reviewer_name ?? "", review.star_rating ?? 5, review.comment ?? "");

    // Cascata de provedores IA
    let response: string | null = null;
    let lastError: Error | null = null;
    let usedProvider: string | null = null;
    for (const provider of PROVIDERS) {
      try {
        response = await callLovableAI(provider, prompt);
        if (response) { usedProvider = provider; break; }
      } catch (err) {
        lastError = err as Error;
        console.error(`[reviews-respond] ${provider} falhou:`, (err as Error).message);
        continue;
      }
    }

    if (!response) {
      await supabase.from("google_reviews").update({
        response_status: "error",
        error_message: "Todos os provedores de IA falharam: " + (lastError?.message ?? "desconhecido"),
      }).eq("id", review_id);
      return new Response(JSON.stringify({ success: false, error: "ai_cascade_failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[reviews-respond] provider usado: ${usedProvider}`);

    // Publica no Google
    try {
      const accessToken = await getValidAccessToken();
      const putResp = await fetch(
        `https://mybusiness.googleapis.com/v4/${review.account_id}/${review.location_id}/reviews/${review.review_id}/reply`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ comment: response }),
        },
      );

      if (!putResp.ok) {
        const txt = await putResp.text();
        await supabase.from("google_reviews").update({
          ai_response_draft: response,
          response_status: "error",
          error_message: `Google API ${putResp.status}: ${txt.slice(0, 500)}`,
        }).eq("id", review_id);
        return new Response(JSON.stringify({ success: false, error: "google_publish_failed" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("google_reviews").update({
        ai_response_draft: response,
        reply_text: response,
        reply_time: new Date().toISOString(),
        response_status: "published",
        error_message: null,
      }).eq("id", review_id);

      return new Response(JSON.stringify({ success: true, provider: usedProvider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (pubErr) {
      await supabase.from("google_reviews").update({
        ai_response_draft: response,
        response_status: "error",
        error_message: `Erro ao publicar: ${(pubErr as Error).message}`,
      }).eq("id", review_id);
      return new Response(JSON.stringify({ success: false, error: (pubErr as Error).message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[reviews-respond] fatal", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});