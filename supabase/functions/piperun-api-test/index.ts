const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, dealId, path, show } = await req.json();
    const base = "https://api.pipe.run";
    let url = "";

    switch (action) {
      case "list_deals":
        url = `${base}/v1/deals?show=${show || 1}`;
        break;
      case "get_deal":
        if (!dealId) throw new Error("dealId required");
        url = `${base}/v1/deals/${dealId}?with=items,persons,companies,customForms,users`;
        break;
      case "list_users":
        url = `${base}/v1/users`;
        break;
      case "list_stages":
        url = `${base}/v1/stages`;
        break;
      case "list_pipelines":
        url = `${base}/v1/pipelines`;
        break;
      case "raw_get":
        if (!path) throw new Error("path required for raw_get");
        url = `${base}/v1/${path.replace(/^\/+/, "")}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}. Use: list_deals, get_deal, list_users, list_stages, list_pipelines, raw_get`);
    }

    console.log(`[piperun-api-test] ${action} -> ${url}`);

    const res = await fetch(url, {
      headers: { "Token": PIPERUN_API_KEY },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      action,
      url,
      data,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[piperun-api-test] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
