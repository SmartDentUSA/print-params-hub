import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASTRON_BASE = "https://api.astronmembers.com.br";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function astronFetch(endpoint: string, params: Record<string, unknown> = {}, method: "GET" | "POST" = "GET") {
  const amKey = Deno.env.get("ASTRON_AM_KEY")!;
  const amSecret = Deno.env.get("ASTRON_AM_SECRET")!;

  const allParams: Record<string, string> = {
    am_key: amKey,
    am_secret: amSecret,
  };
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) allParams[k] = String(v);
  }

  const url = new URL(`${ASTRON_BASE}/${endpoint}`);
  if (method === "GET") {
    for (const [k, v] of Object.entries(allParams)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(allParams) } : {}),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Astron ${endpoint} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, lead_id, force_refresh } = await req.json();

    if (!email && !lead_id) {
      return new Response(
        JSON.stringify({ error: "email or lead_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch cached data from lia_attendances
    let query = supabase
      .from("lia_attendances")
      .select("id, email, nome, astron_user_id, astron_status, astron_plans_active, astron_plans_data, astron_courses_access, astron_courses_total, astron_courses_completed, astron_login_url, astron_created_at, astron_last_login_at, astron_synced_at");

    if (lead_id) {
      query = query.eq("id", lead_id);
    } else {
      query = query.eq("email", email.trim().toLowerCase());
    }

    const { data: lead } = await query.limit(1).maybeSingle();

    if (!lead) {
      return new Response(
        JSON.stringify({ found: false, source: "no_lead" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check cache freshness
    const syncedAt = lead.astron_synced_at ? new Date(lead.astron_synced_at).getTime() : 0;
    const isFresh = (Date.now() - syncedAt) < CACHE_TTL_MS;

    if (isFresh && !force_refresh && lead.astron_user_id) {
      return new Response(
        JSON.stringify({
          found: true,
          source: "cache",
          data: {
            astron_user_id: lead.astron_user_id,
            astron_status: lead.astron_status,
            astron_plans_active: lead.astron_plans_active,
            astron_plans_data: lead.astron_plans_data,
            astron_courses_total: lead.astron_courses_total,
            astron_courses_completed: lead.astron_courses_completed,
            astron_login_url: lead.astron_login_url,
            astron_last_login_at: lead.astron_last_login_at,
            astron_synced_at: lead.astron_synced_at,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fresh lookup from Astron API
    const lookupEmail = lead.email.trim().toLowerCase();
    console.log(`[astron-lookup] Querying Astron for ${lookupEmail}`);

    try {
      // Search by email in Astron
      const usersResp = await astronFetch("listClubUsers", { email: lookupEmail });
      const users = usersResp?.data || usersResp?.users || usersResp || [];
      const astronUser = Array.isArray(users) ? users[0] : null;

      if (!astronUser) {
        // Update synced_at to avoid re-querying too soon
        await supabase
          .from("lia_attendances")
          .update({ astron_synced_at: new Date().toISOString(), astron_status: "not_found" })
          .eq("id", lead.id);

        return new Response(
          JSON.stringify({ found: true, astron_found: false, source: "api_miss" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch plans
      let plansData: unknown[] = [];
      let plansActive: string[] = [];
      try {
        const plansResp = await astronFetch("listClubUserPlans", {
          user_id: astronUser.id,
        });
        plansData = plansResp?.data || plansResp?.plans || plansResp || [];
        if (Array.isArray(plansData)) {
          plansActive = plansData
            .filter((p: any) => p.status === "active" || p.status === "ativo")
            .map((p: any) => p.plan_name || p.name || `Plan ${p.id}`);
        }
      } catch (e) {
        console.warn(`[astron-lookup] Plans fetch failed: ${e}`);
      }

      // Update lia_attendances
      const updateFields = {
        astron_user_id: astronUser.id,
        astron_status: astronUser.status || "active",
        astron_nome: astronUser.name || astronUser.nome,
        astron_email: lookupEmail,
        astron_phone: astronUser.phone || astronUser.telefone || null,
        astron_plans_active: plansActive,
        astron_plans_data: plansData,
        astron_courses_total: astronUser.courses_total || 0,
        astron_courses_completed: astronUser.courses_completed || 0,
        astron_login_url: astronUser.login_url || "https://smartdentacademy.astronmembers.com/",
        astron_created_at: astronUser.created_at || null,
        astron_last_login_at: astronUser.last_login_at || astronUser.last_access || null,
        astron_synced_at: new Date().toISOString(),
      };

      await supabase
        .from("lia_attendances")
        .update(updateFields)
        .eq("id", lead.id);

      return new Response(
        JSON.stringify({ found: true, astron_found: true, source: "api_hit", data: updateFields }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (apiErr) {
      console.error(`[astron-lookup] API error: ${apiErr}`);
      // Return cached data if available
      if (lead.astron_user_id) {
        return new Response(
          JSON.stringify({
            found: true,
            source: "cache_stale",
            error: String(apiErr),
            data: {
              astron_user_id: lead.astron_user_id,
              astron_status: lead.astron_status,
              astron_plans_active: lead.astron_plans_active,
              astron_courses_total: lead.astron_courses_total,
              astron_courses_completed: lead.astron_courses_completed,
              astron_login_url: lead.astron_login_url,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ found: true, astron_found: false, source: "api_error", error: String(apiErr) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
