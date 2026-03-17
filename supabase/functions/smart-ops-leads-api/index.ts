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

  // Attach deals to lead for timeline
  lead.piperun_deals_history = (deals || []).map((d: any) => ({
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

  // Compute LTV & total_deals from deals
  const wonDeals = (deals || []).filter((d: any) => d.status === "won" || d.status === "ganha");
  if (!lead.ltv_total) {
    lead.ltv_total = wonDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
  }
  if (!lead.total_deals) {
    lead.total_deals = wonDeals.length;
  }

  // 5. Opportunities
  const { data: opportunities } = await supabase
    .from("lead_opportunities")
    .select("opportunity_type, product_name, recommended_action, recommended_message, competitor_product, priority, score, value_est_brl")
    .eq("lead_id", id)
    .eq("status", "open")
    .order("score", { ascending: false })
    .limit(20);

  // 6. Support tickets
  const { data: tickets } = await supabase
    .from("technical_tickets")
    .select("id, ticket_full_id, equipment, client_summary, ai_summary, status, created_at, resolved_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

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

  // 7. Portfolio from workflow_portfolio
  const portfolio = transformPortfolio(lead.workflow_portfolio);
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
  };

  return new Response(JSON.stringify(response), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Subcategory mapping per stage ───
// Maps DB stage keys to the subcategory fields expected by WorkflowPortfolio component
const STAGE_SUBCATEGORIES: Record<string, string[]> = {
  etapa_1_scanner:       ['scanner_intraoral', 'scanner_bancada', 'notebook', 'acessorios', 'pecas_partes'],
  etapa_2_cad:           ['software', 'creditos_ia', 'servico'],
  etapa_3_impressao:     ['resina', 'software_imp', 'impressora', 'acessorios', 'pecas_partes'],
  etapa_4_pos_impressao: ['equipamentos', 'limpeza_acabamento'],
  etapa_5_finalizacao:   ['caracterizacao', 'instalacao', 'dentistica_orto'],
  etapa_6_cursos:        ['presencial', 'online'],
  etapa_7_fresagem:      ['equipamentos', 'software', 'servico', 'acessorios', 'pecas_partes'],
};

function transformPortfolio(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;

  // Check if any stage has actual data (not all sem_sinal)
  const stageKeys = Object.keys(raw).filter(k => k.startsWith('etapa_'));
  if (stageKeys.length === 0) return null;

  const result: Record<string, any> = {};
  let nAtivo = 0, nConc = 0, nSdr = 0;

  for (const stageKey of stageKeys) {
    const stageData = raw[stageKey];
    if (!stageData || typeof stageData !== 'object') continue;

    const subcats = STAGE_SUBCATEGORIES[stageKey] || [];
    const stageResult: Record<string, any> = {};

    // Determine which layer this stage has and assign to first relevant subcategory
    const ativoItems = Array.isArray(stageData.ativo_smartdent) ? stageData.ativo_smartdent : [];
    const concItems = Array.isArray(stageData.mapeamento_concorrente) ? stageData.mapeamento_concorrente : [];
    const sdrItems = Array.isArray(stageData.sdr_interesse) ? stageData.sdr_interesse : [];

    // Assign ativo items to subcategories
    ativoItems.forEach((item: string, idx: number) => {
      const field = subcats[idx] || subcats[0] || 'default';
      stageResult[field] = { label: item, layer: 'ativo', hits: 1 };
      nAtivo++;
    });

    // Assign concorrente items to next available subcategories
    concItems.forEach((item: string, idx: number) => {
      const usedFields = Object.keys(stageResult);
      const available = subcats.find(f => !usedFields.includes(f)) || subcats[0] || 'default';
      stageResult[available] = { label: item, layer: 'conc', hits: 1 };
      nConc++;
    });

    // Assign SDR interest items
    sdrItems.forEach((item: string, idx: number) => {
      const usedFields = Object.keys(stageResult);
      const available = subcats.find(f => !usedFields.includes(f)) || subcats[0] || 'default';
      stageResult[available] = { label: item, layer: 'sdr', hits: 1 };
      nSdr++;
    });

    // Fill remaining subcategories with empty
    for (const field of subcats) {
      if (!stageResult[field]) {
        stageResult[field] = { label: '—', layer: 'vazio' };
      }
    }

    result[stageKey] = stageResult;
  }

  // If everything is empty, return null
  if (nAtivo === 0 && nConc === 0 && nSdr === 0) return null;

  result.summary = { n_ativo: nAtivo, n_conc: nConc, n_sdr: nSdr };
  return result;
}
