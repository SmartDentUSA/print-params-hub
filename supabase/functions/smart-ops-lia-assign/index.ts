import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PIPELINES,
  STAGES_VENDAS,
  PIPERUN_USERS,
  piperunPost,
  piperunPut,
  piperunGet,
  addDealNote,
  mapAttendanceToDealCustomFields,
  customFieldsToHashMap,
  DEAL_CUSTOM_FIELDS,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_OWNER_ID = 64367; // Thiago Nicoletti — gestor

/**
 * Resolve the first stage_id of a pipeline via PipeRun API.
 */
async function resolveFirstStage(apiToken: string, pipelineId: number): Promise<number> {
  try {
    const res = await piperunGet(apiToken, "stages", {
      pipeline_id: pipelineId,
      order_by: "order",
      order_type: "asc",
      show: 1,
    });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items && items.length > 0) {
        return Number(items[0].id);
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to resolve first stage for pipeline", pipelineId, e);
  }
  return 0;
}

/**
 * Find or create a person in PipeRun by email.
 * Returns the person_id.
 */
async function findOrCreatePerson(
  apiToken: string,
  lead: Record<string, unknown>
): Promise<number | null> {
  const email = lead.email as string | null;
  const nome = (lead.nome || email || "Lead Sem Nome") as string;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = lead.especialidade as string | null;

  // 1. Search existing person by email
  if (email) {
    try {
      const searchRes = await piperunGet(apiToken, "persons", { email, show: 1 });
      if (searchRes.success && searchRes.data) {
        const items = (searchRes.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
        if (items && items.length > 0 && items[0].id) {
          console.log(`[lia-assign] Found existing person ${items[0].id} for ${email}`);
          return Number(items[0].id);
        }
      }
    } catch (e) {
      console.warn("[lia-assign] Person search error:", e);
    }
  }

  // 2. Create new person
  const personPayload: Record<string, unknown> = { name: nome };

  if (email) {
    personPayload.emails = [{ email }];
  }
  if (phone) {
    personPayload.phones = [{ phone }];
  }
  if (especialidade) {
    personPayload.job_title = especialidade;
  }

  console.log(`[lia-assign] Creating person: ${JSON.stringify(personPayload)}`);
  const createRes = await piperunPost(apiToken, "persons", personPayload);
  console.log(`[lia-assign] Person create result: ${createRes.success} (${createRes.status})`, JSON.stringify(createRes.data).slice(0, 300));

  if (createRes.success && createRes.data) {
    const personData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (personData?.id) {
      return Number(personData.id);
    }
  }

  return null;
}

/**
 * Build a summary note from lead data (even if resumo_historico_ia is empty).
 */
function buildLeadNote(lead: Record<string, unknown>, isNew: boolean): string {
  const lines: string[] = [];
  lines.push(isNew
    ? "🤖 [Dra. L.I.A.] Lead qualificado automaticamente"
    : "🤖 [Dra. L.I.A.] Nova interação detectada"
  );
  lines.push("");

  if (lead.resumo_historico_ia) {
    lines.push(String(lead.resumo_historico_ia));
    lines.push("");
  }

  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  lines.push(`📊 Produto interesse: ${lead.produto_interesse || "N/A"}`);
  lines.push(`🏥 Especialidade: ${lead.especialidade || "N/A"}`);
  lines.push(`🔗 Telefone: ${phone || "N/A"}`);
  lines.push(`📧 Email: ${lead.email || "N/A"}`);
  lines.push(`📍 Origem: dra-lia`);

  if (lead.area_atuacao) lines.push(`🔬 Área: ${lead.area_atuacao}`);
  if (lead.tem_impressora) lines.push(`🖨️ Impressora: ${lead.tem_impressora}`);
  if (lead.tem_scanner) lines.push(`📷 Scanner: ${lead.tem_scanner}`);
  if (lead.cidade) lines.push(`📍 Cidade: ${lead.cidade}${lead.uf ? ` - ${lead.uf}` : ""}`);

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

  if (!PIPERUN_API_KEY) {
    console.error("[lia-assign] PIPERUN_API_KEY not set");
    return new Response(JSON.stringify({ error: "Missing PIPERUN_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[lia-assign] Processing lead: ${email}`);

    // ── 1. Fetch lead ──
    const { data: lead, error: leadErr } = await supabase
      .from("lia_attendances")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadErr || !lead) {
      console.warn("[lia-assign] Lead not found:", email, leadErr);
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency: skip if assigned in last 5 min ──
    if (lead.proprietario_lead_crm && lead.updated_at) {
      const lastUpdate = new Date(lead.updated_at).getTime();
      if (Date.now() - lastUpdate < 5 * 60 * 1000) {
        console.log("[lia-assign] Already assigned recently, skipping");
        return new Response(JSON.stringify({ skipped: true, reason: "recently_assigned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 2. Determine flow: new (no piperun_id) vs existing ──
    const isExisting = !!lead.piperun_id;

    // ── 3. Select owner via Round Robin ──
    let assignedOwnerId: number;
    let assignedTeamMemberId: string | null = null;
    let assignedOwnerName: string;

    if (isExisting && lead.proprietario_lead_crm) {
      const { data: currentOwner } = await supabase
        .from("team_members")
        .select("id, nome_completo, piperun_owner_id, ativo")
        .eq("nome_completo", lead.proprietario_lead_crm)
        .maybeSingle();

      if (currentOwner && currentOwner.ativo) {
        assignedOwnerId = currentOwner.piperun_owner_id;
        assignedTeamMemberId = currentOwner.id;
        assignedOwnerName = currentOwner.nome_completo;
        console.log(`[lia-assign] Keeping existing owner: ${assignedOwnerName}`);
      } else {
        const newOwner = await pickRandomActiveVendedor(supabase);
        assignedOwnerId = newOwner.piperun_owner_id;
        assignedTeamMemberId = newOwner.id;
        assignedOwnerName = newOwner.nome_completo;
        console.log(`[lia-assign] Re-assigned from inactive owner to: ${assignedOwnerName}`);
      }
    } else {
      const newOwner = await pickRandomActiveVendedor(supabase);
      assignedOwnerId = newOwner.piperun_owner_id;
      assignedTeamMemberId = newOwner.id;
      assignedOwnerName = newOwner.nome_completo;
      console.log(`[lia-assign] Round Robin assigned: ${assignedOwnerName} (${assignedOwnerId})`);
    }

    // ── 4. Determine pipeline & stage ──
    const isDistribuidor = assignedOwnerId === FALLBACK_OWNER_ID;
    const pipeline_id = isDistribuidor ? PIPELINES.DISTRIBUIDOR_LEADS : PIPELINES.VENDAS;

    let stage_id: number;
    if (isDistribuidor) {
      stage_id = await resolveFirstStage(PIPERUN_API_KEY, PIPELINES.DISTRIBUIDOR_LEADS);
      console.log(`[lia-assign] Distribuidor de Leads stage: ${stage_id}`);
    } else {
      stage_id = STAGES_VENDAS.SEM_CONTATO;
    }

    // ── 5. Build PipeRun custom fields ──
    const customFields = mapAttendanceToDealCustomFields(lead as Record<string, unknown>);
    const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
    if (phone) {
      customFields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.WHATSAPP, value: phone });
    }

    // ── 6. Sync with PipeRun ──
    let piperunId = lead.piperun_id;
    const piperunEtapa = isDistribuidor ? "distribuidor_leads" : "sem_contato";
    const piperunFunil = isDistribuidor ? "Distribuidor de Leads" : "Funil de vendas";

    if (isExisting && piperunId) {
      // ── UPDATE existing deal ──
      console.log(`[lia-assign] Updating deal ${piperunId}`);
      const updatePayload: Record<string, unknown> = {
        stage_id,
        owner_id: assignedOwnerId,
        origin: "dra-lia",
      };

      // Send custom fields on update too
      if (customFields.length > 0) {
        updatePayload.custom_fields = customFields;
      }

      console.log(`[lia-assign] Update payload: ${JSON.stringify(updatePayload).slice(0, 500)}`);
      const updateRes = await piperunPut(PIPERUN_API_KEY, `deals/${piperunId}`, updatePayload);
      console.log(`[lia-assign] PipeRun update: ${updateRes.success} (${updateRes.status})`, JSON.stringify(updateRes.data).slice(0, 300));

      // If custom_fields caused 422, retry without them
      if (updateRes.status === 422 && customFields.length > 0) {
        console.warn("[lia-assign] 422 on update with custom_fields, retrying without...");
        const retryPayload: Record<string, unknown> = { stage_id, owner_id: assignedOwnerId, origin: "dra-lia" };
        const retryRes = await piperunPut(PIPERUN_API_KEY, `deals/${piperunId}`, retryPayload);
        console.log(`[lia-assign] Retry update: ${retryRes.success} (${retryRes.status})`);
      }

      // Always add note with lead data
      const noteText = buildLeadNote(lead as Record<string, unknown>, false);
      const noteRes = await addDealNote(PIPERUN_API_KEY, Number(piperunId), noteText);
      console.log(`[lia-assign] Note added: ${noteRes.success}`, JSON.stringify(noteRes.data).slice(0, 200));
    } else {
      // ── CREATE new deal ──
      console.log(`[lia-assign] Creating new deal for ${lead.nome}`);

      // Step 1: Find or create person in PipeRun
      const personId = await findOrCreatePerson(PIPERUN_API_KEY, lead as Record<string, unknown>);
      console.log(`[lia-assign] Person ID: ${personId}`);

      // Step 2: Create deal with person_id
      const dealPayload: Record<string, unknown> = {
        title: lead.nome || email,
        pipeline_id,
        stage_id,
        owner_id: assignedOwnerId,
        origin: "dra-lia",
        reference: email,
      };

      if (personId) {
        dealPayload.person_id = personId;
      }

      if (customFields.length > 0) {
        dealPayload.custom_fields = customFields;
      }

      console.log(`[lia-assign] Deal payload: ${JSON.stringify(dealPayload).slice(0, 500)}`);
      const createRes = await piperunPost(PIPERUN_API_KEY, "deals", dealPayload);
      console.log(`[lia-assign] PipeRun create: ${createRes.success} (${createRes.status})`, JSON.stringify(createRes.data).slice(0, 300));

      if (createRes.success && createRes.data) {
        const dealData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
        if (dealData?.id) {
          piperunId = String(dealData.id);
          console.log(`[lia-assign] New deal ID: ${piperunId}`);

          // Add note with lead data
          const noteText = buildLeadNote(lead as Record<string, unknown>, true);
          const noteRes = await addDealNote(PIPERUN_API_KEY, Number(piperunId), noteText);
          console.log(`[lia-assign] Note added: ${noteRes.success}`);
        }
      }
    }

    // ── 7. Update lead in lia_attendances ──
    const updateFields: Record<string, unknown> = {
      proprietario_lead_crm: assignedOwnerName,
      funil_entrada_crm: piperunFunil,
      ultima_etapa_comercial: piperunEtapa,
    };
    if (piperunId && !lead.piperun_id) {
      updateFields.piperun_id = piperunId;
      updateFields.piperun_link = `https://app.pipe.run/#/deals/${piperunId}`;
    }

    await supabase
      .from("lia_attendances")
      .update(updateFields)
      .eq("id", lead.id);

    console.log(`[lia-assign] Lead updated: owner=${assignedOwnerName}, funil=${piperunFunil}`);

    // ── 8. Outbound automation ──
    await triggerOutboundAutomation(supabase, SUPABASE_URL, SERVICE_ROLE_KEY, lead, assignedTeamMemberId);

    return new Response(
      JSON.stringify({
        success: true,
        flow: isExisting ? "update" : "new",
        owner: assignedOwnerName,
        owner_id: assignedOwnerId,
        pipeline: piperunFunil,
        piperun_id: piperunId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[lia-assign] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helpers ──

interface TeamMember {
  id: string;
  nome_completo: string;
  piperun_owner_id: number;
}

async function pickRandomActiveVendedor(
  supabase: ReturnType<typeof createClient>
): Promise<TeamMember> {
  const { data: members } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor");

  if (!members || members.length === 0) {
    console.warn("[lia-assign] No active vendedores, falling back to admin");
    const fallbackUser = PIPERUN_USERS[FALLBACK_OWNER_ID];
    return {
      id: "fallback-admin",
      nome_completo: fallbackUser?.name || "Thiago Nicoletti",
      piperun_owner_id: FALLBACK_OWNER_ID,
    };
  }

  const idx = Math.floor(Math.random() * members.length);
  return members[idx] as TeamMember;
}

async function triggerOutboundAutomation(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  lead: Record<string, unknown>,
  teamMemberId: string | null
) {
  if (!teamMemberId || teamMemberId === "fallback-admin") return;

  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  if (!phone) return;

  try {
    // Query rules: first try team-specific, then any global rule
    let { data: rules } = await supabase
      .from("cs_automation_rules")
      .select("*")
      .eq("trigger_event", "NOVO_LEAD")
      .eq("ativo", true)
      .eq("waleads_ativo", true);

    // No rules at all? Skip
    if (!rules || rules.length === 0) {
      console.log("[lia-assign] No NOVO_LEAD automation rules found");
      return;
    }

    // Prefer team-specific rules, then fallback to any
    const teamRules = rules.filter((r: Record<string, unknown>) => r.team_member_id === teamMemberId);
    if (teamRules.length > 0) rules = teamRules;

    let rule = null;
    if (rules && rules.length > 0) {
      const produtoInteresse = lead.produto_interesse as string | null;
      if (produtoInteresse) {
        rule = rules.find((r: Record<string, unknown>) =>
          r.produto_interesse && String(r.produto_interesse).toLowerCase() === produtoInteresse.toLowerCase()
        );
      }
      if (!rule) rule = rules.find((r: Record<string, unknown>) => !r.produto_interesse);
      if (!rule) rule = rules[0];
    }

    if (!rule) return;

    const payload: Record<string, unknown> = {
      team_member_id: teamMemberId,
      phone,
      tipo: rule.waleads_tipo || "text",
      message: rule.mensagem_waleads || "",
      lead_id: lead.id,
    };
    if (rule.waleads_media_url) {
      payload.media_url = rule.waleads_media_url;
      payload.caption = rule.waleads_media_caption || "";
    }

    await fetch(`${supabaseUrl}/functions/v1/smart-ops-send-waleads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[lia-assign] Outbound automation error:", e);
  }
}
