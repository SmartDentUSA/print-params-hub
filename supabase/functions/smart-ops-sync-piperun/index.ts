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
  type PipeRunDealData,
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

// ─── Deal Snapshot for history ───

interface ProposalItem {
  item_id: string;
  nome: string;
  tipo: string;
  qtd: number;
  unit: number;
  total: number;
  categoria: string;
}

interface ProposalSnapshot {
  id: string | number;
  sigla: string;
  status: string;
  vendedor: string;
  tipo_frete: string;
  valor_frete: number;
  valor_ps: number;
  valor_mrr: number;
  parcelas: number;
  items: ProposalItem[];
}

interface DealSnapshot {
  deal_id: string;
  deal_hash: string | null;
  pipeline_id: number | undefined;
  pipeline_name: string | null;
  stage_name: string | null;
  status: string;
  value: number | null;
  value_products: number | null;
  value_freight: number | null;
  value_mrr: number | null;
  created_at: string | null;
  closed_at: string | null;
  product: string | null;
  owner_name: string | null;
  owner_email: string | null;
  origem: string | null;
  synced_at: string;
  proposals: ProposalSnapshot[];
}

function upsertDealHistory(
  currentHistory: unknown[] | null,
  snapshot: DealSnapshot,
): DealSnapshot[] {
  const history = (Array.isArray(currentHistory) ? [...currentHistory] : []) as DealSnapshot[];
  const idx = history.findIndex((d) => String(d.deal_id) === String(snapshot.deal_id));
  if (idx >= 0) {
    history[idx] = snapshot;
  } else {
    history.push(snapshot);
  }
  return history;
}

// ─── Identity Resolution (4-level cascade, matching webhook) ───

interface LeadRecord {
  id: string;
  lead_status: string;
  email: string | null;
  tags_crm: string[] | null;
  piperun_deals_history: unknown[] | null;
  produto_interesse: string | null;
}

const SELECT_COLS = "id, lead_status, email, tags_crm, piperun_deals_history, produto_interesse";

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
    .maybeSingle();
  if (byDeal) return byDeal as LeadRecord;

  // 2. By pessoa_hash
  if (pessoaHash) {
    const { data: byHash } = await supabase
      .from("lia_attendances")
      .select(SELECT_COLS)
      .eq("pessoa_hash", pessoaHash)
      .maybeSingle();
    if (byHash) return byHash as LeadRecord;
  }

  // 3. By pessoa_piperun_id
  if (pessoaPiperunId) {
    const { data: byPersonId } = await supabase
      .from("lia_attendances")
      .select(SELECT_COLS)
      .eq("pessoa_piperun_id", pessoaPiperunId)
      .maybeSingle();
    if (byPersonId) return byPersonId as LeadRecord;
  }

  // 4. By email
  if (email) {
    const { data: byEmail } = await supabase
      .from("lia_attendances")
      .select(SELECT_COLS)
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (byEmail) return byEmail as LeadRecord;
  }

  return null;
}

// ─── Fetch deals from PipeRun API ───

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

    allDeals = allDeals.concat(deals);

    if (piperunData?.meta && piperunData.meta.current_page >= piperunData.meta.last_page) break;
    page++;
  }

  return allDeals;
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
  const email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;

  // GAP 2 FIX: 4-level identity cascade (matching webhook)
  const currentLead = await findLeadByCascade(supabase, dealId, pessoaHash, pessoaPiperunId, email);

  // Build deal snapshot for history
  const dealStatus = deal.status !== undefined
    ? (DEAL_STATUS_MAP[deal.status] || "aberta")
    : "aberta";
  const ownerName = deal.owner_id ? (PIPERUN_USERS[deal.owner_id]?.name || null) : null;

  // Extract proposals from deal
  const proposalSnapshots: ProposalSnapshot[] = [];
  if (Array.isArray(deal.proposals)) {
    for (const prop of deal.proposals as any[]) {
      const items: ProposalItem[] = [];
      if (Array.isArray(prop.items)) {
        for (const it of prop.items) {
          items.push({
            item_id: String(it.id || it.item_id || ""),
            nome: it.name || it.description || "",
            tipo: it.type || "Produto",
            qtd: Number(it.quantity) || 1,
            unit: Number(it.unit_value || it.unit_price || 0),
            total: Number(it.total_value || it.total || 0),
            categoria: it.category || "",
          });
        }
      }
      proposalSnapshots.push({
        id: prop.id || "",
        sigla: prop.initials || prop.sigla || "",
        status: prop.status || "",
        vendedor: prop.seller_name || prop.vendedor || ownerName || "",
        tipo_frete: prop.freight_type || "",
        valor_frete: Number(prop.freight_value || 0),
        valor_ps: Number(prop.value || prop.total_value || 0),
        valor_mrr: Number(prop.value_mrr || 0),
        parcelas: Number(prop.installments || 0),
        items,
      });
    }
  }

  // Owner email from users map

  // Extract value breakdown
  const totalFreight = proposalSnapshots.reduce((s, p) => s + p.valor_frete, 0);
  const totalMrr = deal.value_mrr != null ? Number(deal.value_mrr) : 0;

  const dealSnapshot: DealSnapshot = {
    deal_id: dealId,
    deal_hash: deal.hash || null,
    pipeline_id: deal.pipeline_id,
    pipeline_name: deal.pipeline_id ? (PIPELINE_NAMES[deal.pipeline_id] || null) : null,
    stage_name: deal.stage?.name || (deal.stage_id ? STAGE_TO_ETAPA[deal.stage_id] : null) || null,
    status: dealStatus,
    value: deal.value != null ? Number(deal.value) : null,
    value_products: deal.value != null ? Number(deal.value) - totalFreight : null,
    value_freight: totalFreight || null,
    value_mrr: totalMrr || null,
    created_at: deal.created_at || null,
    closed_at: deal.closed_at || null,
    product: updatePayload.produto_interesse ? String(updatePayload.produto_interesse) : null,
    owner_name: ownerName,
    owner_email: deal.owner_id ? (PIPERUN_USERS[deal.owner_id]?.email || null) : null,
    origem: deal.origin?.name || null,
    synced_at: new Date().toISOString(),
    proposals: proposalSnapshots,
  };

  if (currentLead) {
    // Smart merge: remove null/undefined values but PRESERVE falsy values (0, false, "")
    const smartPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updatePayload)) {
      if (value != null) {  // allows 0, false, "" — only filters null/undefined
        smartPayload[key] = value;
      }
    }

    // Always update piperun_id to current deal
    smartPayload.piperun_id = dealId;

    // GAP 3 FIX: Upsert deal history
    smartPayload.piperun_deals_history = upsertDealHistory(currentLead.piperun_deals_history, dealSnapshot);

    // Stagnation logic
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
        // GAP 4 FIX: Tags CRM journey computation
        const mappedStatus = STAGE_TO_ETAPA[deal.stage_id] || "sem_contato";
        const { tags: updatedTags } = computeTagsFromStage(mappedStatus, currentLead.tags_crm);
        smartPayload.tags_crm = updatedTags;
      }
    }

    const { error } = await supabase
      .from("lia_attendances")
      .update(smartPayload)
      .eq("id", currentLead.id);

    if (!error) {
      counters.updated++;

      // ─── Deal Consolidation: priorizar deal aberto de maior valor ───
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

          // Auditoria de consolidação
          logEnrichmentAudit(
            currentLead.id,
            "piperun_consolidation",
            ["valor_oportunidade", "piperun_id", "piperun_stage_name"],
          ).catch(() => {});
        }
      }
    } else {
      console.error(`[sync-piperun] Update error deal ${dealId}:`, error.message);
    }
  } else {
    // Not found — try to create
    if (!email) {
      counters.skippedNoData++;
      return;
    }

    const nome = updatePayload.nome ? String(updatePayload.nome) : (deal as any).title || `Deal #${dealId}`;
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
    if (!error) counters.created++;
    else console.error(`[sync-piperun] Insert error deal ${dealId}:`, error.message);
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
