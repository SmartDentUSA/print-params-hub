// nps-question-insight — análise por pergunta do NPS usando contexto real:
// histórico de respostas, cursos/turmas, segmentos dos leads e comentários.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FN = "nps-question-insight";

type Q = { label: string; counts: number[]; total: number; avg: number | null; score: number | null };

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const f1 = (n: number | null) => (n == null ? "-" : n.toFixed(1));

interface Resp {
  enrollment_id: string | null;
  course_id: string | null;
  email: string | null;
  created_at: string;
  score_satisfacao: number | null;
  score_treinamentos: number | null;
  score_recomendacao: number | null;
  comment: string | null;
}

const PICKERS: Array<(r: Resp) => number | null> = [
  (r) => r.score_satisfacao,
  (r) => r.score_treinamentos,
  (r) => r.score_recomendacao,
];

/** Constrói o dossiê histórico real (banco) para embasar a análise. */
async function buildContext(surveyType: string) {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: respRaw } = await db
    .from("smartops_nps_responses")
    .select("enrollment_id, course_id, email, created_at, score_satisfacao, score_treinamentos, score_recomendacao, comment")
    .eq("survey_type", surveyType)
    .order("created_at", { ascending: false })
    .limit(600);
  const responses = (respRaw || []) as Resp[];
  if (!responses.length) return { text: "Sem histórico de respostas registrado no banco.", count: 0 };

  const courseIds = [...new Set(responses.map((r) => r.course_id).filter(Boolean))] as string[];
  const enrollIds = [...new Set(responses.map((r) => r.enrollment_id).filter(Boolean))] as string[];

  const [coursesRes, enrollRes] = await Promise.all([
    courseIds.length
      ? db.from("smartops_courses").select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [] as any[] }),
    enrollIds.length
      ? db
          .from("smartops_course_enrollments")
          .select("id, person_name, course_id, turma_id, area_atuacao, especialidade, empresa_estado")
          .in("id", enrollIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const courseTitle = new Map((coursesRes.data || []).map((c: any) => [c.id, c.title as string]));
  const enrollMap = new Map((enrollRes.data || []).map((e: any) => [e.id, e]));

  const turmaIds = [...new Set((enrollRes.data || []).map((e: any) => e.turma_id).filter(Boolean))];
  const { data: turmas } = turmaIds.length
    ? await db.from("smartops_course_turmas").select("id, label, end_date").in("id", turmaIds)
    : { data: [] as any[] };
  const turmaMap = new Map((turmas || []).map((t: any) => [t.id, t]));

  const now = Date.now();
  const days = (iso: string) => (now - new Date(iso).getTime()) / 86_400_000;
  const recent = responses.filter((r) => days(r.created_at) <= 60);
  const previous = responses.filter((r) => days(r.created_at) > 60 && days(r.created_at) <= 180);

  const lines: string[] = [];
  lines.push(`HISTÓRICO TOTAL: ${responses.length} respostas registradas (mais antiga ${responses[responses.length - 1].created_at.slice(0, 10)}, mais recente ${responses[0].created_at.slice(0, 10)}).`);

  // Tendência por pergunta (60d vs 60-180d)
  PICKERS.forEach((pick, i) => {
    const a = avg(recent.map(pick).filter((v): v is number => !!v));
    const b = avg(previous.map(pick).filter((v): v is number => !!v));
    lines.push(`TENDÊNCIA P${i + 1}: últimos 60 dias=${f1(a)} (${recent.length} resp.) vs 60–180 dias=${f1(b)} (${previous.length} resp.).`);
  });

  // Ranking por curso / turma
  const byCourse = new Map<string, Resp[]>();
  for (const r of responses) {
    const key = courseTitle.get(r.course_id || "") || "Curso não identificado";
    (byCourse.get(key) || byCourse.set(key, []).get(key)!).push(r);
  }
  const courseStats = [...byCourse.entries()]
    .map(([title, rs]) => ({
      title,
      n: rs.length,
      m: [0, 1, 2].map((i) => avg(rs.map(PICKERS[i]).filter((v): v is number => !!v))),
    }))
    .filter((c) => c.n >= 2)
    .sort((a, b) => (b.m[0] ?? 0) - (a.m[0] ?? 0));
  if (courseStats.length) {
    lines.push("POR CURSO (n>=2) — média P1/P2/P3:");
    for (const c of courseStats.slice(0, 6)) lines.push(`  • ${c.title} (${c.n} resp.): ${f1(c.m[0])} / ${f1(c.m[1])} / ${f1(c.m[2])}`);
    if (courseStats.length > 1) {
      const worst = courseStats[courseStats.length - 1];
      lines.push(`  • pior avaliado: ${worst.title} (${worst.n} resp.) P1=${f1(worst.m[0])}`);
    }
  }

  const byTurma = new Map<string, Resp[]>();
  for (const r of responses) {
    const e = enrollMap.get(r.enrollment_id || "");
    const t = e ? turmaMap.get(e.turma_id) : null;
    if (!t?.label) continue;
    const key = `${t.label}${t.end_date ? ` (fim ${String(t.end_date).slice(0, 10)})` : ""}`;
    (byTurma.get(key) || byTurma.set(key, []).get(key)!).push(r);
  }
  const turmaStats = [...byTurma.entries()]
    .map(([label, rs]) => ({ label, n: rs.length, m: avg(rs.map(PICKERS[0]).filter((v): v is number => !!v)) }))
    .filter((t) => t.n >= 2)
    .sort((a, b) => (a.m ?? 0) - (b.m ?? 0));
  if (turmaStats.length) {
    lines.push("TURMAS COM PIOR MÉDIA (P1):");
    for (const t of turmaStats.slice(0, 4)) lines.push(`  • ${t.label} (${t.n} resp.): ${f1(t.m)}`);
  }

  // Segmento do lead (área de atuação / especialidade)
  const bySeg = new Map<string, Resp[]>();
  for (const r of responses) {
    const e = enrollMap.get(r.enrollment_id || "");
    const seg = String(e?.area_atuacao || e?.especialidade || "").trim();
    if (!seg) continue;
    (bySeg.get(seg) || bySeg.set(seg, []).get(seg)!).push(r);
  }
  const segStats = [...bySeg.entries()]
    .map(([seg, rs]) => ({ seg, n: rs.length, m: avg(rs.map(PICKERS[0]).filter((v): v is number => !!v)) }))
    .filter((s) => s.n >= 2)
    .sort((a, b) => b.n - a.n);
  if (segStats.length) {
    lines.push("POR SEGMENTO DO LEAD (área/especialidade, P1):");
    for (const s of segStats.slice(0, 5)) lines.push(`  • ${s.seg} (${s.n} resp.): ${f1(s.m)}`);
  }

  // Participantes recorrentes (histórico do lead)
  const byEmail = new Map<string, Resp[]>();
  for (const r of responses) {
    const k = String(r.email || "").toLowerCase();
    if (!k) continue;
    (byEmail.get(k) || byEmail.set(k, []).get(k)!).push(r);
  }
  const repeats = [...byEmail.values()].filter((rs) => rs.length > 1);
  if (repeats.length) {
    const deltas = repeats
      .map((rs) => {
        const last = rs[0].score_recomendacao;
        const first = rs[rs.length - 1].score_recomendacao;
        return last != null && first != null ? last - first : null;
      })
      .filter((d): d is number => d != null);
    const piorou = deltas.filter((d) => d < 0).length;
    const melhorou = deltas.filter((d) => d > 0).length;
    lines.push(`RECORRENTES: ${repeats.length} participantes responderam mais de uma vez — ${melhorou} melhoraram, ${piorou} pioraram a nota de recomendação entre a primeira e a última resposta.`);
  }

  // Comentários reais (verbatins), priorizando detratores
  const withComment = responses.filter((r) => String(r.comment || "").trim().length > 3);
  const detr = withComment.filter((r) => (r.score_recomendacao ?? 5) <= 3);
  const rest = withComment.filter((r) => !detr.includes(r));
  const verbatims = [...detr.slice(0, 8), ...rest.slice(0, 8)];
  if (verbatims.length) {
    lines.push("COMENTÁRIOS REAIS (nota recomendação · curso · texto):");
    for (const r of verbatims) {
      const e = enrollMap.get(r.enrollment_id || "");
      const c = courseTitle.get(r.course_id || "") || e?.course_id || "curso n/d";
      lines.push(`  • ${r.score_recomendacao ?? "-"}/5 · ${c} · "${String(r.comment).replace(/\s+/g, " ").slice(0, 220)}"`);
    }
  } else {
    lines.push("COMENTÁRIOS: nenhum comentário aberto registrado no histórico.");
  }

  return { text: lines.join("\n"), count: responses.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "missing_lovable_api_key" }, 500);

    const body = await req.json().catch(() => null) as
      | { survey_label?: string; survey_type?: string; questions?: Q[] }
      | null;
    const questions = Array.isArray(body?.questions) ? body!.questions!.slice(0, 6) : [];
    if (!questions.length) return json({ error: "invalid_payload" }, 400);

    const surveyLabel = String(body?.survey_label ?? "NPS").slice(0, 120);
    const surveyType = ["pos_treinamento", "demonstracao_ao_vivo"].includes(String(body?.survey_type))
      ? String(body!.survey_type)
      : "pos_treinamento";

    let context = { text: "Contexto histórico indisponível.", count: 0 };
    try {
      context = await buildContext(surveyType);
    } catch (e) {
      console.warn(`[${FN}] contexto`, String((e as any)?.message || e));
    }

    const described = questions.map((q, i) => {
      const t = q.total || 0;
      const pct = (n: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0");
      const c = Array.isArray(q.counts) ? q.counts : [0, 0, 0, 0, 0];
      return [
        `#${i + 1} ${q.label}`,
        `respostas=${t}`,
        `media=${q.avg ?? "-"} /5`,
        `classificação: 5=promotor, 4=neutro, <=3=detrator`,
        `distribuicao: 1=${pct(c[0])}% 2=${pct(c[1])}% 3=${pct(c[2])}% 4=${pct(c[3])}% 5=${pct(c[4])}%`,
      ].join(" | ");
    }).join("\n");

    const prompt = `Você é analista de Customer Experience da Smart Dent. Pesquisa: ${surveyLabel}.

Para CADA pergunta, escreva uma análise ESPECÍFICA em português do Brasil (2 a 3 frases, máx. 420 caracteres) que:
- cite ao menos um dado concreto do dossiê histórico (curso, turma, segmento do lead, tendência de 60 dias ou um comentário real);
- explique a causa provável do resultado, não apenas o número;
- termine com uma ação prática e específica (quem/o quê).
Proibido: frases genéricas do tipo "bom resultado, continue monitorando"; inventar dados que não estejam abaixo; markdown; repetir a mesma análise em duas perguntas.
Se o dossiê não tiver histórico suficiente, diga isso explicitamente em vez de generalizar.

Responda SOMENTE com JSON: {"insights":[{"index":1,"analysis":"..."}]}

== RESULTADO ATUAL POR PERGUNTA ==
${described}

== DOSSIÊ HISTÓRICO REAL (banco de dados) ==
${context.text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        reasoning: { effort: "low" },
        text: { format: { type: "json_object" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[${FN}] gateway ${res.status}`, txt.slice(0, 400));
      return json({ error: "ai_error", status: res.status }, res.status === 429 ? 429 : 502);
    }

    const data = await res.json();
    const joined = Array.isArray(data?.output)
      ? data.output
          .flatMap((o: any) => (Array.isArray(o?.content) ? o.content : []))
          .filter((c: any) => c?.type === "output_text" || typeof c?.text === "string")
          .map((c: any) => c.text)
          .join("")
      : "";
    const raw = String(data?.output_text || joined || "{}");
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const list = Array.isArray(parsed?.insights) ? parsed.insights : [];

    const insights = questions.map((q, i) => {
      const hit = list.find((x: any) => Number(x?.index) === i + 1) ?? list[i];
      return { index: i, label: q.label, analysis: String(hit?.analysis ?? "").trim() || null };
    });

    return json({ insights, history_responses: context.count });
  } catch (err) {
    console.error(`[${FN}]`, err);
    return json({ error: "internal_error" }, 500);
  }
});
