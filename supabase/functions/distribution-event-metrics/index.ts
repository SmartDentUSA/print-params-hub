import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response(JSON.stringify({ error: "Indisponível" }), { status: 503, headers });
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("fn_distribution_event_metrics");
  if (error) return new Response(JSON.stringify({ error: "Indicadores indisponíveis" }), { status: 503, headers });
  return new Response(JSON.stringify({ metrics: data || [] }), { headers: { ...headers, "Cache-Control": "public, max-age=60" } });
});