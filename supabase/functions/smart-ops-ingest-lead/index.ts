import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendLeadToSellFlux, sendCampaignViaSellFlux } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = "55" + digits;
  if (digits.length < 12 || digits.length > 13) return null;
  return "+" + digits;
}

function extractField(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(payload)) {
      if (k.toLowerCase().includes(key.toLowerCase()) && v) {
        return String(v).trim();
      }
    }
  }
  return null;
}

function detectProductFromFormName(formName: string | null): string | null {
  if (!formName) return null;
  const upper = formName.toUpperCase();
  if (upper.includes("VITALITY")) return "Vitality";
  if (upper.includes("EDGEMINI") || upper.includes("EDGE MINI")) return "EdgeMini";
  if (upper.includes("IOCONNECT") || upper.includes("IO CONNECT")) return "IoConnect";
  if (upper.includes("EBOOK") || upper.includes("PLACA")) return "Ebook/Placa";
  return null;
}

/** Smart Merge: only fill null fields, never overwrite existing data */
function smartMerge(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  protectedFields: string[]
): { merged: Record<string, unknown>; fieldsUpdated: string[] } {
  const merged: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];

  for (const [key, newValue] of Object.entries(incoming)) {
    if (newValue === null || newValue === undefined) continue;

    const existingValue = existing[key];
    const isProtected = protectedFields.includes(key);

    // Protected fields: NEVER overwrite if they have a value
    if (isProtected && existingValue !== null && existingValue !== undefined && existingValue !== "") {
      continue;
    }

    // Non-protected: only fill if currently null/empty
    if (existingValue === null || existingValue === undefined || existingValue === "") {
      merged[key] = newValue;
      fieldsUpdated.push(key);
    }
  }

  // UTMs always update (latest campaign wins)
  for (const utmKey of ["utm_source", "utm_medium", "utm_campaign", "utm_term"]) {
    if (incoming[utmKey]) {
      merged[utmKey] = incoming[utmKey];
      if (!fieldsUpdated.includes(utmKey)) fieldsUpdated.push(utmKey);
    }
  }

  return { merged, fieldsUpdated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();

    console.log("[ingest-lead] Payload recebido:", JSON.stringify(payload).slice(0, 500));

    // --- Fix: declare source from payload ---
    const source = payload.source || payload.utm_source || "formulario";
    const formName = payload.form_name || payload.formName || payload.form || null;

    // --- Extract fields with EXPLICIT keys (avoid form_name collision) ---
    const nome = payload.nome || payload.full_name || payload.name || payload.user_name ||
      [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim() || "Sem nome";

    const emailRaw = extractField(payload, "email", "user_email") || "";
    const email = emailRaw.toLowerCase().trim();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter test emails to prevent polluting the database
    const TEST_DOMAINS = ["@test.com", "@example.com", "@test.com.br", "@teste.com"];
    const isTestEmail = TEST_DOMAINS.some(d => email.toLowerCase().endsWith(d)) || /^teste?[\-_@]/i.test(email);
    if (isTestEmail) {
      console.log("[ingest-lead] Test email filtered:", email);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "test_email" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefoneRaw = extractField(payload, "phone_number", "phone", "mobile", "telefone", "celular", "user_phone");
    const telefoneNormalized = normalizePhone(telefoneRaw);

    const areaAtuacao = extractField(payload, "area de atuacao", "area_atuacao", "specialty");
    const especialidade = extractField(payload, "especialidade", "specialty");
    const comoDigitaliza = extractField(payload, "como digitaliza", "como_digitaliza", "moldagens");
    const temImpressora = extractField(payload, "impressoes 3d", "tem_impressora", "utiliza impressoes");
    const impressoraModelo = extractField(payload, "impressora_modelo", "modelo impressora", "printer_model");
    const resinaInteresse = extractField(payload, "resina_interesse", "resina", "resin");
    const produtoInteresse = detectProductFromFormName(formName) || extractField(payload, "produto_interesse", "product");

    // --- Step 1: Check if lead already exists ---
    const { data: existingLead } = await supabase
      .from("lia_attendances")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    // --- Step 2: Detect PQL (existing customer re-entering) ---
    let detectedStage: string | null = null;
    const isSellerDirect = source === "vendedor_direto";

    if (!isSellerDirect && existingLead?.status_oportunidade === "ganha") {
      detectedStage = "PQL_recompra";
      console.log("[ingest-lead] PQL detected: existing customer re-entering via", source);
    }

    // --- Step 3: Build incoming data ---
    const incomingData: Record<string, unknown> = {
      nome, email, telefone_raw: telefoneRaw, telefone_normalized: telefoneNormalized,
      area_atuacao: areaAtuacao, especialidade, como_digitaliza: comoDigitaliza,
      tem_impressora: temImpressora, impressora_modelo: impressoraModelo,
      resina_interesse: resinaInteresse, produto_interesse: produtoInteresse,
      source, form_name: formName,
      origem_campanha: payload.campaign || payload.origem_campanha || null,
      utm_source: payload.utm_source || null, utm_medium: payload.utm_medium || null,
      utm_campaign: payload.utm_campaign || null, utm_term: payload.utm_term || null,
      ip_origem: payload.ip || req.headers.get("x-forwarded-for") || null,
      // Empresa extras
      empresa_nome: payload.empresa_nome || null,
      empresa_cnpj: payload.empresa_cnpj || null,
      empresa_razao_social: payload.empresa_razao_social || null,
      empresa_segmento: payload.empresa_segmento || null,
      empresa_website: payload.empresa_website || null,
      empresa_ie: payload.empresa_ie || null,
      empresa_porte: payload.empresa_porte || null,
      // Pessoa extras
      pessoa_cargo: payload.pessoa_cargo || null,
      pessoa_cpf: payload.pessoa_cpf || null,
      pessoa_genero: payload.pessoa_genero || null,
      pessoa_nascimento: payload.pessoa_nascimento || null,
      pessoa_linkedin: payload.pessoa_linkedin || null,
      pessoa_facebook: payload.pessoa_facebook || null,
      // Equipamentos extras
      software_cad: payload.software_cad || null,
      tem_scanner: payload.tem_scanner || null,
      volume_mensal_pecas: payload.volume_mensal_pecas || null,
      principal_aplicacao: payload.principal_aplicacao || null,
      // Comercial
      cidade: payload.cidade || null,
      uf: payload.uf || null,
      pais_origem: payload.pais_origem || null,
      informacao_desejada: payload.informacao_desejada || null,
      codigo_contrato: payload.codigo_contrato || null,
      temperatura_lead: payload.temperatura_lead || null,
      // SDR fields
      sdr_scanner_interesse: payload.sdr_scanner_interesse || null,
      sdr_impressora_interesse: payload.sdr_impressora_interesse || null,
      sdr_software_cad_interesse: payload.sdr_software_cad_interesse || null,
      sdr_cursos_interesse: payload.sdr_cursos_interesse || null,
      sdr_insumos_lab_interesse: payload.sdr_insumos_lab_interesse || null,
      sdr_pos_impressao_interesse: payload.sdr_pos_impressao_interesse || null,
      sdr_solucoes_interesse: payload.sdr_solucoes_interesse || null,
      sdr_dentistica_interesse: payload.sdr_dentistica_interesse || null,
      sdr_caracterizacao_interesse: payload.sdr_caracterizacao_interesse || null,
      sdr_marca_impressora_param: payload.sdr_marca_impressora_param || null,
      sdr_modelo_impressora_param: payload.sdr_modelo_impressora_param || null,
      sdr_resina_param: payload.sdr_resina_param || null,
      sdr_suporte_equipamento: payload.sdr_suporte_equipamento || null,
      sdr_suporte_tipo: payload.sdr_suporte_tipo || null,
      sdr_suporte_descricao: payload.sdr_suporte_descricao || null,
      ...(detectedStage ? { lead_stage_detected: detectedStage } : {}),
    };

    let leadId: string;
    let fieldsUpdated: string[] = [];

    if (existingLead) {
      // --- SMART MERGE: only fill null fields ---
      const protectedFields = [
        "nome", "email", "telefone_normalized", "piperun_id",
        "proprietario_lead_crm", "status_oportunidade", "lead_stage_detected",
        "entrada_sistema",
      ];

      const { merged, fieldsUpdated: updated } = smartMerge(existingLead, incomingData, protectedFields);
      fieldsUpdated = updated;

      // Build form submission history entry
      const submissionEntry = {
        form_name: formName,
        source,
        submitted_at: new Date().toISOString(),
        fields_updated: fieldsUpdated,
      };

      // Append to raw_payload as submission history
      const existingHistory = Array.isArray(existingLead.raw_payload?.form_submissions)
        ? existingLead.raw_payload.form_submissions
        : [];

      merged.raw_payload = {
        ...(existingLead.raw_payload || {}),
        form_submissions: [...existingHistory, submissionEntry],
        latest_payload: payload,
      };

      if (Object.keys(merged).length > 0) {
        const { error: updateError } = await supabase
          .from("lia_attendances")
          .update(merged)
          .eq("id", existingLead.id);

        if (updateError) {
          console.error("[ingest-lead] Update error:", updateError);
          try { await supabase.from("system_health_logs").insert({ function_name: "smart-ops-ingest-lead", severity: "error", error_type: "lead_update_failed", lead_email: email, details: { error: updateError.message } }); } catch {}
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      leadId = existingLead.id;
      console.log("[ingest-lead] Lead existente atualizado (merge):", leadId, "campos:", fieldsUpdated);

      // Recalculate intelligence score after merge
      supabase.rpc("calculate_lead_intelligence_score", { p_lead_id: leadId })
        .then(({ error }: { error: unknown }) => { if (error) console.warn("[ingest-lead] Intelligence score RPC failed:", error); });
    } else {
      // --- NEW LEAD: insert ---
      const newLeadData = {
        ...incomingData,
        lead_status: "novo",
        raw_payload: {
          form_submissions: [{
            form_name: formName,
            source,
            submitted_at: new Date().toISOString(),
            fields_updated: Object.keys(incomingData).filter(k => incomingData[k] !== null),
          }],
          latest_payload: payload,
        },
      };

      const { data: newLead, error: insertError } = await supabase
        .from("lia_attendances")
        .insert(newLeadData)
        .select("id")
        .single();

      if (insertError) {
        console.error("[ingest-lead] Insert error:", insertError);
        try { await supabase.from("system_health_logs").insert({ function_name: "smart-ops-ingest-lead", severity: "error", error_type: "lead_insert_failed", lead_email: email, details: { error: insertError.message } }); } catch {}
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      leadId = newLead.id;
      fieldsUpdated = Object.keys(incomingData).filter(k => incomingData[k] !== null);
      console.log("[ingest-lead] Novo lead criado:", leadId);

      // Recalculate intelligence score for new lead
      supabase.rpc("calculate_lead_intelligence_score", { p_lead_id: leadId })
        .then(({ error }: { error: unknown }) => { if (error) console.warn("[ingest-lead] Intelligence score RPC failed:", error); });
    }

    // --- Step 4: Fire-and-forget orchestration ---
    // Trigger lia-assign (CRM sync + seller routing)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ lead_id: leadId, source, trigger: "ingest-lead" }),
      }).catch(e => console.warn("[ingest-lead] lia-assign fire-and-forget error:", e));
    } catch (e) {
      console.warn("[ingest-lead] lia-assign call failed:", e);
    }

    // Trigger cognitive-lead-analysis
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ lead_id: leadId, trigger: "ingest-lead" }),
      }).catch(e => console.warn("[ingest-lead] cognitive-analysis fire-and-forget error:", e));
    } catch (e) {
      console.warn("[ingest-lead] cognitive-analysis call failed:", e);
    }

    // ─── Sync lead to SellFlux ───
    const SELLFLUX_WEBHOOK_LEADS = Deno.env.get("SELLFLUX_WEBHOOK_LEADS");
    const SELLFLUX_WEBHOOK_CAMPANHAS = Deno.env.get("SELLFLUX_WEBHOOK_CAMPANHAS");
    const sellfluxData: Record<string, unknown> = {
      ...incomingData,
      ...(existingLead || {}),
      nome: incomingData.nome || existingLead?.nome,
      email: incomingData.email || existingLead?.email,
      telefone_normalized: incomingData.telefone_normalized || existingLead?.telefone_normalized,
    };

    // V2 webhook (Campanhas) — creates/updates contact + triggers automation
    if (SELLFLUX_WEBHOOK_CAMPANHAS) {
      try {
        const sfResult = await sendCampaignViaSellFlux(SELLFLUX_WEBHOOK_CAMPANHAS, sellfluxData, "ingest_lead");
        console.log("[ingest-lead] SellFlux campaign sync:", sfResult.success ? "OK" : "FAIL", sfResult.status);
      } catch (e) {
        console.warn("[ingest-lead] SellFlux campaign sync error:", e);
      }
    }

    // V1 webhook (Leads) — updates existing contact data
    if (SELLFLUX_WEBHOOK_LEADS) {
      try {
        const sfResult = await sendLeadToSellFlux(SELLFLUX_WEBHOOK_LEADS, sellfluxData);
        console.log("[ingest-lead] SellFlux lead update:", sfResult.success ? "OK" : "FAIL", sfResult.status);
      } catch (e) {
        console.warn("[ingest-lead] SellFlux lead update error:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      is_existing: !!existingLead,
      fields_updated: fieldsUpdated,
      pql_detected: detectedStage === "PQL_recompra",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ingest-lead] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
