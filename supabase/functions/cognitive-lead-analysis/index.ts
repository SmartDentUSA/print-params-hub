import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDealNote, fetchDealNotes } from "../_shared/piperun-field-map.ts";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

const VALID_STAGES = ["MQL_pesquisador", "PQL_recompra", "SAL_comparador", "SQL_decisor", "CLIENTE_ativo"];
const VALID_URGENCY = ["alta", "media", "baixa"];
const VALID_TIMELINE = ["imediato", "3_6_meses", "6_12_meses", "indefinido"];

// ── Intelligence Score helpers ──

const STAGE_ORDER = ["MQL_pesquisador", "PQL_recompra", "SAL_comparador", "SQL_decisor", "CLIENTE_ativo"];

function isRegression(oldStage: string | null, newStage: string | null): boolean {
  if (!oldStage || !newStage) return false;
  const oldIdx = STAGE_ORDER.indexOf(oldStage);
  const newIdx = STAGE_ORDER.indexOf(newStage);
  if (oldIdx === -1 || newIdx === -1) return false;
  return newIdx < oldIdx;
}

async function sha256(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}

// ── Longitudinal memory builder ──

interface LongitudinalContext {
  sessionHistory: string;
  previousStage: string | null;
  piperunContext: string;
  piperunNotes: string;
  astronContext: string;
  ecommerceContext: string;
  stageEvolution: string;
}

function buildLongitudinalContext(
  leadData: Record<string, unknown>,
  dealNotes: Array<{ text: string; created_at: string }>
): LongitudinalContext {
  const resumos = Array.isArray(leadData.historico_resumos)
    ? (leadData.historico_resumos as Array<{ data?: string; resumo?: string; msgs?: number }>)
    : [];
  const sessionHistory = resumos.length > 0
    ? resumos.slice(-10).map((r) =>
        `[${r.data || "?"}] (${r.msgs || 0} msgs): ${(r.resumo || "").slice(0, 150)}`
      ).join("\n")
    : "Nenhuma sessão anterior registrada";

  const previousStage = leadData.previous_stage as string | null;
  const cogPrev = leadData.cognitive_analysis as Record<string, unknown> | null;
  const prevTrajectory = cogPrev?.stage_trajectory as string | null;
  const stageEvolution = prevTrajectory
    ? `Trajetória anterior: ${prevTrajectory}`
    : previousStage
      ? `Último estágio detectado: ${previousStage}`
      : "Primeiro contato cognitivo";

  const piperunParts: string[] = [];
  if (leadData.piperun_pipeline_name) piperunParts.push(`Pipeline: ${leadData.piperun_pipeline_name}`);
  if (leadData.piperun_stage_name) piperunParts.push(`Etapa CRM: ${leadData.piperun_stage_name}`);
  if (leadData.proposals_total_value && Number(leadData.proposals_total_value) > 0)
    piperunParts.push(`Propostas: R$ ${Number(leadData.proposals_total_value).toLocaleString("pt-BR")}`);
  if (leadData.valor_oportunidade && Number(leadData.valor_oportunidade) > 0)
    piperunParts.push(`Valor oportunidade: R$ ${Number(leadData.valor_oportunidade).toLocaleString("pt-BR")}`);
  if (leadData.piperun_created_at)
    piperunParts.push(`Deal criado: ${new Date(leadData.piperun_created_at as string).toLocaleDateString("pt-BR")}`);
  if (leadData.piperun_closed_at)
    piperunParts.push(`Deal fechado: ${new Date(leadData.piperun_closed_at as string).toLocaleDateString("pt-BR")}`);
  if (leadData.data_fechamento_crm)
    piperunParts.push(`Fechamento CRM: ${new Date(leadData.data_fechamento_crm as string).toLocaleDateString("pt-BR")}`);
  if (leadData.piperun_stage_changed_at)
    piperunParts.push(`Última mudança etapa: ${new Date(leadData.piperun_stage_changed_at as string).toLocaleDateString("pt-BR")}`);
  const piperunContext = piperunParts.length > 0 ? piperunParts.join(" | ") : "Sem dados PipeRun";

  const piperunNotes = dealNotes.length > 0
    ? dealNotes.map((n) => `[${n.created_at ? new Date(n.created_at).toLocaleDateString("pt-BR") : "?"}] ${n.text}`).join("\n")
    : "Sem notas do vendedor";

  const astronParts: string[] = [];
  if (leadData.astron_courses_total && Number(leadData.astron_courses_total) > 0) {
    astronParts.push(`${leadData.astron_courses_completed || 0}/${leadData.astron_courses_total} cursos concluídos`);
  }
  if (leadData.astron_last_login_at) {
    astronParts.push(`Último login: ${new Date(leadData.astron_last_login_at as string).toLocaleDateString("pt-BR")}`);
  }
  if (leadData.astron_plans_active && Array.isArray(leadData.astron_plans_active) && (leadData.astron_plans_active as string[]).length > 0) {
    astronParts.push(`Planos: ${(leadData.astron_plans_active as string[]).join(", ")}`);
  }
  const astronContext = astronParts.length > 0 ? astronParts.join(" | ") : "Sem dados Astron";

  const ecommerceParts: string[] = [];
  if (leadData.lojaintegrada_ultimo_pedido_valor && Number(leadData.lojaintegrada_ultimo_pedido_valor) > 0) {
    ecommerceParts.push(`Último pedido: R$ ${Number(leadData.lojaintegrada_ultimo_pedido_valor).toLocaleString("pt-BR")}`);
  }
  if (leadData.lojaintegrada_ultimo_pedido_data) {
    ecommerceParts.push(`Data: ${new Date(leadData.lojaintegrada_ultimo_pedido_data as string).toLocaleDateString("pt-BR")}`);
  }
  const ecommerceContext = ecommerceParts.length > 0 ? ecommerceParts.join(" | ") : "Sem dados e-commerce";

  return {
    sessionHistory,
    previousStage,
    piperunContext,
    piperunNotes,
    astronContext,
    ecommerceContext,
    stageEvolution,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const { email, leadId } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Guard 1: Find lead (expanded SELECT for longitudinal memory + audit) ──
    let query = supabase.from("lia_attendances").select(
      `id, nome, email, area_atuacao, tem_impressora, tem_scanner, impressora_modelo,
       volume_mensal_pecas, ultima_etapa_comercial, resumo_historico_ia,
       status_oportunidade, cognitive_updated_at, source, rota_inicial_lia,
       produto_interesse, cognitive_analysis, lead_stage_detected,
       historico_resumos, proposals_data, proposals_total_value,
       piperun_stage_name, piperun_pipeline_name, piperun_created_at,
       piperun_closed_at, valor_oportunidade, data_fechamento_crm,
       piperun_stage_changed_at, piperun_id,
       astron_courses_completed, astron_courses_total, astron_last_login_at,
       astron_plans_active,
       lojaintegrada_ultimo_pedido_data, lojaintegrada_ultimo_pedido_valor,
       intelligence_score, proprietario_lead_crm`
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
    const { data: leadsRecord } = await supabase
      .from("leads")
      .select("id")
      .eq("email", leadData.email)
      .maybeSingle();

    const leadsId = leadsRecord?.id;

    let totalMsgs = 0;
    if (leadsId) {
      const { count: directCount } = await supabase
        .from("agent_interactions")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadsId);
      totalMsgs = directCount ?? 0;
    }
    if (totalMsgs < 5) {
      return new Response(JSON.stringify({ skip: "insufficient_messages", count: totalMsgs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Guard 3: Already current? ──
    const { data: latestInteraction } = leadsId ? await supabase
      .from("agent_interactions")
      .select("created_at")
      .eq("lead_id", leadsId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() : { data: null };

    if (leadData.cognitive_updated_at && latestInteraction?.created_at) {
      if (new Date(leadData.cognitive_updated_at) >= new Date(latestInteraction.created_at)) {
        return new Response(JSON.stringify({ skip: "already_current" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Enrichment: Fetch PipeRun notes ──
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
    let dealNotes: Array<{ text: string; created_at: string }> = [];
    if (PIPERUN_API_KEY && leadData.piperun_id) {
      try {
        dealNotes = await fetchDealNotes(PIPERUN_API_KEY, Number(leadData.piperun_id), 5);
      } catch (e) {
        console.warn("[cognitive] Failed to fetch PipeRun notes:", e);
      }
    }

    // ── Build longitudinal context ──
    const longitudinal = buildLongitudinalContext(
      { ...leadData, previous_stage: leadData.lead_stage_detected },
      dealNotes
    );

    // ── Fetch applicable opportunity rules ──
    let opportunityRulesContext = "";
    try {
      const { data: oppRules } = await supabase
        .from("opportunity_rules")
        .select("source_item, action_type, target_product_name, useful_life_months, workflow_stage")
        .eq("active", true)
        .limit(100);
      if (oppRules && oppRules.length > 0) {
        opportunityRulesContext = `\n- Regras de oportunidade configuradas (${oppRules.length} regras):\n` +
          oppRules.map(r => `  • ${r.source_item} → ${r.action_type} → ${r.target_product_name || "N/A"} (vida útil: ${r.useful_life_months}m)`).join("\n");
      }
    } catch (e) {
      console.warn("[cognitive] Failed to fetch opportunity rules:", e);
    }

    // ── Fetch last 50 interactions ──
    const { data: messages } = leadsId ? await supabase
      .from("agent_interactions")
      .select("user_message, agent_response, created_at")
      .eq("lead_id", leadsId)
      .order("created_at", { ascending: false })
      .limit(50) : { data: [] };

    const contextString = (messages || [])
      .reverse()
      .map((m) => `Usuário: ${m.user_message}\nLIA: ${m.agent_response || "(sem resposta)"}`)
      .join("\n\n");

    // ── Deterministic PQL override ──
    const isExistingCustomer = leadData.status_oportunidade === "ganha";
    const isAutonomousReentry = leadData.source !== "vendedor_direto" && leadData.rota_inicial_lia !== "vendedor_direto";
    const forcePQL = isExistingCustomer && isAutonomousReentry;

    // ── Build prompt with longitudinal memory ──
    const prompt = `Você é um analista de inteligência comercial da Smart Dent (odontologia digital 3D).
Analise o histórico de conversa, dados CRM e MEMÓRIA LONGITUDINAL abaixo e retorne ESTRITAMENTE um JSON.

**Lead:** ${leadData.nome} | Área: ${leadData.area_atuacao || "N/I"} | Impressora: ${leadData.impressora_modelo || leadData.tem_impressora || "N/I"}
Scanner: ${leadData.tem_scanner || "N/I"} | Volume: ${leadData.volume_mensal_pecas || "N/I"}
Etapa CRM: ${leadData.ultima_etapa_comercial || "N/I"} | Status: ${leadData.status_oportunidade || "N/I"}
Produto anterior: ${leadData.produto_interesse || "N/I"}
Resumo IA: ${(leadData.resumo_historico_ia || "").slice(0, 300)}

**Memória Longitudinal:**
- Sessões anteriores:
${longitudinal.sessionHistory}
- ${longitudinal.stageEvolution}
- CRM/PipeRun: ${longitudinal.piperunContext}
- Notas do vendedor:
${longitudinal.piperunNotes}
- Astron (cursos): ${longitudinal.astronContext}
- E-commerce: ${longitudinal.ecommerceContext}

**Histórico de conversa (${totalMsgs} msgs):**
${contextString.slice(0, 3500)}

**Classifique nos 10 eixos:**

1. **lead_stage_detected**: Baseado em padrões linguísticos E na memória longitudinal:
   - "MQL_pesquisador": Perguntas genéricas, "quanto custa", "como funciona", exploração inicial
   - "PQL_recompra": Já comprou antes (status_oportunidade = 'ganha'), retornou por formulário/campanha (não por vendedor), pergunta sobre outros produtos do portfólio, quer expandir
   - "SAL_comparador": Compara modelos, menciona concorrentes, "qual a diferença entre", pede demonstração
   - "SQL_decisor": Pede proposta, prazo de entrega, condições de pagamento, "quero fechar", "quando posso começar"
   - "CLIENTE_ativo": Já comprou, pergunta sobre suporte, manutenção, novos materiais

2. **interest_timeline**: "imediato" | "3_6_meses" | "6_12_meses" | "indefinido"
3. **urgency_level**: "alta" (quer agora, frases curtas, pressão) | "media" (interessado mas sem pressa) | "baixa" (só explorando)
4. **psychological_profile**: Frase curta descrevendo o perfil (ex: "Analítico cauteloso", "Impulsivo entusiasta", "Técnico detalhista")
5. **primary_motivation**: O que mais motiva este lead (ex: "Autonomia clínica", "Redução de custos com protético", "Diferencial competitivo")
6. **objection_risk**: Principal objeção provável — se notas do vendedor mencionam objeções, use-as como referência
7. **recommended_approach**: Instrução imperativa para a IA seguir (ex: "Use tom educativo, mostre ROI de 6 meses, evite pressão")
8. **confidence_score_analysis**: 0-100, confiança na classificação
9. **stage_trajectory**: Descreva a evolução do lead ao longo do tempo usando as sessões anteriores e estágios. Ex: "MQL→SAL→abandono (6 meses)→MQL (reentrada)" ou "Primeiro contato" se não houver histórico
10. **seasonal_pattern**: Identifique padrões temporais de contato. Ex: "Contato recorrente em março (2 anos consecutivos)", "Ciclo de recompra trimestral", "Primeiro contato" se não houver padrão

Retorne APENAS o JSON, sem markdown, sem explicação.`;

    const modelUsed = "deepseek-chat";

    // ── LLM call via DeepSeek API ──
    const response = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelUsed,
        max_tokens: 800,
        temperature: 0.6,
        stream: false,
        messages: [
          { role: "system", content: "Você é um analista especializado em perfil psicológico comercial. Retorne APENAS JSON válido. Sem markdown. Use EXCLUSIVAMENTE os dados fornecidos. NÃO invente nomes, datas ou valores que não estejam nos DADOS." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const result = await response.json();
    const usage = extractUsage(result);
    await logAIUsage({
      functionName: "cognitive-lead-analysis",
      actionLabel: "cognitive-profile-deepseek",
      model: modelUsed,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    });
    const rawText = result.choices?.[0]?.message?.content || "";
    console.log("[cognitive] Raw LLM response length:", rawText.length);

    // ── 3-layer sanitization ──
    let cognitiveData: Record<string, unknown>;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      let cleanText = jsonMatch ? jsonMatch[0] : rawText;
      cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
      cognitiveData = JSON.parse(cleanText);
    } catch (e) {
      console.error("[cognitive] JSON parse failed. Raw:", rawText.slice(0, 500));
      clearTimeout(timeoutId);
      return new Response(JSON.stringify({ error: "parse_failed", raw: rawText.slice(0, 200) }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enum validation ──
    if (!VALID_STAGES.includes(cognitiveData.lead_stage_detected as string)) cognitiveData.lead_stage_detected = null;
    if (!VALID_URGENCY.includes(cognitiveData.urgency_level as string)) cognitiveData.urgency_level = null;
    if (!VALID_TIMELINE.includes(cognitiveData.interest_timeline as string)) cognitiveData.interest_timeline = null;

    // ── Deterministic PQL override ──
    if (forcePQL && cognitiveData.lead_stage_detected !== "SQL_decisor") {
      cognitiveData.lead_stage_detected = "PQL_recompra";
      console.log(`[cognitive] PQL override for ${leadData.email} (status_oportunidade=ganha, autonomous re-entry)`);
    }

    // Clamp confidence score
    const rawScore = Number(cognitiveData.confidence_score_analysis);
    cognitiveData.confidence_score_analysis = isNaN(rawScore) ? null : Math.max(0, Math.min(100, Math.round(rawScore)));

    // Validate new string fields
    if (typeof cognitiveData.stage_trajectory !== "string") cognitiveData.stage_trajectory = null;
    else cognitiveData.stage_trajectory = (cognitiveData.stage_trajectory as string).slice(0, 300);
    if (typeof cognitiveData.seasonal_pattern !== "string") cognitiveData.seasonal_pattern = null;
    else cognitiveData.seasonal_pattern = (cognitiveData.seasonal_pattern as string).slice(0, 200);

    // ── Audit trail ──
    const promptHash = await sha256(prompt + modelUsed);
    const contextHash = await sha256(JSON.stringify({ longitudinal, contextString: contextString.slice(0, 500) }) + modelUsed);

    cognitiveData._audit = {
      prompt_v: 2,
      model: modelUsed,
      prompt_hash: promptHash,
      context_hash: contextHash,
      calculated_at: new Date().toISOString(),
    };

    // ── Upsert ──
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

    // ── Emit state event if stage changed ──
    const oldStage = leadData.lead_stage_detected;
    const newStage = cognitiveData.lead_stage_detected as string | null;

    if (oldStage !== newStage && newStage) {
      const regression = isRegression(oldStage, newStage);
      const lastChangeAt = leadData.piperun_stage_changed_at;
      const regressionGapDays = lastChangeAt
        ? Math.floor((Date.now() - new Date(lastChangeAt as string).getTime()) / 86400000)
        : null;

      await supabase.from("lead_state_events").insert({
        lead_id: leadData.id,
        old_stage: oldStage,
        new_stage: newStage,
        cognitive_stage: newStage,
        owner_id: (leadData.proprietario_lead_crm as string) || null,
        source: "cognitive-lead-analysis",
        is_regression: regression,
        regression_gap_days: regressionGapDays,
        intelligence_score: leadData.intelligence_score || null,
      }).catch((e: unknown) => console.warn("[cognitive] State event insert failed:", e));
    }

    // ── Update audit fields ──
    await supabase.from("lia_attendances").update({
      cognitive_model_version: modelUsed,
      cognitive_prompt_hash: promptHash,
      cognitive_context_hash: contextHash,
      cognitive_analyzed_at: new Date().toISOString(),
    }).eq("id", leadData.id).catch((e: unknown) => console.warn("[cognitive] Audit fields update failed:", e));

    // ── Recalculate intelligence score ──
    await supabase.rpc("calculate_lead_intelligence_score", { p_lead_id: leadData.id })
      .catch((e: unknown) => console.warn("[cognitive] Intelligence score RPC failed:", e));

    // ── Push cognitive note to PipeRun deal ──
    if (PIPERUN_API_KEY) {
      const { data: piperunLead } = await supabase
        .from("lia_attendances")
        .select("piperun_id")
        .eq("id", leadData.id)
        .single();

      if (piperunLead?.piperun_id) {
        const noteLines = [
          `🧠 Análise Cognitiva L.I.A. (${new Date().toLocaleDateString("pt-BR")})`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📊 Estágio: ${cognitiveData.lead_stage_detected || "N/I"}`,
          `⏱️ Timeline: ${cognitiveData.interest_timeline || "N/I"}`,
          `🔥 Urgência: ${cognitiveData.urgency_level || "N/I"}`,
          `🧬 Perfil: ${cognitiveData.psychological_profile || "N/I"}`,
          `💡 Motivação: ${cognitiveData.primary_motivation || "N/I"}`,
          `⚠️ Objeção provável: ${cognitiveData.objection_risk || "N/I"}`,
          `📋 Abordagem: ${cognitiveData.recommended_approach || "N/I"}`,
          `📈 Confiança: ${cognitiveData.confidence_score_analysis || 0}%`,
          `📐 Trajetória: ${cognitiveData.stage_trajectory || "N/I"}`,
          `📅 Padrão sazonal: ${cognitiveData.seasonal_pattern || "N/I"}`,
        ];

        const noteResult = await addDealNote(
          PIPERUN_API_KEY,
          Number(piperunLead.piperun_id),
          noteLines.join("\n")
        );

        if (noteResult.success) {
          console.log(`[cognitive] ✅ Nota PipeRun inserida deal ${piperunLead.piperun_id}`);
        } else {
          console.warn(`[cognitive] ⚠️ Nota PipeRun falhou deal ${piperunLead.piperun_id}:`, noteResult.data);
        }
      }
    }

    clearTimeout(timeoutId);
    console.log(`[cognitive] ✅ ${leadData.email} → ${cognitiveData.lead_stage_detected} (confidence: ${cognitiveData.confidence_score_analysis}, trajectory: ${cognitiveData.stage_trajectory})`);

    return new Response(JSON.stringify({
      success: true,
      stage: cognitiveData.lead_stage_detected,
      urgency: cognitiveData.urgency_level,
      confidence: cognitiveData.confidence_score_analysis,
      trajectory: cognitiveData.stage_trajectory,
      seasonal: cognitiveData.seasonal_pattern,
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
