// Meta Lead Ads — serialized round-robin pull
// One form per invocation. Cron every minute => each configured form is polled every ~4min.
// Reads X-Business-Use-Case-Usage for adaptive backoff.
// Cursor claim uses FOR UPDATE SKIP LOCKED (via RPC claim_next_meta_pull_form).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const FN = "meta-lead-ads-pull";
// Hardcoded fallback: last-resort ONLY. If used, we emit severity='error'
// so nobody trusts it silently. Update cron_state.meta_pull_forms instead.
const FALLBACK_FORM_IDS = [
  "4309081142703799",
  "1853424102139156",
  "1789308268708562",
  "994460442184175",
];

// Business Use Case Usage thresholds (percent). Meta throttles above ~75.
const BUC_WARN = 60;
const BUC_BACKOFF = 75;

type SupabaseClient = ReturnType<typeof createClient>;

async function log(
  supabase: SupabaseClient,
  severity: "info" | "warning" | "error",
  errorType: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: FN,
      severity,
      error_type: errorType,
      details: { ...details, ts: new Date().toISOString() },
    });
  } catch (e) {
    console.warn(`[${FN}] log failed`, e);
  }
}

// Extract highest BUC usage % from Meta's response header (JSON string, keyed by business_id)
function parseBUC(headerValue: string | null): { pct: number; raw: unknown } | null {
  if (!headerValue) return null;
  try {
    const parsed = JSON.parse(headerValue);
    let pct = 0;
    for (const bizId of Object.keys(parsed || {})) {
      const entries = Array.isArray(parsed[bizId]) ? parsed[bizId] : [parsed[bizId]];
      for (const e of entries) {
        for (const k of ["call_count", "total_cputime", "total_time", "estimated_time_to_regain_access"]) {
          const v = Number(e?.[k]);
          if (Number.isFinite(v) && v > pct) pct = v;
        }
      }
    }
    return { pct, raw: parsed };
  } catch {
    return null;
  }
}

// Read cursor state exposed for observability (does NOT hold the lock — the RPC does that)
async function isBackoffActive(supabase: SupabaseClient): Promise<{ active: boolean; until?: string }> {
  const { data } = await supabase
    .from("cron_state")
    .select("meta, value")
    .eq("key", "meta_pull_backoff_until")
    .maybeSingle();
  const untilIso = data?.meta && typeof data.meta === "object" ? (data.meta as Record<string, unknown>).until as string | undefined : undefined;
  if (!untilIso) return { active: false };
  const active = new Date(untilIso).getTime() > Date.now();
  return { active, until: untilIso };
}

async function setBackoff(supabase: SupabaseClient, minutes: number, reason: string) {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  await supabase.from("cron_state").upsert(
    { key: "meta_pull_backoff_until", value: minutes, meta: { until, reason }, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const META_TOKEN = Deno.env.get("META_LEAD_ADS_TOKEN");
  if (!META_TOKEN) {
    await log(supabase, "error", "meta_token_missing", {});
    return new Response(JSON.stringify({ error: "META_LEAD_ADS_TOKEN missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sinceMinutes = 30;
  try {
    const b = await req.json().catch(() => ({}));
    if (Number.isFinite(Number(b?.since_minutes))) sinceMinutes = Number(b.since_minutes);
  } catch { /* ignore */ }

  // Adaptive backoff gate
  const bo = await isBackoffActive(supabase);
  if (bo.active) {
    await log(supabase, "info", "meta_pull_backoff_skip", { until: bo.until });
    return new Response(JSON.stringify({ skipped: "backoff_active", until: bo.until }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Claim next form via SKIP LOCKED cursor
  const { data: claim, error: claimErr } = await supabase.rpc("claim_next_meta_pull_form");
  if (claimErr) {
    await log(supabase, "error", "claim_cursor_failed", { error: claimErr.message });
    return new Response(JSON.stringify({ error: "claim_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const row = Array.isArray(claim) ? claim[0] : claim;
  if (!row?.form_id) {
    // Another invocation currently holds the cursor lock -> back off
    await log(supabase, "info", "cursor_locked_skip", {});
    return new Response(JSON.stringify({ skipped: "cursor_locked" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { form_id: formId, idx, total, fallback_used } = row as {
    form_id: string; idx: number; total: number; fallback_used: boolean;
  };

  if (fallback_used) {
    // Silent time-bomb guard: HARD ERROR so this gets seen in health logs.
    await log(supabase, "error", "meta_pull_hardcoded_fallback_used", {
      message: "cron_state.meta_pull_forms is empty/invalid — falling back to compiled-in list. Update cron_state.meta_pull_forms ASAP.",
      fallback_form_ids: FALLBACK_FORM_IDS,
    });
  }

  const sinceEpoch = Math.floor((Date.now() - sinceMinutes * 60_000) / 1000);
  const sinceMs = sinceEpoch * 1000;
  const url = `${GRAPH}/${formId}/leads?fields=id,form_id,ad_id,adset_id,campaign_id,created_time,field_data,platform&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceEpoch}}]&limit=50&access_token=${META_TOKEN}`;

  let leadsFetched = 0;
  let forwarded = 0;
  let skipped = 0;
  let pageCount = 0;
  let nextUrl: string | null = url;
  const startedAt = Date.now();
  const TIMEOUT_MS = 45_000;
  const MAX_PAGES = 3;
  let bucPct = 0;
  let bucRaw: unknown = null;

  const ingestUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-ingest-lead`;
  const ingestHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
  };

  try {
    while (nextUrl && pageCount < MAX_PAGES && Date.now() - startedAt < TIMEOUT_MS) {
      pageCount++;
      const res = await fetch(nextUrl);
      const buc = parseBUC(res.headers.get("x-business-use-case-usage"));
      if (buc) { bucPct = Math.max(bucPct, buc.pct); bucRaw = buc.raw; }

      if (res.status === 429 || (res.status >= 400 && bucPct >= BUC_BACKOFF)) {
        // Meta is throttling — back off entire function for 30min
        await setBackoff(supabase, 30, `http_${res.status}_buc_${bucPct}`);
        await log(supabase, "warning", "meta_pull_rate_limited_form", {
          form_id: formId, status: res.status, buc_pct: bucPct, buc_raw: bucRaw,
        });
        break;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await log(supabase, "warning", "meta_pull_http_error", {
          form_id: formId, status: res.status, body_preview: errText.slice(0, 500),
        });
        break;
      }

      const body = await res.json();
      const fetchedLeads = Array.isArray(body?.data) ? body.data : [];
      // Meta's filtering parameter has intermittently returned old records. Filter
      // locally before invoking ingest; forwarding hundreds of old leads exhausted
      // the Edge Runtime trace quota and prevented the newest leads from arriving.
      const leads = fetchedLeads.filter((lead: { created_time?: string }) => {
        const createdMs = Date.parse(String(lead?.created_time || ""));
        return Number.isFinite(createdMs) && createdMs >= sinceMs;
      });
      leadsFetched += leads.length;

      for (const lead of leads) {
        try {
          const fieldData: Array<{ name: string; values: string[] }> = lead.field_data || [];
          const fieldMap: Record<string, string> = {};
          for (const f of fieldData) fieldMap[String(f.name || "").toLowerCase()] = (f.values || [])[0] || "";

          const payload = {
            source: "meta_lead_ads",
            platform_lead_id: String(lead.id),
            platform_form_id: String(lead.form_id || formId),
            form_name: `Meta Ads — Form ${String(lead.form_id || formId)}`,
            form_purpose: "sdr_captacao",
            name: fieldMap.full_name || fieldMap.name || fieldMap.nome || null,
            email: fieldMap.email || null,
            phone: fieldMap.phone_number || fieldMap.phone || fieldMap.telefone || null,
            meta_created_time: lead.created_time,
            meta_ad_id: lead.ad_id || null,
            meta_adset_id: lead.adset_id || null,
            meta_campaign_id: lead.campaign_id || null,
            meta_platform: lead.platform || "facebook",
            raw_field_data: fieldData,
            origem: "meta_lead_ads_pull",
          };

          const ir = await fetch(ingestUrl, {
            method: "POST",
            headers: ingestHeaders,
            body: JSON.stringify(payload),
          });
          if (ir?.ok) forwarded++; else skipped++;
        } catch (e) {
          skipped++;
          console.warn(`[${FN}] forward failed`, e);
          const msg = String(e);
          if (/RateLimitError|Rate limit exceeded/i.test(msg)) {
            // Runtime rate-limit is amplifying — back off 2min so cron ticks don't pile on
            await setBackoff(supabase, 2, "runtime_rate_limit_persistent");
          }
        }
      }

      nextUrl = body?.paging?.next || null;
    }

    // Even on success, if BUC is climbing toward the ceiling, preemptively back off
    if (bucPct >= BUC_BACKOFF) {
      await setBackoff(supabase, 30, `buc_ceiling_${bucPct}`);
    } else if (bucPct >= BUC_WARN) {
      await log(supabase, "warning", "meta_pull_buc_warning", { buc_pct: bucPct, form_id: formId, buc_raw: bucRaw });
    }

    await log(supabase, "info", "meta_pull_ok", {
      form_id: formId, idx, total, leads_fetched: leadsFetched,
      forwarded, skipped, pages: pageCount, since_minutes: sinceMinutes,
      buc_pct: bucPct, duration_ms: Date.now() - startedAt,
      cycle_hint: `${total} forms x 5min cron = ${total * 5}min per-form polling cadence`,
    });

    return new Response(JSON.stringify({
      ok: true, form_id: formId, idx, total, leads_fetched: leadsFetched,
      forwarded, skipped, pages: pageCount, buc_pct: bucPct,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await log(supabase, "error", "meta_pull_exception", {
      form_id: formId, error: String(e), duration_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});