import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFakeEmail } from "../_shared/lead-identity-guard.ts";
import { piperunPut, buildPersonFormCustomFields } from "../_shared/piperun-field-map.ts";
import { verifyAndRecoverPersonContact } from "../_shared/piperun-person-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY")!;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: { days?: number; limit?: number; lead_ids?: string[]; emails?: string[]; mode?: string } = {};
  try { body = await req.json(); } catch {}
  const days = body.days ?? 3;
  const limit = Math.min(body.limit ?? 50, 200);
  const mode = body.mode || "default";

  let q = supa
    .from("lia_attendances")
    .select("id,email,nome,telefone_normalized,telefone_raw,pessoa_piperun_id,empresa_piperun_id,area_atuacao,especialidade,pessoa_cargo,pessoa_cpf,pessoa_nascimento,pessoa_genero,pessoa_linkedin,pessoa_facebook,pessoa_observation,empresa_nome,empresa_razao_social,empresa_cnpj,empresa_segmento,empresa_website,empresa_email,empresa_telefone,empresa_cidade,empresa_uf,cidade,uf,scanner_marca,impressora_modelo,tem_scanner,tem_impressora,form_data")
    .is("merged_into", null)
    .not("pessoa_piperun_id", "is", null);

  if (mode === "remediate_silent_rejects") {
    // Pull lead_ids from system_health_logs warnings in the last 72h.
    const since = new Date(Date.now() - 72 * 3600_000).toISOString();
    const { data: logs } = await supa
      .from("system_health_logs")
      .select("lead_id")
      .in("error_type", ["piperun_contact_still_missing_after_resync", "piperun_email_silently_rejected"])
      .gte("created_at", since)
      .not("lead_id", "is", null)
      .limit(limit * 2);
    const ids = Array.from(new Set((logs ?? []).map((l) => l.lead_id).filter(Boolean))).slice(0, limit);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ processed: 0, mode, note: "no_silent_reject_logs_in_72h" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    q = q.in("id", ids);
  } else if (body.lead_ids?.length) {
    q = q.in("id", body.lead_ids);
  } else if (body.emails?.length) {
    q = q.in("email", body.emails.map((e) => String(e).toLowerCase().trim()));
  } else {
    q = q.gte("created_at", new Date(Date.now() - days * 86400_000).toISOString())
         .order("created_at", { ascending: false })
         .limit(limit);
  }

  const { data: leads, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results: Array<Record<string, unknown>> = [];
  for (const lead of leads ?? []) {
    const personId = Number(lead.pessoa_piperun_id);
    if (!personId) continue;
    const email = lead.email as string | null;
    const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;

    // ── Person full payload ──
    const personPayload: Record<string, unknown> = {};
    if (email && !isFakeEmail(email)) personPayload.emails = [{ email }];
    if (phone) {
      personPayload.phones = [{ phone }];
      personPayload.cellphone = phone;
    }
    const jobTitle = (lead.especialidade as string | null) || (lead.area_atuacao as string | null) || (lead.pessoa_cargo as string | null);
    if (jobTitle) personPayload.job_title = jobTitle;
    if (lead.pessoa_cpf) personPayload.cpf = lead.pessoa_cpf;
    if (lead.pessoa_nascimento) personPayload.birth_date = lead.pessoa_nascimento;
    if (lead.pessoa_genero) personPayload.gender = lead.pessoa_genero;
    if (lead.pessoa_linkedin) personPayload.linkedin = lead.pessoa_linkedin;
    if (lead.pessoa_facebook) personPayload.facebook = lead.pessoa_facebook;
    if (lead.pessoa_observation) personPayload.observation = lead.pessoa_observation;

    // Form custom fields: Scanner (772727), Impressora (772728), Área (673900), Especialidade (445631)
    const personCF = buildPersonFormCustomFields(lead as Record<string, unknown>);
    if (personCF.length > 0) personPayload.custom_fields = personCF;

    if (Object.keys(personPayload).length === 0) {
      results.push({ id: lead.id, person_id: personId, skipped: "no_contact_data" });
      continue;
    }
    let res = await piperunPut(PIPERUN_API_KEY, `persons/${personId}`, personPayload);
    // Retry without custom_fields first (most likely 422 cause)
    if (!res.success && personPayload.custom_fields) {
      const { custom_fields: _cf, ...withoutCF } = personPayload as Record<string, unknown>;
      res = await piperunPut(PIPERUN_API_KEY, `persons/${personId}`, withoutCF);
    }
    if (!res.success && (personPayload.emails || personPayload.phones)) {
      const minimal: Record<string, unknown> = {};
      if (personPayload.emails) minimal.emails = personPayload.emails;
      if (personPayload.phones) minimal.phones = personPayload.phones;
      res = await piperunPut(PIPERUN_API_KEY, `persons/${personId}`, minimal);
    }

    // Active verify-and-recover (remap if PipeRun silently rejected).
    let verifyOk: boolean | null = null;
    let remappedTo: number | null = null;
    try {
      const v = await verifyAndRecoverPersonContact(
        PIPERUN_API_KEY, supa, String(lead.id),
        personId,
        email && !isFakeEmail(email) ? email : null,
        phone || null,
      );
      verifyOk = v.ok;
      remappedTo = v.remapped_to ?? null;
    } catch (e) {
      console.warn("[backfill] verify error:", e);
    }

    // ── Company resync (best-effort) ──
    let companyRes: { success: boolean; status: number } | null = null;
    const companyId = Number(lead.empresa_piperun_id || 0);
    if (companyId) {
      const companyEmail = (lead.empresa_email as string | null) || (email && !isFakeEmail(email) ? email : null);
      const companyPhone = (lead.empresa_telefone as string | null) || phone;
      const companyPayload: Record<string, unknown> = {};
      const companyName = (lead.empresa_razao_social as string | null) || (lead.empresa_nome as string | null);
      if (companyName) companyPayload.name = companyName;
      if (companyEmail) companyPayload.emails = [{ email: companyEmail }];
      if (companyPhone) companyPayload.phones = [{ phone: companyPhone }];
      if (lead.empresa_cnpj) companyPayload.cnpj = lead.empresa_cnpj;
      if (lead.empresa_segmento) companyPayload.segment = lead.empresa_segmento;
      if (lead.empresa_website) companyPayload.website = lead.empresa_website;
      const city = (lead.empresa_cidade as string | null) || (lead.cidade as string | null);
      const state = (lead.empresa_uf as string | null) || (lead.uf as string | null);
      if (city) companyPayload.city = city;
      if (state) companyPayload.state = state;
      if (Object.keys(companyPayload).length > 0) {
        companyRes = await piperunPut(PIPERUN_API_KEY, `companies/${companyId}`, companyPayload);
      }
    }

    results.push({ id: lead.id, person_id: personId, company_id: companyId || null, person_status: res.status, person_ok: res.success, verify_ok: verifyOk, remapped_to: remappedTo, company_status: companyRes?.status || null, company_ok: companyRes?.success || null });
    // Throttle to be gentle with PipeRun rate limits.
    await new Promise((r) => setTimeout(r, 250));
    await supa.from("system_health_logs").insert({
      function_name: "piperun-person-contact-backfill",
      severity: res.success ? "info" : "warning",
      error_type: res.success ? "piperun_person_contact_backfilled" : "piperun_person_contact_backfill_failed",
      lead_id: lead.id,
      lead_email: email,
      details: { person_id: personId, status: res.status, mode, verify_ok: verifyOk, remapped_to: remappedTo, company_id: companyId || null, company_status: companyRes?.status || null },
    });
  }

  return new Response(JSON.stringify({ processed: results.length, mode, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});