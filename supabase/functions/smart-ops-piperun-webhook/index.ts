import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeTagsFromStage, mergeTagsCrm, sendViaSellFlux, ALL_STAGNATION_TAGS, JOURNEY_TAGS } from "../_shared/sellflux-field-map.ts";
import {
  PIPELINES,
  STAGE_TO_ETAPA,
  DEAL_STATUS_MAP,
  DEAL_CUSTOM_FIELDS,
  PIPELINE_NAMES,
  PIPERUN_USERS,
  getCustomFieldValue,
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

/**
 * Extract deal/stage/pipeline IDs from webhook payload (handles nested objects)
 */
function extractIds(deal: Record<string, unknown>) {
  const stage = deal.stage as Record<string, unknown> | undefined;
  const pipeline = deal.pipeline as Record<string, unknown> | undefined;
  const owner = deal.owner as Record<string, unknown> | undefined;

  return {
    stageId: Number(stage?.id || deal.stage_id) || undefined,
    stageName: stage?.name ? String(stage.name) : null,
    pipelineId: Number(pipeline?.id || deal.pipeline_id) || undefined,
    pipelineName: pipeline?.name ? String(pipeline.name) : null,
    ownerId: Number(owner?.id || deal.owner_id) || undefined,
    ownerName: owner?.name ? String(owner.name) : null,
    ownerEmail: owner?.email ? String(owner.email) : null,
  };
}

/**
 * Extract custom fields from webhook payload (supports both ID-based and name-based)
 */
function extractWebhookCustomFields(deal: Record<string, unknown>) {
  // Try ID-based extraction first (custom_fields array with custom_field_id)
  const cfArray = deal.custom_fields as Array<{ custom_field_id: number; value?: string | number | null }> | undefined;

  if (cfArray && Array.isArray(cfArray) && cfArray.length > 0 && cfArray[0]?.custom_field_id) {
    return {
      produtoInteresse: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE),
      temScanner: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.TEM_SCANNER),
      temImpressora: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.TEM_IMPRESSORA),
      idCliente: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.BANCO_DADOS_ID),
      especialidade: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.ESPECIALIDADE),
      paisOrigem: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.PAIS_ORIGEM),
    };
  }

  // Fallback: name-based extraction for legacy webhook format
  const extractByName = (fieldName: string): string | null => {
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
  };

  return {
    produtoInteresse: extractByName("produto de interesse"),
    temScanner: extractByName("tem scanner"),
    temImpressora: extractByName("tem impressora"),
    idCliente: extractByName("banco de dados") || extractByName("id banco"),
    especialidade: extractByName("especialidade"),
    paisOrigem: extractByName("pais de origem") || extractByName("país de origem"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");
    const SELLFLUX_API_TOKEN = Deno.env.get("SELLFLUX_API_TOKEN");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();

    console.log("[piperun-webhook] Payload:", JSON.stringify(payload).slice(0, 500));

    const deal = (payload.deal || payload) as Record<string, unknown>;
    const dealId = String(deal.id || payload.deal_id || "");
    const person = deal.person as Record<string, unknown> | undefined;
    const city = person?.city as Record<string, unknown> | undefined;
    const state = person?.state as Record<string, unknown> | undefined;
    const lossReason = deal.loss_reason as Record<string, unknown> | undefined;
    const tags = deal.tags as Array<{ name?: string }> | undefined;

    const { stageId, stageName, pipelineId, pipelineName, ownerId, ownerName, ownerEmail } = extractIds(deal);
    const customFields = extractWebhookCustomFields(deal);

    // Resolve lead_status from stage ID (preferred) or fallback to name
    const resolvedStatus = stageId ? (STAGE_TO_ETAPA[stageId] || "sem_contato") : "sem_contato";

    if (!dealId) {
      return new Response(JSON.stringify({ error: "deal_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current lead
    const { data: currentLead } = await supabase
      .from("lia_attendances")
      .select("id, nome, telefone_normalized, produto_interesse, lead_status, tags_crm")
      .eq("piperun_id", dealId)
      .single();

    let leadId: string;
    let leadNome: string;
    let leadTelefone: string | null;
    let leadProduto: string | null;
    let leadStatus: string;
    let currentTagsCrm: string[] | null;

    if (!currentLead) {
      // AUTO-CREATE
      const personName = person?.name ? String(person.name) : (deal.title ? String(deal.title).split(" - ")[0] : "Lead PipeRun");
      const personEmail = (person?.email ? String(person.email) : null) as string | null;
      const personPhone = person?.phone ? String(person.phone) : (person?.mobile ? String(person.mobile) : null);

      if (!personEmail) {
        console.warn("[piperun-webhook] Deal sem email:", dealId);
        return new Response(JSON.stringify({ error: "Deal sem email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let phoneNormalized: string | null = null;
      if (personPhone) {
        let digits = personPhone.replace(/\D/g, "");
        if (digits.startsWith("0")) digits = digits.slice(1);
        if (!digits.startsWith("55")) digits = "55" + digits;
        if (digits.length >= 12 && digits.length <= 13) phoneNormalized = "+" + digits;
      }

      const { tags: initialTags } = computeTagsFromStage(resolvedStatus, [JOURNEY_TAGS.J01_CONSCIENCIA]);

      const newLeadData: Record<string, unknown> = {
        nome: personName,
        email: personEmail,
        telefone_raw: personPhone,
        telefone_normalized: phoneNormalized,
        piperun_id: dealId,
        piperun_link: `https://app.pipe.run/#/deals/${dealId}`,
        source: "piperun_webhook",
        lead_status: resolvedStatus,
        produto_interesse: customFields.produtoInteresse || null,
        area_atuacao: person?.job_title ? String(person.job_title) : null,
        proprietario_lead_crm: ownerName || (ownerId ? PIPERUN_USERS[ownerId]?.name : null) || null,
        status_atual_lead_crm: stageName || null,
        funil_entrada_crm: pipelineName || (pipelineId ? PIPELINE_NAMES[pipelineId] : null) || null,
        cidade: city?.name ? String(city.name) : null,
        uf: state?.abbr ? String(state.abbr) : (state?.name ? String(state.name) : null),
        tags_crm: initialTags,
      };

      // Deal status (numeric in API: 0=open, 1=won, 2=lost)
      const dealStatus = deal.status;
      if (dealStatus !== undefined) {
        const numStatus = typeof dealStatus === "number" ? dealStatus : (dealStatus === "won" ? 1 : dealStatus === "lost" ? 2 : 0);
        newLeadData.status_oportunidade = DEAL_STATUS_MAP[numStatus] || "aberta";
      }
      if (deal.value != null) newLeadData.valor_oportunidade = Number(deal.value) || null;

      const { data: newLead, error: insertError } = await supabase
        .from("lia_attendances")
        .upsert(newLeadData, { onConflict: "email" })
        .select("id, nome, telefone_normalized, produto_interesse, lead_status, tags_crm")
        .single();

      if (insertError || !newLead) {
        console.error("[piperun-webhook] Erro ao criar lead:", insertError);
        return new Response(JSON.stringify({ error: insertError?.message || "Erro ao criar lead" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[piperun-webhook] Lead CRIADO:", newLead.id, "| deal:", dealId);
      leadId = newLead.id;
      leadNome = newLead.nome;
      leadTelefone = newLead.telefone_normalized;
      leadProduto = newLead.produto_interesse;
      leadStatus = newLead.lead_status;
      currentTagsCrm = newLead.tags_crm;
    } else {
      leadId = currentLead.id;
      leadNome = currentLead.nome;
      leadTelefone = currentLead.telefone_normalized;
      leadProduto = currentLead.produto_interesse;
      leadStatus = currentLead.lead_status;
      currentTagsCrm = currentLead.tags_crm;
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    if (ownerName) updateData.proprietario_lead_crm = ownerName;
    else if (ownerId && PIPERUN_USERS[ownerId]) updateData.proprietario_lead_crm = PIPERUN_USERS[ownerId].name;
    if (stageName) updateData.status_atual_lead_crm = stageName;
    if (pipelineName) updateData.funil_entrada_crm = pipelineName;
    else if (pipelineId && PIPELINE_NAMES[pipelineId]) updateData.funil_entrada_crm = PIPELINE_NAMES[pipelineId];

    // Deal status
    const dealStatus = deal.status;
    if (dealStatus !== undefined) {
      const numStatus = typeof dealStatus === "number" ? dealStatus : (dealStatus === "won" ? 1 : dealStatus === "lost" ? 2 : 0);
      updateData.status_oportunidade = DEAL_STATUS_MAP[numStatus] || "aberta";
    }
    if (deal.value != null) updateData.valor_oportunidade = Number(deal.value) || null;
    if (deal.temperature) updateData.temperatura_lead = String(deal.temperature);
    if (lossReason?.name) updateData.motivo_perda = String(lossReason.name);
    if (lossReason?.comment) updateData.comentario_perda = String(lossReason.comment);
    if (deal.lead_timing != null) updateData.lead_timing_dias = Number(deal.lead_timing) || null;
    if (deal.closed_at) updateData.data_fechamento_crm = String(deal.closed_at);
    if (city?.name) updateData.cidade = String(city.name);
    if (state?.abbr || state?.name) updateData.uf = String(state?.abbr || state?.name);

    // Custom fields from shared mapping
    if (customFields.produtoInteresse) updateData.produto_interesse = customFields.produtoInteresse;
    if (customFields.temScanner) updateData.tem_scanner = customFields.temScanner;
    if (customFields.temImpressora) updateData.tem_impressora = customFields.temImpressora;
    if (customFields.idCliente) updateData.id_cliente_smart = customFields.idCliente;
    if (customFields.especialidade) updateData.especialidade = customFields.especialidade;
    if (customFields.paisOrigem) updateData.pais_origem = customFields.paisOrigem;
    if (person?.job_title) updateData.area_atuacao = String(person.job_title);

    updateData.piperun_link = `https://app.pipe.run/#/deals/${dealId}`;

    // ─── Journey TAG logic ───
    let journeyTagsAdded: string[] = [];
    let newStatus: string | null = null;

    if (stageId) {
      const mappedStatus = STAGE_TO_ETAPA[stageId] || "sem_contato";

      if (isStagnantPipeline(pipelineId) && !isInStagnantStatus(leadStatus) && leadStatus !== "estagnado_final") {
        updateData.ultima_etapa_comercial = leadStatus;
        updateData.lead_status = mappedStatus;
        newStatus = mappedStatus;
        updateData.updated_at = new Date().toISOString();
        console.log("[piperun-webhook] Iniciando funil estagnação:", leadId);
      } else if (!isStagnantPipeline(pipelineId) && (isInStagnantStatus(leadStatus) || leadStatus === "estagnado_final")) {
        updateData.lead_status = mappedStatus;
        newStatus = mappedStatus;
        updateData.updated_at = new Date().toISOString();
        // Recovered from stagnation
        const { tags: recoveredTags } = computeTagsFromStage(mappedStatus, currentTagsCrm);
        const finalTags = mergeTagsCrm(recoveredTags, ["C_RECUPERADO"], ALL_STAGNATION_TAGS);
        updateData.tags_crm = finalTags;
        journeyTagsAdded = ["C_RECUPERADO"];
        console.log("[piperun-webhook] Resgatando lead:", leadId, "→", mappedStatus, "+C_RECUPERADO");
      } else {
        // Normal stage change
        if (mappedStatus !== leadStatus) {
          updateData.lead_status = mappedStatus;
          newStatus = mappedStatus;

          // Fire-and-forget cognitive re-analysis
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cognitive-lead-analysis`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ leadId }),
          }).catch(e => console.warn("[piperun-webhook] cognitive re-analysis error:", e));
        }
        const { tags: updatedTags, add } = computeTagsFromStage(mappedStatus, currentTagsCrm);
        updateData.tags_crm = updatedTags;
        journeyTagsAdded = add;
      }
    }

    // ─── Oportunidade Encerrada (won/lost) → Cross-sell/Upsell ───
    const isWon = deal.status === "won" || deal.status === 1;
    const isLost = deal.status === "lost" || deal.status === 2;
    const produtoEncerrado = (updateData.produto_interesse as string) || leadProduto || null;

    if (isWon || isLost) {
      // Both cases: opportunity is closed → lead re-enters nurturing for the rest of the portfolio
      const closedType = isWon ? "COMPRA" : "NAO_COMPROU";
      const baseTags = (updateData.tags_crm as string[]) || currentTagsCrm || [];

      // Tags to ADD
      const addTags: string[] = [
        `C_OPP_ENCERRADA_${closedType}`,
        "C_REENTRADA_NUTRICAO",
      ];
      if (isWon) {
        addTags.push(JOURNEY_TAGS.J04_COMPRA, "C_CONTRATO_FECHADO", "C_PQL_RECOMPRA");
        if (produtoEncerrado) addTags.push(`COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
      } else {
        // Lost deal ≠ lost lead. They're still a buyer for the rest of the portfolio.
        if (produtoEncerrado) addTags.push(`NAO_COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
      }

      // Tags to REMOVE (clean negotiation-phase tags)
      const removeTags = [JOURNEY_TAGS.J03_NEGOCIACAO, "C_PERDIDO"];

      updateData.tags_crm = mergeTagsCrm(baseTags, addTags, removeTags);

      // Mark the product as acquired (won) or declined (lost) for cross-sell logic
      updateData.status_oportunidade = isWon ? "ganha" : "perdida_renutrir";

      // Fire cross-sell re-entry: cognitive re-analysis with portfolio context
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cognitive-lead-analysis`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leadId, trigger: "opp_closed", closedType, produtoEncerrado }),
      }).catch(e => console.warn("[piperun-webhook] cross-sell cognitive error:", e));

      // Feedback loop: prediction accuracy (only for won deals)
      if (isWon) {
        try {
          const { data: cogLead } = await supabase
            .from("lia_attendances")
            .select("cognitive_analysis, lead_stage_detected")
            .eq("id", leadId)
            .maybeSingle();

          if (cogLead?.cognitive_analysis) {
            const predicted = cogLead.lead_stage_detected;
            const accuracy = predicted === "SQL_decisor" ? 1.0 : predicted === "SAL_comparador" ? 0.6 : predicted === "MQL_pesquisador" ? 0.3 : 0.5;
            await supabase.from("lia_attendances").update({ prediction_accuracy: accuracy }).eq("id", leadId);
            console.log(`[piperun-webhook] prediction_accuracy: ${accuracy} (predicted: ${predicted})`);
          }
        } catch (e) {
          console.warn("[piperun-webhook] prediction_accuracy error:", e);
        }
      }

      console.log(`[piperun-webhook] Opp encerrada (${closedType}): lead=${leadId}, produto=${produtoEncerrado} → reentrada nutrição cross-sell`);
    }

    // PipeRun tags merge
    if (tags && Array.isArray(tags)) {
      const piperunTags = tags.map((t) => t.name).filter(Boolean) as string[];
      if (piperunTags.length > 0) {
        const base = (updateData.tags_crm as string[]) || currentTagsCrm || [];
        updateData.tags_crm = mergeTagsCrm(base, piperunTags);
      }
    }

    // Update lead
    const { error: updateError } = await supabase
      .from("lia_attendances")
      .update(updateData)
      .eq("id", leadId);

    if (updateError) {
      console.error("[piperun-webhook] Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find team member
    let teamMember = null;
    const resolvedOwnerEmail = ownerEmail || (ownerId ? PIPERUN_USERS[ownerId]?.email : null);
    if (resolvedOwnerEmail) {
      const { data } = await supabase
        .from("team_members")
        .select("id, whatsapp_number, nome_completo")
        .eq("email", resolvedOwnerEmail)
        .eq("ativo", true)
        .single();
      teamMember = data;
    }

    // ─── SellFlux welcome (preferred) ───
    let messageStatus = "skipped";
    let errorDetails: string | null = null;

    if (SELLFLUX_API_TOKEN && leadTelefone && !currentLead) {
      const { data: fullLead } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("id", leadId)
        .single();

      if (fullLead) {
        const result = await sendViaSellFlux(SELLFLUX_API_TOKEN, fullLead as Record<string, unknown>, "BOAS_VINDAS_NOVO_LEAD");
        messageStatus = result.success ? "enviado" : "erro";
        if (!result.success) errorDetails = result.response;
      }
    } else if (MANYCHAT_API_KEY && leadTelefone) {
      // ManyChat fallback
      try {
        const mcRes = await fetch("https://api.manychat.com/fb/sending/sendFlow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${MANYCHAT_API_KEY}`,
          },
          body: JSON.stringify({
            subscriber_id: leadTelefone,
            flow_ns: "boas_vindas_lead",
          }),
        });
        const mcData = await mcRes.json();
        messageStatus = mcRes.ok ? "enviado" : "erro";
        if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
      } catch (mcErr) {
        messageStatus = "erro";
        errorDetails = String(mcErr);
      }
    }

    // Log message
    await supabase.from("message_logs").insert({
      lead_id: leadId,
      team_member_id: teamMember?.id || null,
      whatsapp_number: teamMember?.whatsapp_number || null,
      tipo: "boas_vindas",
      mensagem_preview: `Atribuição de ${ownerName || "vendedor"} para ${leadNome}${journeyTagsAdded.length ? ` +TAGs: ${journeyTagsAdded.join(",")}` : ""}`,
      status: messageStatus,
      error_details: errorDetails,
    });

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      message_status: messageStatus,
      tags_added: journeyTagsAdded,
      stagnant_funnel: newStatus?.startsWith("est") ? newStatus : null,
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
