import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeTagsFromStage, mergeTagsCrm, sendViaSellFlux, ALL_STAGNATION_TAGS, JOURNEY_TAGS } from "../_shared/sellflux-field-map.ts";

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
    const SELLFLUX_API_TOKEN = Deno.env.get("SELLFLUX_API_TOKEN");

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

      const mappedStatus = stageName ? mapStageToStatus(stageName) : "novo";
      const { tags: initialTags } = computeTagsFromStage(mappedStatus, [JOURNEY_TAGS.J01_CONSCIENCIA]);

      const newLeadData: Record<string, unknown> = {
        nome: personName,
        email: personEmail,
        telefone_raw: personPhone,
        telefone_normalized: phoneNormalized,
        piperun_id: dealId,
        piperun_link: `https://app.pipe.run/pipeline/gerenciador/visualizar/${dealId}`,
        source: "piperun_webhook",
        lead_status: mappedStatus,
        produto_interesse: extractCustomField(deal, "produto de interesse") || null,
        area_atuacao: person?.job_title ? String(person.job_title) : null,
        proprietario_lead_crm: ownerName || null,
        status_atual_lead_crm: stageName || null,
        funil_entrada_crm: pipeline?.name ? String(pipeline.name) : null,
        cidade: city?.name ? String(city.name) : null,
        uf: state?.abbr ? String(state.abbr) : (state?.name ? String(state.name) : null),
        tags_crm: initialTags,
      };

      if (deal.status) newLeadData.status_oportunidade = STATUS_MAP[String(deal.status)] || String(deal.status);
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
    if (stageName) updateData.status_atual_lead_crm = stageName;
    if (pipeline?.name) updateData.funil_entrada_crm = String(pipeline.name);
    if (deal.status) updateData.status_oportunidade = STATUS_MAP[String(deal.status)] || String(deal.status);
    if (deal.value != null) updateData.valor_oportunidade = Number(deal.value) || null;
    if (deal.temperature) updateData.temperatura_lead = String(deal.temperature);
    if (lossReason?.name) updateData.motivo_perda = String(lossReason.name);
    if (lossReason?.comment) updateData.comentario_perda = String(lossReason.comment);
    if (deal.lead_timing != null) updateData.lead_timing_dias = Number(deal.lead_timing) || null;
    if (deal.closed_at) updateData.data_fechamento_crm = String(deal.closed_at);
    if (city?.name) updateData.cidade = String(city.name);
    if (state?.abbr || state?.name) updateData.uf = String(state?.abbr || state?.name);

    const produtoInteresse = extractCustomField(deal, "produto de interesse");
    if (produtoInteresse) updateData.produto_interesse = produtoInteresse;
    const temScanner = extractCustomField(deal, "tem scanner");
    if (temScanner) updateData.tem_scanner = temScanner;
    const itensProposta = extractCustomField(deal, "itens da proposta") || extractCustomField(deal, "itens proposta");
    if (itensProposta) updateData.itens_proposta_crm = itensProposta;
    const idCliente = extractCustomField(deal, "banco de dados") || extractCustomField(deal, "id banco");
    if (idCliente) updateData.id_cliente_smart = idCliente;
    if (person?.job_title) updateData.area_atuacao = String(person.job_title);

    updateData.piperun_link = `https://app.pipe.run/pipeline/gerenciador/visualizar/${dealId}`;

    // ─── Journey TAG logic ───
    let journeyTagsAdded: string[] = [];
    let newStatus: string | null = null;

    if (stageName) {
      if (isStagnant(stageName) && !isInStagnantFunnel(leadStatus) && leadStatus !== "estagnado_final") {
        updateData.ultima_etapa_comercial = leadStatus;
        updateData.lead_status = "est1_0";
        newStatus = "est1_0";
        updateData.updated_at = new Date().toISOString();
        console.log("[piperun-webhook] Iniciando funil estagnação:", leadId);
      } else if (!isStagnant(stageName) && (isInStagnantFunnel(leadStatus) || leadStatus === "estagnado_final")) {
        const mapped = mapStageToStatus(stageName);
        updateData.lead_status = mapped;
        newStatus = mapped;
        updateData.updated_at = new Date().toISOString();
        // Recovered from stagnation — add C_RECUPERADO, remove stagnation tags
        const { tags: recoveredTags } = computeTagsFromStage(mapped, currentTagsCrm);
        const finalTags = mergeTagsCrm(recoveredTags, ["C_RECUPERADO"], ALL_STAGNATION_TAGS);
        updateData.tags_crm = finalTags;
        journeyTagsAdded = ["C_RECUPERADO"];
        console.log("[piperun-webhook] Resgatando lead:", leadId, "→", mapped, "+C_RECUPERADO");
      } else {
        // Normal stage change — compute journey tags
        const mapped = mapStageToStatus(stageName);
        if (mapped !== leadStatus) {
          updateData.lead_status = mapped;
          newStatus = mapped;

          // Fire-and-forget cognitive re-analysis on stage change
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cognitive-lead-analysis`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ leadId: leadId }),
          }).catch(e => console.warn("[piperun-webhook] cognitive re-analysis error:", e));
        }
        const { tags: updatedTags, add } = computeTagsFromStage(mapped, currentTagsCrm);
        updateData.tags_crm = updatedTags;
        journeyTagsAdded = add;
      }
    }

    // Deal won/lost special tags
    if (deal.status === "won") {
      const wonTags = mergeTagsCrm(
        (updateData.tags_crm as string[]) || currentTagsCrm,
        [JOURNEY_TAGS.J04_COMPRA, "C_CONTRATO_FECHADO"],
        [JOURNEY_TAGS.J03_NEGOCIACAO]
      );
      updateData.tags_crm = wonTags;

      // Feedback loop: calculate prediction_accuracy
      try {
        const { data: cogLead } = await supabase
          .from("lia_attendances")
          .select("cognitive_analysis, lead_stage_detected")
          .eq("id", leadId)
          .maybeSingle();

        if (cogLead?.cognitive_analysis) {
          const predicted = cogLead.lead_stage_detected;
          // SQL_decisor predicting a won deal = accurate
          const accuracy = predicted === "SQL_decisor" ? 1.0 : predicted === "SAL_comparador" ? 0.6 : predicted === "MQL_pesquisador" ? 0.3 : 0.5;
          await supabase.from("lia_attendances").update({ prediction_accuracy: accuracy }).eq("id", leadId);
          console.log(`[piperun-webhook] prediction_accuracy: ${accuracy} (predicted: ${predicted})`);
        }
      } catch (e) {
        console.warn("[piperun-webhook] prediction_accuracy error:", e);
      }
    } else if (deal.status === "lost") {
      const lostTags = mergeTagsCrm(
        (updateData.tags_crm as string[]) || currentTagsCrm,
        ["C_PERDIDO"]
      );
      updateData.tags_crm = lostTags;
    }

    // PipeRun tags merge (keep both PipeRun tags and our standardized tags)
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
    if (ownerEmail) {
      const { data } = await supabase
        .from("team_members")
        .select("id, whatsapp_number, nome_completo")
        .eq("email", String(ownerEmail))
        .eq("ativo", true)
        .single();
      teamMember = data;
    }

    // ─── SellFlux welcome (preferred) ───
    let messageStatus = "skipped";
    let errorDetails: string | null = null;

    if (SELLFLUX_API_TOKEN && leadTelefone && !currentLead) {
      // New lead — send welcome via SellFlux
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
      // ─── ManyChat fallback ───
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
