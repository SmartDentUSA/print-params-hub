import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PIPELINES,
  PIPELINE_NAMES,
  STAGE_TO_ETAPA,
  DEAL_STATUS_MAP,
  mapDealToAttendance,
  deepParseStringifiedFields,
  piperunGet,
  buildRichDealSnapshot,
  upsertDealHistory,
  type PipeRunDealData,
  type RichDealSnapshot,
} from "../_shared/piperun-field-map.ts";
import { computeTagsFromStage, JOURNEY_TAGS } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Deal History (uses shared builder from piperun-field-map.ts) ───

// ─── Identity Resolution (4-level cascade) ───

const SELECT_COLS = "id, lead_status, tags_crm, piperun_deals_history, produto_interesse";

async function findLeadByCascade(
  supabase: ReturnType<typeof createClient>,
  dealId: string,
  pessoaHash: string | null,
  pessoaPiperunId: number | null,
  email: string | null,
) {
  const { data: byDeal } = await supabase
    .from("lia_attendances").select(SELECT_COLS).eq("piperun_id", dealId).maybeSingle();
  if (byDeal) return byDeal;

  if (pessoaHash) {
    const { data: byHash } = await supabase
      .from("lia_attendances").select(SELECT_COLS).eq("pessoa_hash", pessoaHash).maybeSingle();
    if (byHash) return byHash;
  }

  if (pessoaPiperunId) {
    const { data: byPerson } = await supabase
      .from("lia_attendances").select(SELECT_COLS).eq("pessoa_piperun_id", pessoaPiperunId).maybeSingle();
    if (byPerson) return byPerson;
  }

  if (email) {
    const { data: byEmail } = await supabase
      .from("lia_attendances").select(SELECT_COLS).eq("email", email.toLowerCase().trim()).maybeSingle();
    if (byEmail) return byEmail;
  }

  return null;
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
    const pipelineId = Number(url.searchParams.get("pipeline_id") || PIPELINES.VENDAS);
    const maxPages = Number(url.searchParams.get("max_pages") || 50);
    const statusFilter = url.searchParams.get("status");

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
      const arrayParams = { "with[]": ["person", "person.phones", "person.emails", "person.company", "company", "company.phones", "company.emails", "origin", "stage", "proposals", "activities", "tags"] };

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

    for (const rawDeal of allDeals) {
      try {
        // GAP 1 FIX: Deep parse stringified fields
        const deal = deepParseStringifiedFields(rawDeal as unknown as Record<string, unknown>) as unknown as PipeRunDealData;

        const dealId = String(deal.id);
        const updatePayload = mapDealToAttendance(deal);

        if (deal.stage_id) {
          const mappedStatus = STAGE_TO_ETAPA[deal.stage_id];
          if (mappedStatus) updatePayload.lead_status = mappedStatus;
          updatePayload.updated_at = new Date().toISOString();
        }

        // Extract identity keys for cascade
        const person = deal.person;
        const pessoaHash = person?.hash ? String(person.hash) : null;
        const pessoaPiperunId = deal.person_id ? Number(deal.person_id) : null;
        const email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;

        // Build deal snapshot
        const dealStatus = deal.status !== undefined ? (DEAL_STATUS_MAP[deal.status] || "aberta") : "aberta";
        const dealSnapshot: DealSnapshot = {
          deal_id: dealId,
          deal_hash: deal.hash || null,
          pipeline_id: deal.pipeline_id,
          pipeline_name: deal.pipeline_id ? (PIPELINE_NAMES[deal.pipeline_id] || null) : null,
          stage_name: deal.stage?.name || (deal.stage_id ? STAGE_TO_ETAPA[deal.stage_id] : null) || null,
          status: dealStatus,
          value: deal.value != null ? Number(deal.value) || null : null,
          created_at: deal.created_at || null,
          closed_at: deal.closed_at || null,
          product: updatePayload.produto_interesse ? String(updatePayload.produto_interesse) : null,
        };

        // GAP 2 FIX: 4-level identity cascade
        const currentLead = await findLeadByCascade(supabase, dealId, pessoaHash, pessoaPiperunId, email);

        if (currentLead) {
          const smartPayload: Record<string, unknown> = { piperun_id: dealId };
          for (const [key, value] of Object.entries(updatePayload)) {
            if (value !== null && value !== undefined) {
              smartPayload[key] = value;
            }
          }
          // GAP 3 FIX: Upsert deal history
          smartPayload.piperun_deals_history = upsertDealHistory(currentLead.piperun_deals_history, dealSnapshot);

          // GAP 4 FIX: Tags CRM journey
          if (deal.stage_id) {
            const mappedStatus = STAGE_TO_ETAPA[deal.stage_id] || "sem_contato";
            const { tags: updatedTags } = computeTagsFromStage(mappedStatus, currentLead.tags_crm);
            smartPayload.tags_crm = updatedTags;
          }

          await supabase.from("lia_attendances").update(smartPayload).eq("id", currentLead.id);
          updated++;
        } else if (email) {
          // Insert new
          const nome = updatePayload.nome || (deal as any).title || `Deal #${dealId}`;
          const resolvedStatus = deal.stage_id ? (STAGE_TO_ETAPA[deal.stage_id] || "sem_contato") : "sem_contato";
          const { tags: initialTags } = computeTagsFromStage(resolvedStatus, [JOURNEY_TAGS.J01_CONSCIENCIA]);

          const insertPayload = {
            ...updatePayload,
            nome,
            piperun_id: dealId,
            source: "piperun",
            lead_status: resolvedStatus,
            piperun_created_at: deal.created_at || null,
            piperun_deals_history: [dealSnapshot],
            tags_crm: initialTags,
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
