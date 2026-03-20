import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "detail") {
      return await handleDetail(supabase, url);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[leads-api] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleDetail(supabase: ReturnType<typeof createClient>, url: URL) {
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Lead
  const { data: lead, error: leadErr } = await supabase
    .from("lia_attendances")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (leadErr) {
    console.error("[leads-api] lead fetch error:", leadErr);
    return new Response(JSON.stringify({ error: leadErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!lead) {
    return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Person (if pessoa_piperun_id exists)
  let person = null;
  if (lead.pessoa_piperun_id) {
    const { data } = await supabase
      .from("people")
      .select("*")
      .eq("piperun_person_id", lead.pessoa_piperun_id)
      .maybeSingle();
    person = data;
  }

  // 3. Company
  let company = null;
  if (lead.empresa_piperun_id) {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("piperun_company_id", lead.empresa_piperun_id)
      .maybeSingle();
    company = data;
  }

  // 4. Deals history
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .eq("lead_id", id)
    .order("piperun_created_at", { ascending: false })
    .limit(50);

  // ─── Merge JSONB history + table deals, pick richest source ───
  const jsonbDeals = (Array.isArray(lead.piperun_deals_history) ? lead.piperun_deals_history : []) as any[];
  const tableDeals = (deals || []).map((d: any) => ({
    deal_id: d.piperun_deal_id || d.id,
    pipeline_name: d.pipeline_name,
    stage_name: d.stage_name,
    status: d.status === "won" ? "ganha" : d.status === "lost" ? "perdida" : d.status,
    value: d.value,
    owner_name: d.owner_name,
    created_at: d.piperun_created_at || d.created_at,
    closed_at: d.closed_at,
    proposals: d.proposals || [],
  }));

  // Use whichever source has more deals (JSONB history is typically more complete)
  const allDealsList = jsonbDeals.length >= tableDeals.length ? jsonbDeals : tableDeals;
  lead.piperun_deals_history = allDealsList;

  // ALWAYS recalculate LTV & total_deals from deal history (never trust stale columns)
  const WON_STATUSES = ["ganha", "won", "Ganha"];
  const wonDeals = allDealsList.filter((d: any) => WON_STATUSES.includes(d.status || ""));
  lead.ltv_total = wonDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
  lead.total_deals = wonDeals.length;

  // 5. Opportunities
  const { data: opportunities } = await supabase
    .from("lead_opportunities")
    .select("opportunity_type, product_name, recommended_action, recommended_message, competitor_product, priority, score, value_est_brl")
    .eq("lead_id", id)
    .eq("status", "aberta")
    .order("score", { ascending: false })
    .limit(20);

  // 6. Support tickets
  const { data: tickets } = await supabase
    .from("technical_tickets")
    .select("id, ticket_full_id, equipment, client_summary, ai_summary, status, created_at, resolved_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // 6b. Activity log (e-commerce, forms, SDR, etc.)
  const { data: activityLog } = await supabase
    .from("lead_activity_log")
    .select("id, event_type, entity_type, entity_id, entity_name, event_data, source_channel, value_numeric, event_timestamp, created_at")
    .eq("lead_id", id)
    .order("event_timestamp", { ascending: false })
    .limit(100);

  // Enrich tickets with message counts
  const enrichedTickets = await Promise.all((tickets || []).map(async (t: any) => {
    const { count } = await supabase
      .from("technical_ticket_messages")
      .select("*", { count: "exact", head: true })
      .eq("ticket_id", t.id);

    const { data: lastMsg } = await supabase
      .from("technical_ticket_messages")
      .select("sender, message, created_at")
      .eq("ticket_id", t.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const openHours = t.status !== "resolved" && t.created_at
      ? Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000)
      : null;
    const resolutionHours = t.resolved_at && t.created_at
      ? Math.round((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000)
      : null;

    return {
      ...t,
      n_messages: count || 0,
      last_message: lastMsg || null,
      messages_preview: lastMsg ? [lastMsg] : [],
      open_hours: openHours,
      resolution_hours: resolutionHours,
    };
  }));

  // Support summary
  const supportSummary = enrichedTickets.length > 0 ? {
    total: enrichedTickets.length,
    open: enrichedTickets.filter((t: any) => t.status !== "resolved").length,
    resolved: enrichedTickets.filter((t: any) => t.status === "resolved").length,
    avg_resolution_hours: (() => {
      const resolved = enrichedTickets.filter((t: any) => t.resolution_hours != null);
      if (resolved.length === 0) return null;
      return Math.round(resolved.reduce((s: number, t: any) => s + t.resolution_hours, 0) / resolved.length);
    })(),
  } : null;

  // 7. Portfolio from individual lead columns (workflow_portfolio JSONB is mostly null)
  const portfolio = transformPortfolioFromLead(lead);
  const portfolio_embed_url = null;

  const response = {
    lead,
    person,
    company,
    opportunities: opportunities || [],
    portfolio,
    portfolio_embed_url,
    support_tickets: enrichedTickets,
    support_summary: supportSummary,
    activity_log: activityLog || [],
  };

  return new Response(JSON.stringify(response), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Subcategory mapping per stage ───
const STAGE_SUBCATEGORIES: Record<string, string[]> = {
  etapa_1_scanner:       ['scanner_intraoral', 'scanner_bancada', 'notebook', 'acessorios', 'pecas_partes'],
  etapa_2_cad:           ['software', 'creditos_ia', 'servico'],
  etapa_3_impressao:     ['resina', 'software_imp', 'impressora', 'acessorios', 'pecas_partes'],
  etapa_4_pos_impressao: ['equipamentos', 'limpeza_acabamento'],
  etapa_5_finalizacao:   ['caracterizacao', 'instalacao', 'dentistica_orto'],
  etapa_6_cursos:        ['presencial', 'online'],
  etapa_7_fresagem:      ['equipamentos', 'software', 'servico', 'acessorios', 'pecas_partes'],
};

// Maps lead columns to portfolio stages & layers
const LEAD_COLUMN_MAP: { stage: string; subcat: string; layer: string; col: string }[] = [
  // Etapa 1: Scanner
  { stage: 'etapa_1_scanner', subcat: 'scanner_intraoral', layer: 'ativo', col: 'equip_scanner' },
  { stage: 'etapa_1_scanner', subcat: 'scanner_intraoral', layer: 'conc', col: 'status_scanner' },
  { stage: 'etapa_1_scanner', subcat: 'scanner_intraoral', layer: 'sdr', col: 'sdr_scanner_interesse' },
  // Etapa 2: CAD
  { stage: 'etapa_2_cad', subcat: 'software', layer: 'ativo', col: 'equip_cad' },
  { stage: 'etapa_2_cad', subcat: 'software', layer: 'conc', col: 'status_cad' },
  { stage: 'etapa_2_cad', subcat: 'software', layer: 'sdr', col: 'sdr_cad_interesse' },
  // Etapa 3: Impressão
  { stage: 'etapa_3_impressao', subcat: 'impressora', layer: 'ativo', col: 'equip_impressora' },
  { stage: 'etapa_3_impressao', subcat: 'impressora', layer: 'conc', col: 'status_impressora' },
  { stage: 'etapa_3_impressao', subcat: 'impressora', layer: 'sdr', col: 'sdr_impressora_interesse' },
  // Etapa 4: Pós-Impressão
  { stage: 'etapa_4_pos_impressao', subcat: 'equipamentos', layer: 'ativo', col: 'equip_pos_impressao' },
  { stage: 'etapa_4_pos_impressao', subcat: 'equipamentos', layer: 'conc', col: 'status_pos_impressao' },
  { stage: 'etapa_4_pos_impressao', subcat: 'equipamentos', layer: 'sdr', col: 'sdr_pos_impressao_interesse' },
  // Etapa 5: Finalização (uses notebook/insumos as proxy)
  { stage: 'etapa_5_finalizacao', subcat: 'caracterizacao', layer: 'ativo', col: 'equip_notebook' },
  // Etapa 6: Cursos
  { stage: 'etapa_6_cursos', subcat: 'presencial', layer: 'ativo', col: 'cs_treinamento' },
  // Etapa 7: Fresagem
  { stage: 'etapa_7_fresagem', subcat: 'equipamentos', layer: 'sdr', col: 'sdr_fresadora_interesse' },
];

function transformPortfolioFromLead(lead: any): any {
  const result: Record<string, any> = {};

  // ── Base: legacy JSONB or individual columns ──
  if (lead.workflow_portfolio && typeof lead.workflow_portfolio === 'object' && Object.keys(lead.workflow_portfolio).length > 1) {
    const fromJsonb = transformPortfolioFromJsonb(lead.workflow_portfolio);
    Object.assign(result, fromJsonb);
  } else {
    // Build from individual columns (unchanged logic)
    for (const [stageKey, subcats] of Object.entries(STAGE_SUBCATEGORIES)) {
      const stageResult: Record<string, any> = {};

      for (const mapping of LEAD_COLUMN_MAP.filter(m => m.stage === stageKey)) {
        const val = lead[mapping.col];
        if (val && typeof val === 'string' && val.trim() !== '' && val !== 'nao' && val !== 'nao_tem') {
          const layerLabel = mapping.layer === 'ativo' ? 'ativo' : mapping.layer === 'conc' ? 'conc' : 'sdr';
          if (!stageResult[mapping.subcat] || stageResult[mapping.subcat].layer === 'vazio') {
            stageResult[mapping.subcat] = { label: val, layer: layerLabel, hits: 1 };
          }
        }
      }

      for (const field of subcats) {
        if (!stageResult[field]) {
          stageResult[field] = { label: '—', layer: 'vazio' };
        }
      }

      result[stageKey] = stageResult;
    }
  }

  // ── Merge portfolio_json — cells from new format have priority over legacy ──
  const pJson = lead.portfolio_json;
  if (pJson && typeof pJson === 'object' && Object.keys(pJson).length > 0) {
    const LAYER_PRIO = ['ativo', 'conc', 'sdr', 'mapeamento'];
    for (const [stageKey, stageData] of Object.entries(pJson as Record<string, any>)) {
      if (!stageData || typeof stageData !== 'object') continue;
      if (!result[stageKey] || typeof result[stageKey] !== 'object') result[stageKey] = {};
      for (const [subcat, subcatData] of Object.entries(stageData as Record<string, any>)) {
        if (!subcatData || typeof subcatData !== 'object') continue;
        for (const layer of LAYER_PRIO) {
          const layerData = (subcatData as Record<string, any>)[layer];
          if (layerData && typeof layerData === 'object') {
            const valor = String(layerData.valor || layerData.status || '').trim();
            if (valor && valor !== 'nao' && valor !== 'nao_tem') {
              result[stageKey][subcat] = { label: valor, layer, hits: 1 };
              break;
            }
          }
        }
      }
    }
  }

  // ── Recount all cells after merge (handles overrides correctly) ──
  let rAtivo = 0, rConc = 0, rSdr = 0, rMap = 0;
  for (const [stageKey, subcats] of Object.entries(STAGE_SUBCATEGORIES)) {
    const stageResult = result[stageKey];
    if (!stageResult) continue;
    for (const subcat of subcats) {
      const cell = stageResult[subcat];
      if (cell?.layer && cell.layer !== 'vazio') {
        if (cell.layer === 'ativo') rAtivo++;
        else if (cell.layer === 'conc') rConc++;
        else if (cell.layer === 'sdr') rSdr++;
        else if (cell.layer === 'mapeamento') rMap++;
      }
    }
  }

  result.summary = { n_ativo: rAtivo, n_conc: rConc, n_sdr: rSdr, n_mapeamento: rMap };
  return result;
}

// Fallback: use the old JSONB-based approach when workflow_portfolio is populated
function transformPortfolioFromJsonb(raw: any): any {
  const result: Record<string, any> = {};
  let nAtivo = 0, nConc = 0, nSdr = 0;

  for (const [stageKey, subcats] of Object.entries(STAGE_SUBCATEGORIES)) {
    const stageData = raw[stageKey];
    const stageResult: Record<string, any> = {};

    if (stageData && typeof stageData === 'object') {
      const ativoItems = Array.isArray(stageData.ativo_smartdent) ? stageData.ativo_smartdent : [];
      const concItems = Array.isArray(stageData.mapeamento_concorrente) ? stageData.mapeamento_concorrente : [];
      const sdrItems = Array.isArray(stageData.sdr_interesse) ? stageData.sdr_interesse : [];

      ativoItems.forEach((item: string, idx: number) => {
        const field = subcats[idx] || subcats[0] || 'default';
        stageResult[field] = { label: item, layer: 'ativo', hits: 1 };
        nAtivo++;
      });
      concItems.forEach((item: string) => {
        const usedFields = Object.keys(stageResult);
        const available = subcats.find(f => !usedFields.includes(f)) || subcats[0] || 'default';
        stageResult[available] = { label: item, layer: 'conc', hits: 1 };
        nConc++;
      });
      sdrItems.forEach((item: string) => {
        const usedFields = Object.keys(stageResult);
        const available = subcats.find(f => !usedFields.includes(f)) || subcats[0] || 'default';
        stageResult[available] = { label: item, layer: 'sdr', hits: 1 };
        nSdr++;
      });
    }

    for (const field of subcats) {
      if (!stageResult[field]) {
        stageResult[field] = { label: '—', layer: 'vazio' };
      }
    }
    result[stageKey] = stageResult;
  }

  result.summary = { n_ativo: nAtivo, n_conc: nConc, n_sdr: nSdr };
  return result;
}
