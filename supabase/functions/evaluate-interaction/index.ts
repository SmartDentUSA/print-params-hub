import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

serve(async (req) => {
  try {
    const body = await req.json();
    const { record, old_record } = body;

    // ── Idempotency guardrails ──────────────────────────────────────────────
    if (!record?.agent_response || old_record?.agent_response) {
      return new Response(
        JSON.stringify({ message: "Skip: agent_response not yet filled or already existed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (record.judge_evaluated_at || record.unanswered || !record.context_raw) {
      return new Response(
        JSON.stringify({ message: "Skip: already evaluated, unanswered, or no context_raw" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
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

    const judgePrompt = `Você é um auditor de qualidade de IA odontológica (SmartDent). Avalie a fidelidade técnica da resposta abaixo.

PERGUNTA DO USUÁRIO:
${record.user_message}

CONTEXTO RAG (único material autorizado — o que a IA recebeu para responder):
${record.context_raw}

RESPOSTA DA IA:
${record.agent_response}

═══ REGRAS DE AVALIAÇÃO ═══

**IMPORTANTE — RESPOSTAS DE PERSONA/COMPORTAMENTO NÃO SÃO ALUCINAÇÕES:**
A IA tem uma PERSONA definida (Dra. L.I.A., consultora de odontologia digital). Respostas sobre:
- Saudações, apresentações, despedidas ("Olá! Sou a Dra. L.I.A...")
- Perguntas de qualificação SPIN ("Qual sua especialidade?", "Que equipamento usa?")
- Ofertas de agendamento/contato ("Posso te conectar com nosso time...")
- Respostas conversacionais ("Fico feliz em ajudar!", "Entendi sua dúvida")
- Meta-respostas sobre o próprio sistema ("Sou uma assistente virtual...")
→ São COMPORTAMENTO ESPERADO da persona, NÃO alucinação. Score 4-5.

**FONTES VÁLIDAS NO CONTEXTO RAG:**
O contexto pode conter MÚLTIPLOS tipos de fonte, TODOS são contexto válido:
- [CATALOG_PRODUCT]: dados de produtos com preços, FAQs, descrições
- [PROCESSING_PROTOCOL]: instruções de processamento de resinas
- [COMPANY_KB]: conhecimento comercial, scripts de venda
- [PARAMETER_SET]: parâmetros de impressão 3D
- [ARTICLE]: artigos técnicos da base de conhecimento
- [VIDEO]: títulos e metadados de vídeos
- [RESIN]: dados de resinas com preços e descrições
- [AUTHOR]: dados de autores/KOLs
- Seções agrupadas ("## PRODUTOS RECOMENDADOS", etc.) — TODOS VÁLIDOS

Se a IA citou dado que aparece em QUALQUER fonte no contexto, NÃO é alucinação.

**CRITÉRIOS DE SCORE:**
- score 0 + "hallucination": Inventou parâmetro técnico (layer height, exposição, preço, nome de produto) que NÃO existe em NENHUMA parte do contexto
- score 1-2 + "off_topic": Citou produto/impressora não solicitado, ou usou termos vagos proibidos ("geralmente", "provavelmente", "normalmente")
- score 3 + "incomplete": Tecnicamente correta mas omitiu informações importantes do contexto
- score 4-5 + "ok": Baseada no contexto ou comportamento legítimo de persona, precisa, direta

**NÃO PENALIZE:**
- Respostas curtas/diretas se tecnicamente corretas
- Perguntas gerais respondidas de forma geral (sem inventar dados)
- Preços/FAQs de [CATALOG_PRODUCT]
- Respostas de persona/conversação (saudação, qualificação, agendamento)

Retorne APENAS um JSON válido: {"score": 0-5, "verdict": "hallucination|off_topic|incomplete|ok", "reason": "explicação em 1 frase"}`;

    // ── Call both models in parallel ──────────────────────────────────────
    const geminiCall = fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    const deepseekCall = DEEPSEEK_API_KEY
      ? fetch(DEEPSEEK_API, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: judgePrompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        })
      : Promise.reject(new Error("DEEPSEEK_API_KEY not configured"));

    const [geminiResult, deepseekResult] = await Promise.allSettled([geminiCall, deepseekCall]);

    // ── Parse results ──────────────────────────────────────────────────────
    const parseResult = async (
      result: PromiseSettledResult<Response>,
      label: string
    ): Promise<{ score: number; verdict: string; reason: string } | null> => {
      if (result.status === "rejected") {
        console.warn(`[evaluate-interaction] ${label} failed:`, result.reason);
        return null;
      }
      const res = result.value;
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[evaluate-interaction] ${label} HTTP ${res.status}: ${errText}`);
        return null;
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      // Log token usage
      const usage = extractUsage(data);
      const provider = label === "Gemini" ? "lovable" : "deepseek";
      const model = label === "Gemini" ? "google/gemini-3-flash-preview" : "deepseek-chat";
      await logAIUsage({
        functionName: "evaluate-interaction",
        actionLabel: `Judge IA (${label})`,
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
      });

      try {
        return JSON.parse(content);
      } catch {
        console.warn(`[evaluate-interaction] ${label} JSON parse failed:`, content);
        return null;
      }
    };

    const geminiEval = await parseResult(geminiResult, "Gemini");
    const deepseekEval = await parseResult(deepseekResult, "DeepSeek");

    if (!geminiEval && !deepseekEval) {
      throw new Error("Both AI models failed to return a valid evaluation");
    }

    // ── Sanitize scores ──────────────────────────────────────────────────
    const validVerdicts = ["hallucination", "off_topic", "incomplete", "ok"];
    const sanitize = (eval_: { score: number; verdict: string; reason: string } | null) => {
      if (!eval_) return null;
      return {
        score: Math.max(0, Math.min(5, Math.round(eval_.score ?? 3))),
        verdict: validVerdicts.includes(eval_.verdict) ? eval_.verdict : "ok",
        reason: eval_.reason || "",
      };
    };

    const geminiSafe = sanitize(geminiEval);
    const deepseekSafe = sanitize(deepseekEval);

    // ── Consolidated score (average of available) ────────────────────────
    const scores = [geminiSafe?.score, deepseekSafe?.score].filter((s): s is number => s !== null && s !== undefined);
    const finalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Final verdict: use the worst verdict if they disagree
    const verdictPriority: Record<string, number> = { hallucination: 0, off_topic: 1, incomplete: 2, ok: 3 };
    const verdicts = [geminiSafe?.verdict, deepseekSafe?.verdict].filter((v): v is string => !!v);
    const finalVerdict = verdicts.sort((a, b) => (verdictPriority[a] ?? 3) - (verdictPriority[b] ?? 3))[0] || "ok";

    // ── Update database ────────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      judge_score: finalScore,
      judge_verdict: finalVerdict,
      judge_evaluated_at: new Date().toISOString(),
    };

    // Gemini-specific fields
    if (geminiSafe) {
      updatePayload.judge_reason = geminiSafe.reason;
    }

    // DeepSeek-specific fields
    if (deepseekSafe) {
      updatePayload.judge_score_ds = deepseekSafe.score;
      updatePayload.judge_verdict_ds = deepseekSafe.verdict;
      updatePayload.judge_reason_ds = deepseekSafe.reason;
    }

    const { error: updateError } = await supabase
      .from("agent_interactions")
      .update(updatePayload)
      .eq("id", record.id);

    if (updateError) throw updateError;

    console.log(`[evaluate-interaction] Evaluated ${record.id}: Gemini=${geminiSafe?.score ?? 'N/A'} DeepSeek=${deepseekSafe?.score ?? 'N/A'} Final=${finalScore}/${finalVerdict}`);

    return new Response(
      JSON.stringify({
        status: "success",
        score: finalScore,
        verdict: finalVerdict,
        gemini: geminiSafe,
        deepseek: deepseekSafe,
      }),
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
