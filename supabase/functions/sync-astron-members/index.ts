import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASTRON_BASE = "https://api.astronmembers.com.br";

/* ─── Astron API helper ─── */
async function astronFetch(endpoint: string, params: Record<string, unknown> = {}) {
  const amKey = Deno.env.get("ASTRON_AM_KEY")!;
  const amSecret = Deno.env.get("ASTRON_AM_SECRET")!;

  // Build query params with auth
  const qp: Record<string, string> = {
    am_key: amKey,
    am_secret: amSecret,
  };
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) qp[k] = String(v);
  }

  const url = new URL(`${ASTRON_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(qp)) url.searchParams.set(k, v);

  console.log(`[sync-astron] Fetching: ${url.toString().replace(amSecret, '***')}`);

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Astron ${endpoint} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/* ─── Phone normalizer ─── */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd >= 11) digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) return null;
  return `+55${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional params
    let pageSize = 100;
    let maxPages = 50;
    try {
      const body = await req.json();
      if (body.page_size) pageSize = Math.min(body.page_size, 200);
      if (body.max_pages) maxPages = Math.min(body.max_pages, 100);
    } catch { /* no body = defaults */ }

    let page = 1;
    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: { email: string; error: string }[] = [];

    console.log(`[sync-astron] Starting sync (pageSize=${pageSize}, maxPages=${maxPages})`);

    while (page <= maxPages) {
      // 1. Fetch paginated users
      const usersResp = await astronFetch("listClubUsers", {
        page: page,
        limit: pageSize,
      });

      const users = usersResp?.data || usersResp?.users || usersResp || [];
      if (!Array.isArray(users) || users.length === 0) {
        console.log(`[sync-astron] No more users at page ${page}`);
        break;
      }

      console.log(`[sync-astron] Page ${page}: ${users.length} users`);

      for (const user of users) {
        try {
          const email = (user.email || "").trim().toLowerCase();
          if (!email || !email.includes("@")) continue;

          // 2. Fetch user plans
          let plansData: unknown[] = [];
          let plansActive: string[] = [];
          try {
            const plansResp = await astronFetch("listClubUserPlans", {
              user_id: user.id,
            });
            plansData = plansResp?.data || plansResp?.plans || plansResp || [];
            if (Array.isArray(plansData)) {
              plansActive = plansData
                .filter((p: any) => p.status === "active" || p.status === "ativo")
                .map((p: any) => p.plan_name || p.name || `Plan ${p.id}`);
            }
          } catch (e) {
            console.warn(`[sync-astron] Plans fetch failed for user ${user.id}: ${e}`);
          }

          // 3. Build astron fields
          const astronFields: Record<string, unknown> = {
            astron_user_id: user.id,
            astron_status: user.status || "unknown",
            astron_nome: user.name || user.nome || null,
            astron_email: email,
            astron_phone: user.phone || user.telefone || null,
            astron_plans_active: plansActive,
            astron_plans_data: plansData,
            astron_courses_total: user.courses_total || 0,
            astron_courses_completed: user.courses_completed || 0,
            astron_login_url: user.login_url || `https://smartdentacademy.astronmembers.com/`,
            astron_created_at: user.created_at || null,
            astron_last_login_at: user.last_login_at || user.last_access || null,
            astron_synced_at: new Date().toISOString(),
          };

          // 4. Match by email in lia_attendances
          const { data: existing } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .limit(1)
            .maybeSingle();

          if (existing) {
            // UPDATE existing lead
            const { error: updateErr } = await supabase
              .from("lia_attendances")
              .update(astronFields)
              .eq("id", existing.id);
            if (updateErr) throw updateErr;
            totalUpdated++;
          } else {
            // INSERT new lead
            const phone = normalizePhone(user.phone || user.telefone);
            const { error: insertErr } = await supabase
              .from("lia_attendances")
              .insert({
                email,
                nome: user.name || user.nome || "Aluno Astron",
                source: "astron_members",
                telefone_normalized: phone,
                telefone_raw: user.phone || user.telefone || null,
                lead_status: "aluno",
                ...astronFields,
              });
            if (insertErr) {
              if (insertErr.code === "23505") {
                // Duplicate — try update
                await supabase
                  .from("lia_attendances")
                  .update(astronFields)
                  .eq("email", email);
                totalUpdated++;
              } else {
                throw insertErr;
              }
            } else {
              totalCreated++;
            }
          }
          totalSynced++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ email: user.email || "unknown", error: msg });
        }
      }

      // If we got fewer than pageSize, we're done
      if (users.length < pageSize) break;
      page++;
    }

    console.log(`[sync-astron] Done: synced=${totalSynced}, created=${totalCreated}, updated=${totalUpdated}, errors=${errors.length}`);

    return new Response(
      JSON.stringify({ synced: totalSynced, created: totalCreated, updated: totalUpdated, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-astron] Fatal error: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
