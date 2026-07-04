import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

// Standard base64 (with +/=) — required inside RFC 2822 body & encoded-word subject.
const b64std = (s: string) => {
  // deno-lint-ignore no-explicit-any
  const g: any = globalThis;
  return g.btoa
    ? g.btoa(unescape(encodeURIComponent(s)))
    : Buffer.from(s, "utf-8").toString("base64");
};
// URL-safe base64 — required ONLY for the Gmail `messages/send` `raw` envelope.
const b64url = (s: string) =>
  b64std(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Ensure the AI output is a complete, well-formed HTML document.
function sanitizeEmailHtml(input: string): string {
  let html = String(input || "").trim();
  // Strip stray/unopened table fragments that some models leak at the tail.
  html = html.replace(/(<\/(?:td|tr|table|tbody|thead|tfoot)>\s*)+$/gi, "");
  // Also drop broken half-tags like `</td` without closing bracket.
  html = html.replace(/<\/(?:td|tr|table|tbody)\s*$/i, "");
  const hasBody = /<body[\s>]/i.test(html);
  const hasHtml = /<html[\s>]/i.test(html);
  const hasCharset = /<meta[^>]+charset/i.test(html);
  if (!hasBody) {
    html = `<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#222;background:#f6f7f9">${html}</body>`;
  }
  if (!hasHtml) {
    html = `<html>${hasCharset ? "" : `<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`}${html}</html>`;
  } else if (!hasCharset) {
    html = html.replace(/<head[^>]*>/i, m => `${m}<meta charset="UTF-8">`);
  }
  return `<!doctype html>${html}`;
}

function firstName(n?: string | null) {
  if (!n) return "";
  return String(n).trim().split(/\s+/)[0] || "";
}

function randomCode(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = ""; for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function extractUrls(html: string): string[] {
  const set = new Set<string>();
  const re = /href\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (/^https?:\/\//i.test(u)) set.add(u);
  }
  return [...set];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY missing (Gmail connector not linked)");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const projectRef = (Deno.env.get("SUPABASE_URL") || "").match(/https?:\/\/([^.]+)/)?.[1] || "";
    const funcBase = `https://${projectRef}.supabase.co/functions/v1`;
    const shortBase = "https://smartdent.com.br/r"; // short-link redirect route

    // ── Resolve OFFICIAL fallback WhatsApp (used when the lead has no seller,
    //    e.g. in test emails or when the lead was never assigned).
    //    Priority: connected Gmail account → team_members.email match →
    //    site_settings.whatsapp_official → hardcoded Smart Dent central number.
    let officialWaDigits = "5516993061659"; // Smart Dent central (fallback of last resort)
    try {
      // (a) Try site_settings.whatsapp_official
      const { data: ss } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "whatsapp_official")
        .maybeSingle();
      const ssNumber = (ss?.value as any)?.number;
      if (ssNumber) officialWaDigits = String(ssNumber).replace(/\D/g, "") || officialWaDigits;

      // (b) Try to match the connected Gmail with a team_member row
      const profRes = await fetch(`${GATEWAY_URL}/users/me/profile`, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        },
      });
      const profJson = await profRes.json().catch(() => ({}));
      const senderEmail = String((profJson as any)?.emailAddress || "").toLowerCase();
      if (senderEmail) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("whatsapp_number")
          .ilike("email", senderEmail)
          .maybeSingle();
        const own = String(tm?.whatsapp_number || "").replace(/\D/g, "");
        if (own) officialWaDigits = own;
      }
    } catch (e) {
      console.warn("[send-gmail] fallback WA resolution failed:", e);
    }
    const officialWaLink = `https://wa.me/${officialWaDigits}`;

    const body = await req.json();

    // ── whoami: return the connected Gmail address ──
    if (body?.action === "whoami") {
      const r = await fetch(`${GATEWAY_URL}/users/me/profile`, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        },
      });
      const j = await r.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: r.ok, ...j }), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      campaign_name,
      description,
      from_name = "Smart Dent | Fluxo Digital",
      subject,
      preheader = "",
      html,
      filters = {},
      cta_config = null,
      test_email,        // if set, sends single test and skips DB campaign
      dry_run = false,
    } = body || {};

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: "subject e html são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve audience (canonical leads with email) ──
    let leads: Array<Record<string, unknown>> = [];
    if (test_email) {
      leads = [{ id: null, nome: "Teste", email: test_email }];
    } else {
      let q = supabase.from("lia_attendances")
        .select("id, nome, email, responsavel, responsavel_id")
        .is("merged_into", null)
        .not("email", "is", null)
        .neq("email", "")
        .limit(2000);
      if (filters.uf) q = q.eq("uf", filters.uf);
      if (filters.etapa_funil) q = q.eq("etapa_funil", filters.etapa_funil);
      if (filters.produto_interesse) q = q.eq("produto_interesse", filters.produto_interesse);
      if (filters.temperatura) q = q.eq("temperatura", filters.temperatura);
      const { data, error } = await q;
      if (error) throw error;
      leads = data || [];
    }

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, audience: leads.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create campaign row (skip on test_email) ──
    let campaignId: string | null = null;
    if (!test_email) {
      const { data: c, error: cErr } = await supabase.from("campaigns").insert({
        nome: campaign_name || `Email — ${new Date().toISOString().slice(0, 10)}`,
        descricao: description || null,
        canal: "email",
        email_subject: subject,
        email_preheader: preheader,
        email_html: html,
        cta_config,
        lead_filter: filters,
        audience_count: leads.length,
        total_leads: leads.length,
        status: "sending",
        started_at: new Date().toISOString(),
      }).select("id").single();
      if (cErr) throw cErr;
      campaignId = c.id;
    }

    // ── Pre-map seller info for placeholder replacement ──
    const sellerIds = [...new Set(leads.map(l => l.responsavel_id).filter(Boolean))] as string[];
    const sellerMap: Record<string, { nome: string; whatsapp: string }> = {};
    if (sellerIds.length) {
      const { data: tm } = await supabase.from("team_members")
        .select("id, nome_completo, whatsapp_number")
        .in("id", sellerIds);
      for (const t of tm || []) {
        sellerMap[t.id] = { nome: t.nome_completo, whatsapp: t.whatsapp_number };
      }
    }

    let sent = 0, failed = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        const email = String(lead.email || "").trim();
        if (!email) { failed++; continue; }

        const sellerId = lead.responsavel_id as string | undefined;
        const seller = sellerId ? sellerMap[sellerId] : undefined;
        const waLink = seller?.whatsapp
          ? `https://wa.me/${String(seller.whatsapp).replace(/\D/g, "")}`
          : officialWaLink;

        // 1) placeholder replacement
        let personalHtml = html
          .replaceAll("{{nome}}", firstName(lead.nome as string))
          .replaceAll("{{primeiro_nome}}", firstName(lead.nome as string))
          .replaceAll("{{vendedor_nome}}", seller?.nome || from_name)
          .replaceAll("{{link_wa_vendedor}}", waLink);

        // 2) create send_log row (need id for tracking)
        let sendLogId: string | null = null;
        if (campaignId && lead.id) {
          const { data: slog } = await supabase.from("campaign_send_log").insert({
            campaign_id: campaignId,
            lead_id: lead.id,
            email,
            nome: lead.nome as string,
            provider: "gmail",
            status: "queued",
            subject_snapshot: subject,
          }).select("id").single();
          sendLogId = slog?.id || null;
        }

        // 3) rewrite all http(s) links via short_links
        const urls = extractUrls(personalHtml);
        for (const original of urls) {
          // skip tracking pixel URLs
          if (original.includes("/email-track-open")) continue;
          const code = randomCode(8);
          const { error: slErr } = await supabase.from("short_links").insert({
            code,
            destination_url: original,
            campaign_id: campaignId,
            send_log_id: sendLogId,
            lead_id: lead.id || null,
            seller_phone: seller?.whatsapp || null,
            seller_name: seller?.nome || null,
          });
          if (!slErr) {
            const shortUrl = `${shortBase}/${code}`;
            personalHtml = personalHtml.split(`href="${original}"`).join(`href="${shortUrl}"`);
          }
        }

        // 4) inject open-tracking pixel
        if (sendLogId) {
          const pixel = `<img src="${funcBase}/email-track-open?m=${sendLogId}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px" />`;
          personalHtml = personalHtml.replace(/<\/body>/i, `${pixel}</body>`);
          if (!/\<\/body\>/i.test(personalHtml)) personalHtml += pixel;
        }

        // 5) build RFC 2822 with preheader hack + sanitized document
        const preheaderBlock = preheader
          ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${preheader}</div>`
          : "";
        const sanitized = sanitizeEmailHtml(personalHtml);
        // Insert preheader right after <body ...>
        const wrappedHtml = preheaderBlock
          ? sanitized.replace(/<body([^>]*)>/i, `<body$1>${preheaderBlock}`)
          : sanitized;

        const senderHeader = `${from_name} <me@gmail>`; // Gmail replaces with authenticated addr
        const raw = [
          `To: ${email}`,
          `Subject: =?UTF-8?B?${b64std(subject)}?=`,
          `From: ${senderHeader}`,
          `MIME-Version: 1.0`,
          `Content-Language: pt-BR`,
          `Content-Type: text/html; charset="UTF-8"`,
          `Content-Transfer-Encoding: base64`,
          ``,
          b64std(wrappedHtml).replace(/(.{76})/g, "$1\r\n"),
        ].join("\r\n");

        const gres = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
          },
          body: JSON.stringify({ raw: b64url(raw) }),
        });

        const gjson = await gres.json().catch(() => ({}));

        if (sendLogId) {
          await supabase.from("campaign_send_log").update({
            status: gres.ok ? "sent" : "error",
            sent_at: gres.ok ? new Date().toISOString() : null,
            provider_message_id: gjson?.id || null,
            provider_status: String(gres.status),
            error_message: gres.ok ? null : (gjson?.error?.message || JSON.stringify(gjson).slice(0, 400)),
            html_snapshot: gres.ok ? wrappedHtml.slice(0, 60000) : null,
          }).eq("id", sendLogId);
        }

        if (gres.ok) sent++; else {
          failed++;
          errors.push(`${email}: ${gres.status} ${gjson?.error?.message || ""}`.slice(0, 200));
        }

        if (test_email) break;
        // gentle throttle: ~3 req/s
        await new Promise(r => setTimeout(r, 330));
      } catch (err) {
        failed++;
        errors.push(String(err).slice(0, 200));
      }
    }

    if (campaignId) {
      await supabase.from("campaigns").update({
        status: failed === leads.length ? "failed" : "completed",
        completed_at: new Date().toISOString(),
        total_sent: sent,
        total_failed: failed,
      }).eq("id", campaignId);
    }

    return new Response(JSON.stringify({
      ok: true,
      campaign_id: campaignId,
      audience: leads.length,
      sent, failed,
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[send-gmail] fatal", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});