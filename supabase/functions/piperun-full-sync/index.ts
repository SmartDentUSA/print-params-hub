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
  callNormalizeFromLead,
  type PipeRunDealData,
  type RichDealSnapshot,
} from "../_shared/piperun-field-map.ts";
import { computeTagsFromStage, mergeTagsCrm, JOURNEY_TAGS } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Deal History (uses shared builder from piperun-field-map.ts) ───

// ─── Identity Resolution (4-level cascade) ───

const SELECT_COLS = "id, lead_status, email, tags_crm, piperun_deals_history, produto_interesse, merged_into";

type FullSyncLeadRecord = {
  id: string;
  lead_status: string;
  email: string | null;
  tags_crm: string[] | null;
  piperun_deals_history: unknown[] | null;
  produto_interesse: string | null;
  merged_into: string | null;
};

async function findLeadByCascade(
  supabase: ReturnType<typeof createClient>,
  dealId: string,
  pessoaHash: string | null,
  pessoaPiperunId: number | null,
  email: string | null,
) {
  const { data: byDeal } = await supabase
    .from("lia_attendances").select(SELECT_COLS).eq("piperun_id", dealId).is("merged_into", null).maybeSingle();
  if (byDeal) return byDeal as FullSyncLeadRecord;

  if (pessoaHash) {
    const { data: byHash } = await supabase
      .from("lia_attendances").select(SELECT_COLS).eq("pessoa_hash", pessoaHash).is("merged_into", null).maybeSingle();
    if (byHash) return byHash as FullSyncLeadRecord;
  }

  if (pessoaPiperunId) {
    const { data: byPerson } = await supabase
      .from("lia_attendances").select(SELECT_COLS).eq("pessoa_piperun_id", pessoaPiperunId).is("merged_into", null).maybeSingle();
    if (byPerson) return byPerson as FullSyncLeadRecord;
  }

  if (email) {
    const { data: byEmail } = await supabase
      .from("lia_attendances").select(SELECT_COLS).eq("email", email.toLowerCase().trim()).is("merged_into", null).maybeSingle();
    if (byEmail) return byEmail as FullSyncLeadRecord;
  }

  return null;
}

async function findLeadByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
  excludeId?: string,
): Promise<FullSyncLeadRecord | null> {
  let query = supabase
    .from("lia_attendances")
    .select(SELECT_COLS)
    .eq("email", email.toLowerCase().trim())
    .is("merged_into", null);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.maybeSingle();
  return (data as FullSyncLeadRecord | null) ?? null;
}

function mergeTagLists(...lists: Array<string[] | null | undefined>): string[] | null {
  const merged = [...new Set(lists.flatMap((list) => list ?? []).filter(Boolean))];
  return merged.length ? merged : null;
}

function mergeDealHistorySets(...histories: Array<unknown[] | null | undefined>): RichDealSnapshot[] {
  let merged: RichDealSnapshot[] = [];

  for (const history of histories) {
    if (!Array.isArray(history)) continue;

    for (const snapshot of history) {
      if (!snapshot || typeof snapshot !== "object") continue;
      merged = upsertDealHistory(merged, snapshot as RichDealSnapshot);
    }
  }

  return merged;
}

async function resolveDuplicateEmailConflict(
  supabase: ReturnType<typeof createClient>,
  email: string,
  payload: Record<string, unknown>,
  currentLead: FullSyncLeadRecord | null,
  dealId: string,
): Promise<boolean> {
  const canonicalLead = await findLeadByEmail(supabase, email, currentLead?.id);
  if (!canonicalLead) {
    console.error(`[piperun-full-sync] Email conflict without canonical lead for deal ${dealId}: ${email}`);
    return false;
  }

  const payloadHistory = Array.isArray(payload.piperun_deals_history)
    ? (payload.piperun_deals_history as unknown[])
    : null;

  const canonicalPayload: Record<string, unknown> = {
    ...payload,
    piperun_deals_history: mergeDealHistorySets(
      canonicalLead.piperun_deals_history,
      currentLead?.piperun_deals_history,
      payloadHistory,
    ),
  };

  const mergedTags = mergeTagLists(
    canonicalLead.tags_crm,
    currentLead?.tags_crm,
    Array.isArray(payload.tags_crm) ? (payload.tags_crm as string[]) : null,
  );
  if (mergedTags) canonicalPayload.tags_crm = mergedTags;

  const { error: canonicalError } = await supabase
    .from("lia_attendances")
    .update(canonicalPayload)
    .eq("id", canonicalLead.id);

  if (canonicalError) {
    console.error(`[piperun-full-sync] Canonical update error deal ${dealId}:`, canonicalError.message);
    return false;
  }

  if (currentLead && currentLead.id !== canonicalLead.id) {
    const mergedAt = new Date().toISOString();
    await supabase
      .from("lia_attendances")
      .update({
        merged_into: canonicalLead.id,
        merged_at: mergedAt,
        merge_history: {
          source: "piperun-full-sync",
          reason: "email_conflict",
          conflicting_email: email,
          conflicting_deal_id: dealId,
          canonical_id: canonicalLead.id,
          merged_at: mergedAt,
        },
        updated_at: mergedAt,
      })
      .eq("id", currentLead.id);
  }

  console.log(`[piperun-full-sync] Email conflict merged deal ${dealId} into lead ${canonicalLead.id}`);
  return true;
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
        const deal = deepParseStringifiedFields(rawDeal as unknown as Record<string, unknown>) as unknown as PipeRunDealData;

        const dealId = String(deal.id);
        const updatePayload = mapDealToAttendance(deal);

        if (deal.stage_id) {
          const mappedStatus = STAGE_TO_ETAPA[deal.stage_id];
          if (mappedStatus) updatePayload.lead_status = mappedStatus;
          updatePayload.updated_at = new Date().toISOString();
        }

        const person = deal.person;
        const pessoaHash = person?.hash ? String(person.hash) : null;
        const pessoaPiperunId = deal.person_id ? Number(deal.person_id) : null;
        const email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;

        const dealSnapshot = buildRichDealSnapshot(deal, {
          dealId,
          product: updatePayload.produto_interesse ? String(updatePayload.produto_interesse) : null,
          ownerName: updatePayload.proprietario_lead_crm ? String(updatePayload.proprietario_lead_crm) : null,
        });

        const currentLead = await findLeadByCascade(supabase, dealId, pessoaHash, pessoaPiperunId, email);

        if (currentLead) {
          const smartPayload: Record<string, unknown> = { piperun_id: dealId };
          for (const [key, value] of Object.entries(updatePayload)) {
            if (value !== null && value !== undefined) {
              smartPayload[key] = value;
            }
          }
          smartPayload.piperun_deals_history = upsertDealHistory(currentLead.piperun_deals_history, dealSnapshot);

          try {
            const { applyPrimarySnapshot } = await import("../_shared/piperun-primary-deal.ts");
            applyPrimarySnapshot(smartPayload, smartPayload.piperun_deals_history as unknown[]);
          } catch (e) {
            console.warn("[piperun-full-sync] applyPrimarySnapshot failed:", e);
          }

          if (deal.stage_id) {
            const mappedStatus = STAGE_TO_ETAPA[deal.stage_id] || "sem_contato";
            const { tags: updatedTags } = computeTagsFromStage(mappedStatus, currentLead.tags_crm);
            smartPayload.tags_crm = updatedTags;
          }

          // ─── Won/Lost processing (mirrors webhook logic) ───
          const isWon = deal.status === "won" || deal.status === 1 || String(deal.status) === "1";
          const isLost = deal.status === "lost" || deal.status === 2 || String(deal.status) === "2";

          if (isWon || isLost) {
            const produtoEncerrado = smartPayload.produto_interesse
              ? String(smartPayload.produto_interesse)
              : currentLead.produto_interesse || null;
            const closedType = isWon ? "COMPRA" : "NAO_COMPROU";
            const baseTags = (smartPayload.tags_crm as string[]) || currentLead.tags_crm || [];

            const addTags: string[] = [
              `C_OPP_ENCERRADA_${closedType}`,
              "C_REENTRADA_NUTRICAO",
            ];
            if (isWon) {
              addTags.push("J04_COMPRA", "C_CONTRATO_FECHADO", "C_PQL_RECOMPRA");
              if (produtoEncerrado) addTags.push(`COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
            } else {
              if (produtoEncerrado) addTags.push(`NAO_COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
            }

            const removeTags = ["J03_NEGOCIACAO", "C_PERDIDO"];
            smartPayload.tags_crm = mergeTagsCrm(baseTags, addTags, removeTags);
            smartPayload.status_oportunidade = isWon ? "ganha" : "perdida_renutrir";
            if (isWon) smartPayload.lead_status = "CLIENTE_ativo";
            console.log(`[piperun-full-sync] Deal ${dealId} status=${isWon ? "WON" : "LOST"} → lead_status=${isWon ? "CLIENTE_ativo" : "kept"}, tags updated`);
          }

          const { error } = await supabase.from("lia_attendances").update(smartPayload).eq("id", currentLead.id);
          if (!error) {
            updated++;
            callNormalizeFromLead(supabase, currentLead.id).catch(() => {});
          } else if (error.code === "23505" && email) {
            const resolved = await resolveDuplicateEmailConflict(supabase, email, smartPayload, currentLead, dealId);
            if (resolved) updated++;
            else {
              errors++;
              console.error(`[piperun-full-sync] Update err deal ${dealId}:`, error.message);
            }
          } else {
            errors++;
            console.error(`[piperun-full-sync] Update err deal ${dealId}:`, error.message);
          }
        } else if (email) {
          const nome = updatePayload.nome || (deal as any).title || `Deal #${dealId}`;
          const resolvedStatus = deal.stage_id ? (STAGE_TO_ETAPA[deal.stage_id] || "sem_contato") : "sem_contato";
          const { tags: initialTags } = computeTagsFromStage(resolvedStatus, [JOURNEY_TAGS.J01_CONSCIENCIA]);

          const insertPayload: Record<string, unknown> = {
            ...updatePayload,
            nome,
            piperun_id: dealId,
            source: "piperun",
            lead_status: resolvedStatus,
            piperun_created_at: deal.created_at || null,
            piperun_deals_history: [dealSnapshot],
            tags_crm: initialTags,
          };
          const { data: newLead, error } = await supabase.from("lia_attendances").insert(insertPayload).select("id").maybeSingle();
          if (!error && newLead) {
            created++;
            callNormalizeFromLead(supabase, newLead.id).catch(() => {});
          }
          else if (error.code === "23505") {
            const resolved = await resolveDuplicateEmailConflict(supabase, email, insertPayload, null, dealId);
            if (resolved) updated++;
            else {
              errors++;
              console.error(`[piperun-full-sync] Insert err deal ${dealId}:`, error.message);
            }
          } else {
            errors++;
            console.error(`[piperun-full-sync] Insert err deal ${dealId}:`, error.message);
          }
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
