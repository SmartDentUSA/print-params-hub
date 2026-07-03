import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { evaluateCommercialIntent } from "../_shared/commercial-intent.ts";
import { isCompanyLikeName } from "../_shared/identity-utils.ts";
import { isFakeEmail } from "../_shared/lead-identity-guard.ts";
import { fetchDealsContext, type DealsContext } from "../_shared/waleads-messaging.ts";
import {
  enrichLeadFromIdentity,
  buildDeterministicCognitiveFallback,
  logBriefingAudit,
  type EnrichmentMeta,
} from "../_shared/lead-enrichment.ts";
import { diagnoseLead, renderDiagnosisWhatsApp } from "../_shared/workflow-diagnosis.ts";
import { buildSellerDealSummaryHTML } from "../_shared/seller-summary.ts";
import { claimSellerNoteSlot, releaseSellerNoteSlot } from "../_shared/seller-note-lock.ts";
import {
  assertCanCreateNewDeal,
  claimDealCreateSlot,
  releaseDealCreateSlot,
  validateCachedDealIsActiveVendas,
} from "../_shared/golden-rule-guard.ts";
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
  buildPersonFormCustomFields,
  type PipeRunDealData,
} from "../_shared/piperun-field-map.ts";

const WALEADS_ENABLED = false; // Pausado — usar Evolution API (smart-ops-lead-welcome + smart-ops-lia-notify-seller)

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
  // name + same source within 60 seconds. Also debounces by email AND by
  // phone (across any source) so concurrent Meta-cron + form-submission
  // pipelines do not race-create two PipeRun Persons for the same human.
  // Prevents the Watillas T. Santos / danilohen-Meta-loop class of bug.
  try {
    const normName = String(nome || "").trim().toLowerCase();
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const selfId = (lead.id as string) || "00000000-0000-0000-0000-000000000000";

    // (a) name + source
    if (normName) {
      const { data: recent } = await supa
        .from("lia_attendances")
        .select("id, pessoa_piperun_id, created_at")
        .ilike("nome", normName)
        .eq("source", String(lead.source || ""))
        .not("pessoa_piperun_id", "is", null)
        .gte("created_at", sinceIso)
        .neq("id", selfId)
        .limit(1)
        .maybeSingle();
      if (recent?.pessoa_piperun_id) {
        console.warn(`[lia-assign] DEBOUNCE(name+source): reusing pessoa ${recent.pessoa_piperun_id} for "${nome}" (created ${recent.created_at})`);
        return Number(recent.pessoa_piperun_id);
      }
    }

    // (b) email — across ANY source
    if (email) {
      const { data: recentEmail } = await supa
        .from("lia_attendances")
        .select("id, pessoa_piperun_id, created_at, source")
        .eq("email", email)
        .not("pessoa_piperun_id", "is", null)
        .gte("updated_at", sinceIso)
        .neq("id", selfId)
        .limit(1)
        .maybeSingle();
      if (recentEmail?.pessoa_piperun_id) {
        console.warn(`[lia-assign] DEBOUNCE(email): reusing pessoa ${recentEmail.pessoa_piperun_id} for "${email}" (source=${recentEmail.source})`);
        return Number(recentEmail.pessoa_piperun_id);
      }
    }

    // (c) phone — across ANY source
    if (phone) {
      const { data: recentPhone } = await supa
        .from("lia_attendances")
        .select("id, pessoa_piperun_id, created_at, source")
        .eq("telefone_normalized", phone)
        .not("pessoa_piperun_id", "is", null)
        .gte("updated_at", sinceIso)
        .neq("id", selfId)
        .limit(1)
        .maybeSingle();
      if (recentPhone?.pessoa_piperun_id) {
        console.warn(`[lia-assign] DEBOUNCE(phone): reusing pessoa ${recentPhone.pessoa_piperun_id} for "${phone}" (source=${recentPhone.source})`);
        return Number(recentPhone.pessoa_piperun_id);
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
  // Verified Pessoa CF IDs (belongs=Pessoas, validated 2026-05):
  //   772727 Scanner formulário (text) · 772728 Impressora formulário (text)
  //   673900 ÁREA DE ATUAÇÃO (enum)    · 445631 Especialidade principal (multi)
  // Old IDs 674001/674002 (PESSOA_CUSTOM_FIELDS) are rejected by Piperun (422)
  // and intentionally NOT used here. The 422-strip fallback below covers any
  // future ID rejection so person creation never blocks.
  void areaAtuacao; void especialidade;
  const personFormCFs = buildPersonFormCustomFields(lead); // [{ id, value }]
  const personCustomFields: Array<{ custom_field_id: number; value: string | string[] }> =
    personFormCFs.map((f) => ({ custom_field_id: f.id, value: f.value }));
  if (personCustomFields.length > 0) {
    // PipeRun POST /persons accepts the same shape as deals: [{ id, value }]
    personPayload.custom_fields = personFormCFs;
  }

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

  // Person custom fields (form data) — verified IDs 772727/772728/673900/445631.
  // Same shape used on Deal: [{ id, value }]. Old IDs 674001/674002 are NOT used.
  const personFormCFs = buildPersonFormCustomFields(lead);
  if (personFormCFs.length > 0) {
    updatePayload.custom_fields = personFormCFs;
  }

  if (Object.keys(updatePayload).length === 0) return;

  console.log(`[lia-assign] Updating person ${personId}: ${JSON.stringify(updatePayload).slice(0, 300)}`);
  const res = await piperunPut(apiToken, `persons/${personId}`, updatePayload);
  console.log(`[lia-assign] Person ${personId} update: ${res.success} (${res.status})`);
  // If PUT failed and we sent custom_fields, retry once without them so
  // identity (name/email/phone/job_title) still publishes.
  if (!res.success && updatePayload.custom_fields) {
    const { custom_fields: _cf, ...withoutCF } = updatePayload;
    const retryCF = await piperunPut(apiToken, `persons/${personId}`, withoutCF);
    console.log(`[lia-assign] Person ${personId} retry w/o custom_fields: ${retryCF.success} (${retryCF.status})`);
  }
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
  const r = await findPersonDealsWithStatus(apiToken, personId);
  return r.deals;
}

/**
 * Same as findPersonDeals but exposes whether the underlying PipeRun call
 * succeeded. Callers that gate Deal creation on a complete list MUST use
 * this variant so they can refuse to createNewDeal when the list could be
 * stale/empty due to an upstream failure (defense-in-depth Regra de Ouro).
 */
async function findPersonDealsWithStatus(
  apiToken: string,
  personId: number,
): Promise<{ deals: Array<Record<string, unknown>>; fetched_ok: boolean }> {
  try {
    const res = await piperunGet(apiToken, "deals", { person_id: personId, show: 50 });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(items)) {
        return {
          deals: items.filter((d) => d.deleted !== 1 && d.deleted !== true),
          fetched_ok: true,
        };
      }
      // success=true mas sem array `data` → resposta degradada (throttle/cache
      // silencioso do PipeRun). NÃO confiar como lista vazia: marca fetched_ok=false
      // para o fail-safe da Regra de Ouro acionar.
      console.warn(
        `[lia-assign] findPersonDeals empty/invalid items for person=${personId} — treating as fetch failure`,
      );
      return { deals: [], fetched_ok: false };
    }
    console.warn(
      `[lia-assign] findPersonDeals non-success response for person=${personId}`,
    );
  } catch (e) {
    console.warn("[lia-assign] Error fetching person deals:", e);
  }
  return { deals: [], fetched_ok: false };
}

/**
 * Defense-in-depth para a Regra de Ouro: une os deals retornados pelo
 * PipeRun (que podem vir vazios por throttle/Person duplicada/race) com os
 * snapshots locais em `lia_attendances.piperun_deals_history`. Garante que
 * o gate `assertCanCreateNewDeal` SEMPRE veja qualquer VENDAS aberto/recente
 * conhecido localmente, mesmo quando a API mente.
 */
function mergeDealsWithLocalHistory(
  apiDeals: Array<Record<string, unknown>>,
  lead: Record<string, unknown> | null | undefined,
): Array<Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const d of apiDeals) {
    const id = String(d.id ?? "").trim();
    if (id) out.set(id, d);
  }
  const history = (lead?.piperun_deals_history as Array<Record<string, unknown>> | undefined) || [];
  for (const h of history) {
    const id = String(h.id ?? h.deal_id ?? "").trim();
    if (!id || out.has(id)) continue;
    out.set(id, {
      id,
      pipeline_id: Number(h.pipeline_id ?? 0),
      status: Number(h.status ?? 0),
      freezed: h.freezed === true || h.freezed === 1,
      created_at: h.created_at,
      updated_at: h.updated_at ?? h.created_at,
      _source: "local_history_snapshot",
    });
  }
  // Snapshot do próprio lead.piperun_id se ainda não estiver presente.
  const cachedId = String((lead?.piperun_id as string | number | undefined) ?? "").trim();
  if (cachedId && !out.has(cachedId)) {
    out.set(cachedId, {
      id: cachedId,
      pipeline_id: Number(lead?.piperun_pipeline_id ?? PIPELINES.VENDAS),
      status: 0,
      freezed: false,
      updated_at: lead?.updated_at,
      created_at: lead?.created_at,
      _source: "local_cached_piperun_id",
    });
  }
  return Array.from(out.values());
}

/**
 * Build the rich seller PipeRun note (Resumo do Lead + Diagnóstico 7×3 + RAG + Rayshape)
 * with idempotency by hash. Falls back to legacy `buildDealNoteHTML` on failure so
 * we never silently skip posting.
 *
 * Returns the HTML actually posted (or null when skipped as duplicate).
 */
async function postRichSellerNote(
  apiToken: string,
  dealId: number,
  lead: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  formResponses?: Array<{ label?: string; value?: unknown }>,
  opts: { headerPrefix?: string } = {},
): Promise<void> {
  const leadId = lead.id as string | undefined;
  let html = "";
  let hash = "";

  try {
    const highlightFormResponses = (formResponses || [])
      .filter((r) => r && r.value !== undefined && r.value !== null && String(r.value).trim() !== "")
      .map((r) => ({
        label: String((r as Record<string, unknown>).label || (r as Record<string, unknown>).field_label || "Campo"),
        value: String((r as Record<string, unknown>).value ?? ""),
      }));

    const built = await buildSellerDealSummaryHTML(supabase, lead, {
      highlightFormName: lead.form_name as string | undefined,
      highlightFormResponses: highlightFormResponses.length ? highlightFormResponses : undefined,
      dealId,
    });
    html = built.html;
    hash = built.hash;
  } catch (e) {
    console.warn(`[lia-assign] buildSellerDealSummaryHTML failed for deal ${dealId}, falling back to legacy:`, e);
    try {
      html = await buildDealNoteHTML(lead, supabase, formResponses);
    } catch (e2) {
      console.error(`[lia-assign] Legacy buildDealNoteHTML also failed for deal ${dealId}:`, e2);
      return;
    }
  }

  // ── Per-deal claim: 1 note per (deal_id, content_hash) + 60s burst floor per lead ──
  // The previous per-lead lock let duplicates through whenever a single lead had
  // multiple open deals, because each deal produced a different content hash.
  const finalHtml = opts.headerPrefix ? `${opts.headerPrefix}${html}` : html;
  if (hash) {
    const claim = await claimSellerNoteSlot(supabase, {
      dealId,
      leadId: (leadId as string | undefined) ?? null,
      contentHash: hash,
    });
    if (!claim.ok) {
      console.log(`[lia-assign] Seller note skipped (${claim.reason}) — deal=${dealId} lead=${leadId}`);
      return;
    }
  }

  const result = await addDealNote(apiToken, dealId, finalHtml);

  // If the note actually failed to post, release the claim so a retry can succeed.
  if (!result?.success && hash) {
    await releaseSellerNoteSlot(supabase, { dealId, contentHash: hash });
  }
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
  // ORIGIN FROZEN: never overwrite origin of an existing deal — this caused
  // a ping-pong loop in PipeRun's timeline between form_name and the PipeRun
  // origin read back by webhooks. Origin is set only on createNewDeal.
  const cfPayload = customFieldsToDealPayload(customFields);
  const updatePayload: Record<string, unknown> = {};
  if (cfPayload.length > 0) updatePayload.custom_fields = cfPayload;
  if (ownerId !== null) updatePayload.owner_id = ownerId;
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Updating deal ${dealId}: owner=${ownerId ?? "PRESERVED"}, origin=PRESERVED, company=${companyId || "none"}`, JSON.stringify(updatePayload).slice(0, 500));
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

  // Briefing do vendedor: SOMENTE no momento de criação no Funil Comercial / Sem contato.
  // updateExistingDeal NUNCA dispara briefing (regra do produto).
  console.log(`[lia-assign] Skip seller briefing on updateExistingDeal (deal=${dealId}) — only created-in-VENDAS/SEM_CONTATO posts briefing.`);
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
  // ORIGIN FROZEN: do NOT overwrite origin when moving an existing deal
  // across pipelines — only stage/owner/pipeline change.
  const cfPayload = customFieldsToDealPayload(customFields);
  const updatePayload: Record<string, unknown> = {
    pipeline_id: PIPELINES.VENDAS,
    stage_id: stageId,
    owner_id: ownerId,
    freezed: 0,
  };
  if (cfPayload.length > 0) updatePayload.custom_fields = cfPayload;
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Moving deal ${dealId} from Estagnados → Vendas, owner=${ownerId}, origin=PRESERVED`);
  const updateRes = await piperunPut(apiToken, `deals/${dealId}`, updatePayload);
  console.log(`[lia-assign] Deal move: ${updateRes.success} (${updateRes.status})`);

  // Briefing apenas se aterrissar em VENDAS/SEM_CONTATO.
  if (stageId === STAGES_VENDAS.SEM_CONTATO) {
    await postRichSellerNote(apiToken, dealId, lead, supabase, formResponses, {
      headerPrefix: `<b>🔄 [Dra. L.I.A.] Deal reativado: Estagnados → Funil de Vendas (Sem contato)</b><br><br>`,
    });
  } else {
    console.log(`[lia-assign] Skip seller briefing on moveDealToVendas — stage=${stageId} ≠ SEM_CONTATO`);
  }
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
        // ORIGIN FROZEN: origin already set on POST /deals; do NOT resend on
        // the enrichment PUT — that would create a redundant origin-change
        // event in the PipeRun timeline.
        const enrichPayload: Record<string, unknown> = {};
        if (cfPayload.length > 0) enrichPayload.custom_fields = cfPayload;
        if (companyId) enrichPayload.company_id = companyId;
        console.log(`[lia-assign] Enriching new deal ${dealId} with ${cfPayload.length} custom fields`);
        const enrichRes = await piperunPut(apiToken, `deals/${dealId}`, enrichPayload);
        console.log(`[lia-assign] New deal custom-field PUT: ${enrichRes.success} (${enrichRes.status})${!enrichRes.success ? " body=" + JSON.stringify(enrichRes.data).slice(0, 500) : ""}`);
        // Persist successfully sent custom fields locally for audit / dedupe.
        // Mirrors the snapshot block in updateExistingDeal so newly-created
        // deals do not leave lia_attendances.piperun_custom_fields as [].
        if (enrichRes.success && cfPayload.length > 0) {
          try {
            await supabase
              .from("lia_attendances")
              .update({ piperun_custom_fields: customFields })
              .eq("id", lead.id as string);
          } catch (e) {
            console.warn("[lia-assign] Failed to persist piperun_custom_fields snapshot (new deal):", e);
          }
        }
      }
      // Add structured HTML note for PipeRun
      // Gate: briefing somente para criação em Funil Comercial (VENDAS) / Sem contato.
      if (pipelineId === PIPELINES.VENDAS && stageId === STAGES_VENDAS.SEM_CONTATO) {
        await postRichSellerNote(apiToken, Number(dealId), lead, supabase, formResponses);
      } else {
        console.log(`[lia-assign] Skip seller briefing on createNewDeal — pipeline=${pipelineId} stage=${stageId} (only VENDAS/SEM_CONTATO posts briefing)`);
      }
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

// ─── §4.6 Estagnados → Vendas: Motivo de perda "Novo interesse" ───

const LOST_REASON_NOVO_INTERESSE = "Novo interesse";
const lostReasonCache = new Map<string, number>();

/**
 * Resolve (ou cria) o ID do motivo de perda "Novo interesse", usado para
 * fechar deals do Funil Estagnados quando um lead reage a um novo anúncio
 * ou formulário. Cache em memória por invocação — mesmo padrão de
 * resolveOriginId.
 */
async function resolveLostReasonId(apiToken: string): Promise<number | null> {
  if (lostReasonCache.has(LOST_REASON_NOVO_INTERESSE)) {
    return lostReasonCache.get(LOST_REASON_NOVO_INTERESSE)!;
  }
  try {
    const searchRes = await piperunGet(apiToken, "lostReasons", { name: LOST_REASON_NOVO_INTERESSE, show: 5 });
    if (searchRes.success && searchRes.data) {
      const items = (searchRes.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      const exact = items?.find(
        (r) => String(r.name).trim().toLowerCase() === LOST_REASON_NOVO_INTERESSE.toLowerCase(),
      );
      if (exact?.id) {
        const id = Number(exact.id);
        lostReasonCache.set(LOST_REASON_NOVO_INTERESSE, id);
        console.log(`[lia-assign] Lost reason found: "${LOST_REASON_NOVO_INTERESSE}" → ${id}`);
        return id;
      }
    }
    console.log(`[lia-assign] Creating lost reason: "${LOST_REASON_NOVO_INTERESSE}" (no exact match)`);
    const createRes = await piperunPost(apiToken, "lostReasons", {
      name: LOST_REASON_NOVO_INTERESSE,
      status: false, // false = ativo (conforme doc PipeRun)
    });
    if (createRes.success && createRes.data) {
      const created = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (created?.id) {
        const id = Number(created.id);
        lostReasonCache.set(LOST_REASON_NOVO_INTERESSE, id);
        console.log(`[lia-assign] Lost reason created: "${LOST_REASON_NOVO_INTERESSE}" → ${id}`);
        return id;
      }
    }
    console.warn(
      `[lia-assign] Could not resolve/create lost reason "${LOST_REASON_NOVO_INTERESSE}" — deal será fechado sem lost_reason_id`,
    );
  } catch (e) {
    console.warn("[lia-assign] Lost reason resolution error:", e);
  }
  return null;
}

/**
 * Fecha um deal como "Perdido" (status=2) com motivo informado.
 * `status: 2` = perdida — validado empiricamente contra DEAL_STATUS_MAP
 * desta conta (a doc pública cita 3, mas 2 é o valor que persiste no UI).
 */
async function closeDealAsLost(
  apiToken: string,
  dealId: number,
  lostReasonId: number | null,
  reasonComment: string,
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    status: 2,
    reason_close: reasonComment,
    closed_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  if (lostReasonId != null) payload.lost_reason_id = lostReasonId;
  console.log(`[lia-assign] Closing deal ${dealId} as Perdido (motivo="${LOST_REASON_NOVO_INTERESSE}")`);
  const res = await piperunPut(apiToken, `deals/${dealId}`, payload);
  console.log(
    `[lia-assign] Close-as-lost deal ${dealId}: ${res.success} (${res.status})${!res.success ? " body=" + JSON.stringify(res.data).slice(0, 400) : ""}`,
  );
  return res.success;
}

/**
 * Detecta intervenção manual do vendedor no deal Estagnados. Retorna
 * `intervened=true` se qualquer sinal indicar que um humano (vendedor)
 * já mexeu no deal — nesse caso o patch NÃO fecha como "Novo interesse".
 *
 * Sinais (cascata barata → cara):
 *  1. Alguma nota no deal com `user_id` mapeando a um team_member
 *     `role='vendedor'` ativo (via GET deals/{id}/notes).
 */
async function hasSellerIntervention(
  apiToken: string,
  supabase: ReturnType<typeof createClient>,
  estagnDeal: Record<string, unknown>,
): Promise<{ intervened: boolean; signal: string }> {
  const dealId = Number(estagnDeal.id);
  try {
    const notesRes = await piperunGet(apiToken, `deals/${dealId}/notes`, { show: 50 });
    if (notesRes.success && notesRes.data) {
      const notes = (notesRes.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      const userIds = Array.from(
        new Set(
          (notes ?? [])
            .map((n) => Number(n.user_id))
            .filter((v) => Number.isFinite(v) && v > 0),
        ),
      );
      if (userIds.length > 0) {
        const { data: sellers } = await supabase
          .from("team_members")
          .select("piperun_owner_id")
          .in("piperun_owner_id", userIds)
          .eq("ativo", true)
          .eq("role", "vendedor");
        if (sellers && sellers.length > 0) {
          const matched = sellers[0].piperun_owner_id;
          return { intervened: true, signal: `note_by_vendedor:${matched}` };
        }
      }
    } else {
      console.warn(`[lia-assign] hasSellerIntervention: notes fetch failed for deal ${dealId} (${notesRes.status}) — assuming no intervention`);
    }
  } catch (e) {
    console.warn(`[lia-assign] hasSellerIntervention error for deal ${dealId}:`, e);
  }
  return { intervened: false, signal: "no_signal" };
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
  // WALEADS_ENABLED: priorização por WaLeads pausada
  // if (WALEADS_ENABLED) {
  //   // Priority: vendedores with waleads_api_key configured
  //   const { data: waMembers } = await supabase
  //     .from("team_members")
  //     .select("id, nome_completo, piperun_owner_id")
  //     .eq("ativo", true)
  //     .eq("role", "vendedor")
  //     .not("waleads_api_key", "is", null);
  //
  //   if (waMembers && waMembers.length > 0) {
  //     const idx = Math.floor(Math.random() * waMembers.length);
  //     console.log(`[lia-assign] Selected WaLeads-enabled vendedor: ${waMembers[idx].nome_completo}`);
  //     return waMembers[idx] as TeamMember;
  //   }
  // }

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
  // Enrich in-memory from canonical siblings + Omie signal (does NOT persist).
  const { enriched: enrichedLead, meta: enrichMeta } = await enrichLeadFromIdentity(supabase, lead);
  const phone = (enrichedLead.telefone_normalized || enrichedLead.telefone_raw) as string | null;

  // Fetch last user message via leads bridge
  let lastQuestion = "";
  try {
    const { data: leadsRec } = await supabase
      .from("leads")
      .select("id")
      .eq("email", enrichedLead.email as string)
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
  const dealsCtx = await fetchDealsContext(supabase, enrichedLead);

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(enrichedLead, dealsCtx);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[lia-assign] AI historico/oportunidade failed:", e);
  }

  // Fallback static texts
  if (!historico) {
    historico = buildHistoricoFallback(enrichedLead, dealsCtx);
  }
  if (!oportunidade) {
    const parts: string[] = [];
    if (enrichedLead.software_cad) parts.push(`Possui software CAD (${enrichedLead.software_cad})`);
    const imp = enrichedLead.impressora_modelo || enrichedLead.equip_impressora;
    if (imp) parts.push(`Impressora: ${imp}`);
    else if (enrichedLead.tem_impressora && enrichedLead.tem_impressora !== "nao" && enrichedLead.tem_impressora !== "não") parts.push(`Tem impressora: ${enrichedLead.tem_impressora}`);
    const scn = enrichedLead.scanner_marca || enrichedLead.equip_scanner;
    if (scn) parts.push(`Scanner: ${scn}`);
    else if (enrichedLead.tem_scanner && enrichedLead.tem_scanner !== "nao" && enrichedLead.tem_scanner !== "não") parts.push(`Tem scanner: ${enrichedLead.tem_scanner}`);
    if (enrichedLead.omie_codigo_cliente) parts.push(`Cliente Smart Dent (Omie #${enrichedLead.omie_codigo_cliente}) — faturado R$${enrichedLead.omie_faturamento_total || 0}`);
    if (enrichedLead.urgency_level) parts.push(`Urgência ${enrichedLead.urgency_level}`);
    if (enrichedLead.primary_motivation) parts.push(`motivado por ${enrichedLead.primary_motivation}`);
    if (enrichedLead.objection_risk) parts.push(`Risco de objeção: ${enrichedLead.objection_risk}`);
    oportunidade = parts.length > 0 ? parts.join(". ") + "." : "Sem dados suficientes.";
  }

  // Deterministic cognitive fallback when cognitive_analysis hasn't run yet.
  const cog = enrichedLead.cognitive_analysis
    ? {
        confidence: Number(enrichedLead.confidence_score_analysis || 0),
        estagio: String(enrichedLead.lead_stage_detected || "N/A"),
        urgencia: String(enrichedLead.urgency_level || "N/A"),
        timeline: String(enrichedLead.interest_timeline || "N/A"),
        perfil: String(enrichedLead.psychological_profile || "N/A"),
        motivacao: String(enrichedLead.primary_motivation || "N/A"),
        risco: String(enrichedLead.objection_risk || "N/A"),
        abordagem: String(enrichedLead.recommended_approach || "N/A"),
        is_fallback: false as const,
      }
    : buildDeterministicCognitiveFallback(enrichedLead);
  const urgencyEmoji = (cog.urgencia === "alta") ? "🔴" : (cog.urgencia === "media") ? "🟡" : "🟢";
  const cogHeader = cog.is_fallback
    ? "📋 *Perfil Inicial* (análise cognitiva completa após primeiras conversas com a LIA)"
    : "🧠 *Análise Cognitiva:*";

  // 7×3 Workflow Diagnosis (stack atual × intent → perguntas + combo + posicionamento)
  let diagBlock = "";
  try {
    const diag = await diagnoseLead(supabase, enrichedLead, { enableLLM: true });
    diagBlock = renderDiagnosisWhatsApp(diag);
  } catch (e) {
    console.warn("[lia-assign] workflow diagnosis (wa) failed:", e);
  }

  // Build template
  const lines: string[] = [
    `🤖 *Novo Lead atribuído - Dra. L.I.A.*`,
    ``,
    `👤 Lead: ${enrichedLead.nome || "N/A"}`,
    `📧 Email: ${enrichedLead.email || "N/A"}`,
    `📱 Tel: ${phone || "N/A"}`,
    ...buildOriginLines(enrichedLead, "wa"),
    `🦷 Área de atuação: ${enrichedLead.area_atuacao || "N/A"}`,
    `🦷 Especialidade: ${enrichedLead.especialidade || "N/A"}`,
    `🎯 Interesse: ${enrichedLead.produto_interesse || "N/A"}`,
    `🌡️ Temp: ${enrichedLead.temperatura_lead || cog.urgencia}`,
    `🔗 PipeRun: ${enrichedLead.piperun_link || "N/A"}`,
    `💬 Última pergunta do lead: ${lastQuestion || "N/A"}`,
    `🏷️ Contexto: ${enrichedLead.rota_inicial_lia || "N/A"}`,
    `📍 Etapa CRM: ${enrichedLead.ultima_etapa_comercial || "N/A"}`,
    ``,
    ...(diagBlock ? [diagBlock, ``] : []),
    `*HISTÓRICO:* ${historico}`,
    `*OPORTUNIDADE:* ${oportunidade}`,
    ``,
    cogHeader,
    `Confiança: ${cog.confidence}%`,
    `Estágio: ${cog.estagio}`,
    `Urgência: ${urgencyEmoji} ${cog.urgencia}`,
    `Timeline: ${cog.timeline}`,
    `Perfil: ${cog.perfil}`,
    `Motivação: ${cog.motivacao}`,
    `Risco objeção: ${cog.risco}`,
    `Abordagem: ${cog.abordagem}`,
  ];

  // Fire-and-forget audit
  if (enrichedLead.id) {
    logBriefingAudit(supabase, String(enrichedLead.id), enrichMeta, lines.join("\n").length, (enrichedLead.email as string | null) ?? null);
  }

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
  const { enriched: enrichedLead } = await enrichLeadFromIdentity(supabase, lead);
  const phone = (enrichedLead.telefone_normalized || enrichedLead.telefone_raw) as string | null;

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
  const dealsCtx = await fetchDealsContext(supabase, enrichedLead);

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(enrichedLead, dealsCtx);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[lia-assign] AI historico/oportunidade failed:", e);
  }

  // Fallback static texts
  if (!historico) {
    historico = buildHistoricoFallback(enrichedLead, dealsCtx);
  }
  if (!oportunidade) {
    const parts: string[] = [];
    if (enrichedLead.software_cad) parts.push(`Possui software CAD (${enrichedLead.software_cad})`);
    const imp = enrichedLead.impressora_modelo || enrichedLead.equip_impressora;
    if (imp) parts.push(`Impressora: ${imp}`);
    const scn = enrichedLead.scanner_marca || enrichedLead.equip_scanner;
    if (scn) parts.push(`Scanner: ${scn}`);
    if (enrichedLead.omie_codigo_cliente) parts.push(`Cliente Smart Dent (Omie #${enrichedLead.omie_codigo_cliente}) — faturado R$${enrichedLead.omie_faturamento_total || 0}`);
    if (enrichedLead.urgency_level) parts.push(`Urgência ${enrichedLead.urgency_level}`);
    if (enrichedLead.primary_motivation) parts.push(`motivado por ${enrichedLead.primary_motivation}`);
    if (enrichedLead.objection_risk) parts.push(`Risco de objeção: ${enrichedLead.objection_risk}`);
    oportunidade = parts.length > 0 ? parts.join(". ") + "." : "Sem dados suficientes.";
  }

  const cog = enrichedLead.cognitive_analysis
    ? {
        confidence: Number(enrichedLead.confidence_score_analysis || 0),
        estagio: String(enrichedLead.lead_stage_detected || "N/A"),
        urgencia: String(enrichedLead.urgency_level || "N/A"),
        timeline: String(enrichedLead.interest_timeline || "N/A"),
        perfil: String(enrichedLead.psychological_profile || "N/A"),
        motivacao: String(enrichedLead.primary_motivation || "N/A"),
        risco: String(enrichedLead.objection_risk || "N/A"),
        abordagem: String(enrichedLead.recommended_approach || "N/A"),
        is_fallback: false as const,
      }
    : buildDeterministicCognitiveFallback(enrichedLead);
  const urgencyEmoji = (cog.urgencia === "alta") ? "🔴" : (cog.urgencia === "media") ? "🟡" : "🟢";
  const cogHeader = cog.is_fallback
    ? "📋 Perfil Inicial (análise cognitiva virá após primeiras conversas com a LIA)"
    : "🧠 Análise Cognitiva:";

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
    `<b>👤 Lead:</b> ${enrichedLead.nome || "N/A"}<br>`,
    `<b>📧 Email:</b> ${enrichedLead.email || "N/A"}<br>`,
    `<b>📱 Tel:</b> ${phone || "N/A"}<br>`,
    ...buildOriginLines(enrichedLead, "html"),
    `<b>🦷 Área de atuação:</b> ${enrichedLead.area_atuacao || "N/A"}<br>`,
    `<b>🦷 Especialidade:</b> ${enrichedLead.especialidade || "N/A"}<br>`,
    `<b>🎯 Interesse:</b> ${enrichedLead.produto_interesse || "N/A"}<br>`,
    `<b>🌡️ Temp:</b> ${enrichedLead.temperatura_lead || cog.urgencia}<br>`,
    `<b>🔗 PipeRun:</b> ${enrichedLead.piperun_link || "N/A"}<br>`,
    `<b>💬 Última pergunta:</b> ${lastQuestion || "N/A"}<br>`,
    `<b>🏷️ Contexto:</b> ${enrichedLead.rota_inicial_lia || "N/A"}<br>`,
    `<b>📍 Etapa CRM:</b> ${enrichedLead.ultima_etapa_comercial || "N/A"}<br>`,
    dealsCountText,
    `<hr>`,
    `<b>HISTÓRICO:</b> ${historico}<br>`,
    `<b>OPORTUNIDADE:</b> ${oportunidade}<br>`,
    `<hr>`,
    `<b>${cogHeader}</b><br>`,
    `<b>Confiança:</b> ${cog.confidence}%<br>`,
    `<b>Estágio:</b> ${cog.estagio}<br>`,
    `<b>Urgência:</b> ${urgencyEmoji} ${cog.urgencia}<br>`,
    `<b>Timeline:</b> ${cog.timeline}<br>`,
    `<b>Perfil:</b> ${cog.perfil}<br>`,
    `<b>Motivação:</b> ${cog.motivacao}<br>`,
    `<b>Risco objeção:</b> ${cog.risco}<br>`,
    `<b>Abordagem:</b> ${cog.abordagem}<br>`,
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
    // DEDUP: garantir que briefing seja enviado apenas 1x por lead por dia
    const leadId = lead.id as string;
    const { data: lockAcquired } = await supabase
      .rpc('try_acquire_briefing_lock', { p_lead_id: leadId });
    if (!lockAcquired) {
      console.log(`[lia-assign] Briefing já enviado hoje para ${leadId}, bloqueado`);
      return;
    }

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
  formResponses?: Array<{ label?: string; value?: unknown }>,
  opts: { newConversionConfirmed?: boolean; conversionKey?: string | null } = {},
): Promise<boolean> {
  const leadId = lead.id as string;
  const leadEmail = (lead.email as string).trim().toLowerCase();

  // Fail-safe definitivo: nenhum caller legado pode reativar Estagnados ou criar
  // Deal em VENDAS sem prova explícita de nova conversão real. Re-entrega Meta,
  // reprocessamento de fila e form antigo são sempre CDP-only.
  if (opts.newConversionConfirmed !== true || !opts.conversionKey) {
    console.warn(
      `[lia-assign] SDR-CAPTAÇÃO BLOQUEADA: sem prova de nova conversão para lead ${leadId} (${leadEmail})`,
    );
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "smart-ops-lia-assign",
        severity: "warning",
        error_type: "sdr_captacao_blocked_no_new_conversion",
        lead_id: leadId,
        lead_email: leadEmail,
        details: {
          source: lead.source,
          form_name: lead.form_name,
          piperun_id: lead.piperun_id ?? null,
          reason: "missing_new_conversion_confirmation",
        },
      });
    } catch {}
    return false;
  }

  try {
    const { data: priorConversion } = await supabase
      .from("lead_activity_log")
      .select("id, event_timestamp")
      .eq("lead_id", leadId)
      .eq("entity_id", opts.conversionKey)
      .in("event_type", ["deal_reativado_via_formulario", "commercial_conversion_consumed"])
      .order("event_timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorConversion?.id) {
      console.warn(
        `[lia-assign] SDR-CAPTAÇÃO BLOQUEADA: conversion_key já consumida (${opts.conversionKey})`,
      );
      await supabase.from("system_health_logs").insert({
        function_name: "smart-ops-lia-assign",
        severity: "warning",
        error_type: "sdr_captacao_blocked_conversion_key_reused",
        lead_id: leadId,
        lead_email: leadEmail,
        details: {
          conversion_key: opts.conversionKey,
          prior_event_at: priorConversion.event_timestamp,
        },
      });
      return false;
    }
  } catch (e) {
    console.warn("[lia-assign] SDR-CAPTAÇÃO conversion_key lookup failed — fail-closed:", e);
    return false;
  }

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

  // ─── GOLDEN RULE: aborta antes de mexer em Estagnados e antes de criar
  // novo Deal em VENDAS se já existe VENDAS aberto/recente.
  const allDealsForVerdict = mergeDealsWithLocalHistory(allDeals, lead as Record<string, unknown>);
  const verdict = assertCanCreateNewDeal(
    allDealsForVerdict as unknown as Array<{ id: string | number; pipeline_id: number; status: number; freezed?: boolean; created_at?: string; updated_at?: string }>,
    { force_new_deal: false },
  );
  if (!verdict.allowed) {
    console.log(
      `[lia-assign] SDR-CAPTAÇÃO GOLDEN RULE BLOCK: ${verdict.reason} (preserved=${verdict.preservedDeal?.id ?? "n/a"}) — sem criação de deal, sem fechamento de Estagnados`,
    );
    try {
      await supabase.from("lead_activity_log").insert({
        lead_id: leadId,
        event_type: "golden_rule_blocked_sdr_captacao",
        entity_type: "deal",
        entity_id: verdict.preservedDeal?.id ? String(verdict.preservedDeal.id) : null,
        entity_name: "SDR-Captação reativação bloqueada (regra de ouro)",
        event_data: {
          reason: verdict.reason,
          preserved_deal_id: verdict.preservedDeal?.id ? String(verdict.preservedDeal.id) : null,
          person_id: personId,
          estagnados_open: estagnDeals.map((d) => String(d.id)),
        },
        source_channel: "form",
        event_timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[lia-assign] SDR-CAPTAÇÃO golden rule log failed:", e);
    }
    return false;
  }

  // Funil Estagnados NÃO é mais fechado automaticamente — usuário pediu
  // explicitamente "não toque". Apenas log para auditoria.
  console.log(
    `[lia-assign] SDR-CAPTAÇÃO: ${estagnDeals.length} deal(s) Estagnados detectados, NÃO fechados (regra: não tocar em Estagnados via automação). ids=${estagnDeals.map((d) => d.id).join(",")}`,
  );

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

  // ── Trava atômica DB-level (defense-in-depth Regra de Ouro) ──
  const claim = await claimDealCreateSlot(
    supabase,
    leadId,
    personId,
    `sdr_captacao:${String(lead.form_name ?? "")}`,
  );
  if (!claim.ok) {
    console.warn(
      `[lia-assign] SDR-CAPTAÇÃO: lock_held para lead ${leadId} — abortando criação concorrente`,
    );
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "smart-ops-lia-assign",
        severity: "warning",
        error_type: "deal_create_lock_held",
        lead_id: leadId,
        lead_email: leadEmail,
        details: { stage: "sdr_captacao", person_id: personId },
      });
    } catch {}
    return false;
  }
  let newDealId: string | number | null = null;
  try {
    // Re-fetch fresh lead.piperun_id (pode ter sido setado por execução concorrente).
    const { data: freshLead } = await supabase
      .from("lia_attendances")
      .select("piperun_id")
      .eq("id", leadId)
      .maybeSingle();
    if (freshLead?.piperun_id) {
      console.log(
        `[lia-assign] SDR-CAPTAÇÃO: lead.piperun_id=${freshLead.piperun_id} já setado (race) → abortando criação`,
      );
      await releaseDealCreateSlot(supabase, leadId);
      return false;
    }
    // ── Cached Deal Validator (defesa #3): valida lead.piperun_id direto via
    // GET /deals/:id antes de criar novo. Cobre o cenário "findPersonDeals
    // empty silencioso por throttling" (Flavia Flores 2026-06-24).
    const cachedDealIdSdr = (lead.piperun_id as string | number | null) ?? null;
    if (cachedDealIdSdr) {
      const validation = await validateCachedDealIsActiveVendas(
        cachedDealIdSdr,
        async (id) => {
          const check = await piperunGet(apiToken, `deals/${id}`, {});
          if (!check?.success) return { ok: false };
          const dealData = (check.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
          return { ok: true, deal: dealData ?? null };
        },
      );
      if (validation.preserve) {
        const preservedId = String(validation.deal_id ?? cachedDealIdSdr);
        const flowType = validation.fetch_ok === false
          ? "preserve_cached_on_validation_failure"
          : "preserve_cached_deal_validated";
        console.log(
          `[lia-assign] CACHED-DEAL VALIDATOR (sdr_captacao): preserved ${preservedId} (${validation.reason}, fetch_ok=${validation.fetch_ok})`,
        );
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: validation.fetch_ok === false ? "warning" : "info",
            error_type: flowType,
            lead_id: leadId,
            lead_email: leadEmail,
            details: {
              cached_piperun_id: String(cachedDealIdSdr),
              validation_reason: validation.reason,
              pipeline_id: validation.pipeline_id ?? null,
              status: validation.status ?? null,
              person_id: personId,
              stage: "sdr_captacao",
            },
          });
        } catch {}
        try {
          await supabase.from("lead_activity_log").insert({
            lead_id: leadId,
            event_type: "vendas_duplicates_detected_noop",
            entity_type: "deal",
            entity_id: preservedId,
            entity_name: "Cached deal validator preservou VENDAS (sdr_captacao)",
            event_data: {
              kept_deal: preservedId,
              reason: validation.reason,
              fetch_ok: validation.fetch_ok ?? null,
              flow_type: flowType,
            },
            source_channel: "form",
            event_timestamp: new Date().toISOString(),
          });
        } catch {}
        await releaseDealCreateSlot(supabase, leadId);
        return false;
      }
    }
    newDealId = await createNewDeal(
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
  } finally {
    await releaseDealCreateSlot(supabase, leadId);
  }

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

  await supabase.from("lead_activity_log").insert({
    lead_id: leadId,
    event_type: "commercial_conversion_consumed",
    entity_type: "conversion_key",
    entity_id: String(opts.conversionKey),
    entity_name: "Nova conversão comercial consumida",
    event_data: {
      conversion_key: String(opts.conversionKey),
      novo_deal_id: newDealId,
      flow: "sdr_captacao_reativacao",
    },
    source_channel: "form",
    event_timestamp: new Date().toISOString(),
  });

  return true;
}

// ─── Main Handler ───

// ─── §4.6 ENRICHMENT RE-DELIVERY: Route deal-only ───
//
// Disparada SOMENTE pelo dedupe `meta_form_history_12h` em ingest-lead
// (re-entrega Meta < 12h após primeira submissão do MESMO form). NÃO cria
// Person, NÃO toca origin, NÃO dispara cognitive/WhatsApp/Sellflux. Apenas
// roteia o Deal segundo a régua espelho de SDR-CAPTAÇÃO:
//   • Open deal em VENDAS  → updateExistingDeal + nota curta (GOLDEN RULE)
//   • Open deals em outros funis → fecha como Perdido + Fresh Round Robin +
//                                   createNewDeal em VENDAS/SEM_CONTATO
//   • Nenhum deal aberto → Fresh Round Robin + createNewDeal
//   • Sem pessoa_piperun_id → abort (route_skipped)
//   • Won deals (status=1) NUNCA são tocados (apenas filtramos status=0).
async function executarEnrichmentDealRoute(
  apiToken: string,
  supabase: ReturnType<typeof createClient>,
  lead: Record<string, unknown>,
  enrichmentFormName: string | null,
  enrichedFields: string[],
): Promise<Record<string, unknown>> {
  const leadId = lead.id as string;
  const leadEmail = ((lead.email as string) || "").trim().toLowerCase();
  const personId = (lead.pessoa_piperun_id as number | null) ?? null;
  if (!personId) {
    console.warn("[lia-assign] enrichment-route: missing pessoa_piperun_id for", leadEmail);
    return { flow_type: "route_skipped", reason: "missing_person" };
  }
  const companyId = (lead.empresa_piperun_id as number | null) ?? null;

  // ─── GUARD A: Cognitive lock por lead (anti-loop sub-minuto) ───
  // TTL 60s. Bloqueia execuções concorrentes do enrichment-route para o
  // mesmo lead independente do caminho de entrada.
  let lockAcquired = false;
  try {
    const { data: existingLock } = await supabase
      .from("cognitive_lead_locks")
      .select("locked_at, ttl_seconds")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (existingLock?.locked_at) {
      const ageSec = (Date.now() - new Date(existingLock.locked_at as string).getTime()) / 1000;
      const ttl = Number(existingLock.ttl_seconds ?? 60);
      if (ageSec < ttl) {
        console.log(
          `[lia-assign] enrichment-route GUARD A: lock ativo (age=${ageSec.toFixed(1)}s, ttl=${ttl}s) — abort`,
        );
        return { flow_type: "lock_held", reason: "concurrent_redelivery", piperun_id: null };
      }
    }
    await supabase
      .from("cognitive_lead_locks")
      .upsert(
        { lead_id: leadId, locked_at: new Date().toISOString(), ttl_seconds: 60 },
        { onConflict: "lead_id" },
      );
    lockAcquired = true;
  } catch (e) {
    console.warn("[lia-assign] enrichment-route GUARD A: lock op falhou (continua sem lock):", e);
  }

  try {

  // ─── GUARD B: Throttle 72h por pessoa_piperun_id ───
  // Conta deal_reativado_via_redelivery nas últimas 72h em QUALQUER lead
  // canônico da mesma pessoa. Se >= 1, apenas adiciona nota no último deal
  // VENDAS (não cria deal novo, não roda Round Robin, não fecha nada).
  {
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const { data: siblingLeads } = await supabase
      .from("lia_attendances")
      .select("id")
      .eq("pessoa_piperun_id", personId)
      .is("merged_into", null);
    const siblingIds = (siblingLeads ?? []).map((r) => r.id as string);
    if (siblingIds.length > 0) {
      const { count: redeliveryCount } = await supabase
        .from("lead_activity_log")
        .select("id", { count: "exact", head: true })
        .in("lead_id", siblingIds)
        .eq("event_type", "deal_reativado_via_redelivery")
        .gte("event_timestamp", cutoff72h);
      if ((redeliveryCount ?? 0) >= 1) {
        const allDealsForGuard = await findPersonDeals(apiToken, personId);
        // Alvo da nota: priorizar o deal CANÔNICO do lead se ainda estiver
        // aberto em VENDAS/CS — assim a nota cai no deal legítimo, e não em
        // duplicatas mais novas criadas por automação externa do PipeRun.
        const canonicalPid = String((lead as Record<string, unknown>).piperun_id ?? "").trim();
        const PROTECTED_FOR_NOTE = new Set<number>([
          PIPELINES.VENDAS,
          PIPELINES.CS_ONBOARDING,
          PIPELINES.GANHOS_ALEATORIOS_CS,
        ]);
        let targetDeal: Record<string, unknown> | undefined;
        if (canonicalPid) {
          targetDeal = allDealsForGuard.find(
            (d) =>
              String(d.id) === canonicalPid &&
              Number(d.status) === 0 &&
              PROTECTED_FOR_NOTE.has(Number(d.pipeline_id)),
          );
        }
        if (!targetDeal) {
          targetDeal = allDealsForGuard
            .filter((d) => Number(d.pipeline_id) === PIPELINES.VENDAS && Number(d.status) === 0)
            .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))[0];
        }
        if (!targetDeal) {
          targetDeal = allDealsForGuard
            .filter((d) => Number(d.pipeline_id) === PIPELINES.VENDAS)
            .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))[0];
        }
        const latestVendas = targetDeal;
        // NOTA SUPRIMIDA: re-entrega Meta throttled não posta nota no PipeRun.
        // Apenas auditoria interna em lead_activity_log abaixo.
        console.log(
          `[lia-assign] enrichment-route GUARD B: throttled (${redeliveryCount} redeliveries em 72h para person ${personId})`,
        );
        await supabase.from("lead_activity_log").insert({
          lead_id: leadId,
          event_type: "deal_enriched_via_redelivery",
          entity_type: "deal",
          entity_id: latestVendas?.id ? String(latestVendas.id) : null,
          entity_name: "Throttled (regra de ouro)",
          event_data: {
            flow_type: "throttled_redelivery_per_person",
            person_id: personId,
            redeliveries_72h: redeliveryCount,
            form_name: enrichmentFormName,
          },
          source_channel: "form",
          event_timestamp: new Date().toISOString(),
        });
        return {
          flow_type: "throttled_redelivery_per_person",
          piperun_id: latestVendas?.id ? String(latestVendas.id) : null,
          created_new: false,
          closed_deals: [],
          reason: "redelivery_72h_per_person",
        };
      }
    }
  }

  const allDeals = await findPersonDeals(apiToken, personId);
  const openDeals = allDeals.filter((d) => Number(d.status) === 0);
  // Multiple open VENDAS deals can pile up over time (CSV imports + form
  // re-deliveries + manual re-opens). Sort by updated_at desc and keep ONE
  // canonical; the others will be closed as duplicates further below.
  const openVendasDeals = openDeals
    .filter((d) => Number(d.pipeline_id) === PIPELINES.VENDAS && !d.freezed)
    .sort((a, b) => {
      const at = String((a.updated_at as string) || (a.created_at as string) || "");
      const bt = String((b.updated_at as string) || (b.created_at as string) || "");
      return bt.localeCompare(at);
    });
  const vendaDeal = openVendasDeals[0];
  const duplicateVendasDeals = openVendasDeals.slice(1);
  // Pipelines protegidos: NUNCA fechados por re-entrega Meta. Cliente em
  // onboarding/CS pode receber novo deal em VENDAS (nova intenção comercial)
  // mas o trabalho de CS é preservado intacto.
  const PROTECTED_PIPELINES = new Set<number>([
    PIPELINES.CS_ONBOARDING,
    PIPELINES.GANHOS_ALEATORIOS_CS,
  ]);
  const otherOpenDeals = openDeals.filter(
    (d) =>
      Number(d.pipeline_id) !== PIPELINES.VENDAS &&
      !PROTECTED_PIPELINES.has(Number(d.pipeline_id)),
  );
  const preservedCsDeals = openDeals.filter((d) =>
    PROTECTED_PIPELINES.has(Number(d.pipeline_id)),
  );

  const customFields = mapAttendanceToDealCustomFields(lead);
  if (!customFields.some((f) => f.custom_field_id === DEAL_CUSTOM_FIELDS.WHATSAPP)) {
    const phone = lead.telefone_raw as string | null;
    if (phone) customFields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.WHATSAPP, value: phone });
  }

  // ─── GUARD D: Regra de ouro — se já existe QUALQUER deal VENDAS (aberto OU
  // Perdido nos últimos 30d), não criar novo, não rodar Round Robin, não
  // fechar outros funis. Apenas adicionar nota no deal VENDAS mais recente.
  // Aplica somente quando NÃO há deal VENDAS aberto (CASE A já trata isso).
  if (!vendaDeal) {
    const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentVendasLost = allDeals
      .filter((d) => Number(d.pipeline_id) === PIPELINES.VENDAS)
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))
      .find((d) => {
        const ts = new Date(String(d.updated_at ?? d.created_at ?? "")).getTime();
        return Number.isFinite(ts) && ts >= cutoff30d;
      });
    if (recentVendasLost?.id) {
      console.log(
        `[lia-assign] enrichment-route GUARD D: deal VENDAS recente (${recentVendasLost.id}, status=${recentVendasLost.status}) — apenas nota, regra de ouro`,
      );
      // NOTA SUPRIMIDA: regra de ouro só registra em lead_activity_log.
      await supabase.from("lead_activity_log").insert({
        lead_id: leadId,
        event_type: "deal_enriched_via_redelivery",
        entity_type: "deal",
        entity_id: String(recentVendasLost.id),
        entity_name: "Re-entrega preservada (regra de ouro)",
        event_data: {
          flow_type: "golden_rule_preserved",
          deal_id: String(recentVendasLost.id),
          deal_status: recentVendasLost.status,
          form_name: enrichmentFormName,
        },
        source_channel: "form",
        event_timestamp: new Date().toISOString(),
      });
      return {
        flow_type: "golden_rule_preserved",
        piperun_id: String(recentVendasLost.id),
        created_new: false,
        closed_deals: [],
      };
    }
  }

  // CASE A — Deal aberto em VENDAS → preserva owner + atualiza
  if (vendaDeal) {
    const dealOwnerId = Number(vendaDeal.owner_id ?? 0);
    // ── NO-OP REDELIVERY GUARD ──
    // If the upstream invocation reports zero enriched fields AND there are
    // no duplicate VENDAS deals to clean up, this is a pure Meta re-delivery
    // with nothing to do. Skip the PipeRun PUT + lead_activity_log insert to
    // stop the Smart Ops timeline spam.
    if (enrichedFields.length === 0 && duplicateVendasDeals.length === 0) {
      console.log(
        `[lia-assign] CASE A NO-OP: deal=${vendaDeal.id} (no enrichment, no dupes) — skipping PUT + activity log`,
      );
      // Keep piperun_id pointer in sync only if drifted.
      if (Number(lead.piperun_id ?? 0) !== Number(vendaDeal.id)) {
        await supabase
          .from("lia_attendances")
          .update({ piperun_id: Number(vendaDeal.id) })
          .eq("id", leadId);
      }
      return {
        flow_type: "preserve_vendas_noop",
        piperun_id: String(vendaDeal.id),
        created_new: false,
        closed_deals: [],
      };
    }
    // ── CONSOLIDATE DUPLICATE OPEN VENDAS DEALS ──
    const consolidatedDupes: Array<{ id: string }> = [];
    if (duplicateVendasDeals.length > 0) {
      // PROIBIDO tocar em deals do Funil de Vendas via automação.
      // Não fechar duplicatas, não postar nota. Apenas registrar log interno
      // para auditoria manual.
      console.log(
        `[lia-assign] CASE A: ${duplicateVendasDeals.length} duplicate open VENDAS deals detected — NOT touching (protected pipeline). kept=${vendaDeal.id}`,
      );
      try {
        await supabase.from("lead_activity_log").insert({
          lead_id: leadId,
          event_type: "vendas_duplicates_detected_noop",
          entity_type: "deal",
          entity_id: String(vendaDeal.id),
          entity_name: "Duplicatas VENDAS detectadas (sem ação)",
          event_data: {
            kept_deal: String(vendaDeal.id),
            duplicates: duplicateVendasDeals.map((d) => String(d.id)),
            reason: "protected_pipeline_no_auto_close",
          },
          source_channel: "form",
          event_timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[lia-assign] failed to log duplicates noop:", e);
      }
    }
    console.log(
      `[lia-assign] CASE A preserve_vendas: deal=${vendaDeal.id} enrichedFields=${enrichedFields.length} (${enrichedFields.join(",") || "—"})`,
    );
    try {
      await updateExistingDeal(
        apiToken,
        Number(vendaDeal.id),
        null,
        customFields,
        lead,
        companyId,
        supabase,
        [],
      );
      // NOTA SUPRIMIDA: re-entrega Meta NUNCA posta nota no PipeRun, mesmo
      // quando enriquece campos. Auditoria fica em lead_activity_log abaixo.
    } catch (e) {
      console.error("[lia-assign] enrichment-route: updateExistingDeal failed:", e);
    }
    await supabase
      .from("lia_attendances")
      .update({ piperun_id: Number(vendaDeal.id) })
      .eq("id", leadId);
    await supabase.from("lead_activity_log").insert({
      lead_id: leadId,
      event_type: "deal_enriched_via_redelivery",
      entity_type: "deal",
      entity_id: String(vendaDeal.id),
      entity_name: "Deal preservado em VENDAS",
      event_data: {
        flow_type: "preserve_vendas",
        deal_id: String(vendaDeal.id),
        owner_id: dealOwnerId,
        enriched_fields: enrichedFields,
        form_name: enrichmentFormName,
      },
      source_channel: "form",
      event_timestamp: new Date().toISOString(),
    });
    return {
      flow_type: "preserve_vendas",
      piperun_id: String(vendaDeal.id),
      created_new: false,
      closed_deals: [],
    };
  }

  // ─── GOLDEN RULE FINAL ──────────────────────────────────────────────
  // Chegou até aqui sem deal VENDAS aberto e sem deal recente coberto pelo
  // GUARD D. Re-entrega Meta NUNCA cria deal novo, NUNCA fecha outros funis,
  // NUNCA posta nota no PipeRun. Só registra auditoria interna.
  console.log(
    `[lia-assign] enrichment-route: GOLDEN RULE BLOCK — re-entrega Meta sem deal VENDAS recente, nada criado. person=${personId} form=${enrichmentFormName ?? "n/a"}`,
  );
  try {
    await supabase.from("lead_activity_log").insert({
      lead_id: leadId,
      event_type: "golden_rule_blocked_enrichment",
      entity_type: "lead",
      entity_id: leadId,
      entity_name: "Re-entrega Meta sem nova conversão real — bloqueada",
      event_data: {
        flow_type: "golden_rule_blocked_enrichment",
        person_id: personId,
        form_name: enrichmentFormName,
        enriched_fields: enrichedFields,
        other_open_deals: otherOpenDeals.map((d) => ({
          id: String(d.id),
          pipeline_id: Number(d.pipeline_id),
        })),
        preserved_cs_deals: preservedCsDeals.map((d) => String(d.id)),
      },
      source_channel: "form",
      event_timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[lia-assign] enrichment-route golden rule log failed:", e);
  }
  return {
    flow_type: "golden_rule_blocked_enrichment",
    piperun_id: null,
    created_new: false,
    closed_deals: [],
    reason: "redelivery_without_real_conversion",
  };
  } finally {
    if (lockAcquired) {
      try {
        await supabase.from("cognitive_lead_locks").delete().eq("lead_id", leadId);
      } catch (e) {
        console.warn("[lia-assign] enrichment-route: lock release falhou:", e);
      }
    }
  }
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
    const body = await req.json();
    const {
      email,
      lead_id,
      force,
      trigger,
      source,
      form_responses: inputFormResponses,
      commercial_override,
      force_new_deal,
      new_conversion_confirmed,
      conversion_key,
      enrichment_only_route_deal,
      enrichment_form_name,
      enriched_fields,
    } = body;
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

    // ─── ENRICHMENT-ONLY DEAL ROUTE (LEGADO DESATIVADO) ───
    // Re-entrega/enrichment nunca toca PipeRun: CDP-only.
    if (enrichment_only_route_deal === true) {
      console.log(
        `[lia-assign] ENRICHMENT_ROUTE: lead=${lead.id} form="${enrichment_form_name ?? "n/a"}" fields=[${(enriched_fields ?? []).join(",")}]`,
      );
      // Legacy route disabled: enrichment/redelivery is CDP-only. This path
      // used to move Estagnados back to VENDAS/Sem contato without a new real
      // conversion, which violates the Golden Rule.
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "warning",
          error_type: "enrichment_only_route_deal_disabled_cdp_only",
          lead_id: lead.id,
          lead_email: (lead.email as string) ?? null,
          details: { trigger, form_name: enrichment_form_name, enriched_fields },
        });
      } catch {}
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          mode: "cdp_only_redelivery_no_crm_touch",
          reason: "enrichment_only_route_deal_disabled",
          lead_id: lead.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── GOLDEN RULE FAIL-CLOSED ──
    // Qualquer lead já vinculado a um Deal (VENDAS/ESTAGNADOS/CS/etc.) só pode
    // sofrer ação automática no CRM se o caller trouxer prova explícita de nova
    // conversão real. Sem isso, enriquecimento é somente CDP e não reabre/move
    // para "Sem contato".
    const hasExplicitNewConversion =
      new_conversion_confirmed === true &&
      typeof conversion_key === "string" &&
      conversion_key.trim().length > 0;
    const autoFormSource = ["meta_lead_ads", "form", "formulario"].includes(
      String((lead as Record<string, unknown>).source || source || "").toLowerCase(),
    );
    const hasAnyCrmLink = Boolean(
      lead.piperun_id ||
      (lead as Record<string, unknown>).pessoa_piperun_id ||
      (lead as Record<string, unknown>).piperun_pipeline_id,
    );
    if (force_new_deal !== true && hasAnyCrmLink && autoFormSource && !hasExplicitNewConversion) {
      console.warn(
        `[lia-assign] CRM_TOUCH_BLOCKED: lead ${lead.id} (${lead.email}) já tem vínculo CRM e não há nova conversão confirmada`,
      );
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "warning",
          error_type: "existing_lead_no_new_conversion_cdp_only",
          lead_id: lead.id,
          lead_email: lead.email,
          details: {
            trigger,
            source: (lead as Record<string, unknown>).source || source,
            form_name: lead.form_name,
            piperun_id: lead.piperun_id,
            pessoa_piperun_id: (lead as Record<string, unknown>).pessoa_piperun_id ?? null,
            piperun_pipeline_id: (lead as Record<string, unknown>).piperun_pipeline_id ?? null,
            reason: "automatic_crm_touch_requires_new_conversion_key",
          },
        });
      } catch {}
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "existing_lead_no_new_conversion_cdp_only",
          lead_id: lead.id,
          piperun_id: lead.piperun_id ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Idempotency: skip if processed in last 3 min (unless force=true) ──
    // NOTE: sdr_captacao_reativacao no longer bypasses this guard. The Meta
    // webhook re-delivers the same leadgen_id every ~2 min and previously
    // looped through lia-assign continuously. Reactivation should only fire
    // for *genuinely new* form submissions (already deduped at ingest-lead).
    //
    // RACE-PROOF: we do NOT require `proprietario_lead_crm` to be present —
    // the GOLDEN RULE path temporarily clears it during re-assignment and a
    // concurrent invocation would observe a momentary NULL, bypass the guard,
    // and fully re-process the lead. Anchor only on `piperun_id` (presence
    // means the Deal already exists) + recent `updated_at`.
    if (!force && force_new_deal !== true && lead.piperun_id && lead.updated_at) {
      const lastUpdate = new Date(lead.updated_at).getTime();
      if (Date.now() - lastUpdate < 3 * 60 * 1000) {
        console.log(`[lia-assign] Idempotency skip: lead ${lead.id} updated ${Math.round((Date.now() - lastUpdate)/1000)}s ago (piperun_id=${lead.piperun_id})`);
        return new Response(JSON.stringify({ skipped: true, reason: "recently_assigned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── META RE-DELIVERY KILL-SWITCH (universal) ──
    // Independent of piperun_id state (which can transiently flip to NULL
    // during force_new_deal / GOLDEN RULE re-assignment). If ANY
    // `seller_assigned` event was logged for this lead in the last 10 min,
    // we are inside a meta-pull re-delivery cycle — skip the whole pipeline.
    // This protects against the case where `meta-lead-ads-pull` invokes
    // lia-assign directly (bypassing ingest-lead's HARD_DEDUPE) for leads
    // already in Funil de Vendas.
    if (!force && force_new_deal !== true && lead.id) {
      try {
        const { data: recentAssign } = await supabase
          .from("lead_activity_log")
          .select("id, event_timestamp")
          .eq("lead_id", lead.id)
          .eq("event_type", "seller_assigned")
          .gte("event_timestamp", new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .order("event_timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentAssign?.id) {
          console.log(`[lia-assign] META_REDELIVERY_KILL: lead ${lead.id} had seller_assigned at ${recentAssign.event_timestamp}, skipping (trigger=${trigger})`);
          try {
            await supabase.from("system_health_logs").insert({
              function_name: "smart-ops-lia-assign",
              severity: "info",
              error_type: "meta_redelivery_kill_switch",
              lead_email: (lead as Record<string, unknown>).email as string | null ?? null,
              details: {
                lead_id: lead.id,
                trigger,
                source,
                last_seller_assigned_at: recentAssign.event_timestamp,
                piperun_id: lead.piperun_id ?? null,
                piperun_pipeline_id: (lead as Record<string, unknown>).piperun_pipeline_id ?? null,
              },
            });
          } catch {}
          return new Response(JSON.stringify({
            skipped: true,
            reason: "meta_redelivery_kill_switch",
            last_seller_assigned_at: recentAssign.event_timestamp,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) {
        console.warn("[lia-assign] kill-switch lookup failed:", e);
      }
    }

    // ── §4.5 SDR-CAPTAÇÃO Reativação ──
    if (trigger === "sdr_captacao_reativacao") {
      if (new_conversion_confirmed !== true || !conversion_key) {
        console.warn(
          `[lia-assign] BLOCKED trigger=sdr_captacao_reativacao without explicit new conversion proof for lead ${lead.id}`,
        );
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "warning",
            error_type: "sdr_captacao_blocked_no_new_conversion",
            lead_id: lead.id,
            lead_email: lead.email,
            details: {
              trigger,
              source,
              form_name: lead.form_name,
              piperun_id: lead.piperun_id ?? null,
              piperun_pipeline_id: lead.piperun_pipeline_id ?? null,
            },
          });
        } catch {}
        return new Response(
          JSON.stringify({
            skipped: true,
            reason: "sdr_captacao_blocked_no_new_conversion",
            lead_id: lead.id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      let reativacaoOk = false;
      try {
        reativacaoOk = await executarReativacaoSdrCaptacao(PIPERUN_API_KEY, supabase, lead, inputFormResponses, {
          newConversionConfirmed: new_conversion_confirmed === true,
          conversionKey: String(conversion_key),
        });
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

    // ── VENDAS IMMUTABILITY GUARD ──
    // Se o lead já tem deal aberto no Funil de Vendas (18784), NÃO trocar owner,
    // NÃO abrir novo deal, NÃO mover de pipeline. Toda redistribuição em Vendas
    // é manual via Copilot/UI.
    const leadPipelineId = Number((lead as Record<string, unknown>).piperun_pipeline_id ?? 0);
    // PipeRun status: 0=aberta, 1=ganha, 2=perdida. Tratamos numérico E texto
    // (alguns fluxos antigos gravam o literal). Qualquer valor != 0/"aberta"
    // é considerado fechado e libera o guard.
    const rawStatus = (lead as Record<string, unknown>).piperun_status;
    const statusNum = typeof rawStatus === "number" ? rawStatus : Number(rawStatus ?? 0);
    const statusText = String(rawStatus ?? "").toLowerCase();
    const leadDealClosed =
      (Number.isFinite(statusNum) && statusNum !== 0 && statusNum !== null) ||
      ["ganha", "perdida", "won", "lost"].includes(statusText);
    if (leadPipelineId === 18784 && !leadDealClosed && lead.piperun_id) {
      console.log(`[lia-assign] VENDAS_IMMUTABILITY skip — lead ${lead.id} já em 18784 (deal ${lead.piperun_id}, owner=${lead.proprietario_lead_crm})`);
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-lia-assign",
          severity: "info",
          error_type: "vendas_immutability_skip",
          lead_email: lead.email,
          details: {
            lead_id: lead.id,
            piperun_id: lead.piperun_id,
            current_owner: lead.proprietario_lead_crm,
            trigger,
            source: (lead as Record<string, unknown>).source,
          },
        });
      } catch {}
      return new Response(
        JSON.stringify({
          success: true,
          flow: "vendas_immutability_skip",
          piperun_id: lead.piperun_id,
          owner_preserved: lead.proprietario_lead_crm,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      const dealsFetch = await findPersonDealsWithStatus(PIPERUN_API_KEY, personId);
      const allDeals = dealsFetch.deals;
      const dealsFetchedOk = dealsFetch.fetched_ok;
      // ── Fail-safe Regra de Ouro: se PipeRun GET /deals falhou e o lead já
      // tem piperun_id cacheado, NUNCA criar deal novo. Apenas preservar.
      if (!dealsFetchedOk && lead.piperun_id) {
        console.warn(
          `[lia-assign] FAIL-SAFE: findPersonDeals falhou para person=${personId} mas lead.piperun_id=${lead.piperun_id} está setado — preservando cacheado, NÃO criando deal novo`,
        );
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-lia-assign",
            severity: "warning",
            error_type: "preserve_cached_on_piperun_fetch_failure",
            lead_id: lead.id,
            lead_email: leadEmail,
            details: {
              person_id: personId,
              cached_piperun_id: lead.piperun_id,
              form_name: lead.form_name,
            },
          });
        } catch {}
        piperunId = String(lead.piperun_id);
        flowType = "preserve_cached_on_piperun_fetch_failure";
      }
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
        // ── GOLDEN RULE PRIMARY (Guard D extended) ──
        // Antes de qualquer criação no fluxo primário, se a Pessoa já tem
        // QUALQUER deal VENDAS (aberto OU Perdido) nos últimos 30 dias,
        // preservamos esse deal: enriquecemos custom_fields, mantemos owner,
        // adicionamos nota — e NÃO criamos novo deal. Regra de ouro.
        if (force_new_deal !== true) {
          const nowMs = Date.now();
          const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
          const recentVendasDeal = allDeals
            .filter((d) => Number(d.pipeline_id) === PIPELINES.VENDAS)
            .filter((d) => {
              const ts = d.created_at ? new Date(String(d.created_at)).getTime() : 0;
              return ts > 0 && (nowMs - ts) <= THIRTY_DAYS_MS;
            })
            .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())[0];
          if (recentVendasDeal) {
            piperunId = String(recentVendasDeal.id);
            flowType = "golden_rule_primary_preserved";
            const dealOwnerId = Number(recentVendasDeal.owner_id) || 0;
            if (dealOwnerId) {
              assignedOwnerId = dealOwnerId;
              const dealOwnerInfo = PIPERUN_USERS[dealOwnerId];
              if (dealOwnerInfo?.name) assignedOwnerName = dealOwnerInfo.name;
              try {
                const { data: dealTm } = await supabase
                  .from("team_members")
                  .select("id")
                  .eq("piperun_owner_id", dealOwnerId)
                  .eq("ativo", true)
                  .maybeSingle();
                if (dealTm) assignedTeamMemberId = dealTm.id;
              } catch {}
            }
            try {
              await updateExistingDeal(
                PIPERUN_API_KEY,
                Number(recentVendasDeal.id),
                null,
                customFields,
                lead as Record<string, unknown>,
                companyId,
                supabase,
                inputFormResponses,
              );
            } catch (e) {
              console.warn("[lia-assign] GOLDEN RULE PRIMARY enrichment failed:", e);
            }
            // NOTA SUPRIMIDA: regra de ouro primária só registra log interno.
            try {
              await supabase.from("lead_activity_log").insert({
                lead_id: lead.id,
                event_type: "golden_rule_primary_preserved",
                entity_id: String(recentVendasDeal.id),
                event_data: {
                  deal_id: String(recentVendasDeal.id),
                  deal_status: recentVendasDeal.status,
                  deal_created_at: recentVendasDeal.created_at,
                  person_id: personId,
                  form_name: lead.form_name,
                  source: lead.source,
                  flow: "primary",
                },
              });
            } catch {}
            try {
              await supabase.from("system_health_logs").insert({
                function_name: "smart-ops-lia-assign",
                severity: "info",
                error_type: "golden_rule_primary_preserved",
                lead_id: lead.id,
                lead_email: leadEmail,
                details: {
                  preserved_deal_id: String(recentVendasDeal.id),
                  deal_status: recentVendasDeal.status,
                  deal_created_at: recentVendasDeal.created_at,
                  person_id: personId,
                },
              });
            } catch {}
            console.log(
              `[lia-assign] GOLDEN RULE PRIMARY: preserved VENDAS deal ${recentVendasDeal.id} (status=${recentVendasDeal.status}, created=${recentVendasDeal.created_at}) — no new deal created`,
            );
          }
        }
        // ── Dedupe guard: if lead already carries a piperun_id, validate it before creating a new deal ──
        const cachedDealId = (lead.piperun_id as string | null) || null;
        if (!piperunId && cachedDealId && force_new_deal !== true) {
          const validation = await validateCachedDealIsActiveVendas(
            cachedDealId,
            async (id) => {
              const check = await piperunGet(PIPERUN_API_KEY, `deals/${id}`, {});
              if (!check?.success) return { ok: false };
              const dealData = (check.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
              return { ok: true, deal: dealData ?? null };
            },
          );
          if (validation.preserve) {
            piperunId = String(validation.deal_id ?? cachedDealId);
            flowType = validation.fetch_ok === false
              ? "preserve_cached_on_validation_failure"
              : "preserve_cached_deal_validated";
            try {
              await updateExistingDeal(
                PIPERUN_API_KEY,
                Number(piperunId),
                null,
                customFields,
                lead as Record<string, unknown>,
                companyId,
                supabase,
                inputFormResponses,
              );
            } catch (e) {
              console.warn("[lia-assign] CACHED-DEAL VALIDATOR updateExistingDeal failed:", e);
            }
            try {
              await supabase.from("system_health_logs").insert({
                function_name: "smart-ops-lia-assign",
                severity: validation.fetch_ok === false ? "warning" : "info",
                error_type: flowType,
                lead_id: lead.id,
                lead_email: leadEmail,
                details: {
                  cached_piperun_id: cachedDealId,
                  validation_reason: validation.reason,
                  pipeline_id: validation.pipeline_id ?? null,
                  status: validation.status ?? null,
                  created_at: validation.created_at ?? null,
                  person_id: personId,
                  form_name: lead.form_name,
                  stage: "main",
                },
              });
            } catch {}
            try {
              await supabase.from("lead_activity_log").insert({
                lead_id: lead.id,
                event_type: "vendas_duplicates_detected_noop",
                entity_type: "deal",
                entity_id: String(piperunId),
                entity_name: "Cached deal validator preservou VENDAS",
                event_data: {
                  kept_deal: String(piperunId),
                  reason: validation.reason,
                  fetch_ok: validation.fetch_ok ?? null,
                  flow_type: flowType,
                },
                source_channel: "form",
                event_timestamp: new Date().toISOString(),
              });
            } catch {}
            console.log(
              `[lia-assign] CACHED-DEAL VALIDATOR (main): preserved ${piperunId} (${validation.reason}, fetch_ok=${validation.fetch_ok})`,
            );
          } else {
            console.log(
              `[lia-assign] CACHED-DEAL VALIDATOR (main): not preserving cached ${cachedDealId} — ${validation.reason}`,
            );
          }
        }
        if (!piperunId) {
        // ── UNIVERSAL GOLDEN RULE GATE (final, antes de createNewDeal) ──
        const allDealsForGate = mergeDealsWithLocalHistory(allDeals, lead as Record<string, unknown>);
        const gate = assertCanCreateNewDeal(
          allDealsForGate as unknown as Array<{ id: string | number; pipeline_id: number; status: number; freezed?: boolean; created_at?: string; updated_at?: string }>,
          { force_new_deal: force_new_deal === true },
        );
        if (!gate.allowed && gate.preservedDeal) {
          piperunId = String(gate.preservedDeal.id);
          flowType = "golden_rule_blocked_primary";
          console.log(
            `[lia-assign] GOLDEN RULE GATE primary: ${gate.reason} → preservando deal ${piperunId}, NÃO criando novo`,
          );
          try {
            await updateExistingDeal(
              PIPERUN_API_KEY,
              Number(piperunId),
              null,
              customFields,
              lead as Record<string, unknown>,
              companyId,
              supabase,
              inputFormResponses,
            );
          } catch (e) {
            console.warn("[lia-assign] GOLDEN RULE GATE updateExistingDeal failed:", e);
          }
          try {
            await supabase.from("lead_activity_log").insert({
              lead_id: lead.id,
              event_type: "golden_rule_blocked_primary",
              entity_type: "deal",
              entity_id: piperunId,
              entity_name: "Criação de deal bloqueada (regra de ouro universal)",
              event_data: {
                reason: gate.reason,
                person_id: personId,
                form_name: lead.form_name,
                source: lead.source,
              },
              source_channel: "form",
              event_timestamp: new Date().toISOString(),
            });
          } catch {}
        } else {
        // ── Trava atômica DB-level (defense-in-depth Regra de Ouro) ──
        // Evita que duas execuções concorrentes do lia-assign para o mesmo
        // lead criem deals duplicados (race entre form re-delivery + cron).
        const claim = await claimDealCreateSlot(
          supabase,
          lead.id as string,
          personId,
          `main:${String(lead.form_name ?? "")}|${String(lead.source ?? "")}`,
        );
        if (!claim.ok) {
          console.warn(
            `[lia-assign] MAIN: lock_held para lead ${lead.id} — abortando criação concorrente`,
          );
          try {
            await supabase.from("system_health_logs").insert({
              function_name: "smart-ops-lia-assign",
              severity: "warning",
              error_type: "deal_create_lock_held",
              lead_id: lead.id,
              lead_email: leadEmail,
              details: { stage: "main", person_id: personId, form_name: lead.form_name },
            });
          } catch {}
          flowType = "concurrent_create_lock_held";
        } else {
          try {
            // Re-fetch fresh lead.piperun_id ANTES do POST: outra execução
            // pode ter setado nesta janela curta.
            const { data: freshLead } = await supabase
              .from("lia_attendances")
              .select("piperun_id")
              .eq("id", lead.id)
              .maybeSingle();
            if (freshLead?.piperun_id) {
              console.log(
                `[lia-assign] MAIN: lead.piperun_id=${freshLead.piperun_id} setado por execução concorrente — abortando createNewDeal`,
              );
              piperunId = String(freshLead.piperun_id);
              flowType = "preserve_cached_fresh_recheck";
            } else {
              // empty-person guard removed: Deal must always be created;
              // GET-based verification produced false positives.
              piperunId = await createNewDeal(
                PIPERUN_API_KEY, personId, companyId,
                lead as Record<string, unknown>,
                pipeline_id, stage_id, assignedOwnerId,
                customFields, leadEmail, supabase, inputFormResponses
              );
              console.log(`[lia-assign] Created new deal: ${piperunId}`);
            }
          } finally {
            await releaseDealCreateSlot(supabase, lead.id as string);
          }
        }
        if (piperunId && flowType === "new_deal" && personNameLooksLikeCompany) {
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
    // WaLeads pausado — usar smart-ops-lia-notify-seller (Evolution API, instância Danilo Henrique)
    if (assignedTeamMemberId && assignedTeamMemberId !== "fallback-admin") {
      try {
        const notifyRes = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-notify-seller`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            lead_id: lead.id,
            team_member_id: assignedTeamMemberId,
            trigger: trigger || "lia_assign",
          }),
        });
        const notifyBody = await notifyRes.text();
        console.log(`[lia-assign] notify-seller: status=${notifyRes.status} body=${notifyBody.slice(0, 300)}`);
      } catch (notifyErr) {
        console.warn("[lia-assign] notify-seller call failed (non-fatal):", notifyErr);
      }
    }

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
