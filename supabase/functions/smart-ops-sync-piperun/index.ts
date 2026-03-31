import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PIPELINES,
  PIPELINE_NAMES,
  STAGE_TO_ETAPA,
  DEAL_STATUS_MAP,
  PIPERUN_USERS,
  mapDealToAttendance,
  deepParseStringifiedFields,
  piperunGet,
  buildRichDealSnapshot,
  upsertDealHistory as sharedUpsertDealHistory,
  callNormalizeFromLead,
  type PipeRunDealData,
  type RichDealSnapshot,
  type RichProposalSnapshot,
  type RichProposalItem,
} from "../_shared/piperun-field-map.ts";
import { computeTagsFromStage, mergeTagsCrm, ALL_STAGNATION_TAGS, JOURNEY_TAGS } from "../_shared/sellflux-field-map.ts";
import { logEnrichmentAudit } from "../_shared/lead-enrichment.ts";

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

// ─── Most Relevant Deal Logic ───
// Prioriza: deal aberto com maior valor → deal aberto mais recente → último processado
function getMostRelevantDeal(deals: DealSnapshot[]): DealSnapshot | null {
  if (!deals?.length) return null;

  const OPEN_STATUSES = ["aberta", "negociacao", "em_andamento", "open"];

  // 1. Deals abertos ordenados por maior valor
  const openDeals = deals
    .filter(d => OPEN_STATUSES.includes((d.status || "").toLowerCase()))
    .sort((a, b) => ((b.value ?? 0) - (a.value ?? 0)));

  if (openDeals.length > 0) return openDeals[0];

  // 2. Fallback: deal mais recente (independente do status)
  const sorted = [...deals].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });
  return sorted[0];
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
  PIPELINES.GANHOS_ALEATORIOS,
];

// ─── HTML Sanitization ───
function stripHtml(str: string | null | undefined): string {
  if (!str || typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// ProposalItem, ProposalSnapshot, DealSnapshot now use shared Rich* types from piperun-field-map.ts
// Local aliases for backwards compatibility within this file
type ProposalItem = RichProposalItem;
type ProposalSnapshot = RichProposalSnapshot;
type DealSnapshot = RichDealSnapshot;

function upsertDealHistory(
  currentHistory: unknown[] | null,
  snapshot: DealSnapshot,
): DealSnapshot[] {
  return sharedUpsertDealHistory(currentHistory, snapshot);
}

// ─── Identity Resolution (4-level cascade, matching webhook) ───

interface LeadRecord {
  id: string;
  lead_status: string;
  email: string | null;
  tags_crm: string[] | null;
  piperun_deals_history: unknown[] | null;
  produto_interesse: string | null;
  merged_into: string | null;
}

const SELECT_COLS = "id, lead_status, email, tags_crm, piperun_deals_history, produto_interesse, merged_into";

async function findLeadByCascade(
  supabase: ReturnType<typeof createClient>,
  dealId: string,
  pessoaHash: string | null,
  pessoaPiperunId: number | null,
  email: string | null,
): Promise<LeadRecord | null> {
  // 1. By piperun_id
  const { data: byDeal } = await supabase
    .from("lia_attendances")
    .select(SELECT_COLS)
    .eq("piperun_id", dealId)
    .is("merged_into", null)
    .maybeSingle();
  if (byDeal) return byDeal as LeadRecord;

  // 2. By pessoa_hash
  if (pessoaHash) {
    const { data: byHash } = await supabase
      .from("lia_attendances")
      .select(SELECT_COLS)
      .eq("pessoa_hash", pessoaHash)
      .is("merged_into", null)
      .maybeSingle();
    if (byHash) return byHash as LeadRecord;
  }

  // 3. By pessoa_piperun_id
  if (pessoaPiperunId) {
    const { data: byPersonId } = await supabase
      .from("lia_attendances")
      .select(SELECT_COLS)
      .eq("pessoa_piperun_id", pessoaPiperunId)
      .is("merged_into", null)
      .maybeSingle();
    if (byPersonId) return byPersonId as LeadRecord;
  }

  // 4. By email
  if (email) {
    const { data: byEmail } = await supabase
      .from("lia_attendances")
      .select(SELECT_COLS)
      .eq("email", email.toLowerCase().trim())
      .is("merged_into", null)
      .maybeSingle();
    if (byEmail) return byEmail as LeadRecord;
  }

  return null;
}

async function findLeadByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
  excludeId?: string,
): Promise<LeadRecord | null> {
  let query = supabase
    .from("lia_attendances")
    .select(SELECT_COLS)
    .eq("email", email.toLowerCase().trim())
    .is("merged_into", null);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.maybeSingle();
  return (data as LeadRecord | null) ?? null;
}

function mergeTagLists(...lists: Array<string[] | null | undefined>): string[] | null {
  const merged = [...new Set(lists.flatMap((list) => list ?? []).filter(Boolean))];
  return merged.length ? merged : null;
}

function mergeDealHistorySets(...histories: Array<unknown[] | null | undefined>): DealSnapshot[] {
  let merged: DealSnapshot[] = [];

  for (const history of histories) {
    if (!Array.isArray(history)) continue;

    for (const snapshot of history) {
      if (!snapshot || typeof snapshot !== "object") continue;
      merged = upsertDealHistory(merged, snapshot as DealSnapshot);
    }
  }

  return merged;
}

async function clearMergedLeadUniqueKeys(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
): Promise<void> {
  await supabase
    .from("lia_attendances")
    .update({
      piperun_id: null,
      piperun_link: null,
      email: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  console.log(`[sync-piperun] Cleared unique keys from merged lead ${leadId}`);
}

async function resolveDuplicateEmailConflict(
  supabase: ReturnType<typeof createClient>,
  email: string,
  payload: Record<string, unknown>,
  currentLead: LeadRecord | null,
  dealId: string,
): Promise<boolean> {
  const canonicalLead = await findLeadByEmail(supabase, email, currentLead?.id);
  if (!canonicalLead) {
    console.error(`[sync-piperun] Email conflict without canonical lead for deal ${dealId}: ${email}`);
    return false;
  }

  // Step 1: Clear unique keys from the lead being merged BEFORE updating canonical
  if (currentLead && currentLead.id !== canonicalLead.id) {
    await clearMergedLeadUniqueKeys(supabase, currentLead.id);
  }

  const payloadHistory = Array.isArray(payload.piperun_deals_history)
    ? (payload.piperun_deals_history as unknown[])
    : null;

  // Remove email from payload to avoid setting it again on canonical (it already has it)
  const { email: _email, ...payloadWithoutEmail } = payload;

  const canonicalPayload: Record<string, unknown> = {
    ...payloadWithoutEmail,
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
  if (mergedTags) {
    canonicalPayload.tags_crm = mergedTags;
  }

  const { error: canonicalError } = await supabase
    .from("lia_attendances")
    .update(canonicalPayload)
    .eq("id", canonicalLead.id);

  if (canonicalError) {
    console.error(`[sync-piperun] Canonical update error deal ${dealId}:`, canonicalError.message);
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
          source: "smart-ops-sync-piperun",
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

  console.log(`[sync-piperun] Email conflict merged deal ${dealId} into lead ${canonicalLead.id}`);
  return true;
}

// ─── Fetch deals from PipeRun API ───

async function fetchDealsForPipeline(
  apiKey: string,
  pipelineId: number,
  since: string | null,
  maxPages: number,
  offset: number = 0,
  chunkSize: number = 0,
): Promise<PipeRunDealData[]> {
  let allDeals: PipeRunDealData[] = [];
  let page = 1;
  let totalFetched = 0;

  // If offset is set, calculate the starting page (100 per page from API)
  if (offset > 0) {
    page = Math.floor(offset / 100) + 1;
  }

  while (page <= maxPages) {
    const params: Record<string, string | number> = {
      show: 100,
      page,
      pipeline_id: pipelineId,
    };
    const arrayParams = { "with[]": ["person", "person.phones", "person.emails", "person.company", "company", "company.phones", "company.emails", "origin", "stage", "proposals", "activities", "tags"] };
    if (since) params.updated_since = since;

    const result = await piperunGet(apiKey, "deals", params, arrayParams);

    if (!result.success) {
      console.error(`[sync-piperun] API error pipeline=${pipelineId} page=${page}:`, result.status);
      break;
    }

    const piperunData = result.data as { data?: PipeRunDealData[]; meta?: { current_page: number; last_page: number } };
    const deals = piperunData?.data || [];
    if (deals.length === 0) break;

    // Handle offset within the first page
    let startIdx = 0;
    if (offset > 0 && page === Math.floor(offset / 100) + 1) {
      startIdx = offset % 100;
    }

    const slicedDeals = startIdx > 0 ? deals.slice(startIdx) : deals;
    
    for (const deal of slicedDeals) {
      if (chunkSize > 0 && totalFetched >= chunkSize) break;
      allDeals.push(deal);
      totalFetched++;
    }

    if (chunkSize > 0 && totalFetched >= chunkSize) break;
    if (piperunData?.meta && piperunData.meta.current_page >= piperunData.meta.last_page) break;
    page++;
  }

  return allDeals;
}

// Count total deals in a pipeline (lightweight call)
async function countDealsForPipeline(
  apiKey: string,
  pipelineId: number,
  since: string | null,
): Promise<number> {
  const params: Record<string, string | number> = {
    show: 1,
    page: 1,
    pipeline_id: pipelineId,
  };
  if (since) params.updated_since = since;

  const result = await piperunGet(apiKey, "deals", params);
  if (!result.success) return 0;

  const piperunData = result.data as { meta?: { total: number; last_page: number } };
  if (piperunData?.meta?.total) return piperunData.meta.total;
  if (piperunData?.meta?.last_page) return piperunData.meta.last_page * 100; // estimate
  return 0;
}

// ─── Process a single deal (shared between single and full sync) ───

async function processDeal(
  supabase: ReturnType<typeof createClient>,
  rawDeal: PipeRunDealData,
  counters: { updated: number; created: number; skippedNoData: number; stagnantStarted: number; stagnantRescued: number },
) {
  // GAP 1 FIX: Deep parse stringified fields before mapping
  const deal = deepParseStringifiedFields(rawDeal as unknown as Record<string, unknown>) as unknown as PipeRunDealData;

  const dealId = String(deal.id);
  const updatePayload = mapDealToAttendance(deal);

  if (deal.stage_id) {
    const mappedStatus = STAGE_TO_ETAPA[deal.stage_id];
    if (mappedStatus) {
      updatePayload.lead_status = mappedStatus;
    }
    updatePayload.updated_at = new Date().toISOString();
  }

  // Extract identity keys for cascade
  const person = deal.person;
  const pessoaHash = person?.hash ? String(person.hash) : null;
  const pessoaPiperunId = deal.person_id ? Number(deal.person_id) : null;
  // Normalize email: take first if comma-separated, lowercase, trim
  const rawEmail = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;
  const email = rawEmail?.includes(",") ? rawEmail.split(",")[0].trim() : rawEmail;
  if (email && email !== rawEmail) {
    updatePayload.email = email;
  }

  // GAP 2 FIX: 4-level identity cascade (matching webhook)
  const currentLead = await findLeadByCascade(supabase, dealId, pessoaHash, pessoaPiperunId, email);

  // Build deal snapshot using shared builder
  const dealSnapshot = buildRichDealSnapshot(deal, {
    dealId,
    product: updatePayload.produto_interesse ? String(updatePayload.produto_interesse) : null,
    ownerName: updatePayload.proprietario_lead_crm ? String(updatePayload.proprietario_lead_crm) : null,
  });

  if (currentLead) {
    // Smart merge: remove null/undefined values but PRESERVE falsy values (0, false, "")
    const smartPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updatePayload)) {
      if (value != null) {
        smartPayload[key] = value;
      }
    }

    smartPayload.piperun_id = dealId;
    smartPayload.piperun_deals_history = upsertDealHistory(currentLead.piperun_deals_history, dealSnapshot);

    if (deal.stage_id) {
      const newIsStagnant = isStagnantPipeline(deal.pipeline_id);
      const wasStagnant = isInStagnantStatus(currentLead.lead_status);

      if (newIsStagnant && !wasStagnant && currentLead.lead_status !== "estagnado_final") {
        smartPayload.ultima_etapa_comercial = currentLead.lead_status;
        counters.stagnantStarted++;
      } else if (!newIsStagnant && wasStagnant) {
        counters.stagnantRescued++;
        const mappedStatus = STAGE_TO_ETAPA[deal.stage_id] || "sem_contato";
        const { tags: recoveredTags } = computeTagsFromStage(mappedStatus, currentLead.tags_crm);
        smartPayload.tags_crm = mergeTagsCrm(recoveredTags, ["C_RECUPERADO"], ALL_STAGNATION_TAGS);
      } else {
        const mappedStatus = STAGE_TO_ETAPA[deal.stage_id] || "sem_contato";
        const { tags: updatedTags } = computeTagsFromStage(mappedStatus, currentLead.tags_crm);
        smartPayload.tags_crm = updatedTags;
      }
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
        addTags.push(JOURNEY_TAGS.J04_COMPRA, "C_CONTRATO_FECHADO", "C_PQL_RECOMPRA");
        if (produtoEncerrado) addTags.push(`COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
      } else {
        if (produtoEncerrado) addTags.push(`NAO_COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
      }

      const removeTags = [JOURNEY_TAGS.J03_NEGOCIACAO, "C_PERDIDO"];
      smartPayload.tags_crm = mergeTagsCrm(baseTags, addTags, removeTags);
      smartPayload.status_oportunidade = isWon ? "ganha" : "perdida_renutrir";
      if (isWon) smartPayload.lead_status = "CLIENTE_ativo";
      console.log(`[sync-piperun] Deal ${dealId} status=${isWon ? "WON" : "LOST"} → lead_status=${isWon ? "CLIENTE_ativo" : "kept"}, tags updated`);
    }

    const { error } = await supabase
      .from("lia_attendances")
      .update(smartPayload)
      .eq("id", currentLead.id);

    if (!error) {
      counters.updated++;
      callNormalizeFromLead(supabase, currentLead.id).catch(() => {});

      const fullHistory = smartPayload.piperun_deals_history as DealSnapshot[] | undefined;
      if (fullHistory && fullHistory.length > 1) {
        const relevantDeal = getMostRelevantDeal(fullHistory);
        if (relevantDeal && String(relevantDeal.deal_id) !== dealId) {
          const consolidatedValue = relevantDeal.value != null ? Number(relevantDeal.value) : null;
          const consolidationPayload: Record<string, unknown> = {
            valor_oportunidade: consolidatedValue,
            piperun_id: String(relevantDeal.deal_id),
            piperun_stage_name: relevantDeal.stage_name || null,
            updated_at: new Date().toISOString(),
          };
          await supabase
            .from("lia_attendances")
            .update(consolidationPayload)
            .eq("id", currentLead.id);

          logEnrichmentAudit(
            currentLead.id,
            "piperun_consolidation",
            ["valor_oportunidade", "piperun_id", "piperun_stage_name"],
          ).catch(() => {});
        }
      }
    } else if (error.code === "23505" && email) {
      const resolved = await resolveDuplicateEmailConflict(supabase, email, smartPayload, currentLead, dealId);
      if (resolved) {
        counters.updated++;
      } else {
        console.error(`[sync-piperun] Update error deal ${dealId}:`, error.message);
      }
    } else {
      console.error(`[sync-piperun] Update error deal ${dealId}:`, error.message);
    }
  } else {
    if (!email) {
      counters.skippedNoData++;
      return;
    }

    const nome = updatePayload.nome ? String(updatePayload.nome) : (deal as any).title || `Deal #${dealId}`;
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
      counters.created++;
      callNormalizeFromLead(supabase, newLead.id).catch(() => {});
    } else if (error.code === "23505") {
      const resolved = await resolveDuplicateEmailConflict(supabase, email, insertPayload, null, dealId);
      if (resolved) {
        counters.updated++;
      } else {
        console.error(`[sync-piperun] Insert error deal ${dealId}:`, error.message);
      }
    } else {
      console.error(`[sync-piperun] Insert error deal ${dealId}:`, error.message);
    }
  }
}

// ─── Main Handler ───

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
      const CHUNK_SIZE = 500;
      const pipelinesToSync = singlePipeline
        ? [Number(singlePipeline)]
        : [...SYNC_PIPELINES];

      const allResults: Record<string, unknown> = {};
      let totalUpdated = 0, totalCreated = 0, totalDeals = 0;

      for (const pid of pipelinesToSync) {
        try {
          // Step 1: Count total deals
          const totalCount = await countDealsForPipeline(PIPERUN_API_KEY, pid, since);
          console.log(`[sync-piperun] Pipeline ${pid}: ~${totalCount} deals total`);

          if (totalCount === 0) {
            allResults[`pipeline_${pid}`] = { total_deals: 0, skipped: true };
            continue;
          }

          // Step 2: Chunk if needed
          const chunks: number[] = [];
          if (fullSync && totalCount > CHUNK_SIZE) {
            for (let off = 0; off < totalCount; off += CHUNK_SIZE) {
              chunks.push(off);
            }
          } else {
            chunks.push(0); // single chunk
          }

          const pipelineResults: unknown[] = [];
          for (const chunkOffset of chunks) {
            const chunkParams = `pipeline_id=${pid}${fullSync ? "&full=true" : ""}&offset=${chunkOffset}&chunk_size=${CHUNK_SIZE}`;
            const fnUrl = `${SUPABASE_URL}/functions/v1/smart-ops-sync-piperun?${chunkParams}`;
            try {
              const res = await fetch(fnUrl, {
                headers: {
                  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                  "Content-Type": "application/json",
                },
              });
              const ct = res.headers.get("content-type") || "";
              if (!ct.includes("application/json")) {
                const txt = await res.text();
                console.error(`[sync-piperun] Pipeline ${pid} offset=${chunkOffset} non-JSON (${res.status}):`, txt.substring(0, 200));
                pipelineResults.push({ error: `Non-JSON (${res.status})`, offset: chunkOffset });
                continue;
              }
              const data = await res.json();
              pipelineResults.push(data);
              if (data.synced) totalUpdated += data.synced;
              if (data.created) totalCreated += data.created;
              if (data.total_deals) totalDeals += data.total_deals;
            } catch (e) {
              pipelineResults.push({ error: String(e), offset: chunkOffset });
            }
          }

          allResults[`pipeline_${pid}`] = chunks.length === 1 ? pipelineResults[0] : { chunks: pipelineResults, total_chunks: chunks.length };
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
    const offset = Number(url.searchParams.get("offset") || "0");
    const chunkSize = Number(url.searchParams.get("chunk_size") || "0");

    const allDeals = await fetchDealsForPipeline(PIPERUN_API_KEY, pipelineId, since, maxPages, offset, chunkSize);
    console.log(`[sync-piperun] Pipeline ${pipelineId} offset=${offset} chunk=${chunkSize}: ${allDeals.length} deals fetched`);

    const counters = { updated: 0, created: 0, skippedNoData: 0, stagnantStarted: 0, stagnantRescued: 0 };

    for (const deal of allDeals) {
      try {
        await processDeal(supabase, deal, counters);
      } catch (e) {
        console.error(`[sync-piperun] Deal error:`, e);
      }
    }

    console.log(`[sync-piperun] Pipeline ${pipelineId}: updated=${counters.updated}, created=${counters.created}, skipped=${counters.skippedNoData}`);
    return new Response(JSON.stringify({
      success: true,
      synced: counters.updated,
      created: counters.created,
      skipped_no_email: counters.skippedNoData,
      total_deals: allDeals.length,
      pipeline_id: pipelineId,
      stagnant_started: counters.stagnantStarted,
      stagnant_rescued: counters.stagnantRescued,
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
