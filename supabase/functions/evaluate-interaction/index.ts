import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  try {
    const body = await req.json();
    const { record, old_record } = body;

    // ── Idempotency guardrails ──────────────────────────────────────────────
    // Only evaluate when agent_response was JUST filled (INSERT had NULL, UPDATE has value)
    if (!record?.agent_response || old_record?.agent_response) {
      return new Response(
        JSON.stringify({ message: "Skip: agent_response not yet filled or already existed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    // Skip if already evaluated, marked as unanswered, or has no context to compare against
    if (record.judge_evaluated_at || record.unanswered || !record.context_raw) {
      return new Response(
        JSON.stringify({ message: "Skip: already evaluated, unanswered, or no context_raw" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Guard: mensagens muito curtas (< 10 chars) não têm conteúdo técnico para auditar
    // Exemplos de ruído: "ok", "vlw", "oi", "sim" — nunca contêm perguntas técnicas
    if ((record.user_message?.length ?? 0) < 10) {
      return new Response(
        JSON.stringify({ message: "Skip: user_message too short for meaningful evaluation" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const judgePrompt = `Você é um auditor de qualidade de IA odontológica (SmartDent). Avalie a fidelidade técnica da resposta abaixo com foco em DETECTAR ALUCINAÇÕES de parâmetros técnicos.

PERGUNTA DO USUÁRIO:
${record.user_message}

CONTEXTO RAG (único material autorizado — o que a IA recebeu para responder):
${record.context_raw}

RESPOSTA DA IA:
${record.agent_response}

ATENÇÃO — FONTES VÁLIDAS NO CONTEXTO RAG:
O contexto acima pode conter MÚLTIPLOS tipos de fonte, TODOS são contexto válido:
- [CATALOG_PRODUCT]: dados de produtos do catálogo com preços, FAQs, descrições e categorias — SÃO CONTEXTO VÁLIDO
- [PROCESSING_PROTOCOL]: instruções de processamento de resinas (limpeza, cura, térmico) — SÃO CONTEXTO VÁLIDO
- [COMPANY_KB]: conhecimento comercial, scripts de venda, expertise de produto — SÃO CONTEXTO VÁLIDO
- [PARAMETER_SET]: parâmetros de impressão 3D (layer height, exposição, etc) — SÃO CONTEXTO VÁLIDO
- [ARTICLE]: artigos técnicos da base de conhecimento — SÃO CONTEXTO VÁLIDO
- [VIDEO]: títulos e metadados de vídeos — SÃO CONTEXTO VÁLIDO
- [RESIN]: dados de resinas com preços e descrições — SÃO CONTEXTO VÁLIDO
- Seções "## PRODUTOS RECOMENDADOS", "## ARGUMENTOS DE VENDA", etc. — são agrupamentos semânticos do mesmo contexto, TODOS VÁLIDOS

Se a IA citou um dado que aparece em QUALQUER uma dessas fontes no contexto acima, NÃO é alucinação.
Só classifique como "hallucination" se o dado técnico/comercial citado pela IA REALMENTE não existe em NENHUMA parte do contexto.

CRITÉRIOS DE AVALIAÇÃO:
- score 0 + "hallucination": A IA citou parâmetro técnico (layer height, tempo de exposição, velocidade de lift, intensidade de luz, etc.) ou dado comercial (preço, nome de produto) que NÃO está presente em NENHUMA fonte do contexto acima
- score 1-2 + "off_topic": Citou produto/impressora/resina não solicitado pelo usuário, ou usou termos vagos proibidos ("geralmente", "provavelmente", "normalmente", "em geral", "costuma ser")
- score 3 + "incomplete": Resposta tecnicamente correta mas omitiu informações importantes presentes no contexto
- score 4-5 + "ok": Baseada estritamente no contexto, precisa, direta, sem invenção

IMPORTANTE: NÃO penalize respostas curtas ou diretas se estiverem tecnicamente corretas.
NÃO penalize se o usuário fez uma pergunta geral e a IA respondeu de forma geral (sem inventar dados).
NÃO penalize se a IA citou preço ou FAQ de um [CATALOG_PRODUCT] — isso é contexto válido, não alucinação.

Retorne APENAS um JSON válido: {"score": 0-5, "verdict": "hallucination|off_topic|incomplete|ok", "reason": "explicação em 1 frase"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: judgePrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No content in AI response");
    }

    let evaluation: { score: number; verdict: string; reason: string };
    try {
      evaluation = JSON.parse(rawContent);
    } catch {
      throw new Error(`Failed to parse judge JSON: ${rawContent}`);
    }

    // Clamp score between 0 and 5
    const safeScore = Math.max(0, Math.min(5, Math.round(evaluation.score ?? 3)));
    const safeVerdict = ["hallucination", "off_topic", "incomplete", "ok"].includes(evaluation.verdict)
      ? evaluation.verdict
      : "ok";

    const { error: updateError } = await supabase
      .from("agent_interactions")
      .update({
        judge_score: safeScore,
        judge_verdict: safeVerdict,
        judge_evaluated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (updateError) throw updateError;

    console.log(`[evaluate-interaction] Evaluated interaction ${record.id}: score=${safeScore}, verdict=${safeVerdict}`);

    return new Response(
      JSON.stringify({ status: "success", score: safeScore, verdict: safeVerdict, reason: evaluation.reason }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[evaluate-interaction] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
