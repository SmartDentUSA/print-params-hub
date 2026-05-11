import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { piperunGet } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUNK_ORIGINS = new Set([
  "piperun", "sellflux", "sync", "crm",
  "manual_capture", "meta", "meta_lead_ads", "form", "formulário",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const PIPERUN_TOKEN = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!PIPERUN_TOKEN) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const limit = Math.min(Number(body.limit) || 100, 500);
  const dryRun = body.dry_run === true;
  const onlyLeadId = (body.lead_id as string) || null;
  const debug = body.debug === true;
  const background = body.background === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Filter junk/null origem in DB so `limit` returns true candidates only
  const junkList = Array.from(JUNK_ORIGINS);
  const junkInList = junkList.map((s) => `"${s}"`).join(",");
  let query = supabase
    .from("lia_attendances")
    .select("id, piperun_id, origem_primeiro_contato, nome, email")
    .is("merged_into", null)
    .not("piperun_id", "is", null)
    .or(`origem_primeiro_contato.is.null,origem_primeiro_contato.in.(${junkInList})`)
    .limit(limit);

  if (onlyLeadId) query = query.eq("id", onlyLeadId);

  const { data: leads, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const candidates = leads || [];

  console.log(`[backfill-person-origin] ${candidates.length} candidates (dry=${dryRun}, bg=${background})`);

  // Background mode: kick off processing and respond immediately
  if (background && !dryRun) {
    // @ts-ignore EdgeRuntime is available in Supabase functions
    EdgeRuntime.waitUntil((async () => {
      let u = 0, s = 0, e = 0;
      for (const lead of candidates) {
        const r = await processLead(lead, PIPERUN_TOKEN, supabase);
        if (r === "updated") u++; else if (r === "skipped") s++; else e++;
        await sleep(120);
      }
      console.log(`[backfill-person-origin] BG done: updated=${u} skipped=${s} errors=${e}`);
    })());
    return new Response(JSON.stringify({
      mode: "background", queued: candidates.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let updated = 0, skipped = 0, errors = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const lead of candidates) {
    try {
      // `piperun_id` in lia_attendances is the DEAL id, not the person id.
      // Strategy v2: resolve person from the deal, then list ALL deals of that
      // person ordered by created_at ASC and read `origin.name` of the FIRST
      // deal (true first conversion). Falls back to person.origin.name if
      // deals don't carry origin info.
      let lookupStatus = 0;
      let resolvedPersonId: number | null = null;
      let originName: string | null = null;
      let originSource: string | null = null;
      let originId: number | null = null;

      const dealRes = await piperunGet(PIPERUN_TOKEN, `deals/${lead.piperun_id}`, {}, { "with[]": ["origin"] });
      lookupStatus = dealRes.status;
      const dealData = (dealRes.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
      const personId = dealData?.person_id as number | string | undefined;

      if (personId) {
        resolvedPersonId = Number(personId);

        // 1) First deal by created_at asc
        const firstDealRes = await piperunGet(PIPERUN_TOKEN, "deals", {
          person_id: resolvedPersonId,
          order_by: "created_at",
          order_type: "asc",
          show: 1,
        }, { "with[]": ["origin"] });
        lookupStatus = firstDealRes.status;
        const firstDeals = ((firstDealRes.data as Record<string, unknown> | undefined)?.data) as Array<Record<string, unknown>> | undefined;
        const firstDeal = firstDeals && firstDeals[0];
        const firstDealOrigin = firstDeal?.origin as Record<string, unknown> | undefined;
        if (firstDealOrigin?.name) {
          originName = String(firstDealOrigin.name).trim() || null;
          originId = (firstDealOrigin.id as number | undefined) ?? null;
          originSource = "first_deal";
        }

        // 2) Fallback: person.origin.name
        if (!originName) {
          const personRes = await piperunGet(PIPERUN_TOKEN, `persons/${resolvedPersonId}`, {}, { "with[]": ["origin"] });
          lookupStatus = personRes.status;
          const personData = ((personRes.data as Record<string, unknown> | undefined)?.data) as Record<string, unknown> | undefined;
          const personOrigin = personData?.origin as Record<string, unknown> | undefined;
          if (personOrigin?.name) {
            originName = String(personOrigin.name).trim() || null;
            originId = (personOrigin.id as number | undefined) ?? null;
            originSource = "person";
          }
        }
      }

      if (debug && samples.length < 5) {
        samples.push({
          id: lead.id, deal_id: lead.piperun_id, person_id: resolvedPersonId,
          originName, originId, originSource, status: lookupStatus,
        });
      }

      if (!originName || JUNK_ORIGINS.has(originName.toLowerCase())) {
        skipped++;
        continue;
      }

      if (samples.length < 10) {
        samples.push({ id: lead.id, nome: lead.nome, old: lead.origem_primeiro_contato, new: originName });
      }

      if (!dryRun) {
        const { error: upErr } = await supabase
          .from("lia_attendances")
          .update({ origem_primeiro_contato: originName })
          .eq("id", lead.id);
        if (upErr) { errors++; console.warn(`[backfill] update fail ${lead.id}:`, upErr.message); continue; }
      }
      updated++;

      // Soft rate-limit: ~5 req/s to Piperun
      await sleep(200);
    } catch (e) {
      errors++;
      console.warn(`[backfill] error lead=${lead.id}:`, e);
    }
  }

  return new Response(JSON.stringify({
    scanned: leads?.length || 0,
    candidates: candidates.length,
    updated, skipped, errors, dryRun, samples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
