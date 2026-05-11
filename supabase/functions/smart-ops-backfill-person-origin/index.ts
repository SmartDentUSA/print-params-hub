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

  const PIPERUN_TOKEN = Deno.env.get("PIPERUN_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!PIPERUN_TOKEN) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_TOKEN missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const limit = Math.min(Number(body.limit) || 100, 500);
  const dryRun = body.dry_run === true;
  const onlyLeadId = (body.lead_id as string) || null;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch candidates: canonical leads with piperun_id and junk/null origem_primeiro_contato
  let query = supabase
    .from("lia_attendances")
    .select("id, piperun_id, origem_primeiro_contato, nome, email")
    .is("merged_into", null)
    .not("piperun_id", "is", null)
    .limit(limit);

  if (onlyLeadId) query = query.eq("id", onlyLeadId);

  const { data: leads, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Filter in JS so we cover NULL + JUNK in one pass
  const candidates = (leads || []).filter((l) => {
    const v = (l.origem_primeiro_contato as string | null)?.toLowerCase().trim() || "";
    return v === "" || JUNK_ORIGINS.has(v);
  });

  console.log(`[backfill-person-origin] ${candidates.length}/${leads?.length || 0} candidates (dry=${dryRun})`);

  let updated = 0, skipped = 0, errors = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const lead of candidates) {
    try {
      const res = await piperunGet(PIPERUN_TOKEN, `persons/${lead.piperun_id}`, {});
      const personData = (res.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
      const origin = personData?.origin as Record<string, unknown> | undefined;
      const originName = (origin?.name as string | null)?.trim() || null;

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
