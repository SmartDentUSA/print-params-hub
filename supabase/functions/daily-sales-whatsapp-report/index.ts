// daily-sales-whatsapp-report — resumo diário (leads por origem, ganhos do dia e do mês) enviado pelo
// número oficial (Zernio) para a diretoria. Cron 17:30 SP; idempotente por dia em cron_state (force=true ignora).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const RECIPIENTS = ["5519992612348", "5516991870988"]; // Danilo Henrique, Marcelo Del Guerra
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
import { buildText } from "./logic.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const stateKey = "daily_sales_whatsapp_report";
  if (!body?.force) {
    const { data: st } = await db.from("cron_state").select("meta").eq("key", stateKey).maybeSingle();
    if ((st as any)?.meta?.day === day) return json({ skipped: "already_sent", day });
  }
  const { data: rep, error } = await db.rpc("fn_daily_sales_report", { p_day: day });
  if (error) return json({ error: error.message }, 500);
  const text = buildText(rep);
  const key = Deno.env.get("ZERNIO_API_KEY");
  const results: any[] = [];
  for (const phone of RECIPIENTS) {
    const { data: s } = await db.from("field_capture_sessions").select("account_id, conversation_id")
      .eq("sender_phone", phone).not("conversation_id", "is", null).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    if (!s || !key) { results.push({ phone, ok: false, error: "sem conversa no número oficial" }); continue; }
    const r = await fetch(`https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent((s as any).conversation_id)}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: (s as any).account_id, message: text }),
    });
    const t = await r.text();
    if (!r.ok) console.error(`[daily-sales-report] ${phone} [${r.status}]: ${t.slice(0, 300)}`);
    results.push({ phone, ok: r.ok, status: r.status, error: r.ok ? undefined : t.slice(0, 300) });
  }
  await db.from("cron_state").upsert({ key: stateKey, value: day, meta: { day, results }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return json({ day, text, results });
});
