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
  PIPELINES.ESTAGNADOS,
  PIPELINES.CS_ONBOARDING,
  PIPELINES.INSUMOS,
  PIPELINES.INTERESSE_CURSOS,
  PIPELINES.EBOOK,
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
      "with[]": "person",
      pipeline_id: pipelineId,
    };
    if (since) params.updated_since = since;

    const result = await piperunGet(apiKey, "deals", params);

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
    const since = fullSync ? null : new Date(Date.now() - 35 * 60 * 1000).toISOString();

    // Determine which pipelines to sync
    let pipelinesToSync: number[];
    if (singlePipeline) {
      pipelinesToSync = [Number(singlePipeline)];
    } else {
      pipelinesToSync = [...SYNC_PIPELINES];
    }

    const maxPagesPerPipeline = fullSync ? 50 : 10;

    // Fetch deals per pipeline
    let allDeals: PipeRunDealData[] = [];
    const pipelineResults: Record<number, number> = {};

    for (const pid of pipelinesToSync) {
      const deals = await fetchDealsForPipeline(PIPERUN_API_KEY, pid, since, maxPagesPerPipeline);
      pipelineResults[pid] = deals.length;
      allDeals = allDeals.concat(deals);
      console.log(`[sync-piperun] Pipeline ${pid}: ${deals.length} deals fetched`);
    }

    let updated = 0;
    let created = 0;
    let stagnantStarted = 0;
    let stagnantRescued = 0;
    let skippedNoData = 0;
    let notFound = 0;

    for (const deal of allDeals) {
      const dealId = String(deal.id);
      const updatePayload = mapDealToAttendance(deal);

      // Set lead_status from stage mapping
      if (deal.stage_id) {
        const mappedStatus = STAGE_TO_ETAPA[deal.stage_id];
        if (mappedStatus) {
          updatePayload.lead_status = mappedStatus;
        }
        updatePayload.updated_at = new Date().toISOString();
      }

      // Check if lead exists by piperun_id
      const { data: currentLead } = await supabase
        .from("lia_attendances")
        .select("id, lead_status, email")
        .eq("piperun_id", dealId)
        .single();

      if (currentLead) {
        // Track stagnation transitions
        if (deal.stage_id) {
          const newIsStagnant = isStagnantPipeline(deal.pipeline_id);
          const wasStagnant = isInStagnantStatus(currentLead.lead_status);
          if (newIsStagnant && !wasStagnant && currentLead.lead_status !== "estagnado_final") {
            updatePayload.ultima_etapa_comercial = currentLead.lead_status;
            stagnantStarted++;
          } else if (!newIsStagnant && wasStagnant) {
            stagnantRescued++;
          }
        }

        const { error } = await supabase
          .from("lia_attendances")
          .update(updatePayload)
          .eq("id", currentLead.id);

        if (!error) updated++;
      } else {
        notFound++;
        // Try to find by email or create
        const email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;
        const nome = updatePayload.nome ? String(updatePayload.nome) : null;

        if (email && nome) {
          const { data: existingByEmail } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existingByEmail) {
            await supabase
              .from("lia_attendances")
              .update({ ...updatePayload, piperun_id: dealId })
              .eq("id", existingByEmail.id);
            updated++;
          } else {
            const insertPayload = {
              ...updatePayload,
              piperun_id: dealId,
              source: "piperun_sync",
              lead_status: deal.stage_id ? (STAGE_TO_ETAPA[deal.stage_id] || "sem_contato") : "sem_contato",
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

    console.log(`[sync-piperun] Total: ${allDeals.length}, updated: ${updated}, created: ${created}, notFound: ${notFound}, skippedNoData: ${skippedNoData}, estagnados: ${stagnantStarted}, resgatados: ${stagnantRescued}`);
    return new Response(JSON.stringify({
      success: true,
      synced: updated,
      created,
      not_found_by_piperun_id: notFound,
      skipped_no_email_nome: skippedNoData,
      total_deals: allDeals.length,
      pipeline_results: pipelineResults,
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
