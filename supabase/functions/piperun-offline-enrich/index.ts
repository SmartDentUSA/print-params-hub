// Enriquecimento OFFLINE de lia_attendances a partir do dump de deals do PipeRun.
// NÃO faz NENHUMA chamada à API do PipeRun. Apenas lê o body com o chunk de
// aggregates já indexado por person_id e atualiza piperun_deals_history,
// ltv_total, total_deals, total_deals_all e (quando vazio) piperun_id.
//
// Body: { aggregates: [{ person_id: number, deals: PRDeal[] }, ...] }
// Response: { processed, enriched, missing, errors, missing_person_ids }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PRDeal = {
  deal_id: number; hash?: string; title?: string | null; value?: number | null;
  status?: number | null; pipeline_id?: number | null; stage_id?: number | null;
  owner_id?: number | null; company_id?: number | null; origin_id?: number | null;
  reference?: string | null; created_at?: string | null; updated_at?: string | null;
  closed_at?: string | null; last_stage_updated_at?: string | null;
  deleted?: number | null; freezed?: number | null;
};

const PIPERUN_STATUS = {
  0: "aberta",
  1: "aberta",
  2: "ganha",
  3: "perdida",
  4: "congelada",
} as Record<number, string>;

function normalizeStatus(s: any): string {
  if (typeof s === "string") return s.toLowerCase();
  if (typeof s === "number") return PIPERUN_STATUS[s] || "aberta";
  return "aberta";
}

function mergeHistory(
  existing: any[] | null | undefined,
  fresh: PRDeal[],
): { merged: any[]; ltv: number; wonCount: number; allCount: number } {
  const map = new Map<string, any>();
  if (Array.isArray(existing)) {
    for (const d of existing) {
      const key = String(d.deal_id ?? d.deal_hash ?? d.hash ?? JSON.stringify(d));
      map.set(key, d);
    }
  }
  for (const d of fresh) {
    if (d.deleted === 1 || d.deleted === true) continue;
    const key = String(d.deal_id);
    const norm = {
      deal_id: d.deal_id,
      deal_hash: d.hash,
      title: d.title,
      value: Number(d.value) || 0,
      status: normalizeStatus(d.status),
      pipeline_id: d.pipeline_id,
      stage_id: d.stage_id,
      owner_id: d.owner_id,
      company_id: d.company_id,
      origin_id: d.origin_id,
      reference: d.reference,
      created_at: d.created_at,
      updated_at: d.updated_at,
      closed_at: d.closed_at,
      last_stage_updated_at: d.last_stage_updated_at,
      freezed: d.freezed,
      source: "piperun_offline_import",
    };
    const prev = map.get(key);
    map.set(key, { ...(prev || {}), ...norm });
  }
  const merged = Array.from(map.values());
  let ltv = 0, wonCount = 0;
  for (const d of merged) {
    const st = String(d.status || d.situacao || "").toLowerCase();
    if (st === "ganha" || st === "won") { ltv += Number(d.value) || 0; wonCount++; }
  }
  return { merged, ltv, wonCount, allCount: merged.length };
}

function pickLatest(deals: PRDeal[]): PRDeal | null {
  if (!deals.length) return null;
  return [...deals].sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  )[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const aggregates: Array<{ person_id: number; deals: PRDeal[] }> = body?.aggregates || [];
    if (!Array.isArray(aggregates) || aggregates.length === 0) {
      return new Response(JSON.stringify({ error: "aggregates[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personIds = aggregates.map((a) => a.person_id);

    // Fetch existing canonical leads in one query.
    const { data: leads, error: fetchErr } = await supabase
      .from("lia_attendances")
      .select("id, pessoa_piperun_id, piperun_id, piperun_deals_history, ltv_total, total_deals")
      .is("merged_into", null)
      .in("pessoa_piperun_id", personIds);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const byPerson = new Map<number, any>();
    for (const l of leads || []) byPerson.set(Number(l.pessoa_piperun_id), l);

    let enriched = 0, errors = 0;
    const missing_person_ids: number[] = [];
    const errorSamples: any[] = [];

    for (const agg of aggregates) {
      const lead = byPerson.get(agg.person_id);
      if (!lead) { missing_person_ids.push(agg.person_id); continue; }

      const { merged, ltv, wonCount, allCount } = mergeHistory(
        lead.piperun_deals_history as any[], agg.deals,
      );
      const latest = pickLatest(agg.deals);

      // Only scalar fields → respeita PostgREST embed-update guard.
      const updateFields: Record<string, any> = {
        piperun_deals_history: merged,
        ltv_total: ltv,
        total_deals: wonCount,
        total_deals_all: allCount,
        updated_at: new Date().toISOString(),
      };
      if (!lead.piperun_id && latest) updateFields.piperun_id = String(latest.deal_id);

      const { error: upErr } = await supabase
        .from("lia_attendances")
        .update(updateFields)
        .eq("id", lead.id);

      if (upErr) {
        errors++;
        if (errorSamples.length < 5) errorSamples.push({ id: lead.id, person_id: agg.person_id, error: upErr.message });
      } else {
        enriched++;
      }
    }

    return new Response(JSON.stringify({
      processed: aggregates.length,
      enriched, errors,
      missing: missing_person_ids.length,
      missing_person_ids,
      error_samples: errorSamples,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});