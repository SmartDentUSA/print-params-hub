// Meta Lead Ads — one-shot backfill for enriching existing CDP leads
// with the original form field_data (área, especialidade, scanner,
// impressora, etc.). Unlike meta-lead-ads-pull, this function is NOT
// on a cursor; it accepts an explicit form_ids list, since_minutes window
// and an optional target set (emails/phones) so only matching leads are
// forwarded to smart-ops-ingest-lead. Idempotent by design: the ingest
// pipeline merges on email/phone and PUTs custom_fields on the existing
// PipeRun deal (no new Deal/Person is created for matched canonical leads).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mapAttendanceToDealCustomFields,
  customFieldsToDealPayload,
  buildPersonFormCustomFields,
  piperunPut,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const FN = "meta-lead-ads-backfill";

type Body = {
  form_ids?: string[];
  since_minutes?: number;
  dry_run?: boolean;
  emails?: string[];
  phones?: string[];
  auto_target?: boolean;      // if true and emails/phones absent, pull recent low-cf leads
  auto_target_hours?: number; // window for auto_target lookup
  max_pages_per_form?: number;
};

function normPhone(s: string | null | undefined): string {
  return String(s || "").replace(/\D/g, "");
}

async function findCanonicalByPhone(supabase: any, phone: string): Promise<Record<string, unknown> | null> {
  const digits = normPhone(phone);
  if (digits.length < 8) return null;
  // CDP stores a mix of E.164 (+55...) and legacy digit-only values. Match by
  // the national suffix so a Smart Merge can always be resolved afterwards.
  const suffix = digits.slice(-11);
  const { data } = await supabase
    .from("lia_attendances")
    .select("*")
    .is("merged_into", null)
    .ilike("telefone_normalized", `%${suffix}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data) return data as Record<string, unknown>;
  // Legacy Brazilian records may differ only by the inserted mobile ninth
  // digit. Fall back to the stable subscriber suffix, but only when unique.
  const subscriberSuffix = digits.slice(-8);
  const { data: candidates } = await supabase
    .from("lia_attendances")
    .select("*")
    .is("merged_into", null)
    .ilike("telefone_normalized", `%${subscriberSuffix}`)
    .order("created_at", { ascending: true })
    .limit(2);
  return Array.isArray(candidates) && candidates.length === 1
    ? candidates[0] as Record<string, unknown>
    : null;
}

// Normalize accented Meta field names to canonical snake_case ASCII keys.
function normKey(k: string): string {
  return String(k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickMetaField(fmap: Record<string, string>, ...needles: string[]): string | null {
  for (const [k, v] of Object.entries(fmap)) {
    if (!v) continue;
    const nk = normKey(k);
    for (const n of needles) {
      if (nk.includes(n)) return String(v).trim();
    }
  }
  return null;
}

async function log(supabase: any, severity: "info" | "warning" | "error", errorType: string, details: Record<string, unknown>) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const META_TOKEN = Deno.env.get("META_LEAD_ADS_TOKEN");
  if (!META_TOKEN) {
    return new Response(JSON.stringify({ error: "META_LEAD_ADS_TOKEN missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") || "";

  const body = (req.method === "POST" ? await req.json().catch(() => ({})) : {}) as Body;
  const sinceMinutes = Math.max(1, Number(body.since_minutes ?? 43200)); // default 30d
  const dryRun = body.dry_run !== false;                                 // default: safe
  const maxPages = Math.max(1, Math.min(50, Number(body.max_pages_per_form ?? 10)));

  // Resolve form_ids: explicit body list → cron_state.meta_pull_forms
  let formIds: string[] = Array.isArray(body.form_ids) ? body.form_ids.map(String) : [];
  if (formIds.length === 0) {
    const { data: cs } = await supabase
      .from("cron_state").select("meta").eq("key", "meta_pull_forms").maybeSingle();
    const arr = (cs?.meta as Record<string, unknown> | null)?.form_ids;
    if (Array.isArray(arr)) formIds = (arr as unknown[]).map(String);
  }
  if (formIds.length === 0) {
    return new Response(JSON.stringify({ error: "no form_ids resolved" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve target set (emails/phones). If auto_target is on, pull recent leads
  // that already have a piperun_id but few custom_fields (likely the ones that
  // came in via CSV backfill and never got field_data).
  const targetEmails = new Set<string>((body.emails || []).map((e) => e.toLowerCase().trim()).filter(Boolean));
  const targetPhones = new Set<string>((body.phones || []).map(normPhone).filter((p) => p.length >= 8));

  if (targetEmails.size === 0 && targetPhones.size === 0 && body.auto_target) {
    const hours = Math.max(1, Number(body.auto_target_hours ?? 6));
    const { data: recent } = await supabase
      .from("lia_attendances")
      .select("email, telefone_normalized, piperun_custom_fields, created_at")
      .is("merged_into", null)
      .not("piperun_id", "is", null)
      .gte("created_at", new Date(Date.now() - hours * 3600_000).toISOString())
      .limit(2000);
    for (const r of (recent || []) as Array<Record<string, unknown>>) {
      const cf = r.piperun_custom_fields;
      const cnt = Array.isArray(cf) ? cf.length : 0;
      if (cnt > 4) continue; // already enriched
      if (r.email) targetEmails.add(String(r.email).toLowerCase().trim());
      const p = normPhone(String(r.telefone_normalized || ""));
      if (p.length >= 8) targetPhones.add(p);
    }
  }
  const hasTargetFilter = targetEmails.size > 0 || targetPhones.size > 0;

  const sinceEpoch = Math.floor((Date.now() - sinceMinutes * 60_000) / 1000);
  const perForm: Array<Record<string, unknown>> = [];
  const matchedSamples: Array<Record<string, unknown>> = [];
  const notFoundEmails = new Set<string>(targetEmails);
  const notFoundPhones = new Set<string>(targetPhones);
  let totalMatched = 0, totalForwarded = 0, totalSkipped = 0, totalScanned = 0;

  const campaignNameCache = new Map<string, string | null>();
  const getCampaignName = async (campaignId: string | null): Promise<string | null> => {
    if (!campaignId) return null;
    if (campaignNameCache.has(campaignId)) return campaignNameCache.get(campaignId) ?? null;
    try {
      const r = await fetch(`${GRAPH}/${campaignId}?fields=name&access_token=${META_TOKEN}`);
      const j = r.ok ? await r.json() : null;
      const name = typeof j?.name === "string" && j.name.trim() ? j.name.trim() : null;
      campaignNameCache.set(campaignId, name);
      return name;
    } catch { campaignNameCache.set(campaignId, null); return null; }
  };

  for (const formId of formIds) {
    let nextUrl: string | null =
      `${GRAPH}/${formId}/leads?fields=id,form_id,ad_id,adset_id,campaign_id,created_time,field_data,platform&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceEpoch}}]&limit=100&access_token=${META_TOKEN}`;
    let pages = 0;
    let scanned = 0, matched = 0, forwarded = 0, skipped = 0;

    try {
      while (nextUrl && pages < maxPages) {
        pages++;
        const res = await fetch(nextUrl);
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          perForm.push({ form_id: formId, status: "http_error", http: res.status, body_preview: t.slice(0, 300) });
          break;
        }
        const j = await res.json();
        const leads = Array.isArray(j?.data) ? j.data : [];
        scanned += leads.length;

        for (const lead of leads) {
          const fd: Array<{ name: string; values: string[] }> = lead.field_data || [];
          const fmap: Record<string, string> = {};
          for (const f of fd) fmap[String(f.name || "").toLowerCase()] = (f.values || [])[0] || "";
          const email = (fmap.email || "").toLowerCase().trim();
          const phone = normPhone(fmap.phone_number || fmap.phone || fmap.telefone || "");

          if (hasTargetFilter) {
            const hitE = email && targetEmails.has(email);
            const hitP = phone && (targetPhones.has(phone) || targetPhones.has(phone.slice(-11)) || targetPhones.has(phone.slice(-10)));
            if (!hitE && !hitP) continue;
            if (hitE) notFoundEmails.delete(email);
            if (hitP) {
              notFoundPhones.delete(phone);
              notFoundPhones.delete(phone.slice(-11));
              notFoundPhones.delete(phone.slice(-10));
            }
          }
          matched++;

          // ── Direct enrichment path (no ingest / no lia-assign) ──
          // Extract qualification fields from Meta field_data with accent-safe key matching.
          const areaAtuacao   = pickMetaField(fmap, "area_de_atuacao", "area_atuacao", "atuacao");
          const especialidade = pickMetaField(fmap, "especialidade", "specialty");
          const temImpressoraRaw = pickMetaField(fmap, "tem_impressora", "possui_impressora", "impressora");
          const temScannerRaw    = pickMetaField(fmap, "tem_scanner", "possui_scanner", "scanner");
          const comoDigitalizaRaw= pickMetaField(fmap, "como_digitaliza", "moldagens", "digitalizacao");
          const impressoraModeloRaw = pickMetaField(fmap, "modelo_impressora", "impressora_modelo", "printer_model");
          // unslug values (Meta manda "clínica_ou_consultório")
          const unslug = (v: string | null) => v ? v.replace(/_/g, " ").replace(/\s+/g, " ").trim() : v;
          const areaCanon = canonicalizeArea(unslug(areaAtuacao));
          const espCanon  = canonicalizeSpecialty(unslug(especialidade));
          const scan = canonicalizeScanner(unslug(comoDigitalizaRaw) || unslug(temScannerRaw));
          const printer = canonicalizePrinter(unslug(temImpressoraRaw) || unslug(impressoraModeloRaw));
          const areaAtuacaoV   = areaCanon ?? unslug(areaAtuacao);
          const especialidadeV = espCanon ?? unslug(especialidade);
          const temImpressora  = printer.tem_impressora ?? unslug(temImpressoraRaw);
          const temScanner     = scan.tem_scanner ?? unslug(temScannerRaw);
          const comoDigitaliza = scan.como_digitaliza ?? unslug(comoDigitalizaRaw);
          const impressoraModelo = printer.impressora_marca ?? unslug(impressoraModeloRaw);
          const scannerMarca   = scan.scanner_marca;

          if (matchedSamples.length < 5) {
            matchedSamples.push({
              meta_lead_id: String(lead.id || ""), form_id: formId, email, phone,
              field_names: fd.map((f) => f.name),
              area_atuacao: areaAtuacaoV, especialidade: especialidadeV,
              tem_scanner: temScanner, tem_impressora: temImpressora,
            });
          }

          if (dryRun) { forwarded++; continue; }

          // Locate canonical lia_attendances row (email OR normalized phone).
          let canon: Record<string, unknown> | null = null;
          if (email) {
            const { data } = await supabase
              .from("lia_attendances")
              .select("id, email, telefone_normalized, piperun_id, pessoa_piperun_id, form_data, area_atuacao, especialidade, tem_scanner, tem_impressora, como_digitaliza, impressora_modelo, scanner_marca, produto_interesse, produto_interesse_auto, pais_origem, id_cliente_smart")
              .eq("email", email).is("merged_into", null).maybeSingle();
            canon = data as any;
          }
          if (!canon && phone) {
            canon = await findCanonicalByPhone(supabase, phone);
          }
          // Recovery path: older versions only enriched rows that already
          // existed in the CDP, so a truly missed Meta lead stayed missing.
          // Re-ingest the original Meta payload first, preserving its real
          // lead ID and creation timestamp, then continue the same enrichment.
          if (!canon) {
            const campaignId = lead.campaign_id ? String(lead.campaign_id) : null;
            const campaignName = await getCampaignName(campaignId);
            const originLabel = campaignName
              ? `Meta Ads — ${campaignName}`
              : `Meta Ads — Form ${String(lead.form_id || formId)}`;
            const ingestUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-ingest-lead`;
            const ingestRes = await fetch(ingestUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                source: "meta_lead_ads",
                platform_lead_id: String(lead.id),
                platform_form_id: String(lead.form_id || formId),
                form_name: originLabel,
                origem_campanha: originLabel,
                utm_source: lead.platform || "facebook",
                utm_medium: "paid",
                utm_campaign: campaignName || campaignId,
                form_purpose: "sdr_captacao",
                name: fmap.full_name || fmap.name || fmap.nome || null,
                email: email || null,
                phone: phone || null,
                meta_created_time: lead.created_time,
                platform_ad_id: lead.ad_id || null,
                platform_adgroup_id: lead.adset_id || null,
                platform_campaign_id: campaignId,
                meta_platform: lead.platform || "facebook",
                raw_field_data: fd,
              }),
            });
            if (!ingestRes.ok) {
              skipped++;
              await log(supabase, "error", "meta_backfill_ingest_failed", {
                meta_lead_id: String(lead.id || ""), email, phone,
                status: ingestRes.status,
                response_preview: (await ingestRes.text().catch(() => "")).slice(0, 500),
              });
              continue;
            }
            if (email) {
              const { data } = await supabase.from("lia_attendances").select("*")
                .eq("email", email).is("merged_into", null).maybeSingle();
              canon = data as any;
            }
            if (!canon && phone) {
              canon = await findCanonicalByPhone(supabase, phone);
            }
            if (!canon) {
              skipped++;
              await log(supabase, "error", "meta_backfill_ingest_unresolved", {
                meta_lead_id: String(lead.id || ""), email, phone,
              });
              continue;
            }
          }

          // Build COALESCE-style updates (never overwrite existing non-null values).
          const upd: Record<string, unknown> = {};
          const coalesce = (col: string, val: unknown) => {
            if (val === null || val === undefined || val === "") return;
            if ((canon as any)[col] === null || (canon as any)[col] === undefined || (canon as any)[col] === "") {
              upd[col] = val;
            }
          };
          coalesce("area_atuacao", areaAtuacaoV);
          coalesce("especialidade", especialidadeV);
          coalesce("tem_impressora", temImpressora);
          coalesce("tem_scanner", temScanner);
          coalesce("como_digitaliza", comoDigitaliza);
          coalesce("impressora_modelo", impressoraModelo);
          coalesce("scanner_marca", scannerMarca);

          // Merge form_data snapshot with raw Meta field_data (never overwrite existing keys).
          const existingFd = (canon.form_data as Record<string, unknown> | null) || {};
          const rawFields: Record<string, string> = {};
          for (const f of fd) rawFields[normKey(f.name)] = (f.values || [])[0] || "";
          const mergedFd = { ...rawFields, ...existingFd, _meta_backfill_ts: new Date().toISOString() };
          upd.form_data = mergedFd;
          upd.updated_at = new Date().toISOString();

          const { error: updErr } = await supabase
            .from("lia_attendances").update(upd).eq("id", canon.id);
          if (updErr) { skipped++; console.warn(`[${FN}] cdp update failed`, updErr); continue; }

          // Re-fetch enriched row for PipeRun mapping.
          const { data: fresh } = await supabase
            .from("lia_attendances")
            .select("*").eq("id", canon.id).maybeSingle();
          const leadRow = (fresh || { ...canon, ...upd }) as Record<string, unknown>;

          // PUT Deal custom_fields.
          if (PIPERUN_API_KEY && leadRow.piperun_id) {
            const cf = mapAttendanceToDealCustomFields(leadRow);
            if (cf.length > 0) {
              const putRes = await piperunPut(PIPERUN_API_KEY, `deals/${leadRow.piperun_id}`, {
                custom_fields: customFieldsToDealPayload(cf),
              });
              if (putRes.success) {
                await supabase.from("lia_attendances")
                  .update({ piperun_custom_fields: cf }).eq("id", canon.id);
              } else {
                console.warn(`[${FN}] deal PUT failed`, putRes.status, String(putRes.data).slice(0, 200));
              }
            }
          }

          // PUT Person custom_fields.
          if (PIPERUN_API_KEY && leadRow.pessoa_piperun_id) {
            const pcf = buildPersonFormCustomFields(leadRow);
            if (pcf.length > 0) {
              const pRes = await piperunPut(PIPERUN_API_KEY, `persons/${leadRow.pessoa_piperun_id}`, {
                custom_fields: pcf,
              });
              if (!pRes.success) {
                console.warn(`[${FN}] person PUT failed`, pRes.status, String(pRes.data).slice(0, 200));
              }
            }
          }

          forwarded++;
          await new Promise((r) => setTimeout(r, 250));
        }

        nextUrl = j?.paging?.next || null;
      }
    } catch (e) {
      perForm.push({ form_id: formId, status: "exception", error: String(e) });
      continue;
    }

    perForm.push({ form_id: formId, pages, scanned, matched, forwarded, skipped });
    totalScanned += scanned; totalMatched += matched; totalForwarded += forwarded; totalSkipped += skipped;
  }

  const summary = {
    dry_run: dryRun,
    since_minutes: sinceMinutes,
    form_count: formIds.length,
    target_emails: targetEmails.size,
    target_phones: targetPhones.size,
    scanned: totalScanned,
    matched: totalMatched,
    forwarded: totalForwarded,
    skipped: totalSkipped,
    not_found_emails: hasTargetFilter ? Array.from(notFoundEmails) : [],
    not_found_phones: hasTargetFilter ? Array.from(notFoundPhones) : [],
    per_form: perForm,
    matched_samples: matchedSamples,
  };

  await log(supabase, "info", dryRun ? "meta_backfill_dry_run" : "meta_backfill_completed", summary);
  if (hasTargetFilter && (notFoundEmails.size > 0 || notFoundPhones.size > 0)) {
    await log(supabase, "warning", "meta_backfill_leads_not_found", {
      not_found_emails: Array.from(notFoundEmails),
      not_found_phones: Array.from(notFoundPhones),
    });
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});