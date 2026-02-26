import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CHAT_API = "https://ai.gateway.lovable.dev/v1/chat/completions";

const VALID_STAGES = ["MQL_pesquisador", "SAL_comparador", "SQL_decisor", "CLIENTE_ativo"];
const VALID_URGENCY = ["alta", "media", "baixa"];
const VALID_TIMELINE = ["imediato", "3_6_meses", "6_12_meses", "indefinido"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const { email, leadId } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Guard 1: Find lead ──
    let query = supabase.from("lia_attendances").select(
      "id, nome, email, area_atuacao, tem_impressora, tem_scanner, impressora_modelo, volume_mensal_pecas, ultima_etapa_comercial, resumo_historico_ia, status_oportunidade, cognitive_updated_at"
    );
    if (email) query = query.eq("email", email);
    else if (leadId) query = query.eq("id", leadId);
    else throw new Error("email or leadId required");

    const { data: leadData, error: leadError } = await query.maybeSingle();
    if (leadError || !leadData) {
      return new Response(JSON.stringify({ skip: "lead_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Guard 2: Min 5 messages ──
    const { count: msgCount } = await supabase
      .from("agent_interactions")
      .select("id", { count: "exact", head: true })
      .in("session_id", 
        supabase.from("agent_sessions").select("session_id").eq("lead_id", leadData.id)
      );

    // Fallback: count by lead_id directly
    const { count: directCount } = await supabase
      .from("agent_interactions")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadData.id);

    const totalMsgs = directCount ?? msgCount ?? 0;
    if (totalMsgs < 5) {
      return new Response(JSON.stringify({ skip: "insufficient_messages", count: totalMsgs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Guard 3: Already current? ──
    const { data: latestInteraction } = await supabase
      .from("agent_interactions")
      .select("created_at")
      .eq("lead_id", leadData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadData.cognitive_updated_at && latestInteraction?.created_at) {
      if (new Date(leadData.cognitive_updated_at) >= new Date(latestInteraction.created_at)) {
        return new Response(JSON.stringify({ skip: "already_current" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Fetch last 50 interactions ──
    const { data: messages } = await supabase
      .from("agent_interactions")
      .select("user_message, agent_response, created_at")
      .eq("lead_id", leadData.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const contextString = (messages || [])
      .reverse()
      .map((m) => `Usuário: ${m.user_message}\nLIA: ${m.agent_response || "(sem resposta)"}`)
      .join("\n\n");

    // ── Build prompt ──
    const prompt = `Você é um analista de inteligência comercial da Smart Dent (odontologia digital 3D).
Analise o histórico de conversa e dados CRM abaixo e retorne ESTRITAMENTE um JSON.

**Lead:** ${leadData.nome} | Área: ${leadData.area_atuacao || "N/I"} | Impressora: ${leadData.impressora_modelo || leadData.tem_impressora || "N/I"}
Scanner: ${leadData.tem_scanner || "N/I"} | Volume: ${leadData.volume_mensal_pecas || "N/I"}
Etapa CRM: ${leadData.ultima_etapa_comercial || "N/I"} | Status: ${leadData.status_oportunidade || "N/I"}
Resumo IA: ${(leadData.resumo_historico_ia || "").slice(0, 300)}

**Histórico de conversa (${totalMsgs} msgs):**
${contextString.slice(0, 4000)}

**Classifique nos 7 eixos:**

1. **lead_stage_detected**: Baseado em padrões linguísticos:
   - "MQL_pesquisador": Perguntas genéricas, "quanto custa", "como funciona", exploração inicial
   - "SAL_comparador": Compara modelos, menciona concorrentes, "qual a diferença entre", pede demonstração
   - "SQL_decisor": Pede proposta, prazo de entrega, condições de pagamento, "quero fechar", "quando posso começar"
   - "CLIENTE_ativo": Já comprou, pergunta sobre suporte, manutenção, novos materiais

2. **interest_timeline**: "imediato" | "3_6_meses" | "6_12_meses" | "indefinido"
3. **urgency_level**: "alta" (quer agora, frases curtas, pressão) | "media" (interessado mas sem pressa) | "baixa" (só explorando)
4. **psychological_profile**: Frase curta descrevendo o perfil (ex: "Analítico cauteloso", "Impulsivo entusiasta", "Técnico detalhista")
5. **primary_motivation**: O que mais motiva este lead (ex: "Autonomia clínica", "Redução de custos com protético", "Diferencial competitivo")
6. **objection_risk**: Principal objeção provável (ex: "Preço alto", "Curva de aprendizado", "Já tem fornecedor")
7. **recommended_approach**: Instrução imperativa para a IA seguir (ex: "Use tom educativo, mostre ROI de 6 meses, evite pressão")
8. **confidence_score_analysis**: 0-100, confiança na classificação

Retorne APENAS o JSON, sem markdown, sem explicação.`;

    // ── LLM call via Lovable AI Gateway ──
    const response = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 400,
        stream: false,
        messages: [
          { role: "system", content: "Você retorna APENAS JSON válido. Sem markdown, sem explicações." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    const result = await response.json();
    const rawText = result.choices?.[0]?.message?.content || "";
    console.log("[cognitive] Raw LLM response length:", rawText.length);

    // ── 3-layer sanitization ──
    let cognitiveData: Record<string, unknown>;
    try {
      // Layer 1: Extract JSON object via regex
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      let cleanText = jsonMatch ? jsonMatch[0] : rawText;

      // Layer 2: Strip markdown artifacts
      cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();

      // Layer 3: Defensive parse
      cognitiveData = JSON.parse(cleanText);
    } catch (e) {
      console.error("[cognitive] JSON parse failed. Raw:", rawText.slice(0, 500));
      clearTimeout(timeoutId);
      return new Response(JSON.stringify({ error: "parse_failed", raw: rawText.slice(0, 200) }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enum validation (NULL invalid values to avoid CHECK constraint violations) ──
    if (!VALID_STAGES.includes(cognitiveData.lead_stage_detected as string)) cognitiveData.lead_stage_detected = null;
    if (!VALID_URGENCY.includes(cognitiveData.urgency_level as string)) cognitiveData.urgency_level = null;
    if (!VALID_TIMELINE.includes(cognitiveData.interest_timeline as string)) cognitiveData.interest_timeline = null;

    // Clamp confidence score
    const rawScore = Number(cognitiveData.confidence_score_analysis);
    cognitiveData.confidence_score_analysis = isNaN(rawScore) ? null : Math.max(0, Math.min(100, Math.round(rawScore)));

    // ── Upsert (cognitive_updated_at ONLY after successful parse + validation) ──
    const { error: updateError } = await supabase
      .from("lia_attendances")
      .update({
        cognitive_analysis: cognitiveData,
        cognitive_updated_at: new Date().toISOString(),
        lead_stage_detected: cognitiveData.lead_stage_detected,
        interest_timeline: cognitiveData.interest_timeline,
        urgency_level: cognitiveData.urgency_level,
        psychological_profile: typeof cognitiveData.psychological_profile === "string" ? cognitiveData.psychological_profile.slice(0, 200) : null,
        primary_motivation: typeof cognitiveData.primary_motivation === "string" ? cognitiveData.primary_motivation.slice(0, 200) : null,
        objection_risk: typeof cognitiveData.objection_risk === "string" ? cognitiveData.objection_risk.slice(0, 200) : null,
        recommended_approach: typeof cognitiveData.recommended_approach === "string" ? cognitiveData.recommended_approach.slice(0, 500) : null,
        confidence_score_analysis: cognitiveData.confidence_score_analysis,
      })
      .eq("id", leadData.id);

    if (updateError) {
      console.error("[cognitive] Update error:", updateError);
      throw updateError;
    }

    clearTimeout(timeoutId);
    console.log(`[cognitive] ✅ ${leadData.email} → ${cognitiveData.lead_stage_detected} (confidence: ${cognitiveData.confidence_score_analysis})`);

    return new Response(JSON.stringify({
      success: true,
      stage: cognitiveData.lead_stage_detected,
      urgency: cognitiveData.urgency_level,
      confidence: cognitiveData.confidence_score_analysis,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cognitive] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof DOMException && err.name === "AbortError" ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
