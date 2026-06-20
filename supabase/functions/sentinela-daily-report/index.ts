// sentinela-daily-report — roda 07h BRT, consolida últimas 24h
// em um insight de momentum e envia resumo via WA para Danilo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVO_BASE = Deno.env.get("EVOLUTION_API_URL") ?? "http://82.25.75.61:8081";
const EVO_GLOBAL_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_INSTANCE = "Danilo Henrique";
const DANILO_JID = "5519992612348@s.whatsapp.net";

async function logHealth(level: "info" | "warning" | "error", message: string, payload?: any) {
  try {
    await sb.from("system_health_logs").insert({
      function_name: "sentinela-daily-report",
      severity: level,
      error_type: "sentinela",
      details: { message, payload: payload ?? null },
    });
  } catch (_) {}
}

async function isInstanceBlocked(instance: string): Promise<boolean> {
  const { data } = await sb
    .from("system_config")
    .select("config_value")
    .eq("config_key", "evolution_blocked_instances")
    .maybeSingle();
  const blocked: string[] = (data?.config_value as any)?.blocked ?? [];
  return blocked.includes(instance);
}

async function getInstanceKey(instance: string): Promise<string> {
  const { data } = await sb
    .from("team_members")
    .select("evolution_api_key")
    .eq("evolution_instance_name", instance)
    .maybeSingle();
  return (data?.evolution_api_key as string | null) || EVO_GLOBAL_KEY;
}

async function sendWa(jid: string, text: string, instance: string) {
  const apikey = await getInstanceKey(instance);
  const res = await fetch(`${EVO_BASE}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({ number: jid, text }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`sendText ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function buildReport() {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: msgs } = await sb
    .from("sentinela_group_messages")
    .select("id, sentiment, intent, buy_signals, topics, product_mentions, competitor_mentions, group_id")
    .gte("created_at", since)
    .eq("processed", true);

  const list = msgs ?? [];
  const total = list.length;
  const buy = list.filter((m) => m.buy_signals).length;
  const neg = list.filter((m) => m.sentiment === "negative").length;
  const pos = list.filter((m) => m.sentiment === "positive").length;
  const groupSet = new Set(list.map((m) => m.group_id).filter(Boolean));

  const topicCount: Record<string, number> = {};
  const prodCount: Record<string, number> = {};
  const compCount: Record<string, number> = {};
  for (const m of list) {
    for (const t of (m.topics as string[] | null) ?? []) topicCount[t] = (topicCount[t] || 0) + 1;
    for (const p of (m.product_mentions as string[] | null) ?? []) prodCount[p] = (prodCount[p] || 0) + 1;
    for (const c of (m.competitor_mentions as string[] | null) ?? []) compCount[c] = (compCount[c] || 0) + 1;
  }

  const top = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ") || "—";

  const summary = `📊 Sentinela 24h\n• ${total} msgs em ${groupSet.size} grupos\n• 🟢 ${pos}  ⚪ ${total - pos - neg}  🔴 ${neg}\n• 🔥 ${buy} sinais de compra\n• Tópicos: ${top(topicCount)}\n• Produtos: ${top(prodCount)}\n• Concorrentes: ${top(compCount)}`;

  const detail = summary;

  await sb.from("sentinela_insights").insert({
    insight_type: "momentum",
    period_start: since,
    period_end: new Date().toISOString(),
    title: `Momentum 24h — ${total} msgs, ${buy} sinais de compra`,
    summary,
    detail,
    messages_analyzed: total,
    groups_analyzed: groupSet.size,
    metrics: {
      sentiment: { positive: pos, negative: neg, neutral: total - pos - neg },
      buy_signals: buy,
      top_topics: topicCount,
      top_products: prodCount,
      top_competitors: compCount,
    },
    severity: neg > pos * 2 ? "warning" : "info",
  });

  return { summary, total, buy };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const report = await buildReport();

    let sent: any = { skipped: "instance_blocked" };
    if (!(await isInstanceBlocked(TARGET_INSTANCE))) {
      try {
        sent = await sendWa(DANILO_JID, report.summary, TARGET_INSTANCE);
      } catch (e) {
        sent = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    await logHealth("info", `daily report sent`, { total: report.total, buy: report.buy, sent });
    return Response.json({ ok: true, report, sent }, { headers: corsHeaders });
  } catch (e) {
    await logHealth("error", `daily report failed: ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: corsHeaders });
  }
});