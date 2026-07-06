// smart-ops-evolution-webhook-info — busca a URL de webhook configurada na instância Evolution (:8080).
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
      .select("evolution_base_url, evolution_instance_name, evolution_api_key")
      .eq("id", member_id)
      .maybeSingle();

    if (error || !m) {
      return new Response(JSON.stringify({ webhook_url: null, reason: "member_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = ((m.evolution_base_url ?? "") || "http://82.25.75.61:8080").replace(/\/$/, "");
    const apikey = m.evolution_api_key ?? "";
    const instance = m.evolution_instance_name ?? "";
    if (!base || !apikey || !instance) {
      return new Response(JSON.stringify({ webhook_url: null, reason: "missing_creds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const r = await fetch(`${base}/webhook/find/${encodeURIComponent(instance)}`, {
        method: "GET",
        headers: { apikey },
        signal: AbortSignal.timeout(8000),
      });
      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        return new Response(
          JSON.stringify({ webhook_url: null, http: r.status, body: txt.slice(0, 200) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      let webhook_url: string | null = null;
      let webhook_events: string[] | null = null;
      let webhook_enabled: boolean | null = null;
      try {
        const j = JSON.parse(txt);
        webhook_url = j?.url || j?.webhook?.url || j?.webhookUrl || null;
        webhook_events = j?.events || j?.webhook?.events || null;
        webhook_enabled = typeof j?.enabled === "boolean" ? j.enabled : (typeof j?.webhook?.enabled === "boolean" ? j.webhook.enabled : null);
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ webhook_url, webhook_events, webhook_enabled, http: r.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ webhook_url: null, reason: "fetch_failed", error: String(e) }),
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