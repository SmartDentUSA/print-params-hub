// push-campaign-cron — dispara campanhas push agendadas cujo horário já chegou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data: due } = await admin
    .from("push_campaigns")
    .select("id")
    .eq("status", "agendada")
    .lte("schedule_at", new Date().toISOString())
    .limit(10);

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
      results.push({ id: c.id, ok: res.ok });
    } catch {
      results.push({ id: c.id, ok: false });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
