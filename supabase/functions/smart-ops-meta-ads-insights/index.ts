const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

const DEFAULT_FIELDS = [
  "impressions", "clicks", "spend", "cpc", "cpm", "ctr",
  "reach", "frequency", "actions", "cost_per_action_type",
  "cost_per_unique_click", "unique_clicks", "unique_ctr",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_TOKEN = Deno.env.get("META_LEAD_ADS_TOKEN");
    if (!META_TOKEN) {
      return new Response(JSON.stringify({ error: "META_LEAD_ADS_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      action,
      ad_account_id,
      campaign_id,
      adset_id,
      ad_id,
      date_preset,
      time_range,
      fields,
      breakdowns,
      level,
      limit: queryLimit,
      after,
    } = body;

    const insightFields = fields || DEFAULT_FIELDS;
    let url = "";
    let description = "";

    // Build time params
    const timeParams = (() => {
      if (time_range) return `&time_range=${encodeURIComponent(typeof time_range === "string" ? time_range : JSON.stringify(time_range))}`;
      return `&date_preset=${date_preset || "last_30d"}`;
    })();

    const breakdownParam = breakdowns ? `&breakdowns=${breakdowns}` : "";
    const levelParam = level ? `&level=${level}` : "";
    const limitParam = `&limit=${queryLimit || 50}`;
    const afterParam = after ? `&after=${after}` : "";

    switch (action) {
      // ── Account-level insights ──
      case "account_insights": {
        if (!ad_account_id) throw new Error("ad_account_id required");
        url = `${GRAPH_API}/${ad_account_id}/insights?fields=${insightFields}${timeParams}${breakdownParam}${levelParam}${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📊 Account insights for ${ad_account_id}`;
        break;
      }

      // ── Campaign-level insights ──
      case "campaign_insights": {
        if (!campaign_id) throw new Error("campaign_id required");
        url = `${GRAPH_API}/${campaign_id}/insights?fields=${insightFields}${timeParams}${breakdownParam}${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📊 Campaign insights for ${campaign_id}`;
        break;
      }

      // ── Ad Set-level insights ──
      case "adset_insights": {
        if (!adset_id) throw new Error("adset_id required");
        url = `${GRAPH_API}/${adset_id}/insights?fields=${insightFields}${timeParams}${breakdownParam}${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📊 Ad set insights for ${adset_id}`;
        break;
      }

      // ── Ad-level insights ──
      case "ad_insights": {
        if (!ad_id) throw new Error("ad_id required");
        url = `${GRAPH_API}/${ad_id}/insights?fields=${insightFields}${timeParams}${breakdownParam}${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📊 Ad insights for ${ad_id}`;
        break;
      }

      // ── All campaigns with insights (account level, level=campaign) ──
      case "all_campaigns_insights": {
        if (!ad_account_id) throw new Error("ad_account_id required");
        url = `${GRAPH_API}/${ad_account_id}/insights?fields=${insightFields},campaign_id,campaign_name${timeParams}&level=campaign${breakdownParam}${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📊 All campaigns insights for ${ad_account_id}`;
        break;
      }

      // ── Daily breakdown ──
      case "daily_insights": {
        const entityId = campaign_id || adset_id || ad_id || ad_account_id;
        if (!entityId) throw new Error("One of ad_account_id, campaign_id, adset_id, or ad_id required");
        url = `${GRAPH_API}/${entityId}/insights?fields=${insightFields}${timeParams}&time_increment=1${breakdownParam}${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📅 Daily insights for ${entityId}`;
        break;
      }

      // ── Demographics breakdown ──
      case "demographics_insights": {
        const demoId = campaign_id || ad_account_id;
        if (!demoId) throw new Error("ad_account_id or campaign_id required");
        url = `${GRAPH_API}/${demoId}/insights?fields=${insightFields}${timeParams}&breakdowns=age,gender${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `👥 Demographics insights for ${demoId}`;
        break;
      }

      // ── Platform breakdown ──
      case "platform_insights": {
        const platId = campaign_id || ad_account_id;
        if (!platId) throw new Error("ad_account_id or campaign_id required");
        url = `${GRAPH_API}/${platId}/insights?fields=${insightFields}${timeParams}&breakdowns=publisher_platform${limitParam}${afterParam}&access_token=${META_TOKEN}`;
        description = `📱 Platform insights for ${platId}`;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Available: account_insights, campaign_insights, adset_insights, ad_insights, all_campaigns_insights, daily_insights, demographics_insights, platform_insights`);
    }

    console.log(`[meta-ads-insights] ${description}`);

    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Extract convenience metrics from actions array
    let convenience: Record<string, unknown> | undefined;
    if (res.ok && data?.data?.[0]?.actions) {
      const actions = data.data[0].actions as Array<{ action_type: string; value: string }>;
      const costPerAction = (data.data[0].cost_per_action_type || []) as Array<{ action_type: string; value: string }>;

      const findAction = (type: string) => actions.find(a => a.action_type === type)?.value;
      const findCost = (type: string) => costPerAction.find(a => a.action_type === type)?.value;

      convenience = {
        leads: findAction("lead") || findAction("onsite_conversion.lead_grouped"),
        cost_per_lead: findCost("lead") || findCost("onsite_conversion.lead_grouped"),
        link_clicks: findAction("link_click"),
        cost_per_link_click: findCost("link_click"),
        page_engagement: findAction("page_engagement"),
        post_engagement: findAction("post_engagement"),
      };
    }

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      action,
      description,
      data,
      ...(convenience ? { convenience } : {}),
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[meta-ads-insights] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
