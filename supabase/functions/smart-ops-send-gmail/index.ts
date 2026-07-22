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

// Mirror of `applyFiltersToQuery` in src/components/SmartOpsCampaigns.tsx.
// Keep both in sync — server-side audience MUST equal the UI count.
function applyCampaignFilters(q: any, f: Record<string, any>): any {
  if (!f) return q;
  if (f.produto_interesse) {
    const safe = String(f.produto_interesse).replace(/,/g, " ");
    q = q.or(`produto_interesse.ilike.%${safe}%,produto_interesse_auto.ilike.%${safe}%`);
  }
  if (f.temperatura_lead != null) q = q.eq("temperatura_lead", f.temperatura_lead);
  if (f.piperun_stage_name) q = q.eq("piperun_stage_name", f.piperun_stage_name);
  if (f.especialidade) q = q.eq("especialidade", f.especialidade);
  if (f.area_atuacao) q = q.eq("area_atuacao", f.area_atuacao);
  if (f.uf) q = q.eq("uf", f.uf);
  if (f.proprietario_lead_crm) q = q.eq("proprietario_lead_crm", f.proprietario_lead_crm);
  if (f.real_status) q = q.eq("real_status", f.real_status);
  if (f.tem_scanner === "yes") q = q.eq("tem_scanner", true);
  if (f.tem_scanner === "no")  q = q.or("tem_scanner.is.null,tem_scanner.eq.false");
  if (f.tem_printer === "yes") q = q.eq("tem_impressora", true);
  if (f.tem_printer === "no")  q = q.or("tem_impressora.is.null,tem_impressora.eq.false");
  if (f.recencia_dias != null) {
    const since = new Date(Date.now() - Number(f.recencia_dias) * 86400000).toISOString();
    q = q.gte("updated_at", since);
  }
  if (f.cliente_filter === "clientes") q = q.gt("total_deals_all", 0);
  if (f.cliente_filter === "leads")    q = q.or("total_deals_all.is.null,total_deals_all.eq.0");
  if (f.piperun_pipeline_name)     q = q.eq("piperun_pipeline_name", f.piperun_pipeline_name);
  if (f.origem_primeiro_contato)   q = q.eq("origem_primeiro_contato", f.origem_primeiro_contato);
  if (f.piperun_status)            q = q.eq("piperun_status", f.piperun_status);
  if (f.prazo_compra)              q = q.eq("prazo_compra", f.prazo_compra);
  if (f.tipo_local)                q = q.eq("tipo_local", f.tipo_local);
  if (f.cidade)                    q = q.ilike("cidade", `%${String(f.cidade).replace(/,/g, " ")}%`);
  if (f.form_name)                 q = q.eq("form_name", f.form_name);
  if (f.utm_campaign)              q = q.ilike("utm_campaign", `%${String(f.utm_campaign).replace(/,/g, " ")}%`);
  if (f.marca_scanner) {
    const safe = String(f.marca_scanner).replace(/,/g, " ");
    q = q.or(`scanner_marca.ilike.%${safe}%,equip_scanner.ilike.%${safe}%`);
  }
  if (f.marca_impressora) {
    const safe = String(f.marca_impressora).replace(/,/g, " ");
    q = q.or(`equip_impressora.ilike.%${safe}%,impressora_modelo.ilike.%${safe}%`);
  }
  if (f.tem_fresadora === "yes") q = q.not("equip_fresadora", "is", null);
  if (f.tem_fresadora === "no")  q = q.is("equip_fresadora", null);
  if (f.tem_cad === "yes") q = q.or("equip_cad.not.is.null,software_cad.not.is.null");
  if (f.tem_cad === "no")  q = q.is("equip_cad", null).is("software_cad", null);
  const ynBool = (col: string, v: string) => v === "yes"
    ? (qq: any) => qq.eq(col, true)
    : (qq: any) => qq.or(`${col}.is.null,${col}.eq.false`);
  if (f.imprime_modelos)    q = ynBool("imprime_modelos",    f.imprime_modelos)(q);
  if (f.imprime_placas)     q = ynBool("imprime_placas",     f.imprime_placas)(q);
  if (f.imprime_guias)      q = ynBool("imprime_guias",      f.imprime_guias)(q);
  if (f.imprime_resinas_ld) q = ynBool("imprime_resinas_ld", f.imprime_resinas_ld)(q);
  if (f.reuniao_agendada)   q = ynBool("reuniao_agendada",   f.reuniao_agendada)(q);
  if (f.omie_inadimplente)  q = ynBool("omie_inadimplente",  f.omie_inadimplente)(q);
  if (f.recompra_alert)     q = ynBool("recompra_alert",     f.recompra_alert)(q);
  if (f.sdr_completo)       q = ynBool("sdr_completo",       f.sdr_completo)(q);
  if (f.tem_email === "yes")     q = q.not("email", "is", null);
  if (f.tem_email === "no")      q = q.is("email", null);
  if (f.tem_telefone === "yes")  q = q.not("telefone_normalized", "is", null);
  if (f.tem_telefone === "no")   q = q.is("telefone_normalized", null);
  if (f.aceita_contato === "yes") q = q.or("do_not_contact.is.null,do_not_contact.eq.false");
  if (f.aceita_contato === "no")  q = q.eq("do_not_contact", true);
  if (f.ltv_min != null)   q = q.gte("ltv_total", Number(f.ltv_min));
  if (f.score_min != null) q = q.gte("intelligence_score_total", Number(f.score_min));
  // Legacy shortcuts (kept for backward compat with older callers)
  if (f.etapa_funil)  q = q.eq("etapa_funil", f.etapa_funil);
  if (f.temperatura && f.temperatura_lead == null) q = q.eq("temperatura", f.temperatura);
  return q;
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

function forceFormDestination(html: string, ctaConfig: any): string {
  const principal = ctaConfig?.cta_principal;
  const formUrl = principal?.tipo === "form" && /^https:\/\/s\.smartdent\.com\.br\/[A-Za-z0-9_-]+$/i.test(principal?.url || "")
    ? principal.url
    : null;
  if (!formUrl) throw new Error("CTA do e-mail deve usar a URL encurtada oficial do formulário");
  return html.replace(/href\s*=\s*(["'])https?:\/\/[^"']+\1/gi, (_match, quote) => `href=${quote}${formUrl}${quote}`);
}

// Send a single email for a queued campaign_send_log row.
// Updates the log row and short_links; returns { ok, sent, error }.
async function sendOne(args: {
  supabase: any; funcBase: string; shortBase: string; GATEWAY_URL: string;
  LOVABLE_API_KEY: string; GOOGLE_MAIL_API_KEY: string;
  email: string; nome: string; leadId: string | null;
  campaignId: string; sendLogId: string;
  subject: string; preheader: string; html: string;
  fromName: string; seller?: { nome: string; whatsapp: string }; waLink: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, funcBase, shortBase, GATEWAY_URL, LOVABLE_API_KEY, GOOGLE_MAIL_API_KEY,
    email, nome, leadId, campaignId, sendLogId, subject, preheader, html, fromName, seller, waLink } = args;

  let personalHtml = html
    .replaceAll("{{nome}}", firstName(nome))
    .replaceAll("{{primeiro_nome}}", firstName(nome))
    .replaceAll("{{vendedor_nome}}", seller?.nome || fromName)
    .replaceAll("{{link_wa_vendedor}}", waLink);

  // Short-link rewrite
  const urls = extractUrls(personalHtml);
  for (const original of urls) {
    if (original.includes("/email-track-open")) continue;
    const code = randomCode(8);
    const { error: slErr } = await supabase.from("short_links").insert({
      code, destination_url: original,
      campaign_id: campaignId, send_log_id: sendLogId, lead_id: leadId,
      seller_phone: seller?.whatsapp || null, seller_name: seller?.nome || null,
    });
    if (!slErr) {
      const shortUrl = `${shortBase}/${code}`;
      personalHtml = personalHtml.split(`href="${original}"`).join(`href="${shortUrl}"`);
    }
  }

  // Pixel + sanitize
  const pixel = `<img src="${funcBase}/email-track-open?m=${sendLogId}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px" />`;
  personalHtml = personalHtml.replace(/<\/body>/i, `${pixel}</body>`);
  if (!/<\/body>/i.test(personalHtml)) personalHtml += pixel;
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${preheader}</div>`
    : "";
  const sanitized = sanitizeEmailHtml(personalHtml);
  const wrappedHtml = preheaderBlock
    ? sanitized.replace(/<body([^>]*)>/i, `<body$1>${preheaderBlock}`)
    : sanitized;

  const raw = [
    `To: ${email}`,
    `Subject: =?UTF-8?B?${b64std(subject)}?=`,
    `From: ${fromName} <me@gmail>`,
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

  await supabase.from("campaign_send_log").update({
    status: gres.ok ? "sent" : "error",
    sent_at: gres.ok ? new Date().toISOString() : null,
    provider_message_id: gjson?.id || null,
    provider_status: String(gres.status),
    error_message: gres.ok ? null : (gjson?.error?.message || JSON.stringify(gjson).slice(0, 400)),
    html_snapshot: gres.ok ? wrappedHtml.slice(0, 60000) : null,
  }).eq("id", sendLogId);

  return gres.ok ? { ok: true } : { ok: false, error: `${gres.status} ${gjson?.error?.message || ""}`.slice(0, 200) };
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
    // The apex smartdent.com.br is served by WordPress/LiteSpeed, not this Vercel
    // project, so /r/:code is a 404 there. Keep tracked links on the app domain,
    // where vercel.json routes them to short-link-redirect.
    const shortBase = "https://parametros.smartdent.com.br/r";

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
      scheduled_at = null,
      action,            // 'send_one' when invoked by the scheduler
      send_log_id,       // required with action='send_one'
    } = body || {};

    // ────────── Mode: send a single queued row (scheduler-driven) ──────────
    if (action === "send_one") {
      if (!send_log_id) {
        return new Response(JSON.stringify({ error: "send_log_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: log } = await supabase
        .from("campaign_send_log")
        .select("id, source_campaign_id, lead_id, email, nome, status, subject_snapshot")
        .eq("id", send_log_id)
        .maybeSingle();
      if (!log) return new Response(JSON.stringify({ error: "log not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (log.status !== "queued") {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: `status=${log.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: camp } = await supabase
        .from("campaigns")
        .select("id, email_subject, email_preheader, email_html, cta_config, nome")
        .eq("id", log.source_campaign_id).maybeSingle();
      if (!camp) return new Response(JSON.stringify({ error: "campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Resolve seller for this lead
      let seller: { nome: string; whatsapp: string } | undefined;
      if (log.lead_id) {
        const { data: la } = await supabase.from("lia_attendances")
          .select("piperun_owner_id").eq("id", log.lead_id).maybeSingle();
        const ownerId = (la as any)?.piperun_owner_id;
        if (ownerId) {
          const { data: tm } = await supabase.from("team_members")
            .select("nome_completo, whatsapp_number").eq("piperun_owner_id", ownerId).maybeSingle();
          if (tm) seller = { nome: tm.nome_completo, whatsapp: tm.whatsapp_number };
        }
      }
      const waLink = seller?.whatsapp ? `https://wa.me/${String(seller.whatsapp).replace(/\D/g, "")}` : officialWaLink;
      const result = await sendOne({
        supabase, funcBase, shortBase, GATEWAY_URL, LOVABLE_API_KEY, GOOGLE_MAIL_API_KEY,
        email: log.email, nome: (log.nome as any) || "", leadId: log.lead_id,
        campaignId: camp.id, sendLogId: log.id,
        subject: camp.email_subject || log.subject_snapshot || "",
        preheader: camp.email_preheader || "",
        html: camp.email_html || "",
        fromName: from_name, seller, waLink,
      });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: "subject e html são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailHtml: string;
    try {
      emailHtml = forceFormDestination(html, cta_config);
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "CTA de formulário inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ────────── Mode: TEST EMAIL — send one right now, no queue ──────────
    if (test_email) {
      // Send test inline: no campaigns row, no send_log, no short_links, no pixel.
      const personalHtml = emailHtml
        .replaceAll("{{nome}}", "Teste")
        .replaceAll("{{primeiro_nome}}", "Teste")
        .replaceAll("{{vendedor_nome}}", from_name)
        .replaceAll("{{link_wa_vendedor}}", officialWaLink);
      const preheaderBlock = preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${preheader}</div>`
        : "";
      const sanitized = sanitizeEmailHtml(personalHtml);
      const wrappedHtml = preheaderBlock
        ? sanitized.replace(/<body([^>]*)>/i, `<body$1>${preheaderBlock}`)
        : sanitized;
      const raw = [
        `To: ${test_email}`,
        `Subject: =?UTF-8?B?${b64std(`[TESTE] ${subject}`)}?=`,
        `From: ${from_name} <me@gmail>`,
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
      const errMsg = gres.ok ? null : (gjson?.error?.message || JSON.stringify(gjson).slice(0, 400));
      return new Response(JSON.stringify({
        ok: gres.ok, audience: 1,
        sent: gres.ok ? 1 : 0, failed: gres.ok ? 0 : 1,
        errors: errMsg ? [errMsg] : [],
        provider_status: gres.status,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ────────── Mode: ENQUEUE — resolve audience and queue for the scheduler ──────────
    let q = supabase.from("lia_attendances")
      .select("id, nome, email")
      .is("merged_into", null)
      .not("email", "is", null)
      .neq("email", "")
      .limit(5000);
    q = applyCampaignFilters(q, filters || {});
    const { data: leadsData, error: leadsErr } = await q;
    if (leadsErr) throw leadsErr;
    const leads = (leadsData || []).filter((l: any) => String(l.email || "").trim());
    console.log("[send-gmail] enqueue filters=", JSON.stringify(filters || {}), "audience=", leads.length);

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, audience: leads.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (leads.length === 0) {
      return new Response(JSON.stringify({
        ok: false, error: "audience_empty",
        message: "Nenhum lead corresponde aos filtros selecionados.",
        audience: 0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isFutureSchedule = scheduled_at && new Date(scheduled_at).getTime() > Date.now();
    const { data: c, error: cErr } = await supabase.from("campaigns").insert({
      nome: campaign_name || `Email — ${new Date().toISOString().slice(0, 10)}`,
      descricao: description || null,
      canal: "email",
       email_subject: subject, email_preheader: preheader, email_html: emailHtml,
      cta_config, lead_filter: filters,
      audience_count: leads.length, total_leads: leads.length,
      status: "scheduled",
      scheduled_at: scheduled_at || new Date().toISOString(),
    }).select("id").single();
    if (cErr) throw cErr;
    const campaignId = c.id;

    // Bulk insert queued send-log rows in batches of 500
    const rows = leads.map((l: any) => ({
      source_campaign_id: campaignId, lead_id: l.id,
      email: String(l.email).trim(), nome: l.nome,
      provider: "gmail", status: "queued", subject_snapshot: subject,
    }));
    let queued = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error: insErr, count } = await supabase.from("campaign_send_log")
        .insert(chunk, { count: "exact" });
      if (insErr) throw insErr;
      queued += count ?? chunk.length;
    }

    return new Response(JSON.stringify({
      ok: true, queued: true, campaign_id: campaignId,
      audience: leads.length, sent: 0, failed: 0,
      scheduled_at: scheduled_at || null,
      future: !!isFutureSchedule,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[send-gmail] fatal", err);
    const detail = (err && typeof err === "object")
      ? {
          message: (err as any).message ?? null,
          code: (err as any).code ?? null,
          details: (err as any).details ?? null,
          hint: (err as any).hint ?? null,
          name: (err as any).name ?? null,
        }
      : { message: String(err) };
    return new Response(JSON.stringify({ error: detail.message || "unknown", detail }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});