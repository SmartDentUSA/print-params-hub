import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_TO_STATUS: Record<string, string> = {
  "sem contato": "sem_contato",
  "contato feito": "contato_feito",
  "em contato": "em_contato",
  "apresentação": "apresentacao",
  "apresentacao": "apresentacao",
  "visita": "apresentacao",
  "proposta enviada": "proposta_enviada",
  "negociação": "negociacao",
  "negociacao": "negociacao",
  "fechamento": "fechamento",
  "etapa 01": "est1_0",
  "etapa 02": "est2_0",
  "etapa 03": "est3_0",
};

const STATUS_MAP: Record<string, string> = {
  open: "aberta",
  won: "ganha",
  lost: "perdida",
};

function mapStageToStatus(stageName: string): string {
  const normalized = stageName.toLowerCase().trim();
  for (const [key, value] of Object.entries(STAGE_TO_STATUS)) {
    if (normalized.includes(key)) return value;
  }
  return "sem_contato";
}

function isStagnant(stageName: string): boolean {
  return stageName.toLowerCase().includes("estagnado") || stageName.toLowerCase().includes("reativação") || stageName.toLowerCase().includes("reativacao");
}

function isInStagnantFunnel(leadStatus: string): boolean {
  return leadStatus.startsWith("est") && leadStatus !== "estagnado_final";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();

    console.log("[piperun-webhook] Payload:", JSON.stringify(payload).slice(0, 500));

    const deal = (payload.deal || payload) as Record<string, unknown>;
    const dealId = String(deal.id || payload.deal_id || "");
    const owner = deal.owner as Record<string, unknown> | undefined;
    const stage = deal.stage as Record<string, unknown> | undefined;
    const pipeline = deal.pipeline as Record<string, unknown> | undefined;
    const person = deal.person as Record<string, unknown> | undefined;
    const city = person?.city as Record<string, unknown> | undefined;
    const state = person?.state as Record<string, unknown> | undefined;
    const lossReason = deal.loss_reason as Record<string, unknown> | undefined;
    const tags = deal.tags as Array<{ name?: string }> | undefined;

    const ownerName = owner?.name ? String(owner.name) : (payload.owner_name || null);
    const ownerEmail = owner?.email ? String(owner.email) : (payload.owner_email || null);
    const stageName = stage?.name ? String(stage.name) : (payload.stage_name || null);

    if (!dealId) {
      return new Response(JSON.stringify({ error: "deal_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current lead
    const { data: currentLead } = await supabase
      .from("lia_attendances")
      .select("id, nome, telefone_normalized, produto_interesse, lead_status")
      .eq("piperun_id", dealId)
      .single();

    if (!currentLead) {
      console.warn("[piperun-webhook] Lead não encontrado para deal:", dealId);
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build expanded update payload
    const updateData: Record<string, unknown> = {};
    if (ownerName) updateData.proprietario_lead_crm = ownerName;
    if (stageName) updateData.status_atual_lead_crm = stageName;
    if (pipeline?.name) updateData.funil_entrada_crm = String(pipeline.name);

    // New CRM fields
    if (deal.status) updateData.status_oportunidade = STATUS_MAP[String(deal.status)] || String(deal.status);
    if (deal.value != null) updateData.valor_oportunidade = Number(deal.value) || null;
    if (tags && Array.isArray(tags)) updateData.tags_crm = tags.map((t) => t.name).filter(Boolean);
    if (deal.temperature) updateData.temperatura_lead = String(deal.temperature);
    if (lossReason?.name) updateData.motivo_perda = String(lossReason.name);
    if (lossReason?.comment) updateData.comentario_perda = String(lossReason.comment);
    if (deal.lead_timing != null) updateData.lead_timing_dias = Number(deal.lead_timing) || null;
    if (deal.closed_at) updateData.data_fechamento_crm = String(deal.closed_at);

    // Person fields
    if (city?.name) updateData.cidade = String(city.name);
    if (state?.abbr || state?.name) updateData.uf = String(state?.abbr || state?.name);

    // Custom fields (now correctly searching person.customFields)
    const produtoInteresse = extractCustomField(deal, "produto de interesse");
    if (produtoInteresse) updateData.produto_interesse = produtoInteresse;
    const temScanner = extractCustomField(deal, "tem scanner");
    if (temScanner) updateData.tem_scanner = temScanner;
    const itensProposta = extractCustomField(deal, "itens da proposta") || extractCustomField(deal, "itens proposta");
    if (itensProposta) updateData.itens_proposta_crm = itensProposta;
    const idCliente = extractCustomField(deal, "banco de dados") || extractCustomField(deal, "id banco");
    if (idCliente) updateData.id_cliente_smart = idCliente;

    // job_title on person = area de atuação
    if (person?.job_title) updateData.area_atuacao = String(person.job_title);

    updateData.piperun_link = `https://app.pipe.run/pipeline/gerenciador/visualizar/${dealId}`;

    // Stagnation funnel logic
    if (stageName) {
      if (isStagnant(stageName) && !isInStagnantFunnel(currentLead.lead_status) && currentLead.lead_status !== "estagnado_final") {
        // Save current commercial stage before entering stagnation
        updateData.ultima_etapa_comercial = currentLead.lead_status;
        updateData.lead_status = "est1_0";
        updateData.updated_at = new Date().toISOString();
        console.log("[piperun-webhook] Iniciando funil estagnação para lead:", currentLead.id, "| Etapa anterior:", currentLead.lead_status);
      } else if (!isStagnant(stageName) && (isInStagnantFunnel(currentLead.lead_status) || currentLead.lead_status === "estagnado_final")) {
        updateData.lead_status = mapStageToStatus(stageName);
        updateData.updated_at = new Date().toISOString();
        console.log("[piperun-webhook] Resgatando lead do funil estagnação:", currentLead.id, "→", updateData.lead_status);
      }
    }

    // Update lead
    const { error: updateError } = await supabase
      .from("lia_attendances")
      .update(updateData)
      .eq("id", currentLead.id);

    if (updateError) {
      console.error("[piperun-webhook] Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find team member by owner email
    let teamMember = null;
    if (ownerEmail) {
      const { data } = await supabase
        .from("team_members")
        .select("id, whatsapp_number, nome_completo")
        .eq("email", String(ownerEmail))
        .eq("ativo", true)
        .single();
      teamMember = data;
    }

    // Send ManyChat message if we have the subscriber phone
    let messageStatus = "skipped";
    let errorDetails: string | null = null;

    if (MANYCHAT_API_KEY && currentLead.telefone_normalized) {
      try {
        const mcRes = await fetch("https://api.manychat.com/fb/sending/sendFlow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${MANYCHAT_API_KEY}`,
          },
          body: JSON.stringify({
            subscriber_id: currentLead.telefone_normalized,
            flow_ns: "boas_vindas_lead",
          }),
        });
        const mcData = await mcRes.json();
        messageStatus = mcRes.ok ? "enviado" : "erro";
        if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
        console.log("[piperun-webhook] ManyChat response:", messageStatus);
      } catch (mcErr) {
        messageStatus = "erro";
        errorDetails = String(mcErr);
        console.error("[piperun-webhook] ManyChat error:", mcErr);
      }
    }

    // Log message
    await supabase.from("message_logs").insert({
      lead_id: currentLead.id,
      team_member_id: teamMember?.id || null,
      whatsapp_number: teamMember?.whatsapp_number || null,
      tipo: "boas_vindas",
      mensagem_preview: `Atribuição de ${ownerName || "vendedor"} para ${currentLead.nome}`,
      status: messageStatus,
      error_details: errorDetails,
    });

    return new Response(JSON.stringify({
      success: true,
      lead_id: currentLead.id,
      message_status: messageStatus,
      stagnant_funnel: updateData.lead_status?.toString().startsWith("est") ? updateData.lead_status : null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[piperun-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
