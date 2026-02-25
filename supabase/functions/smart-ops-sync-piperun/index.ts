import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SALES_STAGE_MAP: Record<string, string> = {
  "sem contato": "sem_contato",
  "contato feito": "contato_feito",
  "em contato": "em_contato",
  "apresentação": "apresentacao",
  "apresentacao": "apresentacao",
  "apresentação/visita": "apresentacao",
  "visita": "apresentacao",
  "proposta enviada": "proposta_enviada",
  "negociação": "negociacao",
  "negociacao": "negociacao",
  "fechamento": "fechamento",
};

const STAGNANT_STAGE_MAP: Record<string, string> = {
  "etapa 01": "est_etapa1",
  "etapa 02": "est_etapa2",
  "etapa 03": "est_etapa3",
  "etapa 04": "est_etapa4",
  "proposta enviada": "est_proposta",
  "apresentação": "est_apresentacao",
  "apresentacao": "est_apresentacao",
  "apresentação/visita": "est_apresentacao",
};

const CS_STAGE_MAP: Record<string, string> = {
  "em espera": "cs_em_espera",
  "sem data": "cs_agendar",
  "agendar": "cs_agendar",
};

const STATUS_MAP: Record<string, string> = {
  open: "aberta",
  won: "ganha",
  lost: "perdida",
};

function mapStageToStatus(stageName: string, pipelineName: string | null): string {
  const normalized = stageName.toLowerCase().trim();
  const funnel = (pipelineName || "").toLowerCase();

  // Stagnant funnel
  if (funnel.includes("estagnado") || funnel.includes("stagnado")) {
    for (const [key, value] of Object.entries(STAGNANT_STAGE_MAP)) {
      if (normalized.includes(key)) return value;
    }
    return "est_etapa1";
  }

  // CS Onboarding funnel
  if (funnel.includes("cs") || funnel.includes("onboarding")) {
    for (const [key, value] of Object.entries(CS_STAGE_MAP)) {
      if (normalized.includes(key)) return value;
    }
    return "cs_em_espera";
  }

  // E-book funnel
  if (funnel.includes("e-book") || funnel.includes("ebook")) {
    return "ebook";
  }

  // Sales funnel (default)
  for (const [key, value] of Object.entries(SALES_STAGE_MAP)) {
    if (normalized.includes(key)) return value;
  }
  return "sem_contato";
}

function isStagnantFunnel(pipelineName: string | null): boolean {
  if (!pipelineName) return false;
  const lower = pipelineName.toLowerCase();
  return lower.includes("estagnado") || lower.includes("stagnado") || lower.includes("reativação") || lower.includes("reativacao");
}

function isStagnant(stageName: string): boolean {
  return stageName.toLowerCase().includes("estagnado") || stageName.toLowerCase().includes("reativação") || stageName.toLowerCase().includes("reativacao");
}

function isInStagnantFunnel(leadStatus: string): boolean {
  return leadStatus.startsWith("est_") || leadStatus === "estagnado_final";
}

function extractCustomField(deal: Record<string, unknown>, fieldName: string): string | null {
  // PipeRun stores custom fields on Person (camelCase: customFields), not on deal
  const person = deal.person as Record<string, unknown> | undefined;
  const customs = (
    person?.customFields || deal.customFields || deal.custom_fields || []
  ) as Array<{ name?: string; label?: string; value?: unknown; raw_value?: unknown }>;
  if (Array.isArray(customs)) {
    const field = customs.find((f) => {
      const name = (f.name || f.label || "").toLowerCase();
      return name.includes(fieldName.toLowerCase());
    });
    if (field) {
      const val = field.value ?? field.raw_value;
      if (val != null) return String(val);
    }
  }
  return null;
}

function buildUpdatePayload(deal: Record<string, unknown>): Record<string, unknown> {
  const owner = deal.owner as Record<string, unknown> | undefined;
  const stage = deal.stage as Record<string, unknown> | undefined;
  const pipeline = deal.pipeline as Record<string, unknown> | undefined;
  const person = deal.person as Record<string, unknown> | undefined;
  const city = person?.city as Record<string, unknown> | undefined;
  const state = person?.state as Record<string, unknown> | undefined;
  const lossReason = deal.loss_reason as Record<string, unknown> | undefined;
  const tags = deal.tags as Array<{ name?: string }> | undefined;

  const payload: Record<string, unknown> = {};

  // Existing fields
  if (owner?.name) payload.proprietario_lead_crm = owner.name;
  if (stage?.name) payload.status_atual_lead_crm = stage.name;
  if (pipeline?.name) payload.funil_entrada_crm = pipeline.name;

  // New CRM fields
  if (deal.status) payload.status_oportunidade = STATUS_MAP[String(deal.status)] || String(deal.status);
  if (deal.value != null) payload.valor_oportunidade = Number(deal.value) || null;
  if (tags && Array.isArray(tags)) payload.tags_crm = tags.map((t) => t.name).filter(Boolean);
  if (deal.temperature) payload.temperatura_lead = String(deal.temperature);
  if (lossReason?.name) payload.motivo_perda = String(lossReason.name);
  if (lossReason?.comment) payload.comentario_perda = String(lossReason.comment);
  if (deal.lead_timing != null) payload.lead_timing_dias = Number(deal.lead_timing) || null;
  if (deal.closed_at) payload.data_fechamento_crm = String(deal.closed_at);

  // Person fields
  if (person?.name) payload.nome = String(person.name);
  if (person?.email) payload.email = String(person.email);
  if (person?.phone) payload.telefone_raw = String(person.phone);
  if (city?.name) payload.cidade = String(city.name);
  if (state?.abbr || state?.name) payload.uf = String(state?.abbr || state?.name);

  // job_title on person = area de atuação
  if (person?.job_title) payload.area_atuacao = String(person.job_title);

  // Link
  payload.piperun_link = `https://app.pipe.run/pipeline/gerenciador/visualizar/${deal.id}`;

  // Custom fields
  const produtoInteresse = extractCustomField(deal, "produto de interesse");
  if (produtoInteresse) payload.produto_interesse = produtoInteresse;

  const especialidade = extractCustomField(deal, "especialidade");
  if (especialidade) payload.especialidade = especialidade;

  const temImpressora = extractCustomField(deal, "tem impressora");
  if (temImpressora) payload.tem_impressora = temImpressora;

  const temScanner = extractCustomField(deal, "tem scanner");
  if (temScanner) payload.tem_scanner = temScanner;

  const areaAtuacao = extractCustomField(deal, "área de atuação") || extractCustomField(deal, "area de atuacao");
  if (areaAtuacao) payload.area_atuacao = areaAtuacao;

  const idCliente = extractCustomField(deal, "banco de dados") || extractCustomField(deal, "id banco");
  if (idCliente) payload.id_cliente_smart = idCliente;

  const itensProposta = extractCustomField(deal, "itens da proposta") || extractCustomField(deal, "itens proposta");
  if (itensProposta) payload.itens_proposta_crm = itensProposta;

  return payload;
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

    // Check if full sync requested or incremental
    const url = new URL(req.url);
    const fullSync = url.searchParams.get("full") === "true";

    const since = fullSync ? null : new Date(Date.now() - 35 * 60 * 1000).toISOString();

    let allDeals: Record<string, unknown>[] = [];
    let page = 1;
    const maxPages = fullSync ? 50 : 3; // limit pages for safety

    while (page <= maxPages) {
      const params = new URLSearchParams({ token: PIPERUN_API_KEY, show: "100", page: String(page) });
      if (since) params.set("updated_since", since);

      const piperunRes = await fetch(
        `https://api.pipe.run/v1/deals?${params.toString()}`
      );

      if (!piperunRes.ok) {
        const errText = await piperunRes.text();
        console.error("[sync-piperun] API error:", piperunRes.status, errText.slice(0, 300));
        if (page === 1) {
          return new Response(JSON.stringify({ error: `Piperun API ${piperunRes.status}` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      const piperunData = await piperunRes.json();
      const deals = piperunData?.data || [];
      if (deals.length === 0) break;

      allDeals = allDeals.concat(deals);

      // Check if there are more pages
      const meta = piperunData?.meta;
      if (meta && meta.current_page >= meta.last_page) break;

      page++;
    }

    let updated = 0;
    let created = 0;
    let stagnantStarted = 0;
    let stagnantRescued = 0;

    for (const deal of allDeals) {
      const dealId = String(deal.id);
      const stageName = (deal.stage as Record<string, unknown>)?.name as string || null;
      const pipelineName = (deal.pipeline as Record<string, unknown>)?.name as string || null;

      const updatePayload = buildUpdatePayload(deal);
      if (Object.keys(updatePayload).length === 0) continue;

      // Always set lead_status from the current Piperun stage+funnel
      if (stageName) {
        const mappedStatus = mapStageToStatus(stageName, pipelineName);
        updatePayload.lead_status = mappedStatus;
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
        if (stageName) {
          const newIsStagnant = isStagnantFunnel(pipelineName) || isStagnant(stageName);
          const wasStagnant = isInStagnantFunnel(currentLead.lead_status);
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
        // Lead doesn't exist by piperun_id — try to find by email or create
        const person = deal.person as Record<string, unknown> | undefined;
        const email = person?.email ? String(person.email).trim().toLowerCase() : null;
        const nome = person?.name ? String(person.name) : null;

        if (email && nome) {
          const { data: existingByEmail } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existingByEmail) {
            // Link existing lead to piperun_id
            await supabase
              .from("lia_attendances")
              .update({ ...updatePayload, piperun_id: dealId })
              .eq("id", existingByEmail.id);
            updated++;
          } else {
            // Create new lead
            const insertPayload = {
              ...updatePayload,
              piperun_id: dealId,
              nome,
              email,
              source: "piperun_sync",
              lead_status: stageName ? mapStageToStatus(stageName, pipelineName) : "sem_contato",
            };

            const { error } = await supabase.from("lia_attendances").insert(insertPayload);
            if (!error) created++;
          }
        }
      }
    }

    console.log(`[sync-piperun] Total deals: ${allDeals.length}, updated: ${updated}, created: ${created}, estagnados: ${stagnantStarted}, resgatados: ${stagnantRescued}`);
    return new Response(JSON.stringify({
      success: true,
      synced: updated,
      created,
      total_deals: allDeals.length,
      pages_fetched: page,
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
