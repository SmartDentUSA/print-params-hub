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
    const attempts: string[] = [];
    if (instance) {
      attempts.push(`/instance/connectionState/${encodeURIComponent(instance)}`);
      attempts.push(`/instance/${encodeURIComponent(instance)}/status`);
    }
    attempts.push("/instance/fetchInstances");
    attempts.push("/");

    // Fetch webhook info in parallel (best-effort, non-blocking)
    let webhook_url: string | null = null;
    let webhook_events: string[] | null = null;
    let webhook_enabled: boolean | null = null;
    if (instance) {
      try {
        const wr = await fetch(`${base}/webhook/find/${encodeURIComponent(instance)}`, {
          method: "GET",
          headers: { apikey },
          signal: AbortSignal.timeout(6000),
        });
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

    let lastStatus = 0;
    let lastBody = "";
    for (const path of attempts) {
      try {
        const r = await fetch(`${base}${path}`, {
          method: "GET",
          headers: { apikey },
          signal: AbortSignal.timeout(8000),
        });
        lastStatus = r.status;
        const txt = await r.text().catch(() => "");
        lastBody = txt;
        if (!r.ok) continue;
        let state: "open" | "close" | "connecting" = "close";
        try {
          const j = JSON.parse(txt);
          const raw = j?.instance?.state || j?.state || j?.status || (Array.isArray(j) ? j[0]?.instance?.state : null);
          if (raw === "open" || raw === "connected") state = "open";
          else if (raw === "connecting") state = "connecting";
          else if (r.ok) state = "open";
        } catch {
          if (r.ok) state = "open";
        }
        return new Response(
          JSON.stringify({ state, http: r.status, latency_ms: Date.now() - started, path, webhook_url, webhook_events, webhook_enabled }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (_e) {
        // try next
      }
    }
    return new Response(
      JSON.stringify({ state: "close", http: lastStatus, latency_ms: Date.now() - started, body: lastBody.slice(0, 200), webhook_url, webhook_events, webhook_enabled }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});