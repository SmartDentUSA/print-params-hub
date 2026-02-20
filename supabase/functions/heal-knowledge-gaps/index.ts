import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOISE_PATTERNS = [
  /^.{1,9}$/,
  /^(olá|ola|oi|hey|hi|hello|ok|sim|não|nao|obrigado|obrigada|vlw|valeu|bom dia|boa tarde|boa noite)\b/i,
  /^(que merda|caramba|nossa|puts|poxa|tá|ta|show|blz|legal|ótimo|otimo|certo|entendi|ok|tudo bem|tá bom)\b/i,
];

function isNoise(question: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(question.trim()));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error: ${err}`);
  }
  const data = await res.json();
  return data.embedding?.values ?? [];
}

async function generateFAQDraft(
  questions: string[],
  lovableApiKey: string
): Promise<{ draft_title: string; draft_excerpt: string; faqs: { q: string; a: string }[]; keywords: string[] }> {
  const prompt = `Você é um especialista em odontologia digital e resinas 3D para impressão dental (contexto: SmartDent).

Analise estas perguntas de usuários que não foram respondidas e crie um rascunho de FAQ técnico:

Perguntas:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Responda APENAS com JSON válido no formato:
{
  "draft_title": "Título do artigo FAQ (max 70 chars, técnico e descritivo)",
  "draft_excerpt": "Resumo do artigo (max 160 chars, explica o que o artigo cobre)",
  "faqs": [
    {"q": "Pergunta técnica elaborada", "a": "Resposta técnica detalhada sobre o tema odontológico/dental 3D"},
    {"q": "Segunda pergunta relacionada", "a": "Resposta correspondente"}
  ],
  "keywords": ["palavra-chave1", "palavra-chave2", "palavra-chave3"]
}

Use linguagem técnica adequada para profissionais de odontologia. As respostas dos FAQs devem ter pelo menos 2 frases.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um especialista em odontologia digital. Responda sempre em JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lovable AI error: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      draft_title: parsed.draft_title ?? "FAQ Gerado pela IA",
      draft_excerpt: parsed.draft_excerpt ?? "",
      faqs: parsed.faqs ?? [],
      keywords: parsed.keywords ?? [],
    };
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      return {
        draft_title: parsed.draft_title ?? "FAQ Gerado pela IA",
        draft_excerpt: parsed.draft_excerpt ?? "",
        faqs: parsed.faqs ?? [],
        keywords: parsed.keywords ?? [],
      };
    }
    throw new Error("Não foi possível parsear JSON da resposta da IA");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify admin
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check admin role
  const { data: roleData } = await adminSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Acesso negado — requer permissão admin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ─── ACTION: list ───────────────────────────────────────────────────────
    if (action === "list" || (req.method === "GET" && !action)) {
      const { data, error } = await adminSupabase
        .from("knowledge_gap_drafts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ drafts: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: generate ──────────────────────────────────────────────────
    if (action === "generate") {
      // 1. Fetch pending gaps
      const { data: gaps, error: gapsError } = await adminSupabase
        .from("agent_knowledge_gaps")
        .select("id, question, frequency")
        .eq("status", "pending")
        .order("frequency", { ascending: false });

      if (gapsError) throw gapsError;
      if (!gaps || gaps.length === 0) {
        return new Response(
          JSON.stringify({ drafts_created: 0, gaps_analyzed: 0, noise_filtered: 0, message: "Nenhuma lacuna pendente" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Filter noise
      const validGaps = gaps.filter((g) => !isNoise(g.question));
      const noiseFiltered = gaps.length - validGaps.length;

      if (validGaps.length === 0) {
        return new Response(
          JSON.stringify({ drafts_created: 0, gaps_analyzed: gaps.length, noise_filtered: noiseFiltered, message: "Todas as lacunas foram filtradas como ruído" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Generate embeddings (batch with small delay to avoid rate limiting)
      const gapsWithEmbeddings: { id: string; question: string; frequency: number; embedding: number[] }[] = [];
      for (const gap of validGaps) {
        try {
          const embedding = await generateEmbedding(gap.question, GOOGLE_AI_KEY);
          gapsWithEmbeddings.push({ ...gap, embedding });
          // Small delay to avoid rate limiting
          await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
          console.error(`Failed to embed gap ${gap.id}:`, e);
        }
      }

      // 4. Greedy centroid clustering
      const clusters: { centroid: typeof gapsWithEmbeddings[0]; members: typeof gapsWithEmbeddings }[] = [];
      const assigned = new Set<string>();

      for (const gap of gapsWithEmbeddings) {
        if (assigned.has(gap.id)) continue;

        // This gap becomes a centroid
        const cluster = { centroid: gap, members: [gap] };
        assigned.add(gap.id);

        // Find similar gaps
        for (const other of gapsWithEmbeddings) {
          if (assigned.has(other.id)) continue;
          const sim = cosineSimilarity(gap.embedding, other.embedding);
          if (sim >= 0.75) {
            cluster.members.push(other);
            assigned.add(other.id);
          }
        }

        clusters.push(cluster);
      }

      // 5. Generate FAQ drafts for each cluster
      let draftsCreated = 0;

      for (const cluster of clusters) {
        try {
          const questions = cluster.members.map((m) => m.question);
          const gapIds = cluster.members.map((m) => m.id);

          const faqData = await generateFAQDraft(questions, LOVABLE_API_KEY);

          // 6. Save draft
          const { error: insertError } = await adminSupabase
            .from("knowledge_gap_drafts")
            .insert({
              draft_title: faqData.draft_title,
              draft_excerpt: faqData.draft_excerpt,
              draft_faq: faqData.faqs,
              draft_keywords: faqData.keywords,
              gap_ids: gapIds,
              cluster_questions: questions,
              status: "draft",
            });

          if (insertError) {
            console.error("Error inserting draft:", insertError);
          } else {
            draftsCreated++;
          }

          // Small delay between cluster generations
          await new Promise((r) => setTimeout(r, 200));
        } catch (e) {
          console.error(`Error generating FAQ for cluster:`, e);
        }
      }

      return new Response(
        JSON.stringify({
          drafts_created: draftsCreated,
          gaps_analyzed: gaps.length,
          noise_filtered: noiseFiltered,
          clusters_found: clusters.length,
          embeddings_generated: gapsWithEmbeddings.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: approve ───────────────────────────────────────────────────
    if (action === "approve") {
      const body = await req.json();
      const { draft_id, title, excerpt, faqs, keywords, category_id } = body;

      if (!draft_id) {
        return new Response(JSON.stringify({ error: "draft_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify draft exists
      const { data: draft, error: draftError } = await adminSupabase
        .from("knowledge_gap_drafts")
        .select("*")
        .eq("id", draft_id)
        .eq("status", "draft")
        .maybeSingle();

      if (draftError) throw draftError;
      if (!draft) {
        return new Response(JSON.stringify({ error: "Rascunho não encontrado ou já processado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate unique slug
      const baseSlug =
        (title || draft.draft_title)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + "-faq-auto";

      let slug = baseSlug;
      let suffix = 2;
      while (true) {
        const { data: existing } = await adminSupabase
          .from("knowledge_contents")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existing) break;
        slug = `${baseSlug}-${suffix++}`;
        if (suffix > 20) break;
      }

      // Insert into knowledge_contents
      const { data: newContent, error: insertError } = await adminSupabase
        .from("knowledge_contents")
        .insert({
          title: title || draft.draft_title,
          slug,
          excerpt: excerpt || draft.draft_excerpt,
          faqs: faqs || draft.draft_faq,
          keywords: keywords || draft.draft_keywords,
          category_id: category_id || null,
          active: true,
          icon_color: "blue",
          order_index: 0,
        })
        .select("id, slug")
        .single();

      if (insertError) throw insertError;

      // Update draft status
      await adminSupabase
        .from("knowledge_gap_drafts")
        .update({
          status: "approved",
          published_content_id: newContent.id,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.email ?? user.id,
        })
        .eq("id", draft_id);

      // Mark all gap_ids as resolved
      if (draft.gap_ids && draft.gap_ids.length > 0) {
        await adminSupabase
          .from("agent_knowledge_gaps")
          .update({ status: "resolved", resolution_note: `Auto-healed → ${newContent.slug}` })
          .in("id", draft.gap_ids);
      }

      // Trigger incremental RAG indexing
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/index-embeddings?mode=incremental`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
        });
      } catch (e) {
        console.warn("RAG indexing trigger failed (non-fatal):", e);
      }

      return new Response(
        JSON.stringify({ success: true, content_id: newContent.id, slug: newContent.slug }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: reject ────────────────────────────────────────────────────
    if (action === "reject") {
      const body = await req.json();
      const { draft_id } = body;

      if (!draft_id) {
        return new Response(JSON.stringify({ error: "draft_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminSupabase
        .from("knowledge_gap_drafts")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.email ?? user.id })
        .eq("id", draft_id)
        .eq("status", "draft");

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("heal-knowledge-gaps error:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
