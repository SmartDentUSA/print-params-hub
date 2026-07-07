import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { flow_id } = await req.json();
    if (!flow_id) throw new Error("flow_id required");

    const { data: flow, error } = await supabase
      .from("social_flows")
      .select("id, name, zernio_automation_id, zernio_automation_config")
      .eq("id", flow_id)
      .single();
    if (error) throw error;
    if (flow.zernio_automation_id) {
      return new Response(
        JSON.stringify({ ok: true, already: true, zernio_automation_id: flow.zernio_automation_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cfg: any = flow.zernio_automation_config ?? {};
    const zernioKey = Deno.env.get("ZERNIO_API_KEY");
    if (!zernioKey) throw new Error("ZERNIO_API_KEY not configured");

    const payload = {
      profileId: "6a1e1a2368fd70c014724ef0",
      accountId: "6a1e1b992b2567671a925559",
      name: flow.name,
      keywords: cfg.keywords ?? [],
      matchMode: "contains",
      dmMessage: cfg.dm_message ?? "",
      commentReply: cfg.comment_reply ?? "",
      linkTracking: false,
    };

    const zRes = await fetch("https://zernio.com/api/v1/comment-automations", {
      method: "POST",
      headers: { Authorization: `Bearer ${zernioKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const zText = await zRes.text();
    let zData: any = {};
    try { zData = JSON.parse(zText); } catch { zData = { raw: zText }; }
    const zernioId = zData?.automation?.id ?? zData?.id ?? null;

    if (!zRes.ok || !zernioId) {
      return new Response(
        JSON.stringify({ ok: false, status: zRes.status, response: zData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("social_flows")
      .update({ zernio_automation_id: zernioId, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", flow_id);

    return new Response(
      JSON.stringify({ ok: true, zernio_automation_id: zernioId, payload_sent: payload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});