import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { evaluateCommercialIntent } from "../_shared/commercial-intent.ts";
import { isCompanyLikeName } from "../_shared/identity-utils.ts";
import { isFakeEmail } from "../_shared/lead-identity-guard.ts";
import { fetchDealsContext, type DealsContext } from "../_shared/waleads-messaging.ts";
import {
  PIPELINES,
  PIPELINE_NAMES,
  STAGES_VENDAS,
  STAGES_DISTRIBUIDOR,
  STAGE_TO_ETAPA,
  DEAL_STATUS_MAP,
  PIPERUN_USERS,
  ORIGINS,
  piperunPost,
  piperunPut,
  piperunGet,
  addDealNote,
  mapAttendanceToDealCustomFields,
  mapDealToAttendance,
  customFieldsToDealPayload,
  cleanPersonName,
  sanitizePersonNameForPiperun,
  DEAL_CUSTOM_FIELDS,
  PESSOA_CUSTOM_FIELDS,
  PESSOA_CUSTOM_FIELD_HASHES,
  type PipeRunDealData,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_OWNER_ID = 64367; // Thiago Nicoletti — gestor

// Build human-friendly origin lines for the seller notification.
// Separates Channel / Form / Campaign so the seller sees real provenance
// instead of three duplicated copies of the same form_name.
function buildOriginLines(lead: Record<string, unknown>, mode: "wa" | "html"): string[] {
  const br = mode === "html" ? "<br>" : "";
  const b = (s: string) => mode === "html" ? `<b>${s}</b>` : `*${s}*`;
  const join = (label: string, value: string) =>
    mode === "html" ? `${b(label)} ${value}${br}` : `${label} ${value}`;

  const sourceMap: Record<string, string> = {
    meta_lead_ads: "Meta Lead Ads",
    meta_ads: "Meta Lead Ads",
    facebook: "Meta Lead Ads",
    sellflux: "Sellflux",
    waleads: "WhatsApp",
    whatsapp: "WhatsApp",
    site: "Site",
    formulario: "Formulário Site",
    piperun_webhook: "PipeRun (manual)",
    csv_import: "Importação CSV",
  };
  const rawSource = String(lead.source || lead.origem_primeiro_contato || "").trim();
  const channel = sourceMap[rawSource.toLowerCase()] || rawSource || "N/A";

  const formName = String(lead.form_name || "").trim();
  const campaign = String(lead.origem_campanha || "").trim();
  const adset = String((lead as Record<string, unknown>).meta_adset_name || (lead as Record<string, unknown>).utm_term || "").trim();

  const lines: string[] = [];
  lines.push(join("📡 Canal:", channel));
  if (formName) lines.push(join("📋 Formulário:", formName));
  // Only show campaign if it's distinct from the form (avoid duplicate noise).
  if (campaign && campaign.toLowerCase() !== formName.toLowerCase()) {
    const campaignLine = adset ? `${campaign} › ${adset}` : campaign;
    lines.push(join("🎯 Campanha:", campaignLine));
  }
  return lines;
}

// ─── PipeRun Hierarchy Helpers ───

/**
 * Find person in PipeRun by email. Returns person data or null.
 */
async function findPersonByEmail(
  apiToken: string,
  email: string,
  phoneNormalized?: string | null
): Promise<{ id: number; company_id: number | null } | null> {
  if (!email && !phoneNormalized) return null;
  try {
    // Cascade: email exact → email search → phone exact → phone search.
    // Prevents creating a duplicate Person when PipeRun already has one
    // owning either identifier (would otherwise silently create a name-only
    // shadow because emails/phones get deduped server-side).
    const { findPersonByContact } = await import("../_shared/piperun-person-resolver.ts");
    const hit = await findPersonByContact(apiToken, email || null, phoneNormalized || null);
    if (hit) {
      console.log(`[lia-assign] findPersonByContact: hit ${hit.id} via ${hit.matched_via}`);
      return { id: hit.id, company_id: hit.company_id };
    }
    console.log(`[lia-assign] findPersonByContact: no match for email=${email || "-"} phone=${phoneNormalized || "-"}`);
    return null;
  } catch (e) {
    console.warn("[lia-assign] Person search error:", e);
  }
  return null;
}

// Legacy implementation kept for reference — replaced by piperun-person-resolver.
// deno-lint-ignore no-unused-vars
async function _legacyFindPersonByEmail(
  apiToken: string,
  email: string,
  phoneNormalized?: string | null
): Promise<{ id: number; company_id: number | null } | null> {
  if (!email) return null;
  try {
    // PipeRun's /persons endpoint IGNORES unknown filters and returns a generic
    // list. NEVER fall back to items[0] — that attaches the deal to a totally
    // unrelated person (already caused a Heitor-Rabeti contamination incident).
    const lowerEmail = email.toLowerCase();
    const phoneDigits = (phoneNormalized || "").replace(/\D/g, "");

    const pickStrictByEmail = (data: unknown): { id: number; company_id: number | null } | null => {
      const items = (data as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
      if (!items?.length) return null;
      const match = items.find((p) => {
        const emails = (p.emails as Array<Record<string, unknown>> | undefined) || [];
        return emails.some((e) => String(e.email || "").toLowerCase() === lowerEmail);
      });
      if (match?.id) {
        return { id: Number(match.id), company_id: match.company_id ? Number(match.company_id) : null };
      }
      return null;
    };

    // Phone-only fallback is ONLY used when no email is informed by the lead.
    // Matching by phone-suffix when an email exists is unsafe (multiple persons
    // share trailing 10 digits in PipeRun) and was the root cause of the
    // Andreia/AMANDA contamination incident.
    const pickStrictByPhone = (data: unknown): { id: number; company_id: number | null } | null => {
      if (!phoneDigits) return null;
      const last10 = phoneDigits.slice(-10);
      if (last10.length < 10) return null;
      const items = (data as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
      if (!items?.length) return null;
      const match = items.find((p) => {
        const phones = (p.phones as Array<Record<string, unknown>> | undefined) || [];
        return phones.some((ph) => String(ph.phone || "").replace(/\D/g, "").endsWith(last10));
      });
      if (match?.id) {
        return { id: Number(match.id), company_id: match.company_id ? Number(match.company_id) : null };
      }
      return null;
    };

    const res = await piperunGet(apiToken, "persons", { show: 50 }, { "emails[email]": [email] });
    if (res.success && res.data) {
      const found = pickStrictByEmail(res.data);
      if (found) return found;
    }
    const sres = await piperunGet(apiToken, "persons", { search: email, show: 50 });
    if (sres.success && sres.data) {
      const found = pickStrictByEmail(sres.data);
      if (found) return found;
    }
    // No email match → DO NOT fall back to phone search when the lead has an
    // email. Returning null forces createPerson, which is the safe path.
    console.log(`[lia-assign] findPersonByEmail: no strict-email match for ${email} (phone fallback disabled to prevent contamination)`);
  } catch (e) {
    console.warn("[lia-assign] Person search error:", e);
  }
  return null;
}

/**
 * Create a person in PipeRun. Returns person_id.
 */
async function createPerson(
  apiToken: string,
  lead: Record<string, unknown>
): Promise<number | null> {
  const email = lead.email as string | null;
  const rawNome = (lead.nome || "") as string;
  const nome = sanitizePersonNameForPiperun(rawNome, email);
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = lead.especialidade as string | null;
  const areaAtuacao = lead.area_atuacao as string | null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Hard-gate: NEVER create a Person without email AND without phone ──
  // A Person with no email/phone in PipeRun cannot be deduplicated by future
  // syncs, leading to ghost Persons that contaminate the CRM permanently.
  // Mark the lead as blocked and abort. The retry-cron will burn it down.
  if (!email && !phone) {
    const leadId = lead.id as string | undefined;
    console.warn(`[lia-assign] BLOCKED createPerson: lead ${leadId} has no email AND no phone (nome="${nome}")`);
    if (leadId) {
      try {
        await supa
          .from("lia_attendances")
          .update({
            crm_creation_blocked: true,
            crm_creation_blocked_reason: "missing_identifiers",
          })
          .eq("id", leadId);
        await supa.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "warning",
          error_type: "person_create_blocked_missing_identifiers",
          lead_id: leadId,
          details: { nome, source: lead.source, form_name: lead.form_name },
        });
      } catch (logErr) {
        console.error("[lia-assign] Failed to log missing-identifiers block:", logErr);
      }
    }
    return null;
  }

  // ── Debounce: refuse to create a duplicate Person for the same normalized
  // name + same source within 60 seconds. Prevents the Watillas T. Santos
  // class of bug where two parallel invocations create two PipeRun Persons
  // for the same human within the same minute.
  try {
    const normName = String(nome || "").trim().toLowerCase();
    if (normName) {
      const sinceIso = new Date(Date.now() - 60_000).toISOString();
      const { data: recent } = await supa
        .from("lia_attendances")
        .select("id, pessoa_piperun_id, created_at")
        .ilike("nome", normName)
        .eq("source", String(lead.source || ""))
        .not("pessoa_piperun_id", "is", null)
        .gte("created_at", sinceIso)
        .neq("id", (lead.id as string) || "00000000-0000-0000-0000-000000000000")
        .limit(1)
        .maybeSingle();
      if (recent?.pessoa_piperun_id) {
        console.warn(`[lia-assign] DEBOUNCE: reusing pessoa ${recent.pessoa_piperun_id} for "${nome}" (created ${recent.created_at})`);
        return Number(recent.pessoa_piperun_id);
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Debounce check failed (non-fatal):", e);
  }

  const personPayload: Record<string, unknown> = { name: nome };
  // PipeRun changed contract (~2026-05-12): nested arrays are silently
  // discarded on POST/PUT /persons. Send flat string fields. Keep nested
  // arrays as backup for older API behavior.
  if (email) {
    personPayload.email = email;
    personPayload.emails = [{ email }];
  }
  if (phone) {
    personPayload.cellphone = phone;
    personPayload.phones = [{ phone }];
  }
  if (especialidade) personPayload.job_title = especialidade;

  // Person origin = FIRST-TOUCH only (frozen). Falls back to current campaign for brand-new leads.
  const firstTouchOrigin = (lead.origem_primeiro_contato || lead.origem_campanha || lead.form_name) as string | null;
  if (firstTouchOrigin) {
    const personOriginId = await resolveOriginId(apiToken, firstTouchOrigin);
    if (personOriginId) personPayload.origin_id = personOriginId;
  }

  // Include Pessoa custom fields
  // NOTE: Pessoa custom field IDs 674001/674002 are rejected by Piperun (422). Disabled.
  // Area/Especialidade are persisted at the Deal level via mapAttendanceToDealCustomFields.
  void areaAtuacao; void especialidade;
  const personCustomFields: Array<{ custom_field_id: number; value: string }> = [];

  console.log(`[lia-assign] Creating person: ${nome} | origin="${firstTouchOrigin || "(none)"}" | ${personCustomFields.length} custom fields`);

  const attempts: Array<{ attempt: number; name_used: string; status: number; body: unknown }> = [];

  const tryCreate = async (payload: Record<string, unknown>, attemptNum: number): Promise<number | null> => {
    const res = await piperunPost(apiToken, "persons", payload);
    attempts.push({ attempt: attemptNum, name_used: String(payload.name || ""), status: res.status, body: res.data });
    if (res.success && res.data) {
      const personData = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (personData?.id) return Number(personData.id);
    }
    // Retry without custom_fields if 422 about custom fields
    const body = JSON.stringify(res.data || {});
    if (res.status === 422 && /campos customizados|custom_fields/i.test(body) && payload.custom_fields) {
      console.warn("[lia-assign] Stripping custom_fields and retrying same name");
      const { custom_fields: _, ...without } = payload;
      const retryRes = await piperunPost(apiToken, "persons", without);
      attempts.push({ attempt: attemptNum + 0.1, name_used: String(without.name || ""), status: retryRes.status, body: retryRes.data });
      if (retryRes.success && retryRes.data) {
        const personData = (retryRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
        if (personData?.id) return Number(personData.id);
      }
    }
    return null;
  };

  // Attempt 1: full sanitized name
  let id = await tryCreate(personPayload, 1);
  if (id) return id;

  // Attempt 2: fallback to first+last token of original (or email-derived)
  const fallbackName = sanitizePersonNameForPiperun(
    (rawNome.split(/\s+/).filter(Boolean).slice(0, 2).join(" ")) || "",
    email
  );
  if (fallbackName && fallbackName !== nome) {
    console.warn(`[lia-assign] Retrying createPerson with shortened name: "${fallbackName}"`);
    const retryPayload = { ...personPayload, name: fallbackName };
    id = await tryCreate(retryPayload, 2);
    if (id) return id;
  }

  // Attempt 3: bare minimum payload (name + email only)
  if (email) {
    const minimalName = fallbackName || sanitizePersonNameForPiperun("", email);
    console.warn(`[lia-assign] Retrying createPerson with minimal payload, name="${minimalName}"`);
    const minimalPayload: Record<string, unknown> = { name: minimalName, email, emails: [{ email }] };
    id = await tryCreate(minimalPayload, 3);
    if (id) return id;
  }

  // Persist diagnostic — sequential awaits so it always runs
  const lastAttempt = attempts[attempts.length - 1];
  console.warn(`[lia-assign] Failed to create person after ${attempts.length} attempts (last status ${lastAttempt?.status})`);
  try {
    await supa.from("system_health_logs").insert({
      function_name: "smart-ops-lia-assign",
      severity: "error",
      error_type: "piperun_create_person_api_error",
      lead_email: email,
      details: {
        lead_id: lead.id,
        attempts,
        original_name: rawNome,
        sanitized_name: nome,
      },
    });
  } catch (logErr) {
    console.error("[lia-assign] Failed to persist piperun error:", logErr);
  }
  // Stamp the lead's raw_payload for per-lead auditability
  if (lead.id) {
    try {
      const { data: cur } = await supa.from("lia_attendances").select("raw_payload").eq("id", lead.id as string).maybeSingle();
      const rp = (cur?.raw_payload as Record<string, unknown>) || {};
      rp.piperun_last_error = {
        at: new Date().toISOString(),
        attempts,
        original_name: rawNome,
        sanitized_name: nome,
      };
      await supa.from("lia_attendances").update({ raw_payload: rp }).eq("id", lead.id as string);
    } catch (e) {
      console.warn("[lia-assign] Failed to stamp piperun_last_error:", e);
    }
  }
  return null;
}

/**
 * Update existing person fields (job_title, phones, custom_fields).
 */
async function updatePersonFields(
  apiToken: string,
  personId: number,
  lead: Record<string, unknown>
): Promise<void> {
  const rawNome = (lead.nome || "") as string;
  // Don't send corrupted/junk names to PipeRun
  const nome = cleanPersonName(rawNome) || (lead.email as string) || "";
  const email = lead.email as string | null;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = (lead.especialidade as string | null) || null;
  const areaAtuacao = (lead.area_atuacao as string | null) || null;
  const pessoaCargo = (lead.pessoa_cargo as string | null) || null;

  // job_title cascade: especialidade > area_atuacao > pessoa_cargo
  const jobTitle = especialidade || areaAtuacao || pessoaCargo || null;

  // Build payload with standard fields + extended Person fields.
  // Always re-publish emails[]/phones[] — Piperun does NOT auto-fill them when
  // a Person is created via the native Meta Lead Ads integration, so the card
  // stays empty until we backfill from the CDP.
  const updatePayload: Record<string, unknown> = {};
  if (nome && nome !== (lead.email as string)) updatePayload.name = nome;
  // TLD guard: strip emails with invalid TLDs (".TYPO", ".local", typos like
  // ".gmil"). PipeRun silently rejects them, leaving the Person card empty.
  const { isValidEmailTld: _isValidTld } = await import("../_shared/piperun-person-resolver.ts");
  if (email && !isFakeEmail(email) && _isValidTld(email)) {
    updatePayload.email = email;
    updatePayload.emails = [{ email }];
  } else if (email && !isFakeEmail(email)) {
    console.warn(`[lia-assign] SKIP email PUT — invalid TLD: ${email}`);
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      await supa.from("system_health_logs").insert({
        function_name: "smart-ops-lia-assign",
        severity: "warning",
        error_type: "lead_email_invalid_tld_skipped",
        lead_id: lead.id,
        lead_email: email,
        details: { person_id: personId, stage: "updatePersonFields" },
      });
    } catch {}
  }
  if (phone) {
    updatePayload.cellphone = phone;
    updatePayload.phones = [{ phone }];
  }
  if (jobTitle) updatePayload.job_title = jobTitle;

  const cpf = lead.pessoa_cpf as string | null;
  if (cpf) updatePayload.cpf = cpf;
  const birth = lead.pessoa_nascimento as string | null;
  if (birth) updatePayload.birth_date = birth;
  const gender = lead.pessoa_genero as string | null;
  if (gender) updatePayload.gender = gender;
  const linkedin = lead.pessoa_linkedin as string | null;
  if (linkedin) updatePayload.linkedin = linkedin;
  const facebook = lead.pessoa_facebook as string | null;
  if (facebook) updatePayload.facebook = facebook;
  const observation = lead.pessoa_observation as string | null;
  if (observation) updatePayload.observation = observation;

  // Pessoa custom field IDs 674001/674002 are rejected by Piperun. Persisted at Deal level only.

  if (Object.keys(updatePayload).length === 0) return;

  console.log(`[lia-assign] Updating person ${personId}: ${JSON.stringify(updatePayload).slice(0, 300)}`);
  const res = await piperunPut(apiToken, `persons/${personId}`, updatePayload);
  console.log(`[lia-assign] Person ${personId} update: ${res.success} (${res.status})`);
  // Fallback: if PUT failed (often due to ONE problematic field rejected by
  // Piperun), retry with the bare-minimum identity payload so the card at
  // least keeps email + phone visible.
  if (!res.success && (updatePayload.emails || updatePayload.phones)) {
    const minimal: Record<string, unknown> = {};
    if (updatePayload.emails) {
      minimal.email = updatePayload.email;
      minimal.emails = updatePayload.emails;
    }
    if (updatePayload.phones) {
      minimal.cellphone = updatePayload.cellphone;
      minimal.phones = updatePayload.phones;
    }
    if (updatePayload.name) minimal.name = updatePayload.name;
    const retryRes = await piperunPut(apiToken, `persons/${personId}`, minimal);
    console.log(`[lia-assign] Person ${personId} minimal retry: ${retryRes.success} (${retryRes.status})`);
  }
  // Audit log: contact published. Lets retry-cron safety-net detect leads
  // whose Person card was never refreshed with emails[]/phones[].
  if (res.success && (updatePayload.emails || updatePayload.phones)) {
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      await supa.from("system_health_logs").insert({
        function_name: "smart-ops-lia-assign",
        severity: "info",
        error_type: "piperun_person_contact_published",
        lead_id: lead.id,
        lead_email: email,
        details: {
          person_id: personId,
          status: res.status,
          published_email: Boolean(updatePayload.emails),
          published_phone: Boolean(updatePayload.phones),
        },
      });
    } catch {}
  }
  // empty-person guard removed: GET /persons/{id} returns empty arrays even
  // for valid persons (PipeRun API quirk). POST/PUT do persist contacts.
}

/**
 * Find or create company for a person.
 * If person has company_id, return it. Otherwise create company and link to person.
 */
async function findOrCreateCompany(
  apiToken: string,
  personId: number,
  existingCompanyId: number | null,
  lead: Record<string, unknown>
): Promise<number | null> {
  const nome = cleanPersonName(lead.nome as string) || (lead.email as string) || "Empresa Lead";
  const email = lead.email as string | null;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;

  // Extra empresa data from lead
  const cnpj = lead.empresa_cnpj as string | null;
  const razaoSocial = lead.empresa_razao_social as string | null;
  const segmento = lead.empresa_segmento as string | null;
  const website = lead.empresa_website as string | null;
  const empresaEmail = (lead.empresa_email as string | null) || (email && !isFakeEmail(email) ? email : null);
  const empresaPhone = (lead.empresa_telefone as string | null) || phone;
  const empresaCidade = (lead.empresa_cidade as string | null) || (lead.cidade as string | null);
  const empresaUf = (lead.empresa_uf as string | null) || (lead.uf as string | null);

  const buildCompanyPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    const p: Record<string, unknown> = { name: razaoSocial || (lead.empresa_nome as string | null) || nome };
    if (empresaEmail) p.emails = [{ email: empresaEmail }];
    if (empresaPhone) p.phones = [{ phone: empresaPhone }];
    if (cnpj) p.cnpj = cnpj;
    if (segmento) p.segment = segmento;
    if (website) p.website = website;
    if (empresaCidade) p.city = empresaCidade;
    if (empresaUf) p.state = empresaUf;
    return { ...p, ...overrides };
  };

  // Already has company → update it with complete data
  if (existingCompanyId) {
    console.log(`[lia-assign] Person ${personId} already has company ${existingCompanyId}, enriching data`);
    const enrichPayload = buildCompanyPayload();
    const enrichRes = await piperunPut(apiToken, `companies/${existingCompanyId}`, enrichPayload);
    console.log(`[lia-assign] Company ${existingCompanyId} enriched: ${enrichRes.success} (${enrichRes.status})`);
    return existingCompanyId;
  }

  // Create company with complete data
  const companyPayload = buildCompanyPayload();

  console.log(`[lia-assign] Creating company for person ${personId}: ${nome}`);
  const createRes = await piperunPost(apiToken, "companies", companyPayload);
  const companyId = ((createRes.data as Record<string, unknown>)?.data as Record<string, unknown>)?.id;

  if (companyId) {
    // Link company to person
    await piperunPut(apiToken, `persons/${personId}`, { company_id: Number(companyId) });
    console.log(`[lia-assign] Company ${companyId} created and linked to person ${personId}`);
    return Number(companyId);
  }

  console.warn(`[lia-assign] Failed to create company (${createRes.status})`);
  return null;
}

/**
 * Fetch company data from PipeRun to enrich lia_attendances.
 */
async function fetchCompanyData(
  apiToken: string,
  companyId: number
): Promise<Record<string, unknown> | null> {
  try {
    const res = await piperunGet(apiToken, `companies/${companyId}`, {});
    if (res.success && res.data) {
      const companyData = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (companyData) {
        console.log(`[lia-assign] Company ${companyId} fetched: ${companyData.name || "?"}`);
        return companyData;
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Error fetching company data:", e);
  }
  return null;
}

/**
 * Fetch all non-deleted deals for a person from PipeRun.
 */
async function findPersonDeals(
  apiToken: string,
  personId: number
): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await piperunGet(apiToken, "deals", { person_id: personId, show: 50 });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items) {
        // Filter out deleted deals
        return items.filter((d) => d.deleted !== 1 && d.deleted !== true);
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Error fetching person deals:", e);
  }
  return [];
}

/**
 * Update an existing deal (owner, custom fields, note).
 */
/**
 * Update an existing deal (owner, custom fields, note).
 * Pass ownerId=null to skip owner change (golden rule: open Vendas deals).
 */
async function updateExistingDeal(
  apiToken: string,
  dealId: number,
  ownerId: number | null,
  customFields: Array<{ custom_field_id: number; value: string }>,
  lead: Record<string, unknown>,
  companyId: number | null | undefined,
  supabase: ReturnType<typeof createClient>,
  formResponses?: Array<{ label?: string; value?: unknown }>
): Promise<void> {
  const formOriginId = await resolveOriginId(apiToken, lead.form_name as string | null);
  const cfPayload = customFieldsToDealPayload(customFields);
  const updatePayload: Record<string, unknown> = {
    origin_id: formOriginId,
  };
  if (cfPayload.length > 0) updatePayload.custom_fields = cfPayload;
  if (ownerId !== null) updatePayload.owner_id = ownerId;
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Updating deal ${dealId}: owner=${ownerId ?? "PRESERVED"}, company=${companyId || "none"}`, JSON.stringify(updatePayload).slice(0, 500));
  const updateRes = await piperunPut(apiToken, `deals/${dealId}`, updatePayload);
  console.log(`[lia-assign] Deal update: ${updateRes.success} (${updateRes.status})${!updateRes.success ? " body=" + JSON.stringify(updateRes.data).slice(0, 400) : ""}`);
  // Persist successfully sent custom fields locally for audit / dedupe
  if (updateRes.success && cfPayload.length > 0) {
    try {
      await supabase
        .from("lia_attendances")
        .update({ piperun_custom_fields: customFields })
        .eq("id", lead.id as string);
    } catch (e) {
      console.warn("[lia-assign] Failed to persist piperun_custom_fields snapshot:", e);
    }
  }

  // Add structured HTML note for PipeRun
  const noteText = await buildDealNoteHTML(lead, supabase, formResponses);
  await addDealNote(apiToken, dealId, noteText);
}

/**
 * Move a deal from Estagnados to Funil de Vendas.
 */
async function moveDealToVendas(
  apiToken: string,
  dealId: number,
  ownerId: number,
  stageId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  lead: Record<string, unknown>,
  companyId: number | null | undefined,
  supabase: ReturnType<typeof createClient>,
  formResponses?: Array<{ label?: string; value?: unknown }>
): Promise<void> {
  const formOriginId = await resolveOriginId(apiToken, lead.form_name as string | null);
  const cfPayload = customFieldsToDealPayload(customFields);
  const updatePayload: Record<string, unknown> = {
    pipeline_id: PIPELINES.VENDAS,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: formOriginId,
    freezed: 0,
  };
  if (cfPayload.length > 0) updatePayload.custom_fields = cfPayload;
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Moving deal ${dealId} from Estagnados → Vendas, owner=${ownerId}`);
  const updateRes = await piperunPut(apiToken, `deals/${dealId}`, updatePayload);
  console.log(`[lia-assign] Deal move: ${updateRes.success} (${updateRes.status})`);

  // Add structured reactivation note (HTML)
  const reactivationNote = await buildDealNoteHTML(lead, supabase, formResponses);
  const noteText = `<b>🔄 [Dra. L.I.A.] Deal reativado do funil Estagnados → Funil de Vendas</b><br><br>${reactivationNote}`;
  await addDealNote(apiToken, dealId, noteText);
}

/**
 * Create a new deal in the Vendas pipeline.
 */
async function createNewDeal(
  apiToken: string,
  personId: number,
  companyId: number | null,
  lead: Record<string, unknown>,
  pipelineId: number,
  stageId: number,
  ownerId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  email: string,
  supabase: ReturnType<typeof createClient>,
  formResponses?: Array<{ label?: string; value?: unknown }>
): Promise<string | null> {
  const formOriginId = await resolveOriginId(apiToken, lead.form_name as string | null);

  const dealPayload: Record<string, unknown> = {
    title: cleanPersonName(lead.nome as string) || email,
    pipeline_id: pipelineId,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: formOriginId,
    reference: email,
    person_id: personId,
    deleted: 0,
  };

  if (companyId) dealPayload.company_id = companyId;

  console.log(`[lia-assign] Creating deal: person=${personId}, company=${companyId}, pipeline=${pipelineId}, owner=${ownerId}`);
  const createRes = await piperunPost(apiToken, "deals", dealPayload);
  console.log(`[lia-assign] Deal create: ${createRes.success} (${createRes.status})${!createRes.success ? " body=" + JSON.stringify(createRes.data).slice(0, 500) : ""}`);

  if (createRes.success && createRes.data) {
    const dealData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (dealData?.id) {
      const dealId = String(dealData.id);
      const cfPayload = customFieldsToDealPayload(customFields);
      if (cfPayload.length > 0 || companyId) {
        const enrichPayload: Record<string, unknown> = { origin_id: formOriginId };
        if (cfPayload.length > 0) enrichPayload.custom_fields = cfPayload;
        if (companyId) enrichPayload.company_id = companyId;
        console.log(`[lia-assign] Enriching new deal ${dealId} with ${cfPayload.length} custom fields`);
        const enrichRes = await piperunPut(apiToken, `deals/${dealId}`, enrichPayload);
        console.log(`[lia-assign] New deal custom-field PUT: ${enrichRes.success} (${enrichRes.status})${!enrichRes.success ? " body=" + JSON.stringify(enrichRes.data).slice(0, 500) : ""}`);
      }
      // Add structured HTML note for PipeRun
      const noteText = await buildDealNoteHTML(lead, supabase, formResponses);
      await addDealNote(apiToken, Number(dealId), noteText);
      return dealId;
    }
  }
  return null;
}

// ── Origin cache: form_name → origin_id ──
const originCache = new Map<string, number>();

async function resolveOriginId(apiToken: string, formName: string | null): Promise<number> {
  if (!formName) return ORIGINS.DRA_LIA.id;
  
  const cacheKey = formName.trim();
  if (originCache.has(cacheKey)) return originCache.get(cacheKey)!;

  try {
    // Search existing origins
    const searchRes = await piperunGet(apiToken, "origins", { name: cacheKey, show: 5 });
    if (searchRes.success && searchRes.data) {
      const items = (searchRes.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      const exact = items?.find(o => String(o.name).trim().toLowerCase() === cacheKey.toLowerCase());
      if (exact?.id) {
        const id = Number(exact.id);
        originCache.set(cacheKey, id);
        console.log(`[lia-assign] Origin found: "${cacheKey}" → ${id}`);
        return id;
      }
    }
    // Create new origin
    console.log(`[lia-assign] Creating origin: "${cacheKey}" (search returned no match)`);
    const createRes = await piperunPost(apiToken, "origins", {
      name: cacheKey,
      active: true,
      description: `Formulário: ${cacheKey} (criado via Dra. L.I.A.)`,
    });
    console.log(`[lia-assign] Origin create response: ${createRes.success} (${createRes.status})`, JSON.stringify(createRes.data).slice(0, 300));
    if (createRes.success && createRes.data) {
      const created = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (created?.id) {
        const id = Number(created.id);
        originCache.set(cacheKey, id);
        console.log(`[lia-assign] Origin created: "${cacheKey}" → ${id}`);
        return id;
      }
    }
    console.warn(`[lia-assign] Could not resolve/create origin for "${cacheKey}", falling back to Dra. L.I.A.`);
  } catch (e) {
    console.warn("[lia-assign] Origin resolution error:", e);
  }
  return ORIGINS.DRA_LIA.id;
}

// ─── Team Member Selection ───

interface TeamMember {
  id: string;
  nome_completo: string;
  piperun_owner_id: number;
}

/**
 * Pick a random active vendedor, prioritizing those with WaLeads API key.
 */
async function pickRandomActiveVendedor(
  supabase: ReturnType<typeof createClient>
): Promise<TeamMember> {
  // Priority: vendedores with waleads_api_key configured
  const { data: waMembers } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor")
    .not("waleads_api_key", "is", null);

  if (waMembers && waMembers.length > 0) {
    const idx = Math.floor(Math.random() * waMembers.length);
    console.log(`[lia-assign] Selected WaLeads-enabled vendedor: ${waMembers[idx].nome_completo}`);
    return waMembers[idx] as TeamMember;
  }

  // Fallback: any active vendedor
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

// ─── AI Message Generation ───

const LIA_SOURCES = ["dra-lia", "whatsapp_lia", "handoff_lia"];
const BLOCKED_SELLER_NAMES = ["Celular", "Comercial", "Vendas", "Smart Dent"];

// ── Owners that NEVER receive leads as vendedores ──
// Patricia Gastaldi (47675) usa o nº dela só para LIA/Copilot.
// Qualquer lead roteado para ela vai para o Distribuidor de Leads.
const BLOCKED_SELLER_OWNER_IDS = new Set<number>([47675]);
const BLOCKED_SELLER_NAME_PATTERNS: RegExp[] = [/patric[ai]\s+(gastaldi|silva)/i];

function isBlockedSeller(opts: { ownerId?: number | null; ownerName?: string | null }): boolean {
  const { ownerId, ownerName } = opts;
  if (ownerId != null && BLOCKED_SELLER_OWNER_IDS.has(Number(ownerId))) return true;
  if (ownerName) {
    const n = String(ownerName).trim();
    if (BLOCKED_SELLER_NAME_PATTERNS.some((re) => re.test(n))) return true;
  }
  return false;
}

/**
 * Generate AI greeting from seller → lead using conversation context.
 */
async function generateAILeadGreeting(
  lead: Record<string, unknown>,
  sellerName: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[lia-assign] LOVABLE_API_KEY not set, using static greeting");
    return buildStaticGreeting(lead, sellerName);
  }

  const firstName = sellerName.split(" ")[0];
  if (BLOCKED_SELLER_NAMES.some(b => firstName.toLowerCase() === b.toLowerCase())) {
    return buildStaticGreeting(lead, "Equipe Smart Dent");
  }

  const leadName = (lead.nome as string || "").split(" ")[0] || "doutor(a)";
  const resumo = lead.resumo_historico_ia as string || "";
  const produto = lead.produto_interesse as string || "";

  const prompt = `Você é ${firstName}, consultor(a) de odontologia digital da Smart Dent.
Gere uma saudação curta (3-4 linhas) para o WhatsApp do lead ${leadName}.
O lead conversou com nossa assistente virtual Dra. L.I.A. sobre: ${produto || "produtos de odontologia digital"}.
${resumo ? `Resumo da conversa:\n${resumo.slice(0, 500)}` : ""}

Regras:
- Seja profissional mas acolhedor
- Mencione que viu a conversa com a Dra. L.I.A.
- Não use emojis excessivos (máx 2)
- NÃO inclua links
- Assine como ${firstName} da Smart Dent`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const data = await res.json();
    const usage = extractUsage(data);
    await logAIUsage({
      functionName: "smart-ops-lia-assign",
      actionLabel: "generate-greeting",
      model: "google/gemini-2.5-flash-lite",
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    });
    const content = data.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 20) {
      console.log(`[lia-assign] AI greeting generated (${content.length} chars)`);
      return content;
    }
  } catch (e) {
    console.warn("[lia-assign] AI greeting failed, using static:", e);
  }
  return buildStaticGreeting(lead, sellerName);
}

function buildStaticGreeting(lead: Record<string, unknown>, sellerName: string): string {
  const leadName = (lead.nome as string || "").split(" ")[0] || "doutor(a)";
  const firstName = sellerName.split(" ")[0];
  return `Olá ${leadName}! Sou ${firstName} da Smart Dent 🦷\nVi que você conversou com nossa Dra. L.I.A. e gostaria de continuar te ajudando pessoalmente.\nComo posso te auxiliar?`;
}

/**
 * Build structured seller notification with fixed template + AI for HISTÓRICO/OPORTUNIDADE.
 */
async function buildSellerNotification(
  lead: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const urgencyEmoji = (lead.urgency_level === "alta") ? "🔴" : (lead.urgency_level === "media") ? "🟡" : "🟢";

  // Fetch last user message via leads bridge
  let lastQuestion = "";
  try {
    const { data: leadsRec } = await supabase
      .from("leads")
      .select("id")
      .eq("email", lead.email as string)
      .maybeSingle();
    if (leadsRec?.id) {
      const { data: lastMsg } = await supabase
        .from("agent_interactions")
        .select("user_message")
        .eq("lead_id", leadsRec.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg?.user_message) lastQuestion = String(lastMsg.user_message).slice(0, 200);
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to fetch last question:", e);
  }

  // Enrich with real deal history (current owner, distinct owners, first contact date)
  const dealsCtx = await fetchDealsContext(supabase, lead);

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(lead, dealsCtx);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[lia-assign] AI historico/oportunidade failed:", e);
  }

  // Fallback static texts
  if (!historico) {
    historico = buildHistoricoFallback(lead, dealsCtx);
  }
  if (!oportunidade) {
    const parts: string[] = [];
    if (lead.software_cad) parts.push(`Possui software CAD (${lead.software_cad})`);
    if (lead.tem_impressora && lead.tem_impressora !== "nao") parts.push(`Impressora: ${lead.impressora_modelo || lead.tem_impressora}`);
    if (lead.tem_scanner && lead.tem_scanner !== "nao") parts.push(`Scanner: ${lead.tem_scanner}`);
    if (lead.urgency_level) parts.push(`Urgência ${lead.urgency_level}`);
    if (lead.primary_motivation) parts.push(`motivado por ${lead.primary_motivation}`);
    if (lead.objection_risk) parts.push(`Risco de objeção: ${lead.objection_risk}`);
    oportunidade = parts.length > 0 ? parts.join(". ") + "." : "Sem dados suficientes.";
  }

  // Build template
  const lines: string[] = [
    `🤖 *Novo Lead atribuído - Dra. L.I.A.*`,
    ``,
    `👤 Lead: ${lead.nome || "N/A"}`,
    `📧 Email: ${lead.email || "N/A"}`,
    `📱 Tel: ${phone || "N/A"}`,
    ...buildOriginLines(lead, "wa"),
    `🦷 Área de atuação: ${lead.area_atuacao || "N/A"}`,
    `🦷 Especialidade: ${lead.especialidade || "N/A"}`,
    `🎯 Interesse: ${lead.produto_interesse || "N/A"}`,
    `🌡️ Temp: ${lead.temperatura_lead || lead.urgency_level || "N/A"}`,
    `🔗 PipeRun: ${lead.piperun_link || "N/A"}`,
    `💬 Última pergunta do lead: ${lastQuestion || "N/A"}`,
    `🏷️ Contexto: ${lead.rota_inicial_lia || "N/A"}`,
    `📍 Etapa CRM: ${lead.ultima_etapa_comercial || "N/A"}`,
    ``,
    `*HISTÓRICO:* ${historico}`,
    `*OPORTUNIDADE:* ${oportunidade}`,
    ``,
    `🧠 *Análise Cognitiva:*`,
    `Confiança: ${lead.confidence_score_analysis || 0}%`,
    `Estágio: ${lead.lead_stage_detected || "N/A"}`,
    `Urgência: ${urgencyEmoji} ${lead.urgency_level || "N/A"}`,
    `Timeline: ${lead.interest_timeline || "N/A"}`,
    `Perfil: ${lead.psychological_profile || "N/A"}`,
    `Motivação: ${lead.primary_motivation || "N/A"}`,
    `Risco objeção: ${lead.objection_risk || "N/A"}`,
    `Abordagem: ${lead.recommended_approach || "N/A"}`,
  ];

  return lines.join("\n");
}

/**
 * Build HTML-formatted deal note for PipeRun (NOT for WhatsApp).
 * Includes deals count and form responses when available.
 */
async function buildDealNoteHTML(
  lead: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  formResponses?: Array<{ label?: string; value?: unknown }>
): Promise<string> {
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const urgencyEmoji = (lead.urgency_level === "alta") ? "🔴" : (lead.urgency_level === "media") ? "🟡" : "🟢";

  // Fetch last user message
  let lastQuestion = "";
  try {
    const { data: leadsRec } = await supabase
      .from("leads")
      .select("id")
      .eq("email", lead.email as string)
      .maybeSingle();
    if (leadsRec?.id) {
      const { data: lastMsg } = await supabase
        .from("agent_interactions")
        .select("user_message")
        .eq("lead_id", leadsRec.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg?.user_message) lastQuestion = String(lastMsg.user_message).slice(0, 200);
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to fetch last question:", e);
  }

  // Enrich with real deal history (current owner, distinct owners, first contact date)
  const dealsCtx = await fetchDealsContext(supabase, lead);

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(lead, dealsCtx);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[lia-assign] AI historico/oportunidade failed:", e);
  }

  // Fallback static texts
  if (!historico) {
    historico = buildHistoricoFallback(lead, dealsCtx);
  }
  if (!oportunidade) {
    const parts: string[] = [];
    if (lead.software_cad) parts.push(`Possui software CAD (${lead.software_cad})`);
    if (lead.tem_impressora && lead.tem_impressora !== "nao") parts.push(`Impressora: ${lead.impressora_modelo || lead.tem_impressora}`);
    if (lead.tem_scanner && lead.tem_scanner !== "nao") parts.push(`Scanner: ${lead.tem_scanner}`);
    if (lead.urgency_level) parts.push(`Urgência ${lead.urgency_level}`);
    if (lead.primary_motivation) parts.push(`motivado por ${lead.primary_motivation}`);
    if (lead.objection_risk) parts.push(`Risco de objeção: ${lead.objection_risk}`);
    oportunidade = parts.length > 0 ? parts.join(". ") + "." : "Sem dados suficientes.";
  }

  // Fetch deals count
  let dealsCountText = "";
  try {
    const { count } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id as string);
    if (count !== null && count > 0) {
      dealsCountText = `<b>📊 Deals existentes:</b> ${count} deal(s) no histórico<br>`;
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to fetch deals count:", e);
  }

  // Fetch form responses — prefer inline (from ingest-lead payload) over DB query to avoid race condition
  let formResponsesHTML = "";
  try {
    let responses: Array<{ label?: string; field_label?: string; value?: unknown }> = [];
    if (formResponses && Array.isArray(formResponses) && formResponses.length > 0) {
      responses = formResponses;
      console.log(`[lia-assign] Using ${responses.length} inline form responses`);
    } else {
      // Fallback: query DB (may still be empty due to race condition)
      const { data: dbResponses } = await supabase
        .from("smartops_form_field_responses")
        .select("value, field_label")
        .eq("lead_id", lead.id as string);
      if (dbResponses && dbResponses.length > 0) {
        responses = dbResponses;
        console.log(`[lia-assign] Using ${responses.length} DB form responses`);
      }
    }
    // Fallback 3: use form_data JSONB from lead record
    if (responses.length === 0 && lead.form_data && typeof lead.form_data === "object") {
      try {
        const formDataObj = lead.form_data as Record<string, { responses?: Array<{ label?: string; value?: unknown }>; raw_fields?: Record<string, unknown> }>;
        for (const formEntry of Object.values(formDataObj)) {
          if (formEntry?.responses && Array.isArray(formEntry.responses) && formEntry.responses.length > 0) {
            responses = formEntry.responses;
            console.log(`[lia-assign] Using ${responses.length} form_data JSONB responses`);
            break;
          }
          if (formEntry?.raw_fields && Object.keys(formEntry.raw_fields).length > 0) {
            responses = Object.entries(formEntry.raw_fields).map(([k, v]) => ({ label: k, value: v }));
            console.log(`[lia-assign] Using ${responses.length} form_data raw_fields as responses`);
            break;
          }
        }
      } catch (fdErr) {
        console.warn("[lia-assign] Failed to parse form_data:", fdErr);
      }
    }

    if (responses.length > 0) {
      const items = responses
        .filter((r) => r.value)
        .map((r) => `• <b>${r.label || r.field_label || "Campo"}:</b> ${r.value}`)
        .join("<br>");
      if (items) {
        formResponsesHTML = `<hr><b>📝 Respostas do Formulário</b><br><br>${items}<br>`;
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to fetch form responses:", e);
  }

  // Build HTML template
  const html = [
    `<b>🤖 Novo Lead atribuído - Dra. L.I.A.</b><br><br>`,
    `<b>👤 Lead:</b> ${lead.nome || "N/A"}<br>`,
    `<b>📧 Email:</b> ${lead.email || "N/A"}<br>`,
    `<b>📱 Tel:</b> ${phone || "N/A"}<br>`,
    ...buildOriginLines(lead, "html"),
    `<b>🦷 Área de atuação:</b> ${lead.area_atuacao || "N/A"}<br>`,
    `<b>🦷 Especialidade:</b> ${lead.especialidade || "N/A"}<br>`,
    `<b>🎯 Interesse:</b> ${lead.produto_interesse || "N/A"}<br>`,
    `<b>🌡️ Temp:</b> ${lead.temperatura_lead || lead.urgency_level || "N/A"}<br>`,
    `<b>🔗 PipeRun:</b> ${lead.piperun_link || "N/A"}<br>`,
    `<b>💬 Última pergunta:</b> ${lastQuestion || "N/A"}<br>`,
    `<b>🏷️ Contexto:</b> ${lead.rota_inicial_lia || "N/A"}<br>`,
    `<b>📍 Etapa CRM:</b> ${lead.ultima_etapa_comercial || "N/A"}<br>`,
    dealsCountText,
    `<hr>`,
    `<b>HISTÓRICO:</b> ${historico}<br>`,
    `<b>OPORTUNIDADE:</b> ${oportunidade}<br>`,
    `<hr>`,
    `<b>🧠 Análise Cognitiva:</b><br>`,
    `<b>Confiança:</b> ${lead.confidence_score_analysis || 0}%<br>`,
    `<b>Estágio:</b> ${lead.lead_stage_detected || "N/A"}<br>`,
    `<b>Urgência:</b> ${urgencyEmoji} ${lead.urgency_level || "N/A"}<br>`,
    `<b>Timeline:</b> ${lead.interest_timeline || "N/A"}<br>`,
    `<b>Perfil:</b> ${lead.psychological_profile || "N/A"}<br>`,
    `<b>Motivação:</b> ${lead.primary_motivation || "N/A"}<br>`,
    `<b>Risco objeção:</b> ${lead.objection_risk || "N/A"}<br>`,
    `<b>Abordagem:</b> ${lead.recommended_approach || "N/A"}<br>`,
    formResponsesHTML,
  ].join("");

  return html;
}

function formatDate(val: unknown): string {
  if (!val) return "N/A";
  try {
    const d = new Date(String(val));
    return d.toLocaleDateString("pt-BR");
  } catch { return String(val).slice(0, 10); }
}

/**
 * AI generates ONLY historico + oportunidade as JSON.
 */
function buildHistoricoFallback(
  lead: Record<string, unknown>,
  dealsCtx: DealsContext
): string {
  const parts: string[] = [];
  const fc = dealsCtx.firstContactAt || (lead.data_primeiro_contato || lead.created_at) as string | undefined;
  if (fc) parts.push(`Primeiro contato em ${formatDate(fc)}`);
  if (lead.lojaintegrada_cliente_id) parts.push(`Cliente e-commerce (ID: ${lead.lojaintegrada_cliente_id})`);
  else parts.push("Sem compras anteriores no e-commerce");
  if (lead.astron_user_id) parts.push(`Cursos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0} concluídos`);
  else parts.push("Sem cadastro na plataforma de cursos");
  if (dealsCtx.currentOwner) parts.push(`Vendedor atual: ${dealsCtx.currentOwner}`);
  if (dealsCtx.distinctOwners.length > 1) parts.push(`Owners no histórico: ${dealsCtx.distinctOwners.join(", ")}`);
  else if (!dealsCtx.currentOwner && lead.proprietario_lead_crm) parts.push(`Vendedor: ${lead.proprietario_lead_crm}`);
  else if (!dealsCtx.currentOwner) parts.push("Nunca teve contato com vendedor");
  if (dealsCtx.total > 0) parts.push(`${dealsCtx.total} deal(s) (${dealsCtx.ganhos} ganhos / ${dealsCtx.perdidos} perdidos / ${dealsCtx.abertos} abertos)`);
  return parts.join(". ") + ".";
}

function formatDealsBlockLocal(ctx: DealsContext): string {
  if (ctx.total === 0) return "Sem deals registrados no histórico.";
  const header = `Total de deals: ${ctx.total} (${ctx.ganhos} ganhos · ${ctx.perdidos} perdidos · ${ctx.abertos} abertos)`;
  const owners = ctx.distinctOwners.length > 0
    ? `Owners distintos no histórico (cronológico): ${ctx.distinctOwners.join(" → ")}`
    : "Owners distintos no histórico: nenhum registrado";
  const current = `Vendedor atual: ${ctx.currentOwner || "sem owner"}`;
  const recent = ctx.recent.map((d) => {
    const date = d.piperun_created_at ? formatDate(d.piperun_created_at) : "—";
    return `  - #${d.piperun_deal_id || "?"} — ${d.pipeline_name || "—"} / ${d.stage_name || "—"} — ${d.status || "—"} — ${d.owner_name || "—"} — ${date}`;
  }).join("\n");
  return `${header}\n${current}\n${owners}\nDeals (mais recente primeiro):\n${recent}`;
}

function stripUnknownSellerNamesLocal(text: string, allowedOwners: string[], leadName: string): string {
  if (!text) return text;
  const allowed = new Set(allowedOwners.flatMap((o) => o.split(/\s+/)).map((t) => t.toLowerCase()));
  const leadFirst = (leadName || "").split(/\s+/)[0]?.toLowerCase() || "";
  const pattern = /\b(vendedor[a]?|sra\.?|sr\.?|dra?\.?)\s+([A-ZÀ-Ý][\wÀ-ÿ]+)(?:\s+([A-ZÀ-Ý][\wÀ-ÿ]+))?/g;
  return text.replace(pattern, (match, _title, first: string, last?: string) => {
    const f = first.toLowerCase();
    const l = (last || "").toLowerCase();
    if (f === leadFirst) return match;
    if (allowed.has(f) || (l && allowed.has(l))) return match;
    return "vendedor anterior";
  });
}

async function generateHistoricoOportunidade(
  lead: Record<string, unknown>,
  dealsCtx?: DealsContext
): Promise<{ historico: string; oportunidade: string }> {
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) return { historico: "", oportunidade: "" };

  // Enrich prompt with cognitive analysis for deeper tactical briefing
  const cognitive = lead.cognitive_analysis as Record<string, unknown> | null;
  const cognitiveContext = cognitive
    ? `\nAnálise Cognitiva: Perfil=${cognitive.psychological_profile || "N/A"}, Motivação=${cognitive.primary_motivation || "N/A"}, Objeção=${cognitive.objection_risk || "N/A"}, Estágio=${cognitive.lead_stage_detected || "N/A"}, Trajetória=${cognitive.stage_trajectory || "N/A"}`
    : "";

  // Enrich prompt with form_data JSONB (catch-all for fields without dedicated columns)
  let formDataContext = "";
  if (lead.form_data && typeof lead.form_data === "object") {
    try {
      const fd = lead.form_data as Record<string, { responses?: Array<{ label?: string; value?: unknown }>; raw_fields?: Record<string, unknown> }>;
      const parts: string[] = [];
      for (const [formName, entry] of Object.entries(fd)) {
        if (entry?.responses && Array.isArray(entry.responses) && entry.responses.length > 0) {
          parts.push(`Formulário "${formName}": ` + entry.responses.map(r => `${r.label || "campo"}=${r.value}`).join(", "));
        } else if (entry?.raw_fields) {
          parts.push(`Formulário "${formName}": ` + Object.entries(entry.raw_fields).map(([k, v]) => `${k}=${v}`).join(", "));
        }
      }
      if (parts.length > 0) formDataContext = `\nRespostas de formulários: ${parts.join(" | ")}`;
    } catch {}
  }

  const dealsBlock = dealsCtx ? formatDealsBlockLocal(dealsCtx) : "Sem dados de deals fornecidos.";
  const firstContactStr = dealsCtx?.firstContactAt
    ? formatDate(dealsCtx.firstContactAt)
    : (lead.data_primeiro_contato || lead.created_at || "N/A");

  const prompt = `Você é um estrategista comercial sênior. Analise os dados do lead e gere um JSON com 2 campos:
- "historico": 2-3 frases sobre primeiro contato, compras e-commerce, cursos, vendedores anteriores
- "oportunidade": Briefing tático para o vendedor contendo: (1) equipamentos e software atuais, (2) objeção provável e como contorná-la, (3) abordagem recomendada e prova social relevante, (4) urgência e motivação

DADOS:
Nome: ${lead.nome || "N/A"}
Primeiro contato: ${firstContactStr}
E-commerce ID: ${lead.lojaintegrada_cliente_id || "Sem cadastro"}
Último pedido: ${lead.lojaintegrada_ultimo_pedido_data || "Nunca"} (R$ ${lead.lojaintegrada_ultimo_pedido_valor || "0"})
Cursos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0} concluídos
Último login cursos: ${lead.astron_last_login_at || "Nunca"}
${dealsBlock}
Impressora: ${lead.tem_impressora || "N/A"} ${lead.impressora_modelo || ""}
Scanner: ${lead.tem_scanner || "N/A"}
Software CAD: ${lead.software_cad || "N/A"}
Urgência: ${lead.urgency_level || "N/A"}
Motivação: ${lead.primary_motivation || "N/A"}
Risco objeção: ${lead.objection_risk || "N/A"}
Status: ${lead.status_oportunidade || "N/A"}${cognitiveContext}${formDataContext}

REGRAS OBRIGATÓRIAS:
1. NÃO use o nome do lead no texto — diga "o profissional" ou "o lead"
2. Se um dado é "N/A" ou "Nunca", diga "sem informação disponível"
3. NÃO invente dados que não estejam listados acima
4. Seja TÁTICO e ACIONÁVEL — diga O QUE FAZER, não só o que aconteceu
5. Use APENAS owners listados em "Owners distintos no histórico". NÃO invente nomes de vendedores.
6. Se "Vendedor atual" diferir do mais antigo, mencione explicitamente que houve troca de owner.
7. Use a data exata em "Primeiro contato". NÃO escolha datas intermediárias.

Retorne APENAS JSON válido: {"historico":"...","oportunidade":"..."}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Retorne APENAS JSON válido. Sem markdown. Use EXCLUSIVAMENTE os dados fornecidos. NÃO invente nomes (de vendedores ou outros), datas ou valores que não estejam nos DADOS. Refira-se ao lead como 'o profissional' ou 'o lead', NUNCA use nomes próprios no texto gerado." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`DeepSeek API ${res.status}`);
  const data = await res.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: "smart-ops-lia-assign",
    actionLabel: "generate-briefing-deepseek",
    model: "deepseek-chat",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { historico: "", oportunidade: "" };
  const parsed = JSON.parse(jsonMatch[0]);

  // Sanitize: replace any accidental lead name usage with "o profissional"
  const leadNome = String(lead.nome || "").split(" ")[0];
  if (leadNome.length >= 2) {
    const nameRegex = new RegExp(`\\b${leadNome}\\b`, "gi");
    if (typeof parsed.historico === "string") {
      parsed.historico = parsed.historico.replace(nameRegex, "o profissional");
    }
    if (typeof parsed.oportunidade === "string") {
      parsed.oportunidade = parsed.oportunidade.replace(nameRegex, "o profissional");
    }
  }

  // Hallucination guard: strip seller names not in deal owners allowlist
  const allowed = dealsCtx?.distinctOwners || [];
  if (typeof parsed.historico === "string") {
    parsed.historico = stripUnknownSellerNamesLocal(parsed.historico, allowed, String(lead.nome || ""));
  }
  if (typeof parsed.oportunidade === "string") {
    parsed.oportunidade = stripUnknownSellerNamesLocal(parsed.oportunidade, allowed, String(lead.nome || ""));
  }

  return {
    historico: typeof parsed.historico === "string" ? parsed.historico.slice(0, 500) : "",
    oportunidade: typeof parsed.oportunidade === "string" ? parsed.oportunidade.slice(0, 500) : "",
  };
}

// ─── Outbound Messages (Source-Based) ───

async function sendWaLeadsMessage(
  supabaseUrl: string,
  serviceKey: string,
  teamMemberId: string,
  phone: string,
  message: string,
  leadId: string
): Promise<{ success: boolean; status?: number; response?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/smart-ops-send-waleads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_member_id: teamMemberId,
        phone,
        tipo: "text",
        message,
        lead_id: leadId,
      }),
    });
    const resText = await res.text();
    console.log(`[lia-assign] WaLeads response: status=${res.status} body=${resText.slice(0, 500)}`);
    return { success: res.ok, status: res.status, response: resText.slice(0, 300) };
  } catch (e) {
    console.warn("[lia-assign] WaLeads send error:", e);
    return { success: false, response: String(e) };
  }
}

async function sendTemplateMessage(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  lead: Record<string, unknown>,
  teamMemberId: string,
  phone: string
): Promise<void> {
  try {
    let { data: rules } = await supabase
      .from("cs_automation_rules")
      .select("*")
      .eq("trigger_event", "NOVO_LEAD")
      .eq("ativo", true)
      .eq("waleads_ativo", true);

    if (!rules || rules.length === 0) {
      console.log("[lia-assign] No NOVO_LEAD automation rules found");
      return;
    }

    // Prefer team-specific rules
    const teamRules = rules.filter((r: Record<string, unknown>) => r.team_member_id === teamMemberId);
    if (teamRules.length > 0) rules = teamRules;

    // Match by product interest
    let rule = null;
    const produtoInteresse = lead.produto_interesse as string | null;
    if (produtoInteresse) {
      rule = rules.find((r: Record<string, unknown>) =>
        r.produto_interesse && String(r.produto_interesse).toLowerCase() === produtoInteresse.toLowerCase()
      );
    }
    if (!rule) rule = rules.find((r: Record<string, unknown>) => !r.produto_interesse);
    if (!rule) rule = rules[0];
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
    console.warn("[lia-assign] Template message error:", e);
  }
}

/**
 * Outbound messages: bifurcation by source.
 * LIA sources → AI greeting + AI briefing to seller
 * Form sources → Template message + AI briefing to seller
 */
async function triggerOutboundMessages(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  lead: Record<string, unknown>,
  teamMemberId: string | null,
  teamMemberName: string
) {
  if (!teamMemberId || teamMemberId === "fallback-admin") return;

  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  if (!phone) {
    console.log("[lia-assign] No phone number, skipping outbound messages");
    return;
  }

  try {
    // Fetch team member with WaLeads config
    const { data: member } = await supabase
      .from("team_members")
      .select("id, nome_completo, waleads_api_key, whatsapp_number")
      .eq("id", teamMemberId)
      .single();

    if (!member?.waleads_api_key) {
      console.log(`[lia-assign] Team member ${teamMemberId} has no waleads_api_key, skipping`);
      return;
    }

    const isLiaSource = LIA_SOURCES.includes(lead.source as string);
    const leadId = lead.id as string;

    // ── A. Message seller → lead ──
    if (isLiaSource) {
      console.log("[lia-assign] LIA source → generating AI greeting");
      const aiGreeting = await generateAILeadGreeting(lead, member.nome_completo);
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, phone, aiGreeting, leadId);
    } else {
      console.log("[lia-assign] Non-LIA source → using template message");
      await sendTemplateMessage(supabase, supabaseUrl, serviceKey, lead, member.id, phone);
    }

    // ── B. Structured notification → seller (ALWAYS) ──
    console.log("[lia-assign] Building structured seller notification");
    const briefing = await buildSellerNotification(lead, supabase);
    if (member.whatsapp_number) {
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, member.whatsapp_number, briefing, leadId);
      console.log(`[lia-assign] Seller briefing sent to ${member.nome_completo} (${member.whatsapp_number})`);
    } else {
      console.log(`[lia-assign] No whatsapp_number for ${member.nome_completo}, briefing not sent`);
    }
  } catch (e) {
    console.warn("[lia-assign] Outbound messages error:", e);
  }
}

// ─── §4.5 SDR-CAPTAÇÃO: Reativação de Deal ───

/**
 * Fecha deals abertos no Funil Estagnados como "Perdido" com motivo
 * "reativacao_formulario" e cria um novo deal no Funil de Vendas
 * via Round Robin de vendedores ativos. Não herda o owner anterior.
 */
async function executarReativacaoSdrCaptacao(
  apiToken: string,
  supabase: ReturnType<typeof createClient>,
  lead: Record<string, unknown>,
  formResponses?: Array<{ label?: string; value?: unknown }>
): Promise<boolean> {
  const leadId = lead.id as string;
  const leadEmail = (lead.email as string).trim().toLowerCase();

  // 1. Resolve personId — usa cached se disponível, senão busca no PipeRun
  let personId = lead.pessoa_piperun_id as number | null;
  if (!personId) {
    const person = await findPersonByEmail(apiToken, leadEmail, (lead.telefone_normalized as string | null) ?? (lead.telefone_raw as string | null));
    personId = person?.id ?? null;
  }
  if (!personId) {
    console.warn("[lia-assign] SDR-CAPTAÇÃO reativação: person not found in PipeRun for", leadEmail);
    return false;
  }

  const companyId = (lead.empresa_piperun_id as number | null) ?? null;

  // 2. Busca deals abertos no Funil Estagnados
  const allDeals = await findPersonDeals(apiToken, personId);
  const estagnDeals = allDeals.filter(
    (d) => Number(d.status) === 0 && Number(d.pipeline_id) === PIPELINES.ESTAGNADOS
  );

  if (estagnDeals.length === 0) {
    console.log("[lia-assign] SDR-CAPTAÇÃO reativação: nenhum deal Estagnados encontrado para", leadEmail);
    return false;
  }

  // 3. Fecha cada deal Estagnados como Perdido
  for (const deal of estagnDeals) {
    const res = await piperunPut(apiToken, `deals/${deal.id}`, {
      status: 2,
      lost_reason: "reativacao_formulario",
    });
    console.log(`[lia-assign] SDR-CAPTAÇÃO: deal ${deal.id} fechado como Perdido: ${res.success} (${res.status})`);
  }

  // 4. Fresh Round Robin — NUNCA herda owner anterior
  const newOwner = await pickRandomActiveVendedor(supabase);
  const newOwnerId = newOwner.piperun_owner_id;
  const newOwnerName = newOwner.nome_completo;
  console.log(`[lia-assign] SDR-CAPTAÇÃO reativação: novo owner → ${newOwnerName} (${newOwnerId})`);

  // 5. Cria novo deal no Funil de Vendas
  const customFields = mapAttendanceToDealCustomFields(lead);
  // WHATSAPP custom field is now added inside mapAttendanceToDealCustomFields
  // (uses telefone_normalized || telefone). Keeping a fallback on telefone_raw
  // for legacy rows that only have telefone_raw populated.
  if (!customFields.some((f) => f.custom_field_id === DEAL_CUSTOM_FIELDS.WHATSAPP)) {
    const phone = (lead.telefone_raw) as string | null;
    if (phone) customFields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.WHATSAPP, value: phone });
  }

  const newDealId = await createNewDeal(
    apiToken,
    personId,
    companyId,
    lead,
    PIPELINES.VENDAS,
    STAGES_VENDAS.SEM_CONTATO,
    newOwnerId,
    customFields,
    leadEmail,
    supabase,
    formResponses
  );

  if (!newDealId) {
    console.error("[lia-assign] SDR-CAPTAÇÃO: falha ao criar novo deal para", leadEmail);
    return false;
  }
  console.log(`[lia-assign] SDR-CAPTAÇÃO: novo deal criado: ${newDealId}`);

  // 6. Atualiza lia_attendances com novo owner e deal
  await supabase
    .from("lia_attendances")
    .update({
      proprietario_lead_crm: newOwnerName,
      piperun_id: newDealId,
      piperun_link: `https://app.pipe.run/#/deals/${newDealId}`,
      funil_entrada_crm: "Funil de vendas",
      ultima_etapa_comercial: "sem_contato",
    })
    .eq("id", leadId);

  // 7. Registra evento na timeline
  await supabase.from("lead_activity_log").insert({
    lead_id: leadId,
    event_type: "deal_reativado_via_formulario",
    entity_type: "deal",
    entity_id: newDealId,
    entity_name: "Deal reativado — SDR Captação",
    event_data: {
      label: "Deal reativado via formulário sdr_captacao",
      deals_fechados: estagnDeals.map((d) => String(d.id)),
      novo_deal_id: newDealId,
      novo_owner: newOwnerName,
      motivo_fechamento: "reativacao_formulario",
    },
    source_channel: "form",
    event_timestamp: new Date().toISOString(),
  });

  return true;
}

// ─── Main Handler ───

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
    const body = await req.json();
    const { email, lead_id, force, trigger, form_responses: inputFormResponses, commercial_override, force_new_deal } = body;
    if (!email && !lead_id) {
      return new Response(JSON.stringify({ error: "email or lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[lia-assign] Processing lead: ${email || lead_id}`);

    // ── 1. Fetch lead from lia_attendances ──
    let query = supabase.from("lia_attendances").select("*");
    if (lead_id) {
      query = query.eq("id", lead_id);
    } else {
      query = query.eq("email", email.trim().toLowerCase());
    }

    const { data: leadRaw, error: leadErr } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadErr || !leadRaw) {
      console.warn("[lia-assign] Lead not found:", email, leadErr);
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Canonical guard: follow merged_into chain so we never operate on an orphan lead ──
    let lead: Record<string, any> = leadRaw as Record<string, any>;
    let canonicalHops = 0;
    while (lead.merged_into && canonicalHops < 5) {
      const { data: parent } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("id", lead.merged_into)
        .maybeSingle();
      if (!parent) break;
      console.log(`[lia-assign] Following merged_into: ${lead.id} → ${parent.id}`);
      lead = parent as Record<string, any>;
      canonicalHops++;
    }

    // ── Commercial intent guard (defense-in-depth) ──
    // Block PipeRun Deal creation for non-commercial sources (Astron Academy
    // postbacks, e-commerce sync, raw WhatsApp pings, internal emails, etc.).
    // The retry cron also filters these, but we keep this last-mile guard so
    // any future caller (manual invoke, misconfigured webhook, etc.) cannot
    // pollute the CRM. `commercial_override=true` is reserved for explicit
    // qualification flows that have collected real intent.
    {
      const intent = evaluateCommercialIntent(
        {
          source: lead.source,
          form_name: lead.form_name,
          piperun_id: lead.piperun_id,
          email: lead.email,
        },
        commercial_override === true,
      );
      if (!intent.eligible) {
        console.warn(`[lia-assign] BLOCKED non-commercial lead ${lead.id} (${lead.email}) reason=${intent.reason}`);
        try {
          await supabase
            .from("lia_attendances")
            .update({
              crm_creation_blocked: true,
              crm_creation_blocked_reason: `non_commercial:${intent.reason}`,
            })
            .eq("id", lead.id);
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "warning",
            error_type: "lia_assign_blocked_non_commercial",
            lead_id: lead.id,
            lead_email: lead.email,
            details: { reason: intent.reason, source: lead.source, trigger, form_name: lead.form_name },
          });
        } catch (logErr) {
          console.error("[lia-assign] Failed to log non-commercial block:", logErr);
        }
        return new Response(
          JSON.stringify({ blocked: true, reason: "non_commercial_lead", detail: intent.reason }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Idempotency: skip if assigned in last 5 min (unless force=true) ──
    // NOTE: sdr_captacao_reativacao no longer bypasses this guard. The Meta
    // webhook re-delivers the same leadgen_id every ~2 min and previously
    // looped through lia-assign continuously. Reactivation should only fire
    // for *genuinely new* form submissions (already deduped at ingest-lead).
    if (!force && force_new_deal !== true && lead.proprietario_lead_crm && lead.piperun_id && lead.updated_at) {
      const lastUpdate = new Date(lead.updated_at).getTime();
      if (Date.now() - lastUpdate < 5 * 60 * 1000) {
        console.log("[lia-assign] Already assigned recently, skipping");
        return new Response(JSON.stringify({ skipped: true, reason: "recently_assigned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── §4.5 SDR-CAPTAÇÃO Reativação ──
    if (trigger === "sdr_captacao_reativacao") {
      let reativacaoOk = false;
      try {
        reativacaoOk = await executarReativacaoSdrCaptacao(PIPERUN_API_KEY, supabase, lead, inputFormResponses);
      } catch (reativErr) {
        console.error("[lia-assign] SDR-CAPTAÇÃO reativação error:", reativErr);
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "error",
            error_type: "sdr_captacao_reativacao_failed",
            lead_email: lead.email,
            details: { error: String(reativErr) },
          });
        } catch {}
      }
      if (reativacaoOk) {
        return new Response(
          JSON.stringify({ success: true, flow: "sdr_captacao_reativacao" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // reativação falhou → continua com fluxo normal para não bloquear
      console.warn("[lia-assign] SDR-CAPTAÇÃO reativação falhou, continuando com fluxo normal");
    }

    // ── 2. Select owner via Round Robin (prioritize WaLeads) ──
    let assignedOwnerId: number;
    let assignedTeamMemberId: string | null = null;
    let assignedOwnerName: string;

    // Check if current owner exists and is active in team_members
    if (lead.proprietario_lead_crm && !isBlockedSeller({ ownerName: lead.proprietario_lead_crm as string })) {
      const { data: currentOwner } = await supabase
        .from("team_members")
        .select("id, nome_completo, piperun_owner_id, ativo, waleads_api_key")
        .ilike("nome_completo", lead.proprietario_lead_crm)
        .maybeSingle();

      if (
        currentOwner &&
        currentOwner.ativo &&
        !isBlockedSeller({
          ownerId: currentOwner.piperun_owner_id as number,
          ownerName: currentOwner.nome_completo as string,
        })
      ) {
        assignedOwnerId = currentOwner.piperun_owner_id;
        assignedTeamMemberId = currentOwner.id;
        assignedOwnerName = currentOwner.nome_completo;
        console.log(`[lia-assign] Keeping existing active owner: ${assignedOwnerName}`);
      } else {
        // Owner not found in team_members or inactive → re-assign
        const newOwner = await pickRandomActiveVendedor(supabase);
        assignedOwnerId = newOwner.piperun_owner_id;
        assignedTeamMemberId = newOwner.id;
        assignedOwnerName = newOwner.nome_completo;
        console.log(`[lia-assign] Re-assigned (owner not in team or inactive) → ${assignedOwnerName}`);
      }
    } else if (lead.proprietario_lead_crm && isBlockedSeller({ ownerName: lead.proprietario_lead_crm as string })) {
      // Patricia Gastaldi etc → Distribuidor de Leads (não sortear outro vendedor)
      console.warn(`[lia-assign] Blocked seller "${lead.proprietario_lead_crm}" → routing to Distribuidor de Leads`);
      const fallbackUser = PIPERUN_USERS[FALLBACK_OWNER_ID];
      assignedOwnerId = FALLBACK_OWNER_ID;
      assignedOwnerName = fallbackUser?.name || "Thiago Nicoletti";
      assignedTeamMemberId = null;
    } else {
      const newOwner = await pickRandomActiveVendedor(supabase);
      if (isBlockedSeller({ ownerId: newOwner.piperun_owner_id, ownerName: newOwner.nome_completo })) {
        console.warn(`[lia-assign] Round Robin landed on blocked seller "${newOwner.nome_completo}" → Distribuidor de Leads`);
        const fallbackUser = PIPERUN_USERS[FALLBACK_OWNER_ID];
        assignedOwnerId = FALLBACK_OWNER_ID;
        assignedOwnerName = fallbackUser?.name || "Thiago Nicoletti";
        assignedTeamMemberId = null;
      } else {
        assignedOwnerId = newOwner.piperun_owner_id;
        assignedTeamMemberId = newOwner.id;
        assignedOwnerName = newOwner.nome_completo;
        console.log(`[lia-assign] Round Robin assigned: ${assignedOwnerName} (${assignedOwnerId})`);
      }
    }

    // ── 3. Determine pipeline & stage ──
    const isDistribuidor = assignedOwnerId === FALLBACK_OWNER_ID;
    const pipeline_id = isDistribuidor ? PIPELINES.DISTRIBUIDOR_LEADS : PIPELINES.VENDAS;
    const stage_id = isDistribuidor
      ? STAGES_DISTRIBUIDOR.DISTRIBUIDOR_DE_LEADS
      : STAGES_VENDAS.SEM_CONTATO;

    // ── 4. Build PipeRun custom fields ──
    const customFields = mapAttendanceToDealCustomFields(lead as Record<string, unknown>);
    if (!customFields.some((f) => f.custom_field_id === DEAL_CUSTOM_FIELDS.WHATSAPP)) {
      const phone = (lead.telefone_raw) as string | null;
      if (phone) {
        customFields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.WHATSAPP, value: phone });
      }
    }

    // ── 5. Smart PipeRun Sync: Pessoa → Empresa → Deal ──
    const leadEmail = (lead.email as string).trim().toLowerCase();
    let piperunId = lead.piperun_id as string | null;
    let personId: number | null = lead.pessoa_piperun_id as number | null;
    let companyId: number | null = lead.empresa_piperun_id as number | null;
    let flowType = "unknown";
    let vendaDeal: Record<string, unknown> | undefined;

    // Step 5a: Find or create Person (with stale-cache recovery)
    // Resolve origin once for both Person and Deal so Person.origin reflects
    // the first conversion (regra Person vs Deal Origin Separation).
    const personOriginName = (lead.origem_primeiro_contato as string | null)
      || (lead.form_name as string | null);
    const resolvedPersonOriginId = await resolveOriginId(PIPERUN_API_KEY, personOriginName);

    // ── Company-like name detection ──
    // When the Meta lead form 'full_name' is actually a razão social (e.g.
    // "ESTÉTICA AVANÇADA"), the Person card ends up with a meaningless contact
    // name. We still create Person/Company so the deal isn't blocked, but flag
    // the lead for SDR review and add a note to the Deal.
    const personNameLooksLikeCompany = isCompanyLikeName(
      lead.nome as string | null,
      {
        empresa_razao_social: lead.empresa_razao_social as string | null,
        empresa_nome: lead.empresa_nome as string | null,
      },
    );
    if (personNameLooksLikeCompany) {
      console.warn(`[lia-assign] Person name looks like a company: "${lead.nome}" (lead ${lead.id}) — flagging for SDR review`);
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "warning",
          error_type: "person_name_is_company",
          lead_email: lead.email,
          details: {
            lead_id: lead.id,
            person_name: lead.nome,
            empresa_razao_social: lead.empresa_razao_social,
            empresa_nome: lead.empresa_nome,
            source: lead.source,
            form_name: lead.form_name,
          },
        });
      } catch {}
    }

    if (personId) {
      // Validate cached Person by GET /persons/{id} — NOT by email/phone search.
      // Searching by contact would miss Persons with empty emails[]/phones[]
      // (PipeRun's native Meta integration creates them this way), and the
      // caller would then create a brand-new duplicate Person each run.
      const { validateCachedPerson } = await import("../_shared/piperun-person-resolver.ts");
      const cachedCheck = await validateCachedPerson(PIPERUN_API_KEY, personId);
      if (cachedCheck.exists) {
        if (cachedCheck.company_id) companyId = cachedCheck.company_id;
        console.log(`[lia-assign] Cached person ${personId} validated via GET (hasContact=${cachedCheck.hasContact})`);
        // If the cached Person is a "ghost" (no email/phone), try to swap it
        // for the rightful owner BEFORE we attempt updatePersonFields. The
        // swap avoids both ghost proliferation and PipeRun's silent reject.
        if (!cachedCheck.hasContact) {
          try {
            // Try to swap the empty cached Person for an existing owner
            // (matched by email/phone/name) before falling back to PUT.
            const { findPersonExpanded } = await import("../_shared/piperun-person-resolver.ts");
            const owner = await findPersonExpanded(PIPERUN_API_KEY, {
              email: leadEmail || null,
              phone: (lead.telefone_normalized as string | null) ?? (lead.telefone_raw as string | null),
              name: (lead.nome as string | null) ?? null,
            });
            if (owner && owner.id !== personId) {
              console.warn(`[lia-assign] Swapping empty cached person ${personId} → owner ${owner.id} via ${owner.matched_via}`);
              try {
                await supabase.from("system_health_logs").insert({
                  function_name: "smart-ops-lia-assign",
                  severity: "warning",
                  error_type: "piperun_person_swapped_empty_to_owner",
                  lead_id: lead.id,
                  lead_email: leadEmail,
                  details: { previous_person_id: personId, new_person_id: owner.id, matched_via: owner.matched_via, stage: "cached_check" },
                });
              } catch {}
              personId = owner.id;
              if (owner.company_id) companyId = owner.company_id;
            }
          } catch (e) { console.warn("[lia-assign] expanded-swap (cached) error:", e); }
        }
      } else {
        console.warn(`[lia-assign] Cached person ${personId} truly missing in PipeRun, re-resolving`);
        const fallback = await findPersonByEmail(PIPERUN_API_KEY, leadEmail, (lead.telefone_normalized as string | null) ?? (lead.telefone_raw as string | null));
        if (fallback) {
          personId = fallback.id;
          companyId = fallback.company_id || companyId;
        } else {
          personId = await createPerson(PIPERUN_API_KEY, lead as Record<string, unknown>, resolvedPersonOriginId);
          try {
            await supabase.from("system_health_logs").insert({
              function_name: "smart-ops-lia-assign",
              severity: "info",
              error_type: "piperun_person_created_path",
              lead_id: lead.id,
              lead_email: leadEmail,
              details: { via: "cache_missing_no_fallback", new_person_id: personId, previous_cached_id: lead.pessoa_piperun_id ?? null },
            });
          } catch {}
        }
      }
    } else {
      // Use expanded resolver (strict + name + localpart) so we don't keep
      // creating ghost Persons when PipeRun's native Meta integration owns
      // the email/phone in a card that doesn't respond to strict filters.
      const { findPersonExpanded } = await import("../_shared/piperun-person-resolver.ts");
      const existing = await findPersonExpanded(PIPERUN_API_KEY, {
        email: leadEmail || null,
        phone: (lead.telefone_normalized as string | null) ?? (lead.telefone_raw as string | null),
        name: (lead.nome as string | null) ?? null,
      });
      if (existing) {
        personId = existing.id;
        companyId = existing.company_id || companyId;
        console.log(`[lia-assign] Found existing person via expanded: ${personId} (${existing.matched_via}), company: ${companyId}`);
      } else {
        personId = await createPerson(PIPERUN_API_KEY, lead as Record<string, unknown>, resolvedPersonOriginId);
        console.log(`[lia-assign] Created new person: ${personId}`);
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "info",
            error_type: "piperun_person_created_path",
            lead_id: lead.id,
            lead_email: leadEmail,
            details: { via: "no_match_after_expanded", new_person_id: personId },
          });
        } catch {}
      }
    }

    // ── Person resolution trace (always log, even on success) ──
    // Fixes the Gabrielly-class blind spot: 6× error_no_person without any
    // diagnostic for what the resolution path actually did.
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "smart-ops-lia-assign",
        severity: personId ? "info" : "warning",
        error_type: "person_resolution_trace",
        lead_id: lead.id,
        lead_email: leadEmail,
        details: {
          resolved_person_id: personId,
          had_cached_pessoa_piperun_id: Boolean((lead as Record<string, unknown>).pessoa_piperun_id),
          email_present: Boolean(leadEmail),
          phone_present: Boolean(lead.telefone_normalized || lead.telefone_raw),
          source: lead.source,
          form_name: lead.form_name,
        },
      });
    } catch {}

    if (personId) {
      // Step 5b: Update person fields (custom_fields, job_title, phones)
      // NOTE: do NOT pass originId on update — Person.origin is frozen at
      // first contact (see memory: Person vs Deal Origin Separation).
      await updatePersonFields(PIPERUN_API_KEY, personId, lead as Record<string, unknown>);

      // Step 5c: Ensure company exists
      companyId = await findOrCreateCompany(PIPERUN_API_KEY, personId, companyId, lead as Record<string, unknown>);

      // Step 5d: Fetch all deals for this person
      const allDeals = await findPersonDeals(PIPERUN_API_KEY, personId);
      const openDeals = allDeals.filter((d) => Number(d.status) === 0);
      const wonDeals = allDeals.filter((d) => Number(d.status) === 1);

      console.log(`[lia-assign] Person ${personId}: ${allDeals.length} deals total, ${openDeals.length} open, ${wonDeals.length} won`);

      // Won deals: NEVER TOUCH
      if (wonDeals.length > 0) {
        console.log(`[lia-assign] ${wonDeals.length} won deals preserved (CS/Suporte)`);
      }

      // Step 5e: Decision tree for open deals
      vendaDeal = openDeals.find(
        (d) => Number(d.pipeline_id) === PIPELINES.VENDAS && !d.freezed
      );
      const estagnDeal = openDeals.find(
        (d) => Number(d.pipeline_id) === PIPELINES.ESTAGNADOS
      );

      // ── FORCE NEW DEAL (e.g. Loja Integrada "Sob Consulta") ──
      // Each product consult is a fresh revenue opportunity. Skip the
      // vendaDeal-preserve and estagnado-reactivate branches; create a
      // brand-new Deal even if open ones already exist for this Person.
      if (force_new_deal === true) {
        console.log(`[lia-assign] force_new_deal=true → bypassing vendaDeal/estagnDeal preserve for person ${personId}`);
        vendaDeal = undefined;
        // Reset piperunId so the dedupe + `if (!piperunId)` guards downstream
        // do NOT short-circuit createNewDeal. Each "Sob Consulta" submission
        // must produce a brand-new Deal even if the Person already carries a
        // cached piperun_id from a prior conversion.
        piperunId = null;
      }

      // ── GOLDEN RULE: Open deal in Vendas → NEVER change owner/stage ──
      if (vendaDeal) {
        piperunId = String(vendaDeal.id);
        flowType = "preserve_vendas";

        // Read owner FROM the deal (source of truth)
        const dealOwnerId = Number(vendaDeal.owner_id);
        const dealOwnerInfo = PIPERUN_USERS[dealOwnerId];
        const dealOwnerName = dealOwnerInfo?.name || String(dealOwnerId);

        if (isBlockedSeller({ ownerId: dealOwnerId, ownerName: dealOwnerName })) {
          // Lead estava com vendedor bloqueado (ex.: Patricia Gastaldi) → mover deal para Distribuidor
          const fallbackUser = PIPERUN_USERS[FALLBACK_OWNER_ID];
          assignedOwnerId = FALLBACK_OWNER_ID;
          assignedOwnerName = fallbackUser?.name || "Thiago Nicoletti";
          assignedTeamMemberId = null;
          flowType = "rerouted_blocked_seller_vendas";

          await piperunPut(PIPERUN_API_KEY, `deals/${vendaDeal.id}`, {
            pipeline_id: PIPELINES.DISTRIBUIDOR_LEADS,
            stage_id: STAGES_DISTRIBUIDOR.DISTRIBUIDOR_DE_LEADS,
            owner_id: assignedOwnerId,
          });
          await updateExistingDeal(PIPERUN_API_KEY, Number(vendaDeal.id), assignedOwnerId, customFields, lead as Record<string, unknown>, companyId, supabase, inputFormResponses);
          try {
            await addDealNote(
              PIPERUN_API_KEY,
              Number(vendaDeal.id),
              `🔁 [Dra. L.I.A.] Deal removido do owner bloqueado "${dealOwnerName}" e movido para Distribuidor de Leads.`,
            );
          } catch (e) {
            console.warn("[lia-assign] Failed to add re-route note:", e);
          }
          console.warn(`[lia-assign] BLOCKED SELLER on Vendas deal ${piperunId}: moved to Distribuidor (was ${dealOwnerName})`);
        } else {
          // Override round-robin with deal's actual owner
          assignedOwnerId = dealOwnerId;
          assignedOwnerName = dealOwnerName;

          // Find team member for this owner
          const { data: dealTeamMember } = await supabase
            .from("team_members")
            .select("id")
            .eq("piperun_owner_id", dealOwnerId)
            .eq("ativo", true)
            .maybeSingle();
          if (dealTeamMember) assignedTeamMemberId = dealTeamMember.id;

          // Update ONLY custom fields + note (owner_id = null → preserved)
          await updateExistingDeal(PIPERUN_API_KEY, Number(vendaDeal.id), null, customFields, lead as Record<string, unknown>, companyId, supabase, inputFormResponses);
          console.log(`[lia-assign] GOLDEN RULE: Preserved Vendas deal ${piperunId}, owner=${dealOwnerName} (${dealOwnerId})`);
        }
      } else if (estagnDeal && force_new_deal !== true) {
        piperunId = String(estagnDeal.id);
        flowType = "reactivate_estagnado";
        await moveDealToVendas(PIPERUN_API_KEY, Number(estagnDeal.id), assignedOwnerId, stage_id, customFields, lead as Record<string, unknown>, companyId, supabase, inputFormResponses);
        console.log(`[lia-assign] Reactivated estagnado deal ${piperunId} → Vendas`);
      } else {
        flowType = "new_deal";
        // ── Dedupe guard: if lead already carries a piperun_id, validate it before creating a new deal ──
        const cachedDealId = (lead.piperun_id as string | null) || null;
        if (cachedDealId && force_new_deal !== true) {
          try {
            const check = await piperunGet(PIPERUN_API_KEY, `deals/${cachedDealId}`, {});
            const dealData = (check?.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
            const isAlive = dealData && dealData.deleted !== 1 && dealData.deleted !== true;
            if (isAlive) {
              piperunId = cachedDealId;
              flowType = "preserve_cached_deal";
              await updateExistingDeal(PIPERUN_API_KEY, Number(cachedDealId), null, customFields, lead as Record<string, unknown>, companyId, supabase, inputFormResponses);
              console.log(`[lia-assign] DEDUPE GUARD: cached deal ${cachedDealId} alive, updated instead of creating new`);
            } else {
              console.warn(`[lia-assign] DEDUPE GUARD: cached deal ${cachedDealId} dead/deleted, will create new`);
            }
          } catch (e) {
            console.warn(`[lia-assign] DEDUPE GUARD: failed to validate cached deal ${cachedDealId}:`, e);
          }
        }
        if (!piperunId) {
        // empty-person guard removed: Deal must always be created;
        // GET-based verification produced false positives.
        piperunId = await createNewDeal(
          PIPERUN_API_KEY, personId, companyId,
          lead as Record<string, unknown>,
          pipeline_id, stage_id, assignedOwnerId,
          customFields, leadEmail, supabase, inputFormResponses
        );
        console.log(`[lia-assign] Created new deal: ${piperunId}`);
        if (piperunId && personNameLooksLikeCompany) {
          try {
            await addDealNote(
              PIPERUN_API_KEY,
              Number(piperunId),
              `⚠️ [Dra. L.I.A.] Nome do contato veio do formulário como razão social ("${lead.nome}"). Confirmar nome real da pessoa no primeiro atendimento.`,
            );
          } catch (e) {
            console.warn("[lia-assign] Failed to add company-like-name review note:", e);
          }
        }
        }
      }

      // ── Step 5f: Enrich lia_attendances with primary deal data ──
      const primaryDeal = vendaDeal || estagnDeal || (allDeals.length > 0 ? allDeals[0] : null);
      if (primaryDeal) {
        const dealEnrichment = mapDealToAttendance(primaryDeal as PipeRunDealData);
        // Remove fields we don't want to overwrite blindly
        delete dealEnrichment.email;
        delete dealEnrichment.nome;
        // Store enrichment for later use in updateFields
        (lead as Record<string, unknown>)._dealEnrichment = dealEnrichment;
      }

      // Check if any deal is won → status_oportunidade = "ganha"
      if (wonDeals.length > 0) {
        (lead as Record<string, unknown>)._hasWonDeal = true;
      }

      // ── Step 5g: Fetch company data for enrichment ──
      if (companyId) {
        const companyData = await fetchCompanyData(PIPERUN_API_KEY, companyId);
        if (companyData) {
          (lead as Record<string, unknown>)._companyData = companyData;
        }
      }

      // ── Step 5h: POST-DEAL RESYNC + CUSTOM FIELDS ──
      // Re-publish Person/Company contact and write the PipeRun custom fields
      // (fields:[{id,valor}] format confirmed via API). Best-effort.
      if (piperunId && personId) {
        try {
          await updatePersonFields(PIPERUN_API_KEY, personId, lead as Record<string, unknown>);
        } catch (e) {
          console.warn("[lia-assign] Post-deal Person resync error:", e);
        }
        if (companyId) {
          try {
            await findOrCreateCompany(PIPERUN_API_KEY, personId, companyId, lead as Record<string, unknown>);
          } catch (e) {
            console.warn("[lia-assign] Post-deal Company resync error:", e);
          }
        }

        // ── Custom fields: PESSOA + DEAL ──
        const CF_PESSOA = {
          area_atuacao: 673900,
          especialidade: 445631,
          tem_impressora: 546566,
          mapeamento_scanner: 772727,
          mapeamento_impressora: 772728,
          origem_lead: 772511,
        };
        const CF_DEAL = {
          area_atuacao: 549241,
          especialidade: 549059,
          produto_interesse: 549058,
          tem_impressora: 549243,
          produto_auto: 549148,
        };

        const formName = String((lead as Record<string, unknown>).form_name || "").trim();
        const cfEmail = (lead.email as string | null) || null;
        const phoneDigits = String(
          (lead as Record<string, unknown>).telefone_normalized ||
          (lead as Record<string, unknown>).telefone_raw || ""
        ).replace(/\D/g, "");
        const leadAreaAtuacao = (lead as Record<string, unknown>).area_atuacao as string | null;
        const leadEspecialidade = (lead as Record<string, unknown>).especialidade as string | null;
        const leadTemImpressora = String((lead as Record<string, unknown>).tem_impressora || "").toLowerCase();
        const leadModeloScanner =
          ((lead as Record<string, unknown>).como_digitaliza as string | null) ||
          ((lead as Record<string, unknown>).equip_scanner as string | null);
        const leadModeloImpressora = (lead as Record<string, unknown>).impressora_modelo as string | null;

        // PESSOA fields
        const personFields: Array<{ id: number; valor: string }> = [];
        if (leadAreaAtuacao)
          personFields.push({ id: CF_PESSOA.area_atuacao, valor: leadAreaAtuacao.toUpperCase() });
        if (leadEspecialidade)
          personFields.push({ id: CF_PESSOA.especialidade, valor: leadEspecialidade });
        if (leadTemImpressora)
          personFields.push({ id: CF_PESSOA.tem_impressora, valor: leadTemImpressora === "sim" ? "SIM" : "NÃO" });
        if (leadModeloScanner && !["ainda_não_digitalizo", "sem scanner"].includes(leadModeloScanner.toLowerCase()))
          personFields.push({ id: CF_PESSOA.mapeamento_scanner, valor: leadModeloScanner });
        if (leadModeloImpressora && !["não tem", "sem impressora"].includes(leadModeloImpressora.toLowerCase()))
          personFields.push({ id: CF_PESSOA.mapeamento_impressora, valor: leadModeloImpressora });
        if (formName)
          personFields.push({ id: CF_PESSOA.origem_lead, valor: `Meta Lead Ads — ${formName}` });

        if (personId && (personFields.length > 0 || cfEmail || phoneDigits)) {
          const personPayload: Record<string, unknown> = {};
          if (personFields.length > 0) personPayload.fields = personFields;
          if (cfEmail) {
            personPayload.contact_emails = [{ address: cfEmail }];
            personPayload.emails = [{ email: cfEmail }];
          }
          if (phoneDigits) {
            personPayload.contact_phones = [{ number: phoneDigits, is_main: 1 }];
            personPayload.phones = [{ phone: phoneDigits }];
            personPayload.cellphone = phoneDigits;
          }
          await piperunPut(PIPERUN_API_KEY, `persons/${personId}`, personPayload)
            .catch((e) => console.warn("[lia-assign] person fields PUT:", (e as Error).message));
        }

        // DEAL fields
        if (piperunId) {
          const dealFields: Array<{ id: number; valor: string }> = [];
          if (leadAreaAtuacao)
            dealFields.push({ id: CF_DEAL.area_atuacao, valor: leadAreaAtuacao });
          if (leadEspecialidade)
            dealFields.push({ id: CF_DEAL.especialidade, valor: leadEspecialidade });
          if ((lead as Record<string, unknown>).produto_interesse)
            dealFields.push({ id: CF_DEAL.produto_interesse, valor: String((lead as Record<string, unknown>).produto_interesse) });
          if (leadTemImpressora)
            dealFields.push({
              id: CF_DEAL.tem_impressora,
              valor: leadModeloImpressora ? `${leadTemImpressora} - ${leadModeloImpressora}` : leadTemImpressora,
            });
          if (dealFields.length > 0) {
            await piperunPut(PIPERUN_API_KEY, `deals/${piperunId}`, { fields: dealFields })
              .catch((e) => console.warn("[lia-assign] deal fields PUT:", (e as Error).message));
          }
        }
      }
    } else {
      console.error("[lia-assign] Could not find or create person in PipeRun");
      flowType = "error_no_person";
    }

    // ── 6. Update lead in lia_attendances ──
    const updateFields: Record<string, unknown> = {};

    if (flowType !== "error_no_person") {
      updateFields.proprietario_lead_crm = assignedOwnerName;
    } else {
      // Log failure for visibility in System Health dashboard
      console.error("[lia-assign] CRM person creation failed for", lead.email);
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "error",
          error_type: "crm_person_creation_failed",
          lead_email: lead.email,
          details: { lead_id: lead.id, flow: flowType, assigned_owner: assignedOwnerName },
        });
      } catch (logErr) {
        console.error("[lia-assign] Failed to log health event", logErr);
      }
      // Stamp the failed owner so metrics don't inflate round-robin assignments
      // for a vendor who never actually saw the lead.
      try {
        await supabase
          .from("lia_attendances")
          .update({ last_failed_assignment_owner: assignedOwnerName })
          .eq("id", lead.id);
      } catch {}
      // HARDENING: when person creation failed, do NOT corrupt the lead with
      // owner/funnel placeholders. Leaving these fields untouched lets the
      // retry cron pick the lead up later and assign it for real.
      // Bail out early — only side-effect is the health log above.
      return new Response(JSON.stringify({
        success: false,
        skipped: true,
        reason: "crm_person_creation_failed",
        lead_id: lead.id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Set pipeline/stage based on flow
    if (flowType === "preserve_vendas" && vendaDeal) {
      // Use the deal's ACTUAL pipeline/stage (read from PipeRun, don't invent)
      updateFields.funil_entrada_crm = PIPELINE_NAMES[Number(vendaDeal.pipeline_id)] || "Funil de vendas";
      updateFields.ultima_etapa_comercial = STAGE_TO_ETAPA[Number(vendaDeal.stage_id)] || "sem_contato";
    } else {
      const piperunFunil = isDistribuidor ? "Distribuidor de Leads" : "Funil de vendas";
      const piperunEtapa = isDistribuidor ? "distribuidor_leads" : "sem_contato";
      updateFields.funil_entrada_crm = piperunFunil;
      updateFields.ultima_etapa_comercial = piperunEtapa;
    }

    if (piperunId) {
      updateFields.piperun_id = piperunId;
      updateFields.piperun_link = `https://app.pipe.run/#/deals/${piperunId}`;
    }

    // Save PipeRun hierarchy IDs
    if (personId) updateFields.pessoa_piperun_id = personId;
    if (companyId) updateFields.empresa_piperun_id = companyId;

    // ── Enrich with deal data (from step 5f) ──
    const dealEnrichment = (lead as Record<string, unknown>)._dealEnrichment as Record<string, unknown> | undefined;
    if (dealEnrichment) {
      // Only fill fields that are currently null/empty in the lead
      const enrichFields = [
        "valor_oportunidade", "data_primeiro_contato", "data_fechamento_crm",
        "motivo_perda", "piperun_link", "origem_campanha",
        "piperun_created_at", "piperun_pipeline_id", "piperun_pipeline_name",
        "piperun_stage_id", "piperun_stage_name", "piperun_status",
        "piperun_origin_id", "piperun_origin_name", "piperun_title",
        "especialidade", "produto_interesse", "tem_scanner", "tem_impressora",
        "pais_origem", "id_cliente_smart", "informacao_desejada",
        "codigo_contrato", "data_treinamento", "telefone_raw",
        "area_atuacao", "cidade", "uf",
      ];
      for (const field of enrichFields) {
        if (dealEnrichment[field] !== null && dealEnrichment[field] !== undefined) {
          const currentValue = (lead as Record<string, unknown>)[field];
          if (currentValue === null || currentValue === undefined || currentValue === "") {
            updateFields[field] = dealEnrichment[field];
          }
        }
      }
    }

    // Set status_oportunidade if any won deal exists
    if ((lead as Record<string, unknown>)._hasWonDeal) {
      updateFields.status_oportunidade = "ganha";
    }

    // ── Enrich with company data (from step 5g) ──
    const companyData = (lead as Record<string, unknown>)._companyData as Record<string, unknown> | undefined;
    if (companyData) {
      const companyFieldMap: Record<string, string> = {
        cnpj: "empresa_cnpj",
        name: "empresa_nome",
        segment: "empresa_segmento",
        website: "empresa_website",
      };
      // Also try razao_social / ie from custom_fields or direct fields
      if (companyData.razao_social) companyFieldMap.razao_social = "empresa_razao_social";
      if (companyData.ie) companyFieldMap.ie = "empresa_ie";

      for (const [srcField, dstField] of Object.entries(companyFieldMap)) {
        const val = companyData[srcField];
        if (val !== null && val !== undefined && val !== "") {
          const currentValue = (lead as Record<string, unknown>)[dstField];
          if (currentValue === null || currentValue === undefined || currentValue === "") {
            updateFields[dstField] = val;
          }
        }
      }
      // empresa_razao_social as fallback for empresa_nome
      if (!updateFields.empresa_razao_social && companyData.name) {
        const current = (lead as Record<string, unknown>).empresa_razao_social;
        if (!current) updateFields.empresa_razao_social = companyData.name;
      }
    }

    // ── PRE-CHECK: piperun_id UNIQUE conflict guard ──
    // The DB has UNIQUE(piperun_id). If we are about to write a piperun_id that
    // already belongs to a DIFFERENT canonical lead, the UPDATE silently fails
    // and leaves this lead orphaned (succeeded_at marked, piperun_id NULL).
    // Detect and abort BEFORE the update so the retry cron can re-run later
    // (after the contaminating Person is fixed in PipeRun).
    if (piperunId) {
      const { data: conflict } = await supabase
        .from("lia_attendances")
        .select("id, email")
        .eq("piperun_id", String(piperunId))
        .neq("id", lead.id as string)
        .is("merged_into", null)
        .maybeSingle();
      if (conflict) {
        console.error(`[lia-assign] piperun_id_conflict: deal ${piperunId} already on lead ${conflict.id} (${conflict.email}); aborting update for ${lead.id}`);
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "error",
            error_type: "piperun_id_conflict",
            lead_email: lead.email,
            details: {
              lead_id: lead.id,
              attempted_piperun_id: piperunId,
              attempted_pessoa_id: personId,
              conflicting_lead_id: conflict.id,
              conflicting_lead_email: conflict.email,
              flow: flowType,
            },
          });
        } catch {}
        return new Response(JSON.stringify({
          success: false,
          skipped: true,
          reason: "piperun_id_conflict",
          conflicting_lead_id: conflict.id,
          attempted_piperun_id: piperunId,
          lead_id: lead.id,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── HARDENING: drop any non-scalar value from updateFields ──
    // PostgREST treats nested objects as "embedded resource updates" and tries
    // to UPDATE child tables, surfacing as `column "value" does not exist`
    // (42703) when a Piperun custom_field shaped `{value: ...}` leaks in.
    // Allow primitives + null. Drop arrays/objects with a warn so we can
    // audit the source later without aborting the whole UPDATE.
    const sanitizedUpdateFields: Record<string, unknown> = {};
    const droppedKeys: string[] = [];
    for (const [k, v] of Object.entries(updateFields)) {
      if (v === null || v === undefined) {
        sanitizedUpdateFields[k] = v;
      } else {
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") {
          sanitizedUpdateFields[k] = v;
        } else {
          droppedKeys.push(k);
          console.warn(
            `[lia-assign] DROP non-scalar updateField "${k}":`,
            JSON.stringify(v).slice(0, 200),
          );
        }
      }
    }
    if (droppedKeys.length > 0) {
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "warning",
          error_type: "non_scalar_update_fields_dropped",
          lead_email: lead.email,
          details: { lead_id: lead.id, dropped_keys: droppedKeys },
        });
      } catch {}
    }
    console.log(`[lia-assign] updateFields keys (${Object.keys(sanitizedUpdateFields).length}): ${Object.keys(sanitizedUpdateFields).join(",")}`);

    // ── PHASED UPDATE ──
    // Some opaque trigger / postgrest quirks cause `column "value" does not
    // exist` (42703) when enrichment fields are mixed with the critical CRM
    // binding fields. To never lose the deal binding, write CRITICAL fields
    // first; if successful, write enrichment in a second best-effort call.
    const CRITICAL_KEYS = new Set([
      "proprietario_lead_crm",
      "funil_entrada_crm",
      "ultima_etapa_comercial",
      "piperun_id",
      "piperun_link",
      "pessoa_piperun_id",
      "empresa_piperun_id",
      "status_oportunidade",
    ]);
    const criticalUpdate: Record<string, unknown> = {};
    const enrichmentUpdate: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sanitizedUpdateFields)) {
      if (CRITICAL_KEYS.has(k)) criticalUpdate[k] = v;
      else enrichmentUpdate[k] = v;
    }

    const { error: criticalError } = await supabase
      .from("lia_attendances")
      .update(criticalUpdate)
      .eq("id", lead.id);

    if (criticalError) {
      console.error(`[lia-assign] CRITICAL DB update FAILED for ${lead.id}:`, criticalError);
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "error",
          error_type: "lead_update_failed",
          lead_email: lead.email,
          details: { lead_id: lead.id, attempted_piperun_id: piperunId, error: criticalError.message, code: criticalError.code, phase: "critical" },
        });
      } catch {}
      return new Response(JSON.stringify({
        success: false,
        error: "lead_update_failed",
        details: criticalError.message,
        lead_id: lead.id,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (Object.keys(enrichmentUpdate).length > 0) {
      const { error: enrichmentError } = await supabase
        .from("lia_attendances")
        .update(enrichmentUpdate)
        .eq("id", lead.id);
      if (enrichmentError) {
        console.warn(`[lia-assign] Enrichment update failed for ${lead.id} (non-fatal): ${enrichmentError.message}`);
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "warning",
            error_type: "lead_enrichment_update_failed",
            lead_email: lead.email,
            details: { lead_id: lead.id, error: enrichmentError.message, code: enrichmentError.code, phase: "enrichment", keys: Object.keys(enrichmentUpdate) },
          });
        } catch {}
      }
    }

    console.log(`[lia-assign] Lead updated: owner=${assignedOwnerName}, flow=${flowType}, funil=${updateFields.funil_entrada_crm || "n/a"}`);

    // ── 7. Outbound automation ──
    await triggerOutboundMessages(supabase, SUPABASE_URL, SERVICE_ROLE_KEY, lead, assignedTeamMemberId, assignedOwnerName);

    return new Response(
      JSON.stringify({
        success: true,
        flow: flowType,
        owner: assignedOwnerName,
        owner_id: assignedOwnerId,
        pipeline: updateFields.funil_entrada_crm || "Funil de vendas",
        piperun_id: piperunId,
        pessoa_piperun_id: personId,
        empresa_piperun_id: companyId,
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

// ─── Stage Resolution Helper ───

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
      if (items && items.length > 0) return Number(items[0].id);
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to resolve first stage for pipeline", pipelineId, e);
  }
  return 0;
}
