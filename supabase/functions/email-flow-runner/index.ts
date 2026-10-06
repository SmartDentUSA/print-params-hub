// email-flow-runner — executa as réguas de "Automação de e-mails sequenciais".
// Rodado por pg_cron a cada 5 min. Lote limitado, trava única, progresso idempotente por enrollment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const DISPARO_PRO_URL = "https://apihttp.disparopro.com.br:8433/mt";
const DAILY_CAP = 499;
const WINDOW_START = 7 * 60 + 30, WINDOW_END = 19 * 60;
const BATCH = 40;
const MAX_HOPS = 6;

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const b64bytes = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const b64url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n");

function spMinutes(): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return Number(p.find(x => x.type === "hour")?.value ?? 0) % 24 * 60 + Number(p.find(x => x.type === "minute")?.value ?? 0);
}
function spDayStartIso(): string {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${d}T00:00:00-03:00`).toISOString();
}
function scheduleFor(node: any): string {
  const d = node?.data || {};
  const now = Date.now();
  if (node?.type === "wait") {
    if (d.mode === "until" && d.until) return new Date(d.until).toISOString();
    const mult = d.unit === "days" ? 1440 : d.unit === "hours" ? 60 : 1;
    return new Date(now + Math.max(0, Number(d.amount || 0)) * mult * 60_000).toISOString();
  }
  const t = d.timing || {};
  if (t.mode === "delay") return new Date(now + Math.max(0, Number(t.minutes || 0)) * 60_000).toISOString();
  if (t.mode === "datetime" && t.at) return new Date(t.at).toISOString();
  return new Date(now).toISOString();
}
function tpl(s: string, v: Record<string, string>) {
  return String(s || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => v[k] ?? "");
}

function signatureHtml(m: any): string {
  if (!m) return "";
  const digits = String(m.whatsapp_number || "").replace(/\D/g, "");
  const icon = (href: string | null, img: string, alt: string) => href
    ? `<a href="${href}" style="text-decoration:none;margin-right:6px"><img src="${img}" width="22" height="22" alt="${alt}" style="border:0;vertical-align:middle"></a>` : "";
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;font-family:Arial,Helvetica,sans-serif"><tr>
${m.photo_url ? `<td style="padding-right:14px;vertical-align:top"><img src="${m.photo_url}" width="64" height="64" alt="${m.nome_completo}" style="border-radius:50%;display:block;object-fit:cover"></td>` : ""}
<td style="vertical-align:top;font-size:13px;color:#334155;line-height:1.5">
<strong style="font-size:15px;color:#0f172a">${m.nome_completo || ""}</strong><br>
${m.cargo ? `${m.cargo}<br>` : ""}Smart Dent | Fluxo Digital<br>
${digits ? `<a href="https://wa.me/${digits}" style="color:#0f766e;text-decoration:none">+${digits}</a><br>` : ""}
<div style="margin-top:6px">
${icon(digits ? `https://wa.me/${digits}` : null, "https://img.icons8.com/color/48/whatsapp--v1.png", "WhatsApp")}
${icon(m.instagram_url, "https://img.icons8.com/color/48/instagram-new--v1.png", "Instagram")}
${icon(m.linkedin_url, "https://img.icons8.com/color/48/linkedin.png", "LinkedIn")}
${icon(m.facebook_url, "https://img.icons8.com/color/48/facebook-new.png", "Facebook")}
${icon(m.youtube_url, "https://img.icons8.com/color/48/youtube-play.png", "YouTube")}
</div></td></tr></table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: locked } = await supabase.rpc("fn_email_flow_try_lock", { _seconds: 240 });
  if (!locked) return json({ ok: true, skipped: "locked" });

  const stats = { enrolled: 0, processed: 0, emails: 0, whatsapp: 0, sms: 0, exited: 0, completed: 0, errors: 0 };
  try {
    // 1) Enroll audiences for active audience-origin flows
    const { data: flowsActive } = await supabase.from("email_flows").select("id").eq("status", "active").eq("origin_type", "audience");
    for (const f of flowsActive || []) {
      const { data: n, error } = await supabase.rpc("fn_email_flow_enroll_audience", { _flow: f.id, _limit: 2000 });
      if (error) console.error("[runner] enroll", f.id, error.message); else stats.enrolled += Number(n || 0);
    }

    // 2) Claim due enrollments
    const { data: claimed, error: claimErr } = await supabase.rpc("fn_email_flow_claim", { _limit: BATCH });
    if (claimErr) throw claimErr;
    if (!claimed?.length) return json({ ok: true, ...stats });

    const flowIds = [...new Set(claimed.map((e: any) => e.flow_id))];
    const { data: flows } = await supabase.from("email_flows").select("*").in("id", flowIds);
    const flowMap = new Map((flows || []).map((f: any) => [f.id, f]));

    // Email budget
    const { data: q } = await supabase.rpc("fn_email_queue_status");
    const { count: flowSentToday } = await supabase.from("email_flow_events").select("id", { count: "exact", head: true })
      .eq("event_type", "email_sent").gte("created_at", spDayStartIso());
    let emailBudget = Math.max(0, DAILY_CAP - Number((q as any)?.sent_today ?? 0) - Number(flowSentToday ?? 0));
    const inWindow = (() => { const m = spMinutes(); return m >= WINDOW_START && m < WINDOW_END; })();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const DISPARO_PRO_TOKEN = Deno.env.get("DISPARO_PRO_TOKEN");
    const funcBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const memberCache = new Map<string, any>();
    const getMember = async (id: string | null) => {
      if (!id) return null;
      if (memberCache.has(id)) return memberCache.get(id);
      const { data } = await supabase.from("team_members").select("*").eq("id", id).maybeSingle();
      memberCache.set(id, data); return data;
    };

    for (const enr of claimed as any[]) {
      const flow: any = flowMap.get(enr.flow_id);
      if (!flow) continue;
      stats.processed++;
      try {
        const nodes: any[] = Array.isArray(flow.nodes) ? flow.nodes : [];
        const edges: any[] = Array.isArray(flow.edges) ? flow.edges : [];
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const nextOf = (id: string, handle?: string) => {
          const e = edges.find((x) => x.source === id && (!handle || (x.sourceHandle || "yes") === handle)) || (handle ? null : null);
          return e ? byId.get(e.target) : null;
        };
        const ctx: any = { ...(enr.context || {}) };
        const log = (node_id: string | null, event_type: string, payload: any = {}) =>
          supabase.from("email_flow_events").insert({ flow_id: flow.id, enrollment_id: enr.id, node_id, event_type, payload }).select("id").single();
        const finish = async (status: string, reason?: string) => {
          await supabase.from("email_flow_enrollments").update({ status, exit_reason: reason ?? null, finished_at: new Date().toISOString(), context: ctx }).eq("id", enr.id);
          await log(null, status === "exited" ? "exited" : "completed", { reason });
          status === "exited" ? stats.exited++ : stats.completed++;
        };

        const { data: reason } = await supabase.rpc("fn_email_flow_exit_reason", { _enr: enr.id });
        if (reason) { await finish("exited", String(reason)); continue; }

        // Variables
        let lead: any = null;
        if (enr.lead_id) {
          const { data } = await supabase.from("lia_attendances").select("nome, email, telefone_normalized, piperun_owner_id, merged_into").eq("id", enr.lead_id).maybeSingle();
          lead = data;
        }
        let seller: any = null;
        if (lead?.piperun_owner_id) {
          const { data } = await supabase.from("team_members").select("*").eq("piperun_owner_id", lead.piperun_owner_id).maybeSingle();
          seller = data;
        }
        if (ctx.course_id && !ctx.curso) {
          const { data } = await supabase.from("smartops_courses").select("title").eq("id", ctx.course_id).maybeSingle();
          ctx.curso = data?.title || "";
        }
        const nome = String(enr.nome || lead?.nome || "").trim();
        const vars: Record<string, string> = {
          nome, primeiro_nome: nome.split(/\s+/)[0] || "", email: enr.email || lead?.email || "",
          curso: ctx.curso || "", vendedor_nome: seller?.nome_completo || "Smart Dent",
          link_wa_vendedor: seller?.whatsapp_number ? `https://wa.me/${String(seller.whatsapp_number).replace(/\D/g, "")}` : "https://wa.me/5516993831794",
        };

        let node: any = enr.current_node_id ? byId.get(enr.current_node_id) : nodes.find((n) => n.type === "origin");
        let nextRun: string | null = null;
        let hops = 0;
        let done = false;
        ctx._arrived = ctx._arrived || {};

        while (node && hops < MAX_HOPS && !nextRun && !done) {
          hops++;
          const d = node.data || {};
          let go: any = undefined; // undefined = default next; null = no next

          if (node.type === "origin") {
            go = nextOf(node.id);
          } else if (node.type === "email") {
            const to = String(enr.email || lead?.email || "").trim();
            if (!to) { await log(node.id, "skipped", { reason: "sem e-mail" }); }
            else if (!inWindow) { nextRun = new Date(Date.now() + 30 * 60_000).toISOString(); break; }
            else if (emailBudget <= 0) { nextRun = new Date(Date.now() + 60 * 60_000).toISOString(); break; }
            else if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) { throw new Error("Gmail não configurado"); }
            else {
              const { data: ev } = await log(node.id, "email_sent", { to, subject: d.subject });
              const evId = ev?.id;
              let html = tpl(d.html || "", vars);
              html = html.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, u) => `href="${funcBase}/email-flow-track?e=${evId}&t=c&u=${encodeURIComponent(u)}"`);
              const sigMember = d.signature === "seller" ? seller : await getMember(d.signature || null);
              const sig = signatureHtml(sigMember);
              const pixel = `<img src="${funcBase}/email-flow-track?e=${evId}&t=o" width="1" height="1" alt="" style="display:none">`;
              const pre = d.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${tpl(d.preheader, vars)}</div>` : "";
              html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${sig}${pixel}</body>`) : `${html}${sig}${pixel}`;
              html = /<body[^>]*>/i.test(html) ? html.replace(/<body([^>]*)>/i, `<body$1>${pre}`) : `<!doctype html><html><head><meta charset="UTF-8"></head><body>${pre}${html}</body></html>`;

              // Attachments
              const atts: { name: string; mime: string; data: string }[] = [];
              for (const a of (d.attachments || []) as any[]) {
                try {
                  if (a.kind === "certificate" && ctx.certificate_pdf_path) {
                    const { data: blob } = await supabase.storage.from("training-certificates").download(ctx.certificate_pdf_path);
                    if (blob) atts.push({ name: `Certificado - ${nome || "participante"}.pdf`, mime: "application/pdf", data: b64bytes(new Uint8Array(await blob.arrayBuffer())) });
                  } else if (a.kind === "url" && /^https?:\/\//.test(a.url || "")) {
                    const r = await fetch(a.url);
                    if (r.ok) atts.push({ name: a.filename || a.url.split("/").pop() || "anexo", mime: r.headers.get("content-type") || "application/octet-stream", data: b64bytes(new Uint8Array(await r.arrayBuffer())) });
                  }
                } catch (err) { console.error("[runner] attachment", err); }
              }
              if ((d.attachments || []).some((a: any) => a.kind === "certificate") && !atts.length && ctx.certificate_pdf_path === undefined) {
                await log(node.id, "warning", { reason: "certificado não disponível para este contato" });
              }

              const fromName = d.from_name || "Smart Dent | Fluxo Digital";
              const boundary = `b_${crypto.randomUUID()}`;
              const headers = [`To: ${to}`, `From: ${hdr(fromName)} <me@gmail>`, `Subject: ${hdr(tpl(d.subject || "", vars))}`, "MIME-Version: 1.0"];
              let raw: string;
              if (atts.length) {
                raw = [...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`,
                  'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(b64(html)),
                  ...atts.flatMap((a) => [`--${boundary}`, `Content-Type: ${a.mime}; name="${hdr(a.name)}"`, "Content-Transfer-Encoding: base64",
                    `Content-Disposition: attachment; filename="${hdr(a.name)}"`, "", wrap76(a.data)]),
                  `--${boundary}--`].join("\r\n");
              } else {
                raw = [...headers, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(b64(html))].join("\r\n");
              }
              const g = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
                body: JSON.stringify({ raw: b64url(b64(raw)) }),
              });
              const gj = await g.json().catch(() => ({}));
              if (!g.ok) {
                await supabase.from("email_flow_events").update({ event_type: "email_failed", payload: { to, status: g.status, error: gj?.error?.message || JSON.stringify(gj).slice(0, 300) } }).eq("id", evId);
                if (g.status === 429 || g.status >= 500) { nextRun = new Date(Date.now() + 30 * 60_000).toISOString(); break; }
              } else {
                await supabase.from("email_flow_events").update({ payload: { to, subject: d.subject, gmail_id: gj?.id, attachments: atts.length } }).eq("id", evId);
                emailBudget--; stats.emails++;
                ctx._last_email_node = node.id;
              }
            }
          } else if (node.type === "wait") {
            // chegou e já venceu → segue
          } else if (node.type === "condition") {
            const ref = d.ref_node || ctx._last_email_node;
            const arrived = ctx._arrived[node.id] ? new Date(ctx._arrived[node.id]).getTime() : Date.now();
            const evType = d.check === "opened" ? "email_opened" : "email_clicked";
            let qy = supabase.from("email_flow_events").select("id, payload").eq("enrollment_id", enr.id).eq("event_type", evType);
            if (ref) qy = qy.eq("node_id", ref);
            const { data: hits } = await qy.limit(50);
            let ok = (hits || []).length > 0;
            if (ok && d.check === "clicked_link" && d.link_contains) ok = (hits || []).some((h: any) => String(h.payload?.url || "").includes(d.link_contains));
            const timeoutMs = Math.max(1, Number(d.timeout_hours || 24)) * 3600_000;
            if (ok) { go = nextOf(node.id, "yes") ?? null; await log(node.id, "condition_yes", { check: d.check }); }
            else if (Date.now() - arrived >= timeoutMs) { go = nextOf(node.id, "no") ?? null; await log(node.id, "condition_no", { check: d.check }); }
            else { nextRun = new Date(Date.now() + 15 * 60_000).toISOString(); break; }
          } else if (node.type === "whatsapp") {
            const phone = String(enr.phone || lead?.telefone_normalized || "").replace(/\D/g, "");
            const tm = await getMember(d.instance_member_id || null);
            if (!phone) await log(node.id, "skipped", { reason: "sem telefone" });
            else if (!tm?.evolution_instance_name || !tm?.evolution_api_key) await log(node.id, "whatsapp_failed", { reason: "instância sem credenciais" });
            else {
              const base = (tm.evolution_base_url || "https://evolution.smartdent.com.br").replace(/\/$/, "");
              const r = await fetch(`${base}/message/sendText/${tm.evolution_instance_name}`, {
                method: "POST", headers: { "Content-Type": "application/json", apikey: tm.evolution_api_key },
                body: JSON.stringify({ number: phone, text: tpl(d.message || "", vars) }),
              });
              const body = await r.text();
              await log(node.id, r.ok ? "whatsapp_sent" : "whatsapp_failed", { phone, instance: tm.evolution_instance_name, status: r.status, body: body.slice(0, 200) });
              if (r.ok) stats.whatsapp++;
            }
          } else if (node.type === "sms") {
            const digits = String(enr.phone || lead?.telefone_normalized || "").replace(/\D/g, "");
            const numero = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : "";
            const msg = tpl(d.message || "", vars).slice(0, 160);
            if (!numero) await log(node.id, "skipped", { reason: "sem telefone" });
            else if (!DISPARO_PRO_TOKEN) await log(node.id, "sms_failed", { reason: "SMS não configurado" });
            else {
              const r = await fetch(DISPARO_PRO_URL, {
                method: "POST", headers: { Authorization: `Bearer ${DISPARO_PRO_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify([{ numero, servico: Deno.env.get("DISPARO_PRO_SERVICO") || "short", mensagem: msg, codificacao: "0", nome_campanha: String(flow.name).slice(0, 60) }]),
              });
              const body = await r.text();
              await log(node.id, r.ok ? "sms_sent" : "sms_failed", { numero, status: r.status, body: body.slice(0, 200) });
              if (r.ok) stats.sms++;
            }
          } else if (node.type === "end") {
            go = null;
          }

          if (nextRun) break;
          const nxt = go === undefined ? nextOf(node.id) : go;
          if (!nxt) { done = true; node = null; break; }
          node = nxt;
          ctx._arrived[node.id] = new Date().toISOString();
          const when = scheduleFor(node);
          if (new Date(when).getTime() > Date.now() + 1000) nextRun = when;
        }

        if (done || !node) { await finish("completed"); continue; }
        await supabase.from("email_flow_enrollments").update({
          current_node_id: node.id, next_run_at: nextRun || new Date().toISOString(), context: ctx,
        }).eq("id", enr.id);
      } catch (err: any) {
        stats.errors++;
        console.error("[runner] enrollment", enr.id, err?.message || err);
        await supabase.from("email_flow_events").insert({ flow_id: enr.flow_id, enrollment_id: enr.id, event_type: "error", payload: { error: String(err?.message || err).slice(0, 300) } });
      }
    }
    return json({ ok: true, ...stats });
  } catch (err: any) {
    console.error("[runner] fatal", err);
    return json({ error: String(err?.message || err), ...stats }, 500);
  } finally {
    await supabase.rpc("fn_email_flow_unlock");
  }
});
