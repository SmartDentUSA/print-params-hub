// sentinela-analyzer — processa mensagens não classificadas dos grupos
// em lotes de 50 usando Lovable AI Gateway (DeepSeek), atualiza
// classificações em sentinela_group_messages e gera insights consolidados
// em sentinela_insights.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 50;
const MODEL = "google/gemini-2.5-flash";

interface Classification {
  id: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  intent: "compra" | "duvida_tecnica" | "reclamacao" | "concorrente" | "elogio" | "off_topic";
  urgency: "low" | "medium" | "high";
  topics: string[];
  product_mentions: string[];
  competitor_mentions: string[];
  pain_points: string[];
  buy_signals: boolean;
  relevance_score: number;
}

const SYSTEM_PROMPT = `Você é um analista de inteligência de mercado especializado em odontologia digital, atuando como Sentinela da Smart Dent.

Contexto: a Smart Dent vende scanners intraorais (Medit, RayShape), resinas 3D (Bio Vitality, ATOS, Smart Ortho, Unikk Veneer), impressoras 3D (Anycubic, Phrozen), software CAD (exocad, BLZDental) e cursos.
Concorrentes: 3Shape, Sirona, Stratasys, FormLabs, Sprintray, Carbon, Asiga, Anycubic (quando vendido por outros), Phrozen direto.

Para cada mensagem do grupo, classifique e retorne SOMENTE JSON válido (array). Schema por item:
{
  "id": string,                       // mesmo id recebido
  "sentiment": "positive"|"neutral"|"negative"|"mixed",
  "intent": "compra"|"duvida_tecnica"|"reclamacao"|"concorrente"|"elogio"|"off_topic",
  "urgency": "low"|"medium"|"high",
  "topics": string[],                 // ex: ["scanner","resina","preço","suporte"]
  "product_mentions": string[],       // produtos Smart Dent citados
  "competitor_mentions": string[],    // concorrentes citados
  "pain_points": string[],            // dores/atritos
  "buy_signals": boolean,             // intenção clara de compra/orçamento
  "relevance_score": number           // 0-100 relevância comercial
}

Não invente. Se não houver sinal, devolva arrays vazios e relevance_score baixo.`;

async function logHealth(level: "info" | "warning" | "error", message: string, payload?: any) {
  try {
    await sb.from("system_health_logs").insert({
      function_name: "sentinela-analyzer",
      severity: level,
      error_type: "sentinela",
      details: { message, payload: payload ?? null },
    });
  } catch (_) {}
}

async function callAI(items: Array<{ id: string; group_name: string | null; text: string }>): Promise<Classification[]> {
  if (!LOVABLE_API_KEY) throw new Error("missing_lovable_api_key");

  const userBlock =
    `Classifique as ${items.length} mensagens abaixo. Retorne SOMENTE o array JSON, sem comentários.\n\n` +
    items.map((m) => `[id=${m.id}] grupo="${m.group_name ?? ""}" :: ${m.text}`).join("\n---\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userBlock },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("rate_limited");
  if (res.status === 402) throw new Error("credits_exhausted");
  if (!res.ok) throw new Error(`ai_${res.status}:${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  const txt: string = data?.choices?.[0]?.message?.content ?? "[]";

  // O modelo pode envelopar em { "results": [...] } por causa de json_object
  let parsed: any;
  try {
    parsed = JSON.parse(txt);
  } catch {
    const m = txt.match(/\[[\s\S]*\]/);
    parsed = m ? JSON.parse(m[0]) : [];
  }
  const arr: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.results)
      ? parsed.results
      : Array.isArray(parsed?.classifications)
        ? parsed.classifications
        : [];
  return arr as Classification[];
}

async function applyClassifications(batchId: string, items: Classification[]) {
  for (const c of items) {
    if (!c?.id) continue;
    await sb
      .from("sentinela_group_messages")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        ai_batch_id: batchId,
        sentiment: c.sentiment ?? null,
        intent: c.intent ?? null,
        urgency: c.urgency ?? null,
        topics: c.topics ?? [],
        product_mentions: c.product_mentions ?? [],
        competitor_mentions: c.competitor_mentions ?? [],
        pain_points: c.pain_points ?? [],
        buy_signals: !!c.buy_signals,
        relevance_score: typeof c.relevance_score === "number" ? Math.max(0, Math.min(100, Math.round(c.relevance_score))) : null,
      })
      .eq("id", c.id);
  }
}

async function maybeGenerateInsight(batchId: string, items: Classification[]) {
  // Geração simples: se houver >= 3 buy_signals OU >= 3 reclamações OU >= 3 menções ao mesmo concorrente
  const buy = items.filter((i) => i.buy_signals);
  const rec = items.filter((i) => i.intent === "reclamacao");
  const compCount: Record<string, string[]> = {};
  for (const it of items) {
    for (const c of it.competitor_mentions ?? []) {
      const k = c.toLowerCase();
      (compCount[k] ||= []).push(it.id);
    }
  }

  const inserts: any[] = [];

  if (buy.length >= 3) {
    inserts.push({
      insight_type: "oportunidade",
      title: `${buy.length} sinais de compra detectados`,
      summary: `Lote ${batchId.slice(0, 8)} acusou ${buy.length} mensagens com intenção comercial clara.`,
      severity: "warning",
      supporting_msgs: buy.map((b) => b.id),
      messages_analyzed: items.length,
    });
  }
  if (rec.length >= 3) {
    inserts.push({
      insight_type: "atrito",
      title: `${rec.length} reclamações no período`,
      summary: `Concentração de reclamações detectada no lote ${batchId.slice(0, 8)}.`,
      severity: rec.length >= 6 ? "critical" : "warning",
      supporting_msgs: rec.map((b) => b.id),
      messages_analyzed: items.length,
      category: "produto",
    });
  }
  for (const [comp, ids] of Object.entries(compCount)) {
    if (ids.length >= 3) {
      inserts.push({
        insight_type: "competitivo",
        title: `Pico de menções: ${comp}`,
        summary: `${ids.length} mensagens citaram "${comp}" no lote ${batchId.slice(0, 8)}.`,
        severity: "info",
        supporting_msgs: ids,
        messages_analyzed: items.length,
        metrics: { competitor: comp, mentions: ids.length },
      });
    }
  }

  if (inserts.length) {
    await sb.from("sentinela_insights").insert(inserts);
  }
}

async function runOnce(): Promise<{ processed: number; batches: number; insights: number }> {
  let totalProcessed = 0;
  let batches = 0;

  // Loop de até 5 lotes por invocação (300 itens) para não estourar timeout
  for (let i = 0; i < 5; i++) {
    const { data: pending, error } = await sb
      .from("sentinela_group_messages")
      .select("id, group_name, message_text, media_type")
      .eq("processed", false)
      .not("message_text", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      await logHealth("error", `select pending: ${error.message}`);
      break;
    }
    if (!pending || pending.length === 0) break;

    const items = pending
      .filter((p) => (p.message_text ?? "").trim().length > 0)
      .map((p) => ({ id: p.id as string, group_name: p.group_name as string | null, text: (p.message_text as string).slice(0, 600) }));

    // marca não-texto como processado (sem classificação rica)
    const skipIds = pending.filter((p) => !(p.message_text ?? "").trim()).map((p) => p.id as string);
    if (skipIds.length) {
      await sb
        .from("sentinela_group_messages")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .in("id", skipIds);
    }
    if (items.length === 0) {
      totalProcessed += skipIds.length;
      continue;
    }

    const batchId = crypto.randomUUID();
    try {
      const classifications = await callAI(items);
      await applyClassifications(batchId, classifications);
      await maybeGenerateInsight(batchId, classifications);
      batches++;
      totalProcessed += classifications.length + skipIds.length;
    } catch (e) {
      await logHealth("error", `batch failed: ${e instanceof Error ? e.message : String(e)}`, { batchId });
      // marca lote como processado para não travar fila (com sentiment=null)
      await sb
        .from("sentinela_group_messages")
        .update({ processed: true, processed_at: new Date().toISOString(), ai_batch_id: batchId })
        .in("id", items.map((i) => i.id));
      break;
    }
  }

  return { processed: totalProcessed, batches, insights: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const result = await runOnce();
    await logHealth("info", `analyzer run: ${result.processed} msgs in ${result.batches} batches`);
    return Response.json({ ok: true, ...result }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: corsHeaders });
  }
});