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

    const { action, dealId, path, show, body: reqBody, method: reqMethod } = await req.json();
    const base = "https://api.pipe.run";
    let url = "";
    let fetchMethod = "GET";
    let fetchBody: string | undefined = undefined;

    switch (action) {
      case "list_deals":
        url = `${base}/v1/deals?token=${PIPERUN_API_KEY}&show=${show || 1}`;
        break;
      case "get_deal":
        if (!dealId) throw new Error("dealId required");
        url = `${base}/v1/deals/${dealId}?token=${PIPERUN_API_KEY}&with=items,persons,companies,customForms,users`;
        break;
      case "list_users":
        url = `${base}/v1/users?token=${PIPERUN_API_KEY}`;
        break;
      case "list_stages":
        url = `${base}/v1/stages?token=${PIPERUN_API_KEY}`;
        break;
      case "list_pipelines":
        url = `${base}/v1/pipelines?token=${PIPERUN_API_KEY}`;
        break;
      case "raw_get":
        if (!path) throw new Error("path required for raw_get");
        url = `${base}/v1/${path.replace(/^\/+/, "")}`;
        url += (url.includes("?") ? "&" : "?") + `token=${PIPERUN_API_KEY}`;
        break;
      case "raw_put":
        if (!path) throw new Error("path required for raw_put");
        url = `${base}/v1/${path.replace(/^\/+/, "")}?token=${PIPERUN_API_KEY}`;
        fetchMethod = "PUT";
        fetchBody = JSON.stringify(reqBody || {});
        break;
      case "raw_post":
        if (!path) throw new Error("path required for raw_post");
        url = `${base}/v1/${path.replace(/^\/+/, "")}?token=${PIPERUN_API_KEY}`;
        fetchMethod = "POST";
        fetchBody = JSON.stringify(reqBody || {});
        break;
      default:
        throw new Error(`Unknown action: ${action}. Use: list_deals, get_deal, list_users, list_stages, list_pipelines, raw_get, raw_put, raw_post`);
        throw new Error(`Unknown action: ${action}. Use: list_deals, get_deal, list_users, list_stages, list_pipelines, raw_get, raw_put`);
    }

    console.log(`[piperun-api-test] ${action} -> ${url}`);

    const fetchHeaders: Record<string, string> = { "Accept": "application/json" };
    if (fetchBody) fetchHeaders["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method: fetchMethod,
      headers: fetchHeaders,
      body: fetchBody,
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Capture all response headers
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      action,
      url,
      response_headers: responseHeaders,
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
