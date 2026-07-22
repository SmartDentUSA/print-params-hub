// Scans the connected Gmail inbox for bounce / Delivery Status Notification
// messages (mailer-daemon), extracts the failed recipient address, marks
// campaign_send_log rows as `bounced`, and flags the lead so future campaigns
// exclude it.
//
// Scheduled via pg_cron every 15 minutes (see README of function).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

// Base64url decode from Gmail payload
function b64urlDecode(input: string): string {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  try {
    // deno-lint-ignore no-explicit-any
    return decodeURIComponent(escape((globalThis as any).atob(s + pad)));
  } catch {
    try { return atob(s + pad); } catch { return ""; }
  }
}

function collectParts(payload: any, out: string[] = []): string[] {
  if (!payload) return out;
  const mime = (payload.mimeType || "").toLowerCase();
  const data = payload?.body?.data;
  if (data && (mime.startsWith("text/") || mime.includes("delivery-status") || mime.includes("rfc822-headers"))) {
    const decoded = b64urlDecode(data);
    if (decoded) out.push(decoded);
  }
  const parts = payload.parts || [];
  for (const p of parts) collectParts(p, out);
  return out;
}

// Extract the failed recipient email from a DSN body
function extractBounceInfo(bodies: string[], toHeader: string): { email: string | null; reason: string | null } {
  const joined = bodies.join("\n");

  // Prefer RFC 3464 Final-Recipient / Original-Recipient
  const finalRe = /(?:Final|Original)-Recipient:\s*(?:rfc822;|RFC822;)?\s*([^\s<>]+@[^\s<>]+)/i;
  const m1 = joined.match(finalRe);
  let email = m1 ? m1[1].trim().toLowerCase() : null;

  // Fallback: line like "  <foo@bar>" or plain "foo@bar" near "not found"
  if (!email) {
    const m2 = joined.match(/<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/);
    if (m2) email = m2[1].trim().toLowerCase();
  }
  if (!email && toHeader) {
    // Sometimes To: header contains the failed recipient
    const m3 = toHeader.match(/<([^\s<>@]+@[^\s<>@]+)>|([^\s<>@]+@[^\s<>@]+)/);
    if (m3) email = (m3[1] || m3[2] || "").trim().toLowerCase();
  }

  // Try to pick a short reason phrase
  let reason: string | null = null;
  const status = joined.match(/Status:\s*([0-9\.]+)/i)?.[1];
  const diag = joined.match(/Diagnostic-Code:\s*([^\r\n]+)/i)?.[1];
  if (diag) reason = (status ? `${status} — ` : "") + diag.trim();
  else if (/address not found|no such user|does not exist|recipient rejected/i.test(joined)) reason = "Endereço não encontrado";
  else if (/mailbox full|quota/i.test(joined)) reason = "Caixa cheia";
  else if (status) reason = `SMTP ${status}`;
  if (reason && reason.length > 300) reason = reason.slice(0, 300);

  return { email, reason };
}

function headerVal(headers: any[], name: string): string {
  const h = (headers || []).find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "gmail_connector_missing" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") || "3")));
    const maxScan = Math.max(1, Math.min(200, Number(url.searchParams.get("max") || "80")));

    // Search recent bounce messages
    const q = encodeURIComponent(
      `from:mailer-daemon OR from:postmaster OR subject:"delivery status notification" OR subject:"undeliverable" OR subject:"endereço não encontrado" newer_than:${days}d`
    );
    const listRes = await fetch(`${GATEWAY_URL}/users/me/messages?maxResults=${maxScan}&q=${q}`, {
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      },
    });
    const listJson = await listRes.json().catch(() => ({} as any));
    if (!listRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: "gmail_list_failed", detail: listJson }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const msgIds: string[] = (listJson.messages || []).map((m: any) => m.id).filter(Boolean);

    let scanned = 0, matched = 0, leads = 0, logs = 0;
    const emailsSeen = new Set<string>();

    for (const id of msgIds) {
      scanned++;
      const mRes = await fetch(`${GATEWAY_URL}/users/me/messages/${id}?format=full`, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        },
      });
      if (!mRes.ok) continue;
      const mJson = await mRes.json().catch(() => ({} as any));
      const payload = mJson.payload || {};
      const headers = payload.headers || [];
      const to = headerVal(headers, "To");
      const bodies = collectParts(payload);
      // Also include the Snippet for reason guessing
      if (mJson.snippet) bodies.push(String(mJson.snippet));

      const { email, reason } = extractBounceInfo(bodies, to);
      if (!email) continue;
      if (emailsSeen.has(email)) continue;
      emailsSeen.add(email);
      matched++;

      const bouncedAt = new Date().toISOString();

      // 1) Flag lead(s)
      const { data: leadRows } = await supabase
        .from("lia_attendances")
        .update({
          email_bounced: true,
          email_bounced_at: bouncedAt,
          email_bounced_reason: reason,
          email_last_attempt_at: bouncedAt,
          email_last_attempt_status: "bounced",
        })
        .ilike("email", email)
        .is("merged_into", null)
        .select("id");
      leads += (leadRows?.length || 0);

      // 2) Mark the most recent send_log entries for this email as bounced
      const { data: logRows } = await supabase
        .from("campaign_send_log")
        .update({
          status: "bounced",
          bounced_at: bouncedAt,
          bounce_reason: reason,
        })
        .ilike("email", email)
        .in("status", ["sent", "queued", "error"])
        .select("id");
      logs += (logRows?.length || 0);
    }

    return new Response(JSON.stringify({
      ok: true, scanned, matched, leads_updated: leads, logs_updated: logs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[gmail-bounce-scan] fatal", err);
    return new Response(JSON.stringify({ ok: false, error: (err as any)?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});