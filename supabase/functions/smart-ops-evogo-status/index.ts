// smart-ops-evogo-status — verifica se a instância EvoGo do member está online.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { member_id } = await req.json();
    if (!member_id || typeof member_id !== "string") {
      return new Response(JSON.stringify({ error: "member_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: m, error } = await supabase
      .from("team_members")
      .select("evo_go_base_url, evo_go_instance_id, evo_go_instance_token, evolution_api_key")
      .eq("id", member_id)
      .maybeSingle();

    if (error || !m) {
      return new Response(JSON.stringify({ state: "close", reason: "member_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = (m.evo_go_base_url ?? "").replace(/\/$/, "");
    const apikey = m.evo_go_instance_token || m.evolution_api_key || "";
    if (!base || !apikey) {
      return new Response(JSON.stringify({ state: "close", reason: "missing_creds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const started = Date.now();
    try {
      const r = await fetch(`${base}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey },
        signal: AbortSignal.timeout(8000),
      });
      const latency_ms = Date.now() - started;
      await r.text().catch(() => "");
      const state = r.ok ? "open" : "close";
      return new Response(JSON.stringify({ state, http: r.status, latency_ms }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ state: "close", reason: "fetch_failed", error: String(e) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});