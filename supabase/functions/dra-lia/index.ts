import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

const CHAT_API = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Multilingual fallback messages when no results found
const FALLBACK_MESSAGES: Record<string, string> = {
  "pt-BR": `Ainda não tenho essa informação em nossa base de conhecimento, mas nossos especialistas podem ajudar você! 😊

💬 **WhatsApp:** [(16) 99383-1794](https://wa.me/5516993831794)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horário:** Segunda a Sexta, 08h às 18h

Nossa equipe está pronta para explicar melhor!`,

  "en-US": `I don't have this information in our knowledge base yet, but our specialists can help you! 😊

💬 **WhatsApp:** [(16) 99383-1794](https://wa.me/5516993831794)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Hours:** Monday to Friday, 8am–6pm (BRT)

Our team is ready to help!`,

  "es-ES": `Todavía no tengo esa información en nuestra base de conocimiento, pero nuestros especialistas pueden ayudarte! 😊

💬 **WhatsApp:** [(16) 99383-1794](https://wa.me/5516993831794)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horario:** Lunes a Viernes, 08h–18h (BRT)

¡Nuestro equipo está listo para ayudarte!`,
};

const LANG_INSTRUCTIONS: Record<string, string> = {
  "pt-BR": "RESPONDA SEMPRE em português do Brasil (pt-BR). Mesmo que os dados do contexto estejam em outro idioma.",
  "en-US": "ALWAYS RESPOND in English (en-US). Even if the context data is in Portuguese or Spanish. Translate technical descriptions but keep numerical values as-is.",
  "es-ES": "RESPONDE SIEMPRE en español (es-ES). Aunque los datos del contexto estén en portugués. Traduce las descripciones pero mantén los valores numéricos.",
};

// Generate embedding via Google AI API (if key available) or return null
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!GOOGLE_AI_KEY) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        }),
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.embedding?.values || null;
  } catch {
    return null;
  }
}

// Search using pgvector if embeddings available, otherwise full-text search
async function searchKnowledge(
  supabase: ReturnType<typeof createClient>,
  query: string,
  lang: string
) {
  // Try vector search first
  const embedding = await generateEmbedding(query);

  if (embedding) {
    const { data, error } = await supabase.rpc("match_agent_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 10,
    });
    if (!error && data && data.length > 0) {
      return { results: data, method: "vector", topSimilarity: data[0]?.similarity || 0 };
    }
  }

  // Fallback: full-text search via existing search_knowledge_base function
  const langCode = lang.split("-")[0]; // 'pt' | 'en' | 'es'
  const { data: articles, error: artError } = await supabase.rpc("search_knowledge_base", {
    search_query: query,
    language_code: langCode,
  });

  if (!artError && articles && articles.length > 0) {
    // Convert to unified format
    const results = articles.slice(0, 8).map((a: {
      content_id: string;
      content_type: string;
      title: string;
      excerpt: string;
      slug: string;
      category_letter: string;
      relevance: number;
    }) => ({
      id: a.content_id,
      source_type: a.content_type,
      chunk_text: `${a.title} | ${a.excerpt}`,
      metadata: {
        title: a.title,
        slug: a.slug,
        category_letter: a.category_letter,
        url_publica: `/base-conhecimento/${a.category_letter}/${a.slug}`,
      },
      similarity: a.relevance,
    }));
    return { results, method: "fulltext", topSimilarity: results[0]?.similarity || 0 };
  }

  // Last resort: keyword search on videos
  const keywords = query.split(" ").filter((w) => w.length > 3).slice(0, 4);
  const videoQuery = keywords.map((k) => `%${k}%`).join("|");

  if (keywords.length > 0) {
    const { data: videos } = await supabase
      .from("knowledge_videos")
      .select("id, title, description, embed_url, thumbnail_url, content_id")
      .or(keywords.map((k) => `title.ilike.%${k}%`).join(","))
      .limit(5);

    if (videos && videos.length > 0) {
      const results = videos.map((v: {
        id: string;
        title: string;
        description: string | null;
        embed_url: string | null;
        thumbnail_url: string | null;
        content_id: string | null;
      }) => ({
        id: v.id,
        source_type: "video",
        chunk_text: `${v.title} ${v.description || ""}`,
        metadata: {
          title: v.title,
          embed_url: v.embed_url,
          thumbnail_url: v.thumbnail_url,
          video_id: v.id,
        },
        similarity: 0.5,
      }));
      return { results, method: "keyword", topSimilarity: 0.5 };
    }
  }

  return { results: [], method: "none", topSimilarity: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "chat";

    // ── ACTION: feedback ─────────────────────────────────────────
    if (action === "feedback") {
      const { interaction_id, feedback, feedback_comment } = await req.json();

      await supabase
        .from("agent_interactions")
        .update({ feedback, feedback_comment })
        .eq("id", interaction_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: chat ─────────────────────────────────────────────
    const { message, history = [], lang = "pt-BR", session_id } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Search knowledge base (vector or fulltext)
    const { results, method, topSimilarity } = await searchKnowledge(supabase, message, lang);

    const hasResults = results.length > 0;
    const MIN_SIMILARITY = method === "vector" ? 0.65 : 0.0; // fulltext always proceeds if results found

    // 2. If no results: return human fallback
    if (!hasResults) {
      const fallbackText = FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES["pt-BR"];

      const { data: interaction } = await supabase
        .from("agent_interactions")
        .insert({
          session_id,
          user_message: message,
          agent_response: fallbackText,
          lang,
          top_similarity: 0,
          context_sources: [],
          unanswered: true,
        })
        .select("id")
        .single();

      // Track knowledge gap
      await supabase
        .from("agent_knowledge_gaps")
        .insert({ question: message.slice(0, 500), lang })
        .onConflict?.("question");

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ interaction_id: interaction?.id, type: "meta" })}\n\n`)
          );
          const words = fallbackText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`)
              );
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 3. Build context from search results
    const contextParts = results.map((m: {
      source_type: string;
      chunk_text: string;
      metadata: Record<string, unknown>;
    }) => {
      const meta = m.metadata as Record<string, unknown>;
      let part = `[${m.source_type.toUpperCase()}] ${m.chunk_text}`;
      if (meta.url_publica) part += ` | URL: ${meta.url_publica}`;
      if (meta.embed_url) part += ` | VIDEO_EMBED: ${meta.embed_url}`;
      if (meta.thumbnail_url) part += ` | THUMBNAIL: ${meta.thumbnail_url}`;
      if (meta.cta_1_url) part += ` | COMPRA: ${meta.cta_1_url}`;
      return part;
    });

    const context = contextParts.join("\n\n---\n\n");
    const langInstruction = LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS["pt-BR"];

    const systemPrompt = `Você é a Dra. L.I.A. (Linguagem de Inteligência Artificial), assistente oficial da SmartDent especializada em odontologia digital e impressão 3D dental.

IDIOMA DA RESPOSTA:
${langInstruction}

REGRAS ABSOLUTAS:
1. USE APENAS os dados fornecidos abaixo — nunca invente dados técnicos
2. Ao encontrar um VÍDEO com VIDEO_EMBED: forneça o título e um link Markdown clicável [▶ Assistir](VIDEO_EMBED_URL)
3. Ao encontrar PARÂMETROS: apresente em formato legível com os valores exatos
4. Ao encontrar RESINA com COMPRA: inclua um link [Ver produto](URL)
5. Cite a fonte naturalmente: "Com base nos dados cadastrados:", "No vídeo [título]:"
6. Tom: especialista empática, clara e didática — nunca robótica
7. Formate com Markdown: **negrito** para termos importantes, listas quando útil
8. Valores técnicos (tempos em segundos, alturas em mm) NUNCA traduzir — apenas o texto ao redor
9. Se houver múltiplos resultados relevantes, mencione os melhores 2-3, não todos
10. Busca usada: ${method} — seja precisa e baseie-se apenas nos dados fornecidos

--- DADOS DAS FONTES ---
${context}
--- FIM DOS DADOS ---

Responda à pergunta do usuário usando APENAS as fontes acima.`;

    // 4. Stream response via Gemini
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: messagesForAI,
        stream: true,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    // 5. Save interaction
    const contextSources = results.map((m: { source_type: string; metadata: Record<string, unknown> }) => ({
      type: m.source_type,
      title: (m.metadata as Record<string, unknown>).title,
    }));

    const { data: interaction } = await supabase
      .from("agent_interactions")
      .insert({
        session_id,
        user_message: message,
        lang,
        top_similarity: topSimilarity,
        context_sources: contextSources,
        unanswered: false,
      })
      .select("id")
      .single();

    // 6. Stream AI response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const transformedStream = new ReadableStream({
      async start(controller) {
        if (!aiResponse.body) { controller.close(); return; }

        // Send interaction meta first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ interaction_id: interaction?.id, type: "meta" })}\n\n`)
        );

        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              if (fullResponse) {
                await supabase
                  .from("agent_interactions")
                  .update({ agent_response: fullResponse })
                  .eq("id", interaction?.id);
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
              }
            } catch { /* partial JSON */ }
          }
        }
        controller.close();
      },
    });

    return new Response(transformedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("dra-lia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
