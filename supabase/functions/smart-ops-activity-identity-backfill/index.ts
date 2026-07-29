import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const batch = Number(body.batch ?? 20000);
  const seconds = Number(body.seconds ?? 45);
  const rounds = Number(body.rounds ?? 1);

  const results: unknown[] = [];
  for (let i = 0; i < rounds; i++) {
    const { data, error } = await supabase.rpc("backfill_activity_identity", {
      p_limit: batch,
      p_seconds: seconds,
    });
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message, results }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    results.push(data);
    const remaining = Number((data as Record<string, unknown> | null)?.remaining ?? 0);
    if (remaining <= 0) break;
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
