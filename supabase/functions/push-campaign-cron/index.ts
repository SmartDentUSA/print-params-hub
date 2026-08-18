// push-campaign-cron — roda de hora em hora e dispara as campanhas push
// cujo horário escolhido chegou, respeitando a janela data início / data fim.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SP_TZ = "America/Sao_Paulo";

function spNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const o: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") o[p.type] = p.value;
  return { date: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour === "24" ? "0" : o.hour) };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { date: today, hour } = spNow();

  const { data: scheduled } = await admin
    .from("push_campaigns")
    .select("id, schedule_at, send_hour, date_start, date_end, last_run_date")
    .eq("status", "agendada")
    .limit(200);

  const nowIso = new Date().toISOString();
  const due = (scheduled ?? []).filter((c) => {
    if (c.last_run_date === today) return false;
    if (c.send_hour === null || c.send_hour === undefined) {
      return !!c.schedule_at && c.schedule_at <= nowIso;
    }
    if (Number(c.send_hour) !== hour) return false;
    if (c.date_start && today < c.date_start) return false;
    if (c.date_end && today > c.date_end) return false;
    return true;
  }).slice(0, 20);

  const results: Array<{ id: string; ok: boolean }> = [];
  for (const c of due ?? []) {
    try {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/push-campaign-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ campaign_id: c.id }),
      });
      // Campanha com janela de datas continua ativa até a data final.
      const recorrente = c.send_hour !== null && c.send_hour !== undefined
        && (!c.date_end || today < c.date_end);
      await admin.from("push_campaigns").update({
        last_run_date: today,
        status: recorrente ? "agendada" : "enviada",
      }).eq("id", c.id);
      results.push({ id: c.id, ok: res.ok });
    } catch {
      results.push({ id: c.id, ok: false });
    }
  }

  return new Response(JSON.stringify({ ok: true, sp_hour: hour, sp_date: today, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
