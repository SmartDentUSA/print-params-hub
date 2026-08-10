// nps-question-insight — gera uma análise curta (IA) para cada pergunta do NPS.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FN = "nps-question-insight";

type Q = { label: string; counts: number[]; total: number; avg: number | null; score: number | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "missing_lovable_api_key" }, 500);

    const body = await req.json().catch(() => null) as { survey_label?: string; questions?: Q[] } | null;
    const questions = Array.isArray(body?.questions) ? body!.questions!.slice(0, 6) : [];
    if (!questions.length) return json({ error: "invalid_payload" }, 400);

    const surveyLabel = String(body?.survey_label ?? "NPS").slice(0, 120);

    const described = questions.map((q, i) => {
      const t = q.total || 0;
      const pct = (n: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0");
      const c = Array.isArray(q.counts) ? q.counts : [0, 0, 0, 0, 0];
      return [
        `#${i + 1} ${q.label}`,
        `respostas=${t}`,
        `media=${q.avg ?? "-"} /5`,
        `score(NPS da pergunta: 5=promotor, 4=neutro, <=3=detrator)=${q.score ?? "-"}`,
        `distribuicao: 1=${pct(c[0])}% 2=${pct(c[1])}% 3=${pct(c[2])}% 4=${pct(c[3])}% 5=${pct(c[4])}%`,
      ].join(" | ");
    }).join("\n");

    const prompt = `Você é analista de Customer Experience da Smart Dent. Pesquisa: ${surveyLabel}.
Para CADA pergunta abaixo, escreva UMA análise objetiva em português do Brasil, de 1 a 2 frases (máx. 260 caracteres), explicando o que o número significa e a ação prática recomendada. Não repita os números crus além do necessário, não invente dados, não use markdown.
Responda SOMENTE com JSON: {"insights":[{"index":1,"analysis":"..."}]}

${described}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[${FN}] gateway ${res.status}`, txt.slice(0, 400));
      return json({ error: "ai_error", status: res.status }, res.status === 429 ? 429 : 502);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const list = Array.isArray(parsed?.insights) ? parsed.insights : [];

    const insights = questions.map((q, i) => {
      const hit = list.find((x: any) => Number(x?.index) === i + 1) ?? list[i];
      return { index: i, label: q.label, analysis: String(hit?.analysis ?? "").trim() || null };
    });

    return json({ insights });
  } catch (err) {
    console.error(`[${FN}]`, err);
    return json({ error: "internal_error" }, 500);
  }
});
