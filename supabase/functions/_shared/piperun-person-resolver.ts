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

/**
 * Validate the TLD of an email. Rejects nonsense like ".TYPO", ".local",
 * stray ".gmil" (typo of gmail), etc. We use a permissive regex (2..24 alpha
 * chars) — it doesn't validate that the domain actually exists, only that
 * the syntactic shape is plausible. PipeRun silently rejects malformed
 * emails so this guard stops us from sending them.
 */
const VALID_TLD_RE = /\.[a-z]{2,24}$/i;
const KNOWN_TYPO_TLDS = new Set(["typo", "local", "lan", "internal", "test", "invalid", "example"]);
export function isValidEmailTld(email: string | null | undefined): boolean {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return false;
  const domain = e.split("@")[1] || "";
  if (!domain.includes(".")) return false;
  if (!VALID_TLD_RE.test(domain)) return false;
  const tld = domain.split(".").pop() || "";
  if (KNOWN_TYPO_TLDS.has(tld)) return false;
  return true;
}

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
 * Expanded resolver — used when the strict contact filter misses the
 * "ghost" Person that PipeRun's native Meta Lead Ads integration creates
 * (the Person card has the email/phone in raw fields that don't respond
 * to `emails[email]`/`phones[phone]` filters but still cause the PUT to
 * be silently rejected).
 *
 * Cascade:
 *  1) findPersonByContact (strict).
 *  2) GET /persons?search=<name>     → match if name OR email OR phone matches.
 *  3) GET /persons?search=<localpart> → match if email OR phone matches.
 *
 * Returned Person is the one whose card actually owns the contact (i.e. has
 * non-empty email or phone). Empty cards are ignored on purpose.
 */
export async function findPersonExpanded(
  apiToken: string,
  args: { email: string | null; phone: string | null; name: string | null },
): Promise<{ id: number; company_id: number | null; matched_via: string } | null> {
  const { email, phone, name } = args;

  const strict = await findPersonByContact(apiToken, email, phone);
  if (strict) return strict;

  const lowerEmail = norm(email);
  const phoneDigits = digits(phone);
  const lowerName = norm(name);

  const evaluate = (
    items: Array<Record<string, unknown>> | undefined,
    matchedVia: string,
    requireContact: boolean,
  ) => {
    if (!items?.length) return null;
    for (const p of items) {
      const emails = ((p.emails as Array<Record<string, unknown>> | undefined) || [])
        .map((e) => norm(String(e.email || ""))).filter(Boolean);
      const phones = ((p.phones as Array<Record<string, unknown>> | undefined) || [])
        .map((ph) => digits(String(ph.phone || ""))).filter(Boolean);
      const pname = norm(String(p.name || ""));
      const emailHit = lowerEmail && emails.includes(lowerEmail);
      const phoneHit = phoneDigits && phones.some((c) =>
        c === phoneDigits ||
        (c.length >= 11 && phoneDigits.endsWith(c)) ||
        (phoneDigits.length >= 11 && c.endsWith(phoneDigits))
      );
      const nameHit = lowerName && pname && pname === lowerName;
      if (!emailHit && !phoneHit && !nameHit) continue;
      if (requireContact && emails.length === 0 && phones.length === 0) continue;
      if (!p.id) continue;
      return {
        id: Number(p.id),
        company_id: p.company_id ? Number(p.company_id) : null,
        matched_via: matchedVia + (emailHit ? "+email" : "") + (phoneHit ? "+phone" : "") + (nameHit ? "+name" : ""),
      };
    }
    return null;
  };

  // 2) name search
  if (lowerName && lowerName.length >= 3) {
    try {
      const res = await piperunGet(apiToken, "persons", { search: name as string, show: 50 });
      if (res.success) {
        const items = (res.data as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
        const hit = evaluate(items, "name_search", /*requireContact*/ true);
        if (hit) return hit;
      }
    } catch (e) { console.warn("[piperun-resolver] name_search error:", e); }
  }

  // 3) email localpart search
  if (lowerEmail && lowerEmail.includes("@")) {
    const localpart = lowerEmail.split("@")[0];
    if (localpart && localpart.length >= 3) {
      try {
        const res = await piperunGet(apiToken, "persons", { search: localpart, show: 50 });
        if (res.success) {
          const items = (res.data as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
          const hit = evaluate(items, "localpart_search", /*requireContact*/ true);
          if (hit) return hit;
        }
      } catch (e) { console.warn("[piperun-resolver] localpart_search error:", e); }
    }
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
 * Force-populate a cached PipeRun Person that has no email/phone.
 *
 *  1) GET /persons/{id} — if it already has any contact, return early.
 *  2) PUT a minimal payload with emails+phones (no name, no custom_fields)
 *     to maximize chance PipeRun accepts.
 *  3) GET /persons/{id} again to confirm contact landed.
 *
 * Returns:
 *   { ok: true, alreadyHasContact }       — Person already had contact.
 *   { ok: true, populated: true }         — PUT succeeded and contact now on card.
 *   { ok: false, reason: 'silent_reject' }— PipeRun returned 200 but card stayed empty.
 *   { ok: false, reason: 'invalid_email_tld' } — email TLD invalid; email skipped.
 *   { ok: false, reason: 'no_contact_to_send' } — no email AND no phone provided.
 */
export interface ForcePopulateResult {
  ok: boolean;
  alreadyHasContact?: boolean;
  populated?: boolean;
  reason?: string;
  emails_after: number;
  phones_after: number;
}
export async function forcePopulateCachedPerson(
  apiToken: string,
  personId: number,
  args: { email: string | null; phone: string | null },
): Promise<ForcePopulateResult> {
  const before = await getPersonContact(apiToken, personId);
  if (before && (before.emails.length > 0 || before.phones.length > 0)) {
    return { ok: true, alreadyHasContact: true, emails_after: before.emails.length, phones_after: before.phones.length };
  }

  const emailValid = !!args.email && isValidEmailTld(args.email);
  const phoneDigits = digits(args.phone);
  const phoneValid = phoneDigits.length >= 10;

  if (!emailValid && !phoneValid) {
    return {
      ok: false,
      reason: args.email && !emailValid ? "invalid_email_tld" : "no_contact_to_send",
      emails_after: before?.emails.length ?? 0,
      phones_after: before?.phones.length ?? 0,
    };
  }

  const payload: Record<string, unknown> = {};
  if (emailValid) payload.emails = [{ email: args.email, type: "work" }];
  if (phoneValid) {
    payload.phones = [{ phone: args.phone, type: "work" }];
    payload.cellphone = args.phone;
  }

  try {
    await piperunPut(apiToken, `persons/${personId}`, payload);
  } catch (e) {
    console.warn("[piperun-resolver] forcePopulate PUT error:", e);
  }

  const after = await getPersonContact(apiToken, personId);
  const emailsAfter = after?.emails.length ?? 0;
  const phonesAfter = after?.phones.length ?? 0;
  const got = emailsAfter > 0 || phonesAfter > 0;
  if (got) return { ok: true, populated: true, emails_after: emailsAfter, phones_after: phonesAfter };

  return { ok: false, reason: "silent_reject", emails_after: emailsAfter, phones_after: phonesAfter };
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