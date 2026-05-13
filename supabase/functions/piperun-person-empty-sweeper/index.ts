/**
 * piperun-person-empty-sweeper
 *
 * One-shot/cron remediation for leads stuck in
 *   crm_creation_blocked_reason = 'empty_person_in_piperun'.
 *
 * For each canonical lead:
 *  1) Use findPersonExpanded (strict + name + localpart) to find the rightful
 *     PipeRun Person owning the email/phone/name.
 *  2) If a non-empty owner is found:
 *       - update pessoa_piperun_id, clear the block,
 *       - re-invoke smart-ops-lia-assign so the Deal is finally created.
 *  3) If no owner is found:
 *       - mark raw_payload.empty_person_unresolvable = true (won't retry).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  findPersonExpanded,
  forcePopulateCachedPerson,
  isValidEmailTld,
  getPersonContact,
} from "../_shared/piperun-person-resolver.ts";
import { piperunPost } from "../_shared/piperun-field-map.ts";

const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: { limit?: number; lead_id?: string; lead_ids?: string[] } = {};
  try { body = await req.json(); } catch {}
  const limit = Math.max(1, Math.min(200, body.limit ?? 50));
  const targetIds = Array.isArray(body.lead_ids) ? body.lead_ids.filter(Boolean) : [];
  const isManual = targetIds.length > 0 || !!body.lead_id;

  let q = supabase
    .from("lia_attendances")
    .select("id, nome, email, telefone_normalized, telefone_raw, pessoa_piperun_id, raw_payload")
    .is("merged_into", null)
    .limit(limit);
  if (targetIds.length > 0) {
    q = q.in("id", targetIds);
  } else if (body.lead_id) {
    q = q.eq("id", body.lead_id);
  } else {
    // Cron / batch mode: only auto-process leads not already marked unresolvable.
    q = q.eq("crm_creation_blocked_reason", "empty_person_in_piperun");
  }

  const { data: leads, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const lead of leads ?? []) {
    const email = (lead.email as string | null) || null;
    const phone = (lead.telefone_normalized as string | null) || (lead.telefone_raw as string | null) || null;
    const name = (lead.nome as string | null) || null;
    const cachedPersonId = lead.pessoa_piperun_id ? Number(lead.pessoa_piperun_id) : null;
    const rawPayload = (lead.raw_payload as Record<string, unknown> | null) || {};

    // Manual mode bypasses the unresolvable flag; cron mode respects it.
    if (!isManual && rawPayload.empty_person_unresolvable === true) {
      results.push({ lead_id: lead.id, action: "skipped_unresolvable" });
      continue;
    }

    const emailHasValidTld = isValidEmailTld(email);
    const emailForPiperun = emailHasValidTld ? email : null; // strip invalid TLD

    const clearBlockAndReassign = async (newPersonId: number, action: string, extra: Record<string, unknown>) => {
      const updRaw = { ...rawPayload };
      delete updRaw.empty_person_unresolvable;
      delete updRaw.empty_person_unresolvable_at;
      await supabase.from("lia_attendances").update({
        pessoa_piperun_id: newPersonId,
        crm_creation_blocked: false,
        crm_creation_blocked_reason: null,
        raw_payload: updRaw,
      }).eq("id", lead.id);
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
          body: JSON.stringify({ lead_id: lead.id, source: "empty_person_sweeper" }),
        });
      } catch (e) { console.warn("[sweeper] re-invoke lia-assign failed:", e); }
      results.push({ lead_id: lead.id, action, new_person_id: newPersonId, ...extra });
    };

    // ── Step 1: try to force-populate the cached Person (if any) ──
    if (cachedPersonId) {
      try {
        const fp = await forcePopulateCachedPerson(PIPERUN_API_KEY, cachedPersonId, {
          email: emailForPiperun,
          phone,
        });
        if (fp.ok) {
          await supabase.from("system_health_logs").insert({
            function_name: "piperun-person-empty-sweeper",
            severity: "info",
            error_type: "piperun_person_force_populated",
            lead_id: lead.id,
            lead_email: email,
            details: { person_id: cachedPersonId, ...fp, email_tld_skipped: !!email && !emailHasValidTld },
          });
          await clearBlockAndReassign(cachedPersonId, "force_populated", {
            already_had_contact: !!fp.alreadyHasContact,
          });
          continue;
        }
        // If reason was invalid TLD AND we have no phone either → block as invalid contact and skip.
        if (fp.reason === "invalid_email_tld" || fp.reason === "no_contact_to_send") {
          await supabase.from("system_health_logs").insert({
            function_name: "piperun-person-empty-sweeper",
            severity: "warning",
            error_type: fp.reason === "invalid_email_tld"
              ? "piperun_person_invalid_email_tld"
              : "piperun_person_no_contact_to_send",
            lead_id: lead.id,
            lead_email: email,
            details: { person_id: cachedPersonId, email, phone, name },
          });
          // Stamp + skip without marking unresolvable so a human-corrected email
          // can be re-swept later.
          const updRaw = { ...rawPayload, email_invalid_tld: fp.reason === "invalid_email_tld" };
          await supabase.from("lia_attendances").update({ raw_payload: updRaw }).eq("id", lead.id);
          results.push({ lead_id: lead.id, action: fp.reason });
          continue;
        }
        // fp.reason === 'silent_reject' → fall through to expanded search / replace
      } catch (e) {
        console.warn(`[sweeper] forcePopulate error for ${lead.id}:`, e);
      }
    }

    let owner: { id: number; company_id: number | null; matched_via: string } | null = null;
    try {
      owner = await findPersonExpanded(PIPERUN_API_KEY, { email, phone, name });
    } catch (e) {
      console.warn(`[sweeper] findPersonExpanded error for ${lead.id}:`, e);
    }

    if (owner) {
      await supabase.from("system_health_logs").insert({
        function_name: "piperun-person-empty-sweeper",
        severity: "info",
        error_type: "empty_person_resolved",
        lead_id: lead.id,
        lead_email: email,
        details: { previous_person_id: lead.pessoa_piperun_id, new_person_id: owner.id, matched_via: owner.matched_via },
      });
      if (owner.company_id) {
        await supabase.from("lia_attendances")
          .update({ empresa_piperun_id: owner.company_id })
          .eq("id", lead.id);
      }
      await clearBlockAndReassign(owner.id, "resolved_to_owner", { matched_via: owner.matched_via });
      continue;
    }

    // ── Step 3: replace cached Person via fresh POST when contact is sendable ──
    const phoneDigitsLen = (phone || "").replace(/\D/g, "").length;
    const canCreate = !!emailForPiperun || phoneDigitsLen >= 10;
    if (canCreate) {
      try {
        const payload: Record<string, unknown> = { name: (name || "Lead").slice(0, 80) };
        // PipeRun changed contract (~2026-05-12): nested arrays alone are
        // silently discarded. Send flat email/cellphone strings; keep nested
        // arrays as backup.
        if (emailForPiperun) {
          payload.email = emailForPiperun;
          payload.emails = [{ email: emailForPiperun }];
        }
        if (phoneDigitsLen >= 10) {
          payload.cellphone = phone;
          payload.phones = [{ phone }];
        }
        const res = await piperunPost(PIPERUN_API_KEY, "persons", payload);
        const newPersonData = res.success
          ? (res.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined
          : undefined;
        const newPersonId = newPersonData?.id ? Number(newPersonData.id) : null;
        if (newPersonId) {
          // Verify new Person actually has contact.
          const verify = await getPersonContact(PIPERUN_API_KEY, newPersonId);
          const hasContact = !!verify && (verify.emails.length > 0 || verify.phones.length > 0);
          await supabase.from("system_health_logs").insert({
            function_name: "piperun-person-empty-sweeper",
            severity: hasContact ? "warning" : "error",
            error_type: hasContact ? "piperun_person_replaced_silent_reject" : "piperun_person_replaced_still_empty",
            lead_id: lead.id,
            lead_email: email,
            details: { old_person_id: cachedPersonId, new_person_id: newPersonId, verify },
          });
          if (hasContact) {
            await clearBlockAndReassign(newPersonId, "replaced_silent_reject", { old_person_id: cachedPersonId });
            continue;
          }
        }
      } catch (e) {
        console.warn(`[sweeper] replace POST error for ${lead.id}:`, e);
      }
    }

    // ── Step 4: truly unresolvable → mark and stop retrying ──
    const updRaw = { ...rawPayload, empty_person_unresolvable: true, empty_person_unresolvable_at: new Date().toISOString() };
    if (email && !emailHasValidTld) updRaw.email_invalid_tld = true;
    await supabase.from("lia_attendances").update({ raw_payload: updRaw }).eq("id", lead.id);
    await supabase.from("system_health_logs").insert({
      function_name: "piperun-person-empty-sweeper",
      severity: "warning",
      error_type: "empty_person_unresolvable",
      lead_id: lead.id,
      lead_email: email,
      details: { person_id: cachedPersonId, name, email, phone, email_invalid_tld: !!email && !emailHasValidTld },
    });
    results.push({ lead_id: lead.id, action: "unresolvable" });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
