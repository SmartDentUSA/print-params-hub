// sentinela-email-report — roda 00:00 BRT (03:00 UTC). Relatório profissional
// das últimas 24h de sentinela_group_messages, dividido em Dentro (interno),
// Clientes, Nutrição e Fora/Mercado, enviado por e-mail via Gmail (gateway).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY") ?? "";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const RECIPIENT = "danilohen@gmail.com";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

type Cat = "interno" | "cliente" | "nutricao" | "externo";
const CAT_LABEL: Record<Cat, string> = {
  interno: "Dentro — Grupos internos",
  cliente: "Clientes — Turmas, treinamentos e pós-venda",
  nutricao: "Nutrição — Grupos de campanha/comunidade",
  externo: "Fora / Mercado — Grupos externos",
};

function classify(g: any): Cat {
  const n = String(g?.name ?? "").toLowerCase();
  if (/interno|dashboard|equipe|diretoria|comercial smdt|\bsmdt\b/.test(n)) return "interno";
  if (g?.tipo === "treinamento" || g?.turma_id || /^#\s*\d|imers|treinamento|mentoria|\bkit\b|\brms\b|pro\d{3,}|^tn\s*\d|turma/.test(n)) return "cliente";
  if (g?.active_campaign_id || g?.is_admin) return "nutricao";
  return "externo";
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const top = (o: Record<string, number>, k = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
const inc = (o: Record<string, number>, arr?: string[] | null) => { for (const x of arr ?? []) if (x) o[x] = (o[x] || 0) + 1; };

async function fetchAll(since: string, until: string) {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await sb.from("sentinela_group_messages")
      .select("group_id, group_name, sender_jid, sender_phone, sender_name, lead_id, message_text, from_me, message_ts, created_at, sentiment, intent, urgency, topics, product_mentions, competitor_mentions, pain_points, buy_signals, relevance_score, processed")
      .gte("created_at", since).lt("created_at", until).order("created_at").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function inChunks<T>(vals: string[], fn: (c: string[]) => Promise<T[]>) {
  const r: T[] = [];
  for (let i = 0; i < vals.length; i += 200) r.push(...(await fn(vals.slice(i, i + 200))));
  return r;
}

async function buildReport() {
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 3600 * 1000);
  const msgs = await fetchAll(since.toISOString(), until.toISOString());

  const groupIds = [...new Set(msgs.map((m) => m.group_id).filter(Boolean))] as string[];
  const groups = await inChunks(groupIds, async (c) =>
    (await sb.from("wa_groups").select("id, name, tipo, turma_id, active_campaign_id, is_admin, member_count").in("id", c)).data ?? []);
  const gmap = new Map(groups.map((g: any) => [g.id, g]));

  // Identificação de pessoas: equipe (evolution_lid / telefone) e leads (whatsapp_lid / telefone)
  const lids = [...new Set(msgs.map((m) => m.sender_jid).filter((j) => j?.endsWith("@lid")).map((j) => j.split("@")[0]))] as string[];
  const phones = [...new Set(msgs.map((m) => digits(m.sender_phone) || (m.sender_jid?.endsWith("@s.whatsapp.net") ? digits(m.sender_jid) : "")).filter((p) => p.length >= 10))] as string[];
  const leadIds = [...new Set(msgs.map((m) => m.lead_id).filter(Boolean))] as string[];

  const { data: team } = await sb.from("team_members").select("nome_completo, whatsapp_number, evolution_lid");
  const teamByKey = new Map<string, string>();
  for (const t of team ?? []) {
    if (t.evolution_lid) teamByKey.set(String(t.evolution_lid).split("@")[0], t.nome_completo);
    const p = digits(t.whatsapp_number); if (p.length >= 10) teamByKey.set(p.slice(-11), t.nome_completo);
  }

  const leadSel = "id, nome, email, telefone_normalized, whatsapp_lid, proprietario_lead_crm, piperun_stage_name, total_deals_all, produto_interesse";
  const leadRows: any[] = [
    ...(await inChunks(lids, async (c) => (await sb.from("lia_attendances").select(leadSel).is("merged_into", null).in("whatsapp_lid", c)).data ?? [])),
    ...(await inChunks(phones, async (c) => (await sb.from("lia_attendances").select(leadSel).is("merged_into", null).in("telefone_normalized", c)).data ?? [])),
    ...(await inChunks(leadIds, async (c) => (await sb.from("lia_attendances").select(leadSel).is("merged_into", null).in("id", c)).data ?? [])),
  ];
  const leadByKey = new Map<string, any>();
  for (const l of leadRows) {
    leadByKey.set("id:" + l.id, l);
    if (l.whatsapp_lid) leadByKey.set("lid:" + String(l.whatsapp_lid).split("@")[0], l);
    if (l.telefone_normalized) leadByKey.set("ph:" + digits(l.telefone_normalized), l);
  }
  const resolveLead = (m: any) => {
    if (m.lead_id && leadByKey.get("id:" + m.lead_id)) return leadByKey.get("id:" + m.lead_id);
    const jid = String(m.sender_jid ?? "");
    if (jid.endsWith("@lid")) { const l = leadByKey.get("lid:" + jid.split("@")[0]); if (l) return l; }
    const p = digits(m.sender_phone) || (jid.endsWith("@s.whatsapp.net") ? digits(jid) : "");
    return p ? leadByKey.get("ph:" + p) : undefined;
  };
  const resolveTeam = (m: any) => {
    const jid = String(m.sender_jid ?? "");
    const p = digits(m.sender_phone) || (jid.endsWith("@s.whatsapp.net") ? digits(jid) : "");
    return teamByKey.get(jid.split("@")[0]) || (p ? teamByKey.get(p.slice(-11)) : undefined);
  };

  type Sec = { msgs: number; groups: Map<string, number>; pos: number; neg: number; buy: number; topics: Record<string, number>; prods: Record<string, number>; comps: Record<string, number>; pains: Record<string, number>; leads: Map<string, any>; team: Record<string, number>; unknown: Set<string>; highlights: any[] };
  const mk = (): Sec => ({ msgs: 0, groups: new Map(), pos: 0, neg: 0, buy: 0, topics: {}, prods: {}, comps: {}, pains: {}, leads: new Map(), team: {}, unknown: new Set(), highlights: [] });
  const secs: Record<Cat, Sec> = { interno: mk(), cliente: mk(), nutricao: mk(), externo: mk() };
  let processed = 0;

  for (const m of msgs) {
    const g = gmap.get(m.group_id) ?? { name: m.group_name };
    const s = secs[classify(g)];
    const gname = g.name || m.group_name || "Sem nome";
    s.msgs++; s.groups.set(gname, (s.groups.get(gname) || 0) + 1);
    if (m.processed) processed++;
    if (m.sentiment === "positive") s.pos++;
    if (m.sentiment === "negative") s.neg++;
    if (m.buy_signals) s.buy++;
    inc(s.topics, m.topics); inc(s.prods, m.product_mentions); inc(s.comps, m.competitor_mentions); inc(s.pains, m.pain_points);
    const tm = m.from_me ? "Smart Dent (instância)" : resolveTeam(m);
    const lead = tm ? undefined : resolveLead(m);
    if (tm) s.team[tm] = (s.team[tm] || 0) + 1;
    else if (lead) {
      const e = s.leads.get(lead.id) ?? { lead, n: 0, buy: 0, groups: new Set<string>() };
      e.n++; if (m.buy_signals) e.buy++; e.groups.add(gname); s.leads.set(lead.id, e);
    } else if (m.sender_jid) s.unknown.add(m.sender_jid);
    if (!m.from_me && m.message_text && (m.buy_signals || (m.relevance_score ?? 0) >= 7 || m.urgency === "high" || (m.competitor_mentions?.length ?? 0) > 0 || m.sentiment === "negative")) {
      s.highlights.push({ m, gname, who: tm || lead?.nome || m.sender_name || "Não identificado" });
    }
  }
  for (const s of Object.values(secs)) s.highlights.sort((a, b) => (Number(b.m.buy_signals) - Number(a.m.buy_signals)) || ((b.m.relevance_score ?? 0) - (a.m.relevance_score ?? 0)));

  return { since, until, total: msgs.length, processed, secs, groupCount: groupIds.length };
}

async function aiSummary(r: any): Promise<string> {
  if (!LOVABLE_API_KEY || r.total === 0) return "";
  const brief = (Object.keys(r.secs) as Cat[]).map((k) => {
    const s = r.secs[k];
    return `${CAT_LABEL[k]}: ${s.msgs} msgs, ${s.groups.size} grupos, ${s.buy} sinais de compra, +${s.pos}/-${s.neg}. Tópicos: ${top(s.topics).map((x) => x[0]).join(", ")}. Produtos: ${top(s.prods).map((x) => x[0]).join(", ")}. Concorrentes: ${top(s.comps).map((x) => x[0]).join(", ")}. Dores: ${top(s.pains).map((x) => x[0]).join(", ")}. Destaques: ${s.highlights.slice(0, 8).map((h: any) => `[${h.gname}] ${String(h.m.message_text).slice(0, 160)}`).join(" | ")}`;
  }).join("\n");
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "Você é analista sênior de inteligência comercial da Smart Dent (odontologia digital). Escreva em português do Brasil um resumo executivo objetivo (máx. 8 tópicos curtos, sem markdown, um por linha iniciando com '• '). Use SOMENTE os dados fornecidos; não invente números, nomes ou fatos. Separe o que aconteceu dentro do ecossistema, com clientes, em nutrição e no mercado externo, e termine com 2 ações recomendadas." },
          { role: "user", content: brief },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return "";
    const j = await res.json();
    return String(j?.choices?.[0]?.message?.content ?? "").trim();
  } catch { return ""; }
}

function renderHtml(r: any, summary: string) {
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const chips = (o: [string, number][]) => o.length ? o.map(([k, v]) => `<span style="display:inline-block;background:#eef4f6;color:#0b4f5c;border-radius:12px;padding:2px 9px;margin:2px;font-size:12px">${esc(k)} (${v})</span>`).join("") : `<span style="color:#888;font-size:12px">—</span>`;
  const kpi = (l: string, v: unknown) => `<td style="padding:10px;text-align:center;border:1px solid #e3e8ea"><div style="font-size:20px;font-weight:700;color:#0b4f5c">${esc(v)}</div><div style="font-size:11px;color:#667">${l}</div></td>`;
  const sections = (Object.keys(r.secs) as Cat[]).map((k) => {
    const s = r.secs[k];
    const leads = [...s.leads.values()].sort((a: any, b: any) => b.buy - a.buy || b.n - a.n);
    return `
<h2 style="font-size:17px;color:#0b4f5c;border-bottom:2px solid #0b4f5c;padding-bottom:4px;margin-top:28px">${CAT_LABEL[k]}</h2>
${s.msgs === 0 ? `<p style="color:#888">Nenhuma mensagem no período.</p>` : `
<table style="border-collapse:collapse;width:100%;margin:8px 0"><tr>${kpi("Mensagens", s.msgs)}${kpi("Grupos ativos", s.groups.size)}${kpi("Sinais de compra", s.buy)}${kpi("Positivas", s.pos)}${kpi("Negativas", s.neg)}${kpi("Leads identificados", s.leads.size)}</tr></table>
<p style="margin:6px 0"><b>Grupos mais ativos:</b><br>${chips(top(Object.fromEntries(s.groups), 8))}</p>
<p style="margin:6px 0"><b>Tópicos:</b><br>${chips(top(s.topics))}</p>
<p style="margin:6px 0"><b>Produtos citados:</b><br>${chips(top(s.prods))}</p>
<p style="margin:6px 0"><b>Concorrentes / mercado:</b><br>${chips(top(s.comps))}</p>
<p style="margin:6px 0"><b>Dores relatadas:</b><br>${chips(top(s.pains))}</p>
${Object.keys(s.team).length ? `<p style="margin:6px 0"><b>Equipe que interagiu:</b><br>${chips(top(s.team, 12))}</p>` : ""}
${leads.length ? `<p style="margin:10px 0 4px"><b>Leads/clientes que interagiram</b></p>
<table style="border-collapse:collapse;width:100%;font-size:12px"><tr style="background:#0b4f5c;color:#fff"><th style="padding:5px;text-align:left">Nome</th><th style="padding:5px">Msgs</th><th style="padding:5px">Sinal compra</th><th style="padding:5px;text-align:left">Vendedor / Etapa</th><th style="padding:5px;text-align:left">Grupos</th></tr>
${leads.slice(0, 25).map((e: any) => `<tr style="border-bottom:1px solid #e3e8ea"><td style="padding:5px">${esc(e.lead.nome || e.lead.email || e.lead.telefone_normalized)}${(e.lead.total_deals_all ?? 0) > 0 ? ' <span style="color:#0a7a3d;font-size:11px">● cliente</span>' : ""}</td><td style="padding:5px;text-align:center">${e.n}</td><td style="padding:5px;text-align:center">${e.buy || "—"}</td><td style="padding:5px">${esc(e.lead.proprietario_lead_crm || "—")} · ${esc(e.lead.piperun_stage_name || "—")}</td><td style="padding:5px">${esc([...e.groups].slice(0, 3).join(", "))}</td></tr>`).join("")}
</table>${leads.length > 25 ? `<p style="font-size:11px;color:#888">+${leads.length - 25} outros leads</p>` : ""}` : ""}
${s.unknown.size ? `<p style="font-size:12px;color:#888">${s.unknown.size} participante(s) não identificado(s) no CRM.</p>` : ""}
${s.highlights.length ? `<p style="margin:10px 0 4px"><b>Mensagens detectadas (destaques)</b></p>
${s.highlights.slice(0, 10).map((h: any) => `<div style="border-left:3px solid ${h.m.buy_signals ? "#0a7a3d" : h.m.sentiment === "negative" ? "#b3261e" : "#0b4f5c"};background:#f8fafb;padding:6px 10px;margin:5px 0;font-size:12px"><div style="color:#667;font-size:11px">${esc(h.gname)} · ${esc(h.who)}${h.m.buy_signals ? " · 🔥 sinal de compra" : ""}${h.m.intent ? " · " + esc(h.m.intent) : ""}</div>${esc(String(h.m.message_text).slice(0, 400))}</div>`).join("")}` : ""}`}`;
  }).join("");

  return `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#222">
<div style="max-width:780px;margin:0 auto;background:#fff;padding:24px">
<div style="background:#0b4f5c;color:#fff;padding:18px 20px;border-radius:6px">
<div style="font-size:12px;opacity:.85">Smart Dent | Fluxo Digital · Sentinela</div>
<div style="font-size:22px;font-weight:700;margin-top:4px">Relatório diário de grupos WhatsApp</div>
<div style="font-size:12px;opacity:.85;margin-top:4px">${fmt(r.since)} → ${fmt(r.until)} (horário de Brasília)</div></div>
<table style="border-collapse:collapse;width:100%;margin:16px 0"><tr>${kpi("Mensagens", r.total)}${kpi("Grupos", r.groupCount)}${kpi("Analisadas pela IA", r.processed)}${kpi("Sinais de compra", Object.values(r.secs).reduce((a: number, s: any) => a + s.buy, 0))}</tr></table>
${summary ? `<h2 style="font-size:17px;color:#0b4f5c">Resumo executivo</h2><div style="font-size:13px;line-height:1.6;white-space:pre-line;background:#f8fafb;padding:12px;border-radius:6px">${esc(summary)}</div>` : ""}
${sections}
<p style="font-size:11px;color:#999;margin-top:28px">Classificação dos grupos por nome/vínculo: internos (equipe/dashboards), clientes (turmas, treinamentos, mentorias, kits e RMS), nutrição (grupos administrados/campanha) e externos (demais). Identificação de pessoas pelo WhatsApp cadastrado no CRM. Relatório gerado automaticamente.</p>
</div></body></html>`;
}

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

async function sendEmail(to: string, subject: string, html: string) {
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) throw new Error("gmail_not_configured");
  const raw = [`To: ${to}`, `Subject: ${hdr(subject)}`, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(html)].join("\r\n");
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }),
  });
  if (!res.ok) throw new Error(`gmail ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    let to = RECIPIENT;
    try { const b = await req.json(); if (typeof b?.to === "string" && /^[^@\s]+@[^@\s]+$/.test(b.to)) to = b.to; } catch { /* sem body */ }

    // Processa mensagens pendentes antes do relatório (melhor esforço).
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/sentinela-analyzer`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: "{}", signal: AbortSignal.timeout(90_000),
      });
    } catch { /* segue com o que já estiver analisado */ }

    const r = await buildReport();
    const summary = await aiSummary(r);
    const html = renderHtml(r, summary);
    const day = r.since.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const sent = await sendEmail(to, `Sentinela Smart Dent — Relatório diário ${day} (${r.total} mensagens)`, html);

    await sb.from("system_health_logs").insert({ function_name: "sentinela-email-report", severity: "info", error_type: "sentinela", details: { to, total: r.total, gmail_id: sent?.id } });
    return Response.json({ ok: true, to, total: r.total, gmail_id: sent?.id }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("system_health_logs").insert({ function_name: "sentinela-email-report", severity: "error", error_type: "sentinela", details: { message: msg } });
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});
