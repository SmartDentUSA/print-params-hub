import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PIPELINES,
  STAGE_TO_ETAPA,
  mapDealToAttendance,
  piperunGet,
  type PipeRunDealData,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isStagnantPipeline(pipelineId: number | undefined): boolean {
  return pipelineId === PIPELINES.ESTAGNADOS;
}

function isInStagnantStatus(leadStatus: string): boolean {
  return leadStatus.startsWith("est_") || leadStatus === "estagnado_final";
}

// Pipelines to sync in full mode (all relevant ones)
const SYNC_PIPELINES = [
  PIPELINES.VENDAS,
  PIPELINES.ATOS,
  PIPELINES.EXPORTACAO,
  PIPELINES.DISTRIBUIDOR_LEADS,
  PIPELINES.ESTAGNADOS,
  PIPELINES.CS_ONBOARDING,
  PIPELINES.INSUMOS,
  PIPELINES.INTERESSE_CURSOS,
  PIPELINES.EBOOK,
  PIPELINES.ECOMMERCE,
  PIPELINES.TULIP_TESTE,
];

async function fetchDealsForPipeline(
  apiKey: string,
  pipelineId: number,
  since: string | null,
  maxPages: number
): Promise<PipeRunDealData[]> {
  let allDeals: PipeRunDealData[] = [];
  let page = 1;

  while (page <= maxPages) {
    const params: Record<string, string | number> = {
      show: 100,
      page,
      pipeline_id: pipelineId,
    };
    const arrayParams = { "with[]": ["person", "person.phones", "person.emails", "origin", "stage"] };
    if (since) params.updated_since = since;

    const result = await piperunGet(apiKey, "deals", params, arrayParams);

    if (!result.success) {
      console.error(`[sync-piperun] API error pipeline=${pipelineId} page=${page}:`, result.status);
      break;
    }

    const piperunData = result.data as { data?: PipeRunDealData[]; meta?: { current_page: number; last_page: number } };
    const deals = piperunData?.data || [];
    if (deals.length === 0) break;

    allDeals = allDeals.concat(deals);

    if (piperunData?.meta && piperunData.meta.current_page >= piperunData.meta.last_page) break;
    page++;
  }

  return allDeals;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const fullSync = url.searchParams.get("full") === "true";
    const singlePipeline = url.searchParams.get("pipeline_id");
    const orchestrate = url.searchParams.get("orchestrate") === "true";
    const since = fullSync ? null : new Date(Date.now() - 35 * 60 * 1000).toISOString();

    // ── Orchestrator mode: call self once per pipeline sequentially ──
    if (orchestrate) {
      const pipelinesToSync = singlePipeline
        ? [Number(singlePipeline)]
        : [...SYNC_PIPELINES];

      const allResults: Record<string, unknown> = {};
      let totalUpdated = 0, totalCreated = 0, totalDeals = 0;

      for (const pid of pipelinesToSync) {
        try {
          const fnUrl = `${SUPABASE_URL}/functions/v1/smart-ops-sync-piperun?pipeline_id=${pid}${fullSync ? "&full=true" : ""}`;
          const res = await fetch(fnUrl, {
            headers: {
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
          });
          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) {
            const txt = await res.text();
            console.error(`[sync-piperun] Pipeline ${pid} returned non-JSON (${res.status}):`, txt.substring(0, 200));
            allResults[`pipeline_${pid}`] = { error: `Non-JSON response (${res.status})`, preview: txt.substring(0, 100) };
            continue;
          }
          const data = await res.json();
          allResults[`pipeline_${pid}`] = data;
          if (data.synced) totalUpdated += data.synced;
          if (data.created) totalCreated += data.created;
          if (data.total_deals) totalDeals += data.total_deals;
        } catch (e) {
          allResults[`pipeline_${pid}`] = { error: String(e) };
        }
      }

      return new Response(JSON.stringify({
        success: true,
        mode: "orchestrated",
        total_updated: totalUpdated,
        total_created: totalCreated,
        total_deals: totalDeals,
        pipeline_details: allResults,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Single pipeline mode (default) ──
    if (!singlePipeline) {
      // If no pipeline specified and not orchestrating, default to orchestrate
      const fnUrl = `${SUPABASE_URL}/functions/v1/smart-ops-sync-piperun?orchestrate=true${fullSync ? "&full=true" : ""}`;
      const res = await fetch(fnUrl, {
        headers: {
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const txt = await res.text();
        return new Response(JSON.stringify({ error: "Orchestrator returned non-JSON", status: res.status, preview: txt.substring(0, 200) }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pipelineId = Number(singlePipeline);
    const maxPages = fullSync ? 50 : 5;

    const allDeals = await fetchDealsForPipeline(PIPERUN_API_KEY, pipelineId, since, maxPages);
    console.log(`[sync-piperun] Pipeline ${pipelineId}: ${allDeals.length} deals fetched`);

    let updated = 0;
    let created = 0;
    let stagnantStarted = 0;
    let stagnantRescued = 0;
    let skippedNoData = 0;
    let notFound = 0;

    for (const deal of allDeals) {
      const dealId = String(deal.id);
      const updatePayload = mapDealToAttendance(deal);

      if (deal.stage_id) {
        const mappedStatus = STAGE_TO_ETAPA[deal.stage_id];
        if (mappedStatus) {
          updatePayload.lead_status = mappedStatus;
        }
        updatePayload.updated_at = new Date().toISOString();
      }

      const { data: currentLead } = await supabase
        .from("lia_attendances")
        .select("id, lead_status, email")
        .eq("piperun_id", dealId)
        .single();

      if (currentLead) {
        // Smart merge: remove null/undefined values to avoid overwriting existing data
        const smartPayload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updatePayload)) {
          if (value !== null && value !== undefined) {
            smartPayload[key] = value;
          }
        }

        if (deal.stage_id) {
          const newIsStagnant = isStagnantPipeline(deal.pipeline_id);
          const wasStagnant = isInStagnantStatus(currentLead.lead_status);
          if (newIsStagnant && !wasStagnant && currentLead.lead_status !== "estagnado_final") {
            smartPayload.ultima_etapa_comercial = currentLead.lead_status;
            stagnantStarted++;
          } else if (!newIsStagnant && wasStagnant) {
            stagnantRescued++;
          }
        }

        const { error } = await supabase
          .from("lia_attendances")
          .update(smartPayload)
          .eq("id", currentLead.id);

        if (!error) updated++;
      } else {
        notFound++;
        const email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;
        const nome = updatePayload.nome ? String(updatePayload.nome) : (deal as any).title || null;

        if (email) {
          const { data: existingByEmail } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existingByEmail) {
            const smartPayload: Record<string, unknown> = { piperun_id: dealId };
            for (const [key, value] of Object.entries(updatePayload)) {
              if (value !== null && value !== undefined) {
                smartPayload[key] = value;
              }
            }
            await supabase
              .from("lia_attendances")
              .update(smartPayload)
              .eq("id", existingByEmail.id);
            updated++;
          } else {
            const insertPayload = {
              ...updatePayload,
              nome: nome || `Deal #${dealId}`,
              piperun_id: dealId,
              source: "piperun",
              lead_status: deal.stage_id ? (STAGE_TO_ETAPA[deal.stage_id] || "sem_contato") : "sem_contato",
              piperun_created_at: deal.created_at || null,
            };

            const { error } = await supabase.from("lia_attendances").insert(insertPayload);
            if (!error) created++;
            else console.error(`[sync-piperun] Insert error for deal ${dealId}:`, error.message);
          }
        } else {
          skippedNoData++;
        }
      }
    }

    console.log(`[sync-piperun] Pipeline ${pipelineId}: updated=${updated}, created=${created}, notFound=${notFound}, skipped=${skippedNoData}`);
    return new Response(JSON.stringify({
      success: true,
      synced: updated,
      created,
      not_found_by_piperun_id: notFound,
      skipped_no_email_nome: skippedNoData,
      total_deals: allDeals.length,
      pipeline_id: pipelineId,
      stagnant_started: stagnantStarted,
      stagnant_rescued: stagnantRescued,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-piperun] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
