import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * One-shot importer for Meta Lead Ads CSV exports.
 * Body: { csv: string, dry_run?: boolean, limit?: number, only_missing?: boolean }
 * For each row, calls smart-ops-ingest-lead with normalized payload, preserving
 * created_time, ad/campaign/form names. Idempotent via email match in ingest-lead.
 */

function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return rows;

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) {
        out.push(cur); cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || "").trim(); });
    rows.push(row);
  }
  return rows;
}

function unprefix(value: string, prefix: string): string {
  if (!value) return value;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function rowToPayload(row: Record<string, string>) {
  const email = (row.email || "").toLowerCase().trim();
  if (!email) return null;
  const phone = unprefix(row.phone_number || "", "p:");
  const formName = (row.form_name || "").replace(/^#\s*/, "").trim();
  const adName = (row.ad_name || "").replace(/^#\s*/, "").trim();
  const campaignName = (row.campaign_name || "").replace(/^#\s*/, "").trim();
  const adsetName = (row.adset_name || "").replace(/^#\s*/, "").trim();
  const leadgenId = unprefix(row.id || "", "l:");
  const adId = unprefix(row.ad_id || "", "ag:");
  const campaignId = unprefix(row.campaign_id || "", "c:");
  const adsetId = unprefix(row.adset_id || "", "as:");
  const formId = unprefix(row.form_id || "", "f:");

  return {
    source: "meta_lead_ads",
    form_name: formName,
    campaign: campaignName || formName,
    origem_campanha: campaignName || formName,
    nome: row.full_name || "",
    email,
    phone_number: phone,
    "área_de_atuação": row["área_de_atuação"] || row.area_de_atuacao || "",
    area_atuacao: row["área_de_atuação"] || row.area_de_atuacao || "",
    como_digitaliza: row["como_digitaliza_suas_moldagens?"] || row.como_digitaliza || "",
    tem_impressora: row["tem_impressora?"] || row.tem_impressora || "",
    utm_source: "facebook",
    utm_medium: row.platform || "ig",
    utm_campaign: campaignName,
    raw_payload_meta: {
      meta_leadgen_id: leadgenId,
      meta_form_id: formId,
      meta_ad_id: adId,
      meta_adset_id: adsetId,
      meta_campaign_id: campaignId,
      ad_name: adName,
      adset_name: adsetName,
      campaign_name: campaignName,
      created_time: row.created_time,
      import_source: "meta_csv_backfill",
    },
    // Backdate timestamp using Meta's created_time (handled by ingest-lead via created_time hint)
    created_time: row.created_time,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let csvText = "";
  let dryRun = false;
  let limit = 1000;
  let onlyMissing = true;
  try {
    const body = await req.json();
    csvText = body.csv || "";
    dryRun = body.dry_run === true;
    if (typeof body.limit === "number") limit = body.limit;
    if (body.only_missing === false) onlyMissing = false;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json_body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!csvText) {
    return new Response(JSON.stringify({ error: "csv_required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = parseCSV(csvText);
  console.log(`[meta-csv-backfill] Parsed ${rows.length} rows`);

  // De-dup by email (latest wins)
  const byEmail = new Map<string, Record<string, string>>();
  for (const r of rows) {
    const e = (r.email || "").toLowerCase().trim();
    if (e) byEmail.set(e, r);
  }
  const allEmails = [...byEmail.keys()];

  // Find which already exist
  let missingEmails = allEmails;
  if (onlyMissing) {
    // chunked .in() lookup
    const existing = new Set<string>();
    for (let i = 0; i < allEmails.length; i += 200) {
      const chunk = allEmails.slice(i, i + 200);
      const { data } = await supabase
        .from("lia_attendances")
        .select("email")
        .in("email", chunk);
      for (const r of (data || [])) existing.add(String((r as any).email || "").toLowerCase());
    }
    missingEmails = allEmails.filter((e) => !existing.has(e));
  }

  const targets = missingEmails.slice(0, limit);
  console.log(`[meta-csv-backfill] ${allEmails.length} unique, ${missingEmails.length} missing, processing ${targets.length}`);

  if (dryRun) {
    return new Response(JSON.stringify({
      total_rows: rows.length, unique_emails: allEmails.length,
      missing: missingEmails.length, would_process: targets.length,
      sample: targets.slice(0, 5),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: Array<{ email: string; ok: boolean; status?: number; error?: string }> = [];
  for (const email of targets) {
    const row = byEmail.get(email)!;
    const payload = rowToPayload(row);
    if (!payload) { results.push({ email, ok: false, error: "no_payload" }); continue; }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify(payload),
      });
      results.push({ email, ok: res.ok, status: res.status });
    } catch (e) {
      results.push({ email, ok: false, error: String(e) });
    }
    // light pacing to avoid Piperun rate limit
    await new Promise((r) => setTimeout(r, 250));
  }

  const okCount = results.filter((r) => r.ok).length;
  return new Response(JSON.stringify({
    total_rows: rows.length, unique_emails: allEmails.length,
    missing: missingEmails.length, processed: targets.length, succeeded: okCount,
    results: results.slice(0, 50),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});