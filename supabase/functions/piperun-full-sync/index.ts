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
    const pipelineId = Number(url.searchParams.get("pipeline_id") || PIPELINES.VENDAS);
    const maxPages = Number(url.searchParams.get("max_pages") || 50);
    // status filter: 0=open, 1=won, 2=lost, 3=stagnant. Default: all
    const statusFilter = url.searchParams.get("status"); // "0", "1", "2", "0,1,2"

    console.log(`[piperun-full-sync] Starting pipeline=${pipelineId} maxPages=${maxPages} status=${statusFilter}`);

    // Fetch all deals from PipeRun
    let allDeals: PipeRunDealData[] = [];
    let page = 1;

    while (page <= maxPages) {
      const params: Record<string, string | number> = {
        show: 200,
        page,
        pipeline_id: pipelineId,
      };
      if (statusFilter) params.status = statusFilter;
      const arrayParams = { "with[]": ["person", "origin"] };

      const result = await piperunGet(PIPERUN_API_KEY, "deals", params, arrayParams);
      if (!result.success) {
        console.error(`[piperun-full-sync] API error page=${page}:`, result.status);
        break;
      }

      const piperunData = result.data as { data?: PipeRunDealData[]; meta?: { current_page: number; last_page: number } };
      const deals = piperunData?.data || [];
      if (deals.length === 0) break;

      allDeals = allDeals.concat(deals);
      console.log(`[piperun-full-sync] Page ${page}: ${deals.length} deals (total: ${allDeals.length})`);

      if (piperunData?.meta && piperunData.meta.current_page >= piperunData.meta.last_page) break;
      page++;
    }

    console.log(`[piperun-full-sync] Total deals fetched: ${allDeals.length}`);

    let updated = 0, created = 0, skipped = 0, errors = 0;

    for (const deal of allDeals) {
      try {
        const dealId = String(deal.id);
        const updatePayload = mapDealToAttendance(deal);

        if (deal.stage_id) {
          const mappedStatus = STAGE_TO_ETAPA[deal.stage_id];
          if (mappedStatus) updatePayload.lead_status = mappedStatus;
          updatePayload.updated_at = new Date().toISOString();
        }

        // Try find by piperun_id first
        const { data: byPiperun } = await supabase
          .from("lia_attendances")
          .select("id, lead_status")
          .eq("piperun_id", dealId)
          .maybeSingle();

        if (byPiperun) {
          const smartPayload: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(updatePayload)) {
            if (value !== null && value !== undefined) {
              smartPayload[key] = value;
            }
          }
          await supabase.from("lia_attendances").update(smartPayload).eq("id", byPiperun.id);
          updated++;
          continue;
        }

        // Try find by email
        const email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;
        if (email) {
          const { data: byEmail } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (byEmail) {
            const smartPayload: Record<string, unknown> = { piperun_id: dealId };
            for (const [key, value] of Object.entries(updatePayload)) {
              if (value !== null && value !== undefined) smartPayload[key] = value;
            }
            await supabase.from("lia_attendances").update(smartPayload).eq("id", byEmail.id);
            updated++;
            continue;
          }

          // Insert new
          const nome = updatePayload.nome || (deal as any).title || `Deal #${dealId}`;
          const insertPayload = {
            ...updatePayload,
            nome,
            piperun_id: dealId,
            source: "piperun",
            lead_status: deal.stage_id ? (STAGE_TO_ETAPA[deal.stage_id] || "sem_contato") : "sem_contato",
            piperun_created_at: deal.created_at || null,
          };
          const { error } = await supabase.from("lia_attendances").insert(insertPayload);
          if (!error) created++;
          else { errors++; console.error(`[piperun-full-sync] Insert err deal ${dealId}:`, error.message); }
        } else {
          skipped++;
        }
      } catch (e) {
        errors++;
        console.error(`[piperun-full-sync] Deal error:`, e);
      }
    }

    const result = {
      success: true,
      pipeline_id: pipelineId,
      total_deals: allDeals.length,
      updated,
      created,
      skipped_no_email: skipped,
      errors,
    };
    console.log(`[piperun-full-sync] Result:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[piperun-full-sync] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
