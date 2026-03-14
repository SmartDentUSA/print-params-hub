const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_TOKEN = Deno.env.get("META_ADS_MANAGER_TOKEN") || Deno.env.get("META_LEAD_ADS_TOKEN");
    if (!META_TOKEN) {
      return new Response(JSON.stringify({ error: "META_LEAD_ADS_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, ad_account_id, campaign_id, adset_id, ad_id, name, objective, status, daily_budget, lifetime_budget, targeting, creative, fields, limit: queryLimit, after } = body;

    let url = "";
    let fetchMethod = "GET";
    let fetchBody: string | undefined = undefined;
    let description = "";

    switch (action) {
      // ── Campaigns ──
      case "list_campaigns": {
        if (!ad_account_id) throw new Error("ad_account_id required");
        const f = fields || "id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget";
        url = `${GRAPH_API}/${ad_account_id}/campaigns?fields=${f}&limit=${queryLimit || 25}${after ? `&after=${after}` : ""}&access_token=${META_TOKEN}`;
        description = `📋 List campaigns for ${ad_account_id}`;
        break;
      }
      case "get_campaign": {
        if (!campaign_id) throw new Error("campaign_id required");
        const f = fields || "id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget,buying_type";
        url = `${GRAPH_API}/${campaign_id}?fields=${f}&access_token=${META_TOKEN}`;
        description = `🔍 Get campaign ${campaign_id}`;
        break;
      }
      case "create_campaign": {
        if (!ad_account_id || !name || !objective) throw new Error("ad_account_id, name, objective required");
        url = `${GRAPH_API}/${ad_account_id}/campaigns?access_token=${META_TOKEN}`;
        fetchMethod = "POST";
        fetchBody = JSON.stringify({
          name,
          objective,
          status: status || "PAUSED",
          special_ad_categories: [],
        });
        description = `➕ Create campaign "${name}" in ${ad_account_id}`;
        break;
      }
      case "update_campaign": {
        if (!campaign_id) throw new Error("campaign_id required");
        url = `${GRAPH_API}/${campaign_id}?access_token=${META_TOKEN}`;
        fetchMethod = "POST";
        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (status) updateData.status = status;
        if (daily_budget) updateData.daily_budget = daily_budget;
        if (lifetime_budget) updateData.lifetime_budget = lifetime_budget;
        fetchBody = JSON.stringify(updateData);
        description = `✏️ Update campaign ${campaign_id}`;
        break;
      }

      // ── Ad Sets ──
      case "list_adsets": {
        if (!ad_account_id && !campaign_id) throw new Error("ad_account_id or campaign_id required");
        const parent = campaign_id || ad_account_id;
        const f = fields || "id,name,status,daily_budget,lifetime_budget,targeting,start_time,end_time";
        url = `${GRAPH_API}/${parent}/adsets?fields=${f}&limit=${queryLimit || 25}${after ? `&after=${after}` : ""}&access_token=${META_TOKEN}`;
        description = `📋 List ad sets for ${parent}`;
        break;
      }

      // ── Ads ──
      case "list_ads": {
        if (!ad_account_id && !adset_id && !campaign_id) throw new Error("ad_account_id, adset_id, or campaign_id required");
        const parent = adset_id || campaign_id || ad_account_id;
        const f = fields || "id,name,status,created_time,updated_time,adset_id,campaign_id";
        url = `${GRAPH_API}/${parent}/ads?fields=${f}&limit=${queryLimit || 25}${after ? `&after=${after}` : ""}&access_token=${META_TOKEN}`;
        description = `📋 List ads for ${parent}`;
        break;
      }
      case "get_ad": {
        if (!ad_id) throw new Error("ad_id required");
        const f = fields || "id,name,status,created_time,adset_id,campaign_id,creative{id,name,thumbnail_url,body,title}";
        url = `${GRAPH_API}/${ad_id}?fields=${f}&access_token=${META_TOKEN}`;
        description = `🔍 Get ad ${ad_id}`;
        break;
      }
      case "update_ad_status": {
        if (!ad_id || !status) throw new Error("ad_id and status required");
        url = `${GRAPH_API}/${ad_id}?access_token=${META_TOKEN}`;
        fetchMethod = "POST";
        fetchBody = JSON.stringify({ status });
        description = `🔄 Update ad ${ad_id} status to ${status}`;
        break;
      }

      // ── Ad Account Info ──
      case "get_ad_account": {
        if (!ad_account_id) throw new Error("ad_account_id required");
        const f = fields || "id,name,account_status,currency,timezone_name,amount_spent,balance,spend_cap";
        url = `${GRAPH_API}/${ad_account_id}?fields=${f}&access_token=${META_TOKEN}`;
        description = `ℹ️ Get ad account ${ad_account_id}`;
        break;
      }

      // ── Raw ──
      case "raw_get": {
        const { path } = body;
        if (!path) throw new Error("path required for raw_get");
        url = `${GRAPH_API}/${path.replace(/^\/+/, "")}`;
        url += (url.includes("?") ? "&" : "?") + `access_token=${META_TOKEN}`;
        description = `🔗 Raw GET: ${path}`;
        break;
      }
      case "raw_post": {
        const { path, payload } = body;
        if (!path) throw new Error("path required for raw_post");
        url = `${GRAPH_API}/${path.replace(/^\/+/, "")}?access_token=${META_TOKEN}`;
        fetchMethod = "POST";
        fetchBody = JSON.stringify(payload || {});
        description = `🔗 Raw POST: ${path}`;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Available: list_campaigns, get_campaign, create_campaign, update_campaign, list_adsets, list_ads, get_ad, update_ad_status, get_ad_account, raw_get, raw_post`);
    }

    console.log(`[meta-ads-manager] ${description}`);

    const fetchHeaders: Record<string, string> = { "Accept": "application/json" };
    if (fetchBody) fetchHeaders["Content-Type"] = "application/json";

    const res = await fetch(url, { method: fetchMethod, headers: fetchHeaders, body: fetchBody });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      action,
      description,
      data,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[meta-ads-manager] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
