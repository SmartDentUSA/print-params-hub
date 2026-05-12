/**
 * PipeRun Person resolution + verify-and-recover.
 *
 * Two responsibilities:
 *
 * 1) `findPersonByContact` — search a Person across email AND phone before
 *    we ever call createPerson. Prevents the "PipeRun returns 200 on POST
 *    but creates a name-only Person because the email/phone already belong
 *    to another Person" failure mode.
 *
 * 2) `verifyAndRecoverPersonContact` — after PUT /persons/{id}, GET the
 *    Person and confirm emails[]/phones[] actually landed. If PipeRun
 *    silently rejected them (HTTP 200 but card stays empty because the
 *    identifiers belong to another Person), find the rightful owner and
 *    remap the lead to that Person ID, or retry with minimal payloads.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunGet, piperunPut } from "./piperun-field-map.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const norm = (s: string | null | undefined) => String(s || "").trim().toLowerCase();
const digits = (s: string | null | undefined) => String(s || "").replace(/\D/g, "");

function pickByEmail(data: unknown, email: string): { id: number; company_id: number | null } | null {
  const lower = norm(email);
  if (!lower) return null;
  const items = (data as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
  if (!items?.length) return null;
  const match = items.find((p) => {
    const emails = (p.emails as Array<Record<string, unknown>> | undefined) || [];
    return emails.some((e) => norm(String(e.email || "")) === lower);
  });
  if (!match?.id) return null;
  return { id: Number(match.id), company_id: match.company_id ? Number(match.company_id) : null };
}

function pickByPhone(data: unknown, phone: string): { id: number; company_id: number | null } | null {
  const phoneDigits = digits(phone);
  // Require full E.164 digits (>= 12 for BR mobile with DDI). Last-10 matching
 // is unsafe (Andreia/AMANDA contamination incident) so we compare full digits.
  if (phoneDigits.length < 11) return null;
  const items = (data as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
  if (!items?.length) return null;
  const match = items.find((p) => {
    const phones = (p.phones as Array<Record<string, unknown>> | undefined) || [];
    return phones.some((ph) => {
      const candidate = digits(String(ph.phone || ""));
      if (!candidate) return false;
      // Strict full-string equality OR exact suffix of >= 11 digits (handles
      // PipeRun storing without DDI but our number having +55 prefix).
      if (candidate === phoneDigits) return true;
      if (phoneDigits.endsWith(candidate) && candidate.length >= 11) return true;
      if (candidate.endsWith(phoneDigits) && phoneDigits.length >= 11) return true;
      return false;
    });
  });
  if (!match?.id) return null;
  return { id: Number(match.id), company_id: match.company_id ? Number(match.company_id) : null };
}

/**
 * Cascade lookup. Returns first strict hit or null.
 *   a) GET /persons?emails[email]=<email>
 *   b) GET /persons?search=<email>
 *   c) GET /persons?phones[phone]=<phone>
 *   d) GET /persons?search=<phone digits>
 */
export async function findPersonByContact(
  apiToken: string,
  email: string | null,
  phone: string | null,
): Promise<{ id: number; company_id: number | null; matched_via: string } | null> {
  // a) email exact
  if (email) {
    try {
      const res = await piperunGet(apiToken, "persons", { show: 50 }, { "emails[email]": [email] });
      if (res.success) {
        const hit = pickByEmail(res.data, email);
        if (hit) return { ...hit, matched_via: "email_filter" };
      }
    } catch (e) { console.warn("[piperun-resolver] email_filter error:", e); }

    // b) email via search
    try {
      const res = await piperunGet(apiToken, "persons", { search: email, show: 50 });
      if (res.success) {
        const hit = pickByEmail(res.data, email);
        if (hit) return { ...hit, matched_via: "email_search" };
      }
    } catch (e) { console.warn("[piperun-resolver] email_search error:", e); }
  }

  // c) phone exact filter
  const phoneDigits = digits(phone);
  if (phoneDigits.length >= 11) {
    try {
      const res = await piperunGet(apiToken, "persons", { show: 50 }, { "phones[phone]": [phone as string] });
      if (res.success) {
        const hit = pickByPhone(res.data, phone as string);
        if (hit) return { ...hit, matched_via: "phone_filter" };
      }
    } catch (e) { console.warn("[piperun-resolver] phone_filter error:", e); }

    // d) phone via search (digits only)
    try {
      const res = await piperunGet(apiToken, "persons", { search: phoneDigits, show: 50 });
      if (res.success) {
        const hit = pickByPhone(res.data, phone as string);
        if (hit) return { ...hit, matched_via: "phone_search" };
      }
    } catch (e) { console.warn("[piperun-resolver] phone_search error:", e); }
  }

  return null;
}

/**
 * GET the person and check if emails/phones actually landed.
 */
export async function getPersonContact(
  apiToken: string,
  personId: number,
): Promise<{ emails: string[]; phones: string[] } | null> {
  try {
    const res = await piperunGet(apiToken, `persons/${personId}`, {});
    if (!res.success || !res.data) return null;
    const data = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (!data) return null;
    const emails = ((data.emails as Array<Record<string, unknown>> | undefined) || [])
      .map((e) => norm(String(e.email || ""))).filter(Boolean);
    const phones = ((data.phones as Array<Record<string, unknown>> | undefined) || [])
      .map((p) => digits(String(p.phone || ""))).filter(Boolean);
    return { emails, phones };
  } catch { return null; }
}

/**
 * Validate a cached PipeRun Person ID by fetching it directly. Returns
 * `{ exists: true, company_id, hasContact }` when the Person is reachable in
 * PipeRun. We use this instead of an email/phone search because PipeRun's
 * native Meta Lead Ads integration creates Persons with empty emails/phones —
 * a search would return null and the caller would create a duplicate.
 */
export async function validateCachedPerson(
  apiToken: string,
  personId: number,
): Promise<{ exists: boolean; company_id: number | null; hasContact: boolean }> {
  try {
    const res = await piperunGet(apiToken, `persons/${personId}`, {});
    if (!res.success || !res.data) {
      // 404/410 → really gone. Anything else (5xx, network) → assume still there.
      const status = (res as { status?: number }).status;
      const exists = status !== 404 && status !== 410;
      return { exists, company_id: null, hasContact: false };
    }
    const data = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (!data?.id) return { exists: false, company_id: null, hasContact: false };
    const emails = (data.emails as Array<Record<string, unknown>> | undefined) || [];
    const phones = (data.phones as Array<Record<string, unknown>> | undefined) || [];
    const hasContact = emails.some((e) => String(e.email || "").trim() !== "")
      || phones.some((p) => String(p.phone || "").trim() !== "");
    return {
      exists: true,
      company_id: data.company_id ? Number(data.company_id) : null,
      hasContact,
    };
  } catch {
    // On unknown errors, assume the Person is still there to avoid creating a
    // duplicate. The verify-and-recover step will fix contact later.
    return { exists: true, company_id: null, hasContact: false };
  }
}

export interface VerifyRecoverResult {
  ok: boolean;
  remapped_to?: number;
  reason?: string;
  emails_after: number;
  phones_after: number;
}

/**
 * Run after PUT /persons/{id}. Confirms the contact landed; if PipeRun
 * silently rejected emails/phones, find the existing Person owning them
 * and remap the lead, or retry with minimal payloads.
 */
export async function verifyAndRecoverPersonContact(
  apiToken: string,
  supabase: SupabaseClient,
  leadId: string,
  personId: number,
  email: string | null,
  phone: string | null,
): Promise<VerifyRecoverResult> {
  const after = await getPersonContact(apiToken, personId);
  if (!after) return { ok: false, reason: "get_failed", emails_after: 0, phones_after: 0 };

  const lowerEmail = norm(email);
  const phoneDigits = digits(phone);

  const hasEmail = lowerEmail ? after.emails.includes(lowerEmail) : true;
  const hasPhone = phoneDigits ? after.phones.some((p) => p === phoneDigits || p.endsWith(phoneDigits) || phoneDigits.endsWith(p)) : true;

  if (hasEmail && hasPhone) {
    return { ok: true, emails_after: after.emails.length, phones_after: after.phones.length };
  }

  // Try to find the rightful owner of the email or phone.
  const owner = await findPersonByContact(apiToken, hasEmail ? null : email, hasPhone ? null : phone);

  if (owner && owner.id !== personId) {
    // Remap CDP to the rightful owner.
    try {
      await supabase.from("lia_attendances")
        .update({ pessoa_piperun_id: owner.id, empresa_piperun_id: owner.company_id ?? undefined })
        .eq("id", leadId);
      await supabase.from("system_health_logs").insert({
        function_name: "piperun-person-resolver",
        severity: "warning",
        error_type: "piperun_person_remapped_owner_of_email",
        lead_id: leadId,
        lead_email: email,
        details: {
          previous_person_id: personId,
          new_person_id: owner.id,
          matched_via: owner.matched_via,
          missing_email: !hasEmail,
          missing_phone: !hasPhone,
        },
      });
    } catch (e) {
      console.warn("[piperun-resolver] remap log failed:", e);
    }
    return { ok: true, remapped_to: owner.id, reason: "remapped_to_owner", emails_after: after.emails.length, phones_after: after.phones.length };
  }

  // No other owner found — retry isolated PUTs as a last resort.
  let retriedEmail = false; let retriedPhone = false;
  if (!hasEmail && lowerEmail) {
    const r = await piperunPut(apiToken, `persons/${personId}`, { emails: [{ email }] });
    retriedEmail = r.success;
  }
  if (!hasPhone && phoneDigits) {
    const r = await piperunPut(apiToken, `persons/${personId}`, { phones: [{ phone }], cellphone: phone });
    retriedPhone = r.success;
  }

  // Re-verify after isolated retries.
  const after2 = await getPersonContact(apiToken, personId);
  const finalHasEmail = lowerEmail ? !!after2?.emails.includes(lowerEmail) : true;
  const finalHasPhone = phoneDigits ? !!after2?.phones.some((p) => p === phoneDigits || p.endsWith(phoneDigits) || phoneDigits.endsWith(p)) : true;

  if (!finalHasEmail || !finalHasPhone) {
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "piperun-person-resolver",
        severity: "error",
        error_type: "piperun_email_silently_rejected",
        lead_id: leadId,
        lead_email: email,
        details: {
          person_id: personId,
          missing_email: !finalHasEmail,
          missing_phone: !finalHasPhone,
          retried_email: retriedEmail,
          retried_phone: retriedPhone,
          owner_search_returned_self_or_null: true,
        },
      });
    } catch {}
    return {
      ok: false,
      reason: "silent_reject_no_owner",
      emails_after: after2?.emails.length ?? after.emails.length,
      phones_after: after2?.phones.length ?? after.phones.length,
    };
  }

  return {
    ok: true,
    reason: "isolated_retry",
    emails_after: after2?.emails.length ?? 0,
    phones_after: after2?.phones.length ?? 0,
  };
}