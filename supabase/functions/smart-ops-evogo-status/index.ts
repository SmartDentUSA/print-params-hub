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

    // 1) Webhook lookup — EvoGo doesn't expose connectionState endpoints,
    // but /webhook/find/{instance} returning 2xx is a strong signal the
    // instance exists and the runtime is up.
    let webhook_url: string | null = null;
    let webhook_events: string[] | null = null;
    let webhook_enabled: boolean | null = null;
    let webhookOk = false;
    let webhookStatus = 0;
    if (instance) {
      try {
        const wr = await fetch(`${base}/webhook/find/${encodeURIComponent(instance)}`, {
          method: "GET",
          headers: { apikey },
          signal: AbortSignal.timeout(6000),
        });
        webhookStatus = wr.status;
        webhookOk = wr.ok;
        if (wr.ok) {
          const wtxt = await wr.text();
          try {
            const wj = JSON.parse(wtxt);
            webhook_url = wj?.url || wj?.webhook?.url || wj?.webhookUrl || null;
            webhook_events = wj?.events || wj?.webhook?.events || null;
            webhook_enabled = typeof wj?.enabled === "boolean" ? wj.enabled : (typeof wj?.webhook?.enabled === "boolean" ? wj.webhook.enabled : null);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    if (webhookOk) {
      return new Response(
        JSON.stringify({
          state: "open",
          http: webhookStatus,
          latency_ms: Date.now() - started,
          probe: "webhook_find",
          webhook_url, webhook_events, webhook_enabled,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Recent webhook activity — EvoGo delivers events to
    // smart-ops-evogo-groups-webhook, which persists to sentinela_group_messages.
    // Any event in the last 10 minutes means the runtime is online and pushing.
    const evtInstance = m.evolution_instance_name || instance;
    if (evtInstance) {
      try {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("sentinela_group_messages")
          .select("id", { head: false })
          .eq("instance_name", evtInstance)
          .gte("received_at", since)
          .limit(1);
        if (recent && recent.length > 0) {
          return new Response(
            JSON.stringify({
              state: "open",
              latency_ms: Date.now() - started,
              probe: "recent_webhook_events",
              webhook_url, webhook_events, webhook_enabled,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch { /* ignore */ }
    }

    // 3) Root health check — accept any 2xx as "runtime up".
    let rootStatus = 0;
    let rootBody = "";
    try {
      const r = await fetch(`${base}/`, {
        method: "GET",
        headers: { apikey },
        signal: AbortSignal.timeout(6000),
      });
      rootStatus = r.status;
      rootBody = await r.text().catch(() => "");
      if (r.ok) {
        return new Response(
          JSON.stringify({
            state: "open",
            http: r.status,
            latency_ms: Date.now() - started,
            probe: "root_ping",
            webhook_url, webhook_events, webhook_enabled,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({
        state: "close",
        http: rootStatus || webhookStatus,
        latency_ms: Date.now() - started,
        reason: webhookStatus ? `webhook_find_${webhookStatus}` : "no_signal",
        body: rootBody.slice(0, 200),
        webhook_url, webhook_events, webhook_enabled,
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