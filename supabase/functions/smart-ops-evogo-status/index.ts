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
      .select("evo_go_base_url, evo_go_instance_id, evo_go_instance_token, evolution_instance_name, evolution_api_key")
      .eq("id", member_id)
      .maybeSingle();

    if (error || !m) {
      return new Response(JSON.stringify({ state: "close", reason: "member_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = ((m.evo_go_base_url ?? "") || "http://82.25.75.61:8081").replace(/\/$/, "");
    const apikey = m.evo_go_instance_token || m.evolution_api_key || "";
    const instance = m.evo_go_instance_id || m.evolution_instance_name || "";
    if (!base || !apikey) {
      return new Response(JSON.stringify({ state: "close", reason: "missing_creds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const started = Date.now();

    // 1) Primary probe: GET /instance/status (wuzapi-style, token identifies the instance).
    //    Returns { data: { Connected, LoggedIn, Name }, message: "success" }
    let statusHttp = 0;
    let statusBody = "";
    let instance_display_name: string | null = null;
    try {
      const r = await fetch(`${base}/instance/status`, {
        method: "GET",
        headers: { apikey },
        signal: AbortSignal.timeout(6000),
      });
      statusHttp = r.status;
      statusBody = await r.text().catch(() => "");
      if (r.ok) {
        try {
          const j = JSON.parse(statusBody);
          const connected = j?.data?.Connected === true;
          const loggedIn = j?.data?.LoggedIn === true;
          instance_display_name = j?.data?.Name ?? null;
          if (connected && loggedIn) {
            return new Response(
              JSON.stringify({
                state: "open",
                http: r.status,
                latency_ms: Date.now() - started,
                probe: "instance_status",
                instance_display_name,
                webhook_url: null, webhook_events: null, webhook_enabled: null,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          // Reached endpoint but not fully connected
          return new Response(
            JSON.stringify({
              state: "close",
              http: r.status,
              latency_ms: Date.now() - started,
              probe: "instance_status",
              reason: !connected ? "not_connected" : "not_logged_in",
              instance_display_name,
              webhook_url: null, webhook_events: null, webhook_enabled: null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch { /* fall through to fallback */ }
      }
    } catch { /* fall through to fallback */ }

    // 2) Fallback: recent webhook activity in sentinela_group_messages (last 10 min).
    const evtInstance = m.evolution_instance_name || instance;
    if (evtInstance) {
      try {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("sentinela_group_messages")
          .select("id")
          .eq("instance_name", evtInstance)
          .gte("received_at", since)
          .limit(1);
        if (recent && recent.length > 0) {
          return new Response(
            JSON.stringify({
              state: "open",
              latency_ms: Date.now() - started,
              probe: "recent_webhook_events",
              webhook_url: null, webhook_events: null, webhook_enabled: null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch { /* ignore */ }
    }

    return new Response(
      JSON.stringify({
        state: "close",
        http: statusHttp,
        latency_ms: Date.now() - started,
        reason: statusHttp ? `instance_status_${statusHttp}` : "no_signal",
        body: statusBody.slice(0, 200),
        webhook_url: null, webhook_events: null, webhook_enabled: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});