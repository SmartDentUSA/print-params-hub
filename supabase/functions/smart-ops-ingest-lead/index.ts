import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendLeadToSellFlux, sendCampaignViaSellFlux } from "../_shared/sellflux-field-map.ts";
import { mergeSmartLead, logEnrichmentAudit } from "../_shared/lead-enrichment.ts";
import { validateLeadIdentity, logRejectedLead } from "../_shared/lead-identity-guard.ts";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizePhone = normalizeBrazilianPhone;

// Fontes comerciais que devem forçar criação de novo Deal no Funil de Vendas
// quando o lead já existe em outro funil (ex.: Estagnados, Reativação).
const NEW_DEAL_SOURCES = new Set([
  "meta_lead_ads",
  "meta_lead_ad",
  "formulario",
  "form",
  "vendedor_direto",
]);

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
  if (upper.includes("EXOCAD")) return "exocad";
  if (upper.includes("MEDIT")) return "Medit";
  if (upper.includes("MIICRAFT") || upper.includes("MII CRAFT")) return "MiiCraft";
  if (upper.includes("SCANNER")) return "Scanner Intraoral";
  if (upper.includes("IMPRESSORA") || upper.includes("PRINTER")) return "Impressora 3D";
  if (upper.includes("RESINA") || upper.includes("RESIN")) return "Resinas";
  return null;
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

    // ─── IDEMPOTENCY GUARD (Meta Lead Ads / SellFlux re-delivery) ───
    // Meta and SellFlux frequently re-deliver the SAME leadgen_id every 2 min,
    // causing the same lead to be re-processed dozens of times → re-triggering
    // lia-assign, SellFlux sync, deal-form-note and seller-summary in a loop.
    // If we already have an event for this exact leadgen_id in the last 6h,
    // short-circuit immediately.
    const dedupeId =
      payload.meta_leadgen_id ||
      payload.platform_lead_id ||
      payload.leadgen_id ||
      null;
    if (dedupeId) {
      try {
        const supabaseDedupe = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        // ─── HARD-DEDUPE: by dedicated column platform_lead_id ───
        // If we already persisted this Meta leadgen_id on a lead — either as
        // the current platform_lead_id OR archived in
        // raw_payload.previous_platform_lead_ids — the cron is re-delivering
        // the same lead. Short-circuit immediately. Checking the archive
        // closes the X↔Y alternation loop where two leadgen_ids ping-pong
        // and keep overwriting platform_lead_id forever.
        const { data: priorLead } = await supabaseDedupe
          .from("lia_attendances")
          .select("id, pessoa_piperun_id, piperun_id, merged_into")
          .or(
            `platform_lead_id.eq.${String(dedupeId)},raw_payload->previous_platform_lead_ids.cs.["${String(dedupeId)}"]`,
          )
          .is("merged_into", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (priorLead) {
          console.log(
            `[ingest-lead] HARD_DEDUPE_SKIPPED: platform_lead_id=${dedupeId} already on lead ${priorLead.id} (pessoa=${priorLead.pessoa_piperun_id ?? "n/a"})`,
          );
          return new Response(
            JSON.stringify({
              success: true,
              duplicate_skipped: true,
              dedupe_id: String(dedupeId),
              dedupe_via: "platform_lead_id_or_archive",
              lead_id: priorLead.id,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // ─── FAMILY-KEY DEDUPE (Meta) ───
        // Even when the leadgen_id is brand-new, if the SAME platform_form_id
        // + email + phone already produced a lead in the last 24h, the Meta
        // pull cron is re-emitting the same submission with a fresh id. Treat
        // as duplicate and only archive the new id on the canonical lead.
        if (payload.source === "meta_lead_ads") {
          const famEmail = String(payload.email || "").toLowerCase().trim();
          const famPhoneRaw = String(payload.phone_number || payload.phone || payload.telefone || "");
          const famPhone = famPhoneRaw ? normalizePhone(famPhoneRaw) : null;
          const famFormId = payload.platform_form_id || payload.meta_form_id || null;
          if (famFormId && (famEmail || famPhone)) {
            const identityFilter = [
              famEmail ? `email.eq.${famEmail}` : null,
              famPhone ? `telefone_normalized.eq.${famPhone}` : null,
            ].filter(Boolean).join(",");
            const { data: famLead } = await supabaseDedupe
              .from("lia_attendances")
              .select("id, platform_lead_id, raw_payload, created_at")
              .eq("platform_form_id", String(famFormId))
              .or(identityFilter)
              .is("merged_into", null)
              .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (famLead) {
              // Archive the new leadgen_id so future HARD_DEDUPE catches it.
              try {
                const archive = new Set<string>([
                  ...((famLead.raw_payload?.previous_platform_lead_ids as string[] | undefined) || []),
                  String(dedupeId),
                ]);
                if (famLead.platform_lead_id && famLead.platform_lead_id !== String(dedupeId)) {
                  archive.add(String(famLead.platform_lead_id));
                }
                await supabaseDedupe
                  .from("lia_attendances")
                  .update({
                    raw_payload: {
                      ...(famLead.raw_payload || {}),
                      previous_platform_lead_ids: Array.from(archive),
                    },
                  })
                  .eq("id", famLead.id);
              } catch (e) {
                console.warn("[ingest-lead] family-archive write failed:", e);
              }
              console.log(
                `[ingest-lead] FAMILY_DEDUPE_SKIPPED: form_id=${famFormId} email=${famEmail} phone=${famPhone} → lead ${famLead.id} (new leadgen_id ${dedupeId} archived)`,
              );
              return new Response(
                JSON.stringify({
                  success: true,
                  duplicate_skipped: true,
                  dedupe_id: String(dedupeId),
                  dedupe_via: "family_key",
                  lead_id: famLead.id,
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }
          }
        }
        const { data: priorEvent } = await supabaseDedupe
          .from("lead_activity_log")
          .select("id, event_timestamp, lead_id")
          .eq("entity_id", String(dedupeId))
          .in("event_type", ["meta_ads_lead_entry", "sellflux_lead_entry", "form_submission"])
          .gte("event_timestamp", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
          .order("event_timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (priorEvent?.lead_id) {
          // ── ORPHAN-EVENT GUARD ──
          // Validate that the lead referenced by the prior activity event ACTUALLY
          // represents this payload (same platform_lead_id OR same email OR same
          // normalized phone). Otherwise the activity_log row is a ghost from a
          // previous absorption (phone-match against a different email), and
          // honouring it would lose every retry of the new lead forever.
          const incomingEmail = String(payload.email || payload.user_email || "").toLowerCase().trim();
          const incomingPhoneRaw = String(
            payload.phone_number || payload.phone || payload.telefone || payload.celular || "",
          );
          const incomingPhone = incomingPhoneRaw ? normalizePhone(incomingPhoneRaw) : null;
          const { data: priorLeadRow } = await supabaseDedupe
            .from("lia_attendances")
            .select("id, email, telefone_normalized, platform_lead_id, raw_payload")
            .eq("id", priorEvent.lead_id)
            .maybeSingle();
          const altIds: string[] = Array.isArray(
            (priorLeadRow?.raw_payload as Record<string, unknown> | null)
              ?.previous_platform_lead_ids,
          )
            ? ((priorLeadRow!.raw_payload as Record<string, unknown>).previous_platform_lead_ids as string[])
            : [];
          const identityMatches = !!priorLeadRow && (
            String(priorLeadRow.platform_lead_id || "") === String(dedupeId) ||
            altIds.includes(String(dedupeId)) ||
            (incomingEmail && String(priorLeadRow.email || "").toLowerCase() === incomingEmail) ||
            (incomingPhone && String(priorLeadRow.telefone_normalized || "") === incomingPhone)
          );
          if (identityMatches) {
            console.log(
              `[ingest-lead] DUPLICATE_SKIPPED: leadgen_id=${dedupeId} already processed at ${priorEvent.event_timestamp} (lead ${priorEvent.lead_id})`,
            );
            return new Response(
              JSON.stringify({
                success: true,
                duplicate_skipped: true,
                dedupe_id: String(dedupeId),
                prior_event_at: priorEvent.event_timestamp,
                lead_id: priorEvent.lead_id,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          console.warn(
            `[ingest-lead] IDENTITY_COLLISION_ORPHAN: activity_log entity_id=${dedupeId} points to lead ${priorEvent.lead_id} ` +
            `(email=${priorLeadRow?.email ?? "n/a"}, platform_lead_id=${priorLeadRow?.platform_lead_id ?? "n/a"}) ` +
            `but incoming payload (email=${incomingEmail || "n/a"}, phone=${incomingPhone || "n/a"}) does not match. ` +
            `Proceeding with normal ingest.`,
          );
          try {
            await supabaseDedupe.from("system_health_logs").insert({
              function_name: "smart-ops-ingest-lead",
              severity: "warning",
              event_type: "identity_collision_orphan",
              lead_email: incomingEmail || null,
              details: {
                dedupe_id: String(dedupeId),
                prior_lead_id: priorEvent.lead_id,
                prior_lead_email: priorLeadRow?.email ?? null,
                prior_lead_platform_lead_id: priorLeadRow?.platform_lead_id ?? null,
                incoming_phone: incomingPhone,
              },
            });
          } catch {}
        }
      } catch (dedupeErr) {
        console.warn("[ingest-lead] dedupe check failed (non-blocking):", dedupeErr);
      }
    }

    // --- Fix: declare source from payload ---
    const source = payload.source || payload.utm_source || "formulario";
    let formName: string | null = payload.form_name || payload.formName || payload.form || null;
    const formPurpose: string | null = payload.form_purpose || null;

    // ── Loja Integrada: normalizar formulário de orçamento ──
    // Front-end posta form_name="produto_sob_consulta" cru. Renomeamos para o
    // label oficial usado no PipeRun (Origin) e fixamos a campanha orgânica.
    const ECOM_QUOTE_LABEL    = "# - Orçamento e-commerce";
    const ECOM_QUOTE_CAMPAIGN = "# - Orgânico e-commerce";
    const isEcomQuote =
      source === "loja_integrada" &&
      (formName === "produto_sob_consulta" || formName === ECOM_QUOTE_LABEL);
    if (isEcomQuote) {
      formName = ECOM_QUOTE_LABEL;
      payload.form_name       = ECOM_QUOTE_LABEL;
      payload.origem_campanha = ECOM_QUOTE_CAMPAIGN;
      payload.utm_campaign    = ECOM_QUOTE_CAMPAIGN;
    }

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

    const areaAtuacao = extractField(payload, "area de atuacao", "area_atuacao", "area_de_atuacao", "atuacao");
    const especialidade = extractField(payload, "especialidade", "specialty", "especialidade_odontologica");
    const comoDigitaliza = extractField(payload, "como digitaliza", "como_digitaliza", "moldagens");
    const temImpressora = payload.tem_impressora
      ? String(payload.tem_impressora).trim()
      : extractField(payload, "tem_impressora", "impressoes 3d", "impressoes_3d", "utiliza impressoes", "possui_impressora", "possui impressora", "impressora");
    const temScanner = payload.tem_scanner
      ? String(payload.tem_scanner).trim()
      : extractField(payload, "tem_scanner", "possui_scanner", "possui scanner", "scanner_intraoral", "tem scanner");
    const impressoraModelo = payload.impressora_modelo
      ? String(payload.impressora_modelo).trim()
      : extractField(payload, "impressora_modelo", "modelo impressora", "printer_model", "modelo_impressora");
    const resinaInteresse = extractField(payload, "resina_interesse", "resina", "resin");
    const formProduct = detectProductFromFormName(formName);
    let produtoInteresse: string | null = payload.produto_interesse
      ? String(payload.produto_interesse).trim()
      : (extractField(payload, "produto_interesse", "product") || formProduct);

    // Loja Integrada: produto selecionado pelo lead na loja → produto_interesse
    if (isEcomQuote) {
      const ecomProduct =
        (typeof payload.produto_nome === "string" && payload.produto_nome.trim()) ||
        (typeof payload.produto_sku  === "string" && payload.produto_sku.trim())  ||
        (typeof payload.page_title   === "string" && payload.page_title.trim())   ||
        null;
      if (ecomProduct) {
        produtoInteresse = ecomProduct;
        payload.produto_interesse = ecomProduct;
      }
    }

    const produtoInteresseAuto = payload.produto_interesse_auto || produtoInteresse || formProduct || null;

    // --- Step 1: Resolve canonical lead via identity cascade (email → phone → merged_into chain) ---
    let existingLead: Record<string, any> | null = null;
    let matchedVia: "email" | "phone" | null = null;
    let incomingEmailDiffersFromCanonical = false;

    {
      const { data: byEmail } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (byEmail) { existingLead = byEmail; matchedVia = "email"; }
    }
    if (!existingLead && telefoneNormalized) {
      const { data: byPhone } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("telefone_normalized", telefoneNormalized)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (byPhone) { existingLead = byPhone; matchedVia = "phone"; }
    }
    // Fallback: busca pelos últimos 9 dígitos do telefone (cobre variações de formato)
    if (!existingLead && telefoneNormalized) {
      const last9 = telefoneNormalized.replace(/\D/g, '').slice(-9);
      if (last9.length === 9) {
        const { data: byPhoneFuzzy } = await supabase
          .from('lia_attendances')
          .select('*')
          .like('telefone_normalized', `%${last9}`)
          .is('merged_into', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (byPhoneFuzzy) {
          existingLead = byPhoneFuzzy;
          matchedVia = 'phone';
          console.log(`[ingest-lead] FUZZY_PHONE_MATCH: found ${byPhoneFuzzy.email} via last9=${last9}`);
        }
      }
    }
    // Follow merged_into chain to canonical
    let hops = 0;
    while (existingLead?.merged_into && hops < 5) {
      const { data: parent } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("id", existingLead.merged_into)
        .maybeSingle();
      if (!parent) break;
      existingLead = parent;
      hops++;
    }
    if (existingLead && existingLead.email && existingLead.email.toLowerCase() !== email) {
      incomingEmailDiffersFromCanonical = true;
      console.log(`[ingest-lead] Lead matched via ${matchedVia}; incoming email "${email}" differs from canonical "${existingLead.email}". Preserving canonical email.`);
    }

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
      // origem_primeiro_contato is set on every payload, but a BEFORE UPDATE trigger
      // on lia_attendances preserves the original value once the lead exists.
      origem_primeiro_contato:
        payload.origem_campanha || payload.campaign || formName || source || null,
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
      tem_scanner: temScanner,
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
      // CS & Suporte
      cs_treinamento: payload.cs_treinamento || null,
      data_treinamento: payload.data_treinamento || null,
      data_contrato: payload.data_contrato || null,
      reuniao_agendada: payload.reuniao_agendada === "Sim" ? true : payload.reuniao_agendada === "Não" ? false : (payload.reuniao_agendada ?? null),
      data_primeiro_contato: payload.data_primeiro_contato || null,
      // Funil & Status
      status_oportunidade: payload.status_oportunidade || null,
      valor_oportunidade: payload.valor_oportunidade ? Number(payload.valor_oportunidade) : null,
      proprietario_lead_crm: payload.proprietario_lead_crm || null,
      produto_interesse_auto: produtoInteresseAuto || payload.produto_interesse_auto || null,
      // Equipamentos Ativos (seriais)
      equip_scanner: payload.equip_scanner || null,
      equip_scanner_serial: payload.equip_scanner_serial || null,
      equip_impressora: payload.equip_impressora || null,
      equip_impressora_serial: payload.equip_impressora_serial || null,
      equip_cad: payload.equip_cad || null,
      equip_cad_serial: payload.equip_cad_serial || null,
      equip_pos_impressao: payload.equip_pos_impressao || null,
      equip_pos_impressao_serial: payload.equip_pos_impressao_serial || null,
      equip_notebook: payload.equip_notebook || null,
      equip_notebook_serial: payload.equip_notebook_serial || null,
      insumos_adquiridos: payload.insumos_adquiridos || null,
      // Tags
      tags_crm: payload.tags_crm || null,
      motivo_perda: payload.motivo_perda || null,
      comentario_perda: payload.comentario_perda || null,
      id_cliente_smart: payload.id_cliente_smart || null,
      // SellFlux custom fields
      sellflux_custom_fields: payload.sellflux_custom_fields || null,
      // Meta Ads → platform_* dedicated columns
      platform: payload.platform || payload.meta_platform || null,
      platform_lead_id: payload.platform_lead_id || payload.meta_leadgen_id || null,
      platform_form_id: payload.platform_form_id || payload.meta_form_id || null,
      platform_campaign_id: payload.platform_campaign_id || payload.meta_campaign_id || null,
      platform_ad_id: payload.platform_ad_id || payload.meta_ad_id || null,
      platform_adgroup_id: payload.platform_adgroup_id || payload.meta_adset_id || null,
      ...(detectedStage ? { lead_stage_detected: detectedStage } : {}),
    };

    // --- Auto-forward: dynamically include any payload key that matches a lia_attendances column ---
    const META_KEYS = new Set([
      "source", "form_name", "form_purpose", "form_responses", "raw_payload",
      "campaign", "formName", "form", "ip", "full_name", "name", "user_name",
      "first_name", "last_name", "phone_number", "phone", "mobile", "celular",
      "user_phone", "user_email", "specialty", "product", "nome", "email",
      "telefone", "utm_source", "utm_medium", "utm_campaign", "utm_term",
      // Loja Integrada / front-end metadata (preserved in raw_payload only) —
      // never let these become inferred columns on lia_attendances.
      "page_url", "page_title", "mensagem", "produto_id", "produto_sku",
      "produto_nome", "referrer", "user_agent", "force_new_deal",
    ]);
    for (const [key, value] of Object.entries(payload)) {
      if (value == null || value === "") continue;
      if (META_KEYS.has(key)) continue;
      if (key in incomingData) continue;
      if (typeof value === "object") continue;
      incomingData[key] = value;
    }

    // --- form_data JSONB catch-all: preserve ALL form fields (even without dedicated columns) ---
    if (source === "form" || formName) {
      const existingFormData = (existingLead?.form_data as Record<string, unknown>) || {};
      const rawFields = Object.fromEntries(
        Object.entries(payload).filter(([k, v]) => v != null && typeof v !== "object" && !META_KEYS.has(k))
      );
      const bucketKey = formName || "_unnamed";
      const newSnapshot = {
        submitted_at: new Date().toISOString(),
        source,
        responses: payload.form_responses || [],
        raw_fields: rawFields,
      };
      // Coerce existing bucket to array (back-compat with old single-object shape)
      const prev = existingFormData[bucketKey];
      const prevArr: unknown[] = Array.isArray(prev) ? prev : prev ? [prev] : [];
      // Cap history at 20 snapshots per form to avoid row bloat
      const nextArr = [...prevArr, newSnapshot].slice(-20);
      incomingData.form_data = {
        ...existingFormData,
        [bucketKey]: nextArr,
      };
      console.log(`[ingest-lead] form_data appended for "${bucketKey}" (${nextArr.length} snapshot(s), ${Object.keys(rawFields).length} raw fields)`);
      // Fire-and-forget instrumentation
      try {
        supabase.from("system_health_logs").insert({
          function_name: "smart-ops-ingest-lead",
          severity: "info",
          event_type: "form_data_appended",
          lead_email: email,
          details: {
            form_name: bucketKey,
            source,
            responses_count: (payload.form_responses || []).length,
            raw_fields_count: Object.keys(rawFields).length,
            history_size: nextArr.length,
          },
        }).then(() => {}, () => {});
      } catch {}
    }

    let leadId: string;
    let fieldsUpdated: string[] = [];
    let forcedNewDeal = false;

    if (existingLead) {
      // Regra: novo deal SEMPRE que vier de fonte comercial e lead não está no Funil de Vendas
      const isInFunilDeVendas = (existingLead?.piperun_pipeline_name || '')
        .toLowerCase()
        .includes('funil de vendas');

      const shouldForceNewDeal =
        NEW_DEAL_SOURCES.has(source) &&
        formName &&
        existingLead?.piperun_id &&
        !isInFunilDeVendas;

      if (shouldForceNewDeal) {
        await supabase.from('lia_attendances').update({
          piperun_id: null,
          piperun_link: null,
          proprietario_lead_crm: null,
          form_name: formName,
          produto_interesse: produtoInteresse || existingLead.produto_interesse,
          source,
        }).eq('id', existingLead.id);

        // Reflete localmente para que merge + deal-form-note enxerguem o estado já zerado
        existingLead.piperun_id = null;
        existingLead.piperun_link = null;
        existingLead.proprietario_lead_crm = null;

        forcedNewDeal = true;
        console.log(`[ingest-lead] NOVO DEAL: ${existingLead.nome} estava em "${existingLead.piperun_pipeline_name}" → criando deal no Funil de Vendas`);
      }

      // --- SMART MERGE using shared lead-enrichment module ---
      const { merged, fieldsUpdated: updated, fieldsSkipped } = mergeSmartLead(existingLead, incomingData, source);
      fieldsUpdated = updated;

      // Never overwrite canonical email when matched via phone
      if (incomingEmailDiffersFromCanonical) {
        delete (merged as Record<string, unknown>).email;
      }

      // ── PLATFORM_LEAD_ID SYNC (Identity-Collision Fix) ──
      // When a Meta/SellFlux retry brings a NEW leadgen_id that we absorbed into
      // an existing canonical lead (phone-match scenario), we must propagate the
      // newest platform_lead_id to the canonical row. Otherwise:
      //   1. HARD_DEDUPE by platform_lead_id never fires for the new id.
      //   2. Only the lead_activity_log path can catch it, and that path used
      //      to short-circuit even when identity didn't match (ORPHAN bug).
      // Strategy: overwrite platform_lead_id with the newest value, but archive
      // the previous id(s) in raw_payload.previous_platform_lead_ids so we keep
      // the full origin history and the HARD_DEDUPE check above can fall back
      // to that archive.
      const incomingPlatformLeadId = (incomingData as Record<string, unknown>).platform_lead_id;
      if (
        incomingPlatformLeadId &&
        String(incomingPlatformLeadId) !== String(existingLead.platform_lead_id || "")
      ) {
        const previousIds = new Set<string>([
          ...((existingLead.raw_payload?.previous_platform_lead_ids as string[] | undefined) || []),
        ]);
        if (existingLead.platform_lead_id) {
          previousIds.add(String(existingLead.platform_lead_id));
        }
        (merged as Record<string, unknown>).platform_lead_id = String(incomingPlatformLeadId);
        merged.raw_payload = {
          ...(existingLead.raw_payload || {}),
          ...(merged.raw_payload || {}),
          previous_platform_lead_ids: Array.from(previousIds),
        };
        if (incomingEmailDiffersFromCanonical) {
          console.warn(
            `[ingest-lead] IDENTITY_COLLISION: canonical lead ${existingLead.id} (email=${existingLead.email}) ` +
            `absorbed payload with different email (${email}) and new platform_lead_id ${incomingPlatformLeadId}. ` +
            `Old platform_lead_id ${existingLead.platform_lead_id || "n/a"} archived.`,
          );
          try {
            await supabase.from("system_health_logs").insert({
              function_name: "smart-ops-ingest-lead",
              severity: "warning",
              event_type: "identity_collision_absorbed",
              lead_email: email,
              details: {
                canonical_lead_id: existingLead.id,
                canonical_email: existingLead.email,
                incoming_email: email,
                matched_via: matchedVia,
                new_platform_lead_id: String(incomingPlatformLeadId),
                previous_platform_lead_id: existingLead.platform_lead_id || null,
                form_name: formName,
                source,
              },
            });
          } catch {}
        }
      }

      if (fieldsSkipped.length > 0) {
        console.log("[ingest-lead] Fields skipped (already filled):", fieldsSkipped.slice(0, 15));
      }

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

      // Preserve custom_fields history (Ajuste B) — each submission appends an
      // entry; the top-level custom_fields keeps the latest for compat.
      const incomingCustomFields = (payload?.raw_payload?.custom_fields ?? null) as
        | Record<string, unknown>
        | null;
      const existingCfHistory = Array.isArray(existingLead.raw_payload?.custom_fields_history)
        ? existingLead.raw_payload.custom_fields_history
        : [];
      const nextCfHistory =
        incomingCustomFields && Object.keys(incomingCustomFields).length > 0
          ? [
              ...existingCfHistory,
              {
                submitted_at: new Date().toISOString(),
                form_name: formName,
                source,
                fields: incomingCustomFields,
              },
            ].slice(-50)
          : existingCfHistory;

      merged.raw_payload = {
        ...(existingLead.raw_payload || {}),
        ...(merged.raw_payload || {}),
        form_submissions: [...existingHistory, submissionEntry],
        custom_fields_history: nextCfHistory,
        latest_payload: payload,
      };

      // Track alternate email used in this submission (kept on canonical without overwriting)
      if (incomingEmailDiffersFromCanonical) {
        const altEmails = new Set<string>([
          ...((existingLead.raw_payload?.alternate_emails as string[] | undefined) || []),
          email,
        ]);
        merged.raw_payload = {
          ...(merged.raw_payload || {}),
          alternate_emails: Array.from(altEmails),
        };
        (submissionEntry as Record<string, unknown>).submitted_via_email = email;
      }

      if (Object.keys(merged).length > 0) {
        // Capture previous values for audit
        const previousValues: Record<string, unknown> = {};
        for (const key of fieldsUpdated) {
          previousValues[key] = existingLead[key];
        }

        let { error: updateError } = await supabase
          .from("lia_attendances")
          .update(merged)
          .eq("id", existingLead.id);

        // Retry: if unknown column, strip it and retry once
        if (updateError?.message?.includes("column") && updateError?.message?.includes("does not exist")) {
          const colMatch = updateError.message.match(/column "([^"]+)"/);
          if (colMatch) {
            console.warn("[ingest-lead] Stripping unknown column from update:", colMatch[1]);
            delete merged[colMatch[1]];
            const retry = await supabase.from("lia_attendances").update(merged).eq("id", existingLead.id);
            updateError = retry.error;
          }
        }

        if (updateError) {
          console.error("[ingest-lead] Update error:", updateError);
          try { await supabase.from("system_health_logs").insert({ function_name: "smart-ops-ingest-lead", severity: "error", error_type: "lead_update_failed", lead_email: email, details: { error: updateError.message } }); } catch {}
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fire-and-forget: audit log
        logEnrichmentAudit(existingLead.id, source, fieldsUpdated, previousValues, merged).catch(() => {});
      }

      leadId = existingLead.id;
      console.log("[ingest-lead] Lead existente atualizado (merge):", leadId, "campos:", fieldsUpdated);

      // If canonical already has a PipeRun deal, post a note documenting this new submission
      if (existingLead.piperun_id && (formName || source === "form")) {
        const responses: Array<{ label: string; value: string }> = Array.isArray(payload.form_responses)
          ? payload.form_responses.map((r: any) => ({
              label: String(r.label ?? r.name ?? r.field ?? ""),
              value: String(r.value ?? r.answer ?? ""),
            })).filter((r: any) => r.label && r.value)
          : [];
        if (incomingEmailDiffersFromCanonical) {
          responses.unshift({ label: "Email usado neste envio", value: email });
        }
        if (responses.length === 0) {
          // Fallback: serialize updated fields
          for (const k of fieldsUpdated.slice(0, 20)) {
            const v = (incomingData as Record<string, unknown>)[k];
            if (v != null && typeof v !== "object") responses.push({ label: k, value: String(v) });
          }
        }
        if (responses.length > 0) {
          const noteFetch = fetch(`${SUPABASE_URL}/functions/v1/smart-ops-deal-form-note`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              lead_id: leadId,
              form_name: formName || `Reentrada via ${source}`,
              responses,
            }),
          }).catch(e => console.warn("[ingest-lead] deal-form-note fire-and-forget error:", e));
          // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
          if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(noteFetch);
        }
      }

      // Recalculate intelligence score after merge
      supabase.rpc("calculate_lead_intelligence_score", { p_lead_id: leadId })
        .then(({ error }: { error: unknown }) => { if (error) console.warn("[ingest-lead] Intelligence score RPC failed:", error); });
    } else {
      // --- NEW LEAD: insert ---
      // ── Identity guard: nunca cria lead sem nome+email+telefone reais ──
      const identity = validateLeadIdentity({
        nome,
        email,
        phoneNormalized: telefoneNormalized,
        rawPhone: telefoneRaw,
      });
      if (!identity.ok) {
        await logRejectedLead(supabase, {
          functionName: "smart-ops-ingest-lead",
          source,
          check: identity,
          email,
          raw: { nome, telefoneRaw, telefoneNormalized, formName },
        });
        console.log(
          `[ingest-lead] Lead criação BLOQUEADA — identity incompleta: ${identity.missing.join(",")}`,
        );
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "missing_identity",
            missing: identity.missing,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

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

      let { data: newLead, error: insertError } = await supabase
        .from("lia_attendances")
        .insert(newLeadData)
        .select("id")
        .single();

      // Retry: if unknown column, strip it and retry once
      if (insertError?.message?.includes("column") && insertError?.message?.includes("does not exist")) {
        const colMatch = insertError.message.match(/column "([^"]+)"/);
        if (colMatch) {
          console.warn("[ingest-lead] Stripping unknown column from insert:", colMatch[1]);
          delete newLeadData[colMatch[1]];
          const retry = await supabase.from("lia_attendances").insert(newLeadData).select("id").single();
          newLead = retry.data;
          insertError = retry.error;
        }
      }

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

    // --- Step 4: Fire-and-forget orchestration (non-blocking but kept alive) ---
    // CRITICAL: use EdgeRuntime.waitUntil so the request survives the handler
    // returning. Without it the runtime may kill the in-flight fetch before it
    // reaches the target function (root cause of stuck-without-piperun_id leads).
    const dispatchAsync = async (
      fnName: string,
      body: Record<string, unknown>,
    ) => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          console.warn(`[ingest-lead] ${fnName} returned ${r.status}: ${text.slice(0, 200)}`);
          try {
            await supabase.from("system_health_logs").insert({
              function_name: "smart-ops-ingest-lead",
              severity: "warning",
              error_type: "downstream_dispatch_non_ok",
              lead_email: email,
              details: { lead_id: leadId, target: fnName, status: r.status, body: text.slice(0, 500) },
            });
          } catch {}
        }
      } catch (e) {
        console.error(`[ingest-lead] ${fnName} dispatch error:`, e);
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-ingest-lead",
            severity: "error",
            error_type: "downstream_dispatch_failed",
            lead_email: email,
            details: { lead_id: leadId, target: fnName, error: String(e) },
          });
        } catch {}
      }
    };

    const liaAssignPromise = dispatchAsync("smart-ops-lia-assign", {
      lead_id: leadId,
      source,
      trigger: (formPurpose === "sdr_captacao" && !!existingLead)
        ? "sdr_captacao_reativacao"
        : "ingest-lead",
      form_responses: payload.form_responses || [],
      // Force a brand-new Deal whenever the submission is an explicit
      // commercial inquiry on a product page (Loja Integrada "Sob Consulta"),
      // even if the Person already has an open Vendas deal. Each consult is
      // a distinct revenue opportunity for that product.
      force_new_deal:
        payload.force_new_deal === true ||
        // NOVO — toda submissão de formulário ativo (qualquer form_name)
        // abre Deal novo em Funil de Vendas. Person é reutilizada; Deals
        // anteriores (aberto/estagnado/perdido) permanecem intocados.
        (typeof formName === "string" && formName.trim().length > 0) ||
        (source === "loja_integrada" && (
          formName === ECOM_QUOTE_LABEL ||
          formName === "produto_sob_consulta"
        )),
    });
    const cognitivePromise = dispatchAsync("cognitive-lead-analysis", {
      lead_id: leadId,
      trigger: "ingest-lead",
    });
    // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(liaAssignPromise);
      // @ts-ignore
      EdgeRuntime.waitUntil(cognitivePromise);
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

    // ─── Timeline: log lead ingestion event ───
    const sourceLabel = source === "meta_lead_ads" ? "Entrada via Meta Ads"
      : source === "sellflux_webhook" || (payload.utm_source || "").includes("sellflux") ? "Entrada via SellFlux"
      : source === "formulario" || formName ? `Formulário: ${formName || source}`
      : source === "loja_integrada" ? "Entrada via E-commerce"
      : `Entrada: ${source}`;

    const timelineEventType = source === "meta_lead_ads" ? "meta_ads_lead_entry"
      : (payload.utm_source || "").includes("sellflux") ? "sellflux_lead_entry"
      : formName ? "form_submission"
      : "lead_ingested";

    await supabase.from("lead_activity_log").insert({
      lead_id: leadId,
      event_type: timelineEventType,
      entity_type: source === "meta_lead_ads" ? "meta_ads" : source === "loja_integrada" ? "ecommerce" : "form",
      entity_id: payload.meta_leadgen_id || formName || source,
      entity_name: sourceLabel,
      event_data: {
        label: sourceLabel,
        form_name: formName,
        source,
        utm_source: payload.utm_source || null,
        utm_campaign: payload.utm_campaign || null,
        utm_medium: payload.utm_medium || null,
        is_existing: !!existingLead,
        fields_updated: fieldsUpdated.slice(0, 20),
        produto_interesse: produtoInteresse || null,
        pql_detected: detectedStage === "PQL_recompra",
      },
      source_channel: source,
      event_timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      is_existing: !!existingLead,
      fields_updated: fieldsUpdated,
      pql_detected: detectedStage === "PQL_recompra",
      forced_new_deal: forcedNewDeal,
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
