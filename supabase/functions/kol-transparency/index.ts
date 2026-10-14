// kol-transparency — Portal de Transparência do KOL (público).
// Login SÓ pelo celular cadastrado (sem código) → sessão em kol_access_sessions; tentativas em kol_portal_attempts.
// Toda leitura usa o lead da SESSÃO, nunca um id vindo da tela.
// Antes do aceite: só contrato + termo de imagem. Depois: todas as seções.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { acceptKolContract, ipOf, kolLog } from "../_shared/kol-accept.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SESSION_TTL_MS = 12 * 3600_000;
const FAIL_WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 6; // bloqueia na 6ª tentativa errada dentro de 15 min
const BLOCK_MS = 3600_000;

async function sha(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const log = (leadId: string, type: string, data: Record<string, unknown>) =>
  kolLog(admin, leadId, type, { ...data, actor: "kol", canal: "portal_transparencia" });

async function blockedUntil(pid: string | null, ipHash: string) {
  const q = admin.from("kol_portal_attempts").select("blocked_until").gt("blocked_until", new Date().toISOString()).limit(1);
  const { data } = pid ? await q.or(`professional_id.eq.${pid},ip_hash.eq.${ipHash}`) : await q.eq("ip_hash", ipHash);
  return data?.[0]?.blocked_until ?? null;
}

async function registerFail(pid: string | null, ipHash: string, motivo: string) {
  await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: false });
  // a contagem recomeça após um bloqueio expirado ou liberado pela equipe
  const { data: lastBlock } = await admin.from("kol_portal_attempts").select("blocked_until")
    .eq("ip_hash", ipHash).not("blocked_until", "is", null).lte("blocked_until", new Date().toISOString())
    .order("blocked_until", { ascending: false }).limit(1);
  const windowStart = Date.now() - FAIL_WINDOW_MS;
  const lb = lastBlock?.[0]?.blocked_until ? new Date(lastBlock[0].blocked_until).getTime() : 0;
  const since = new Date(Math.max(windowStart, lb)).toISOString();
  const { count } = await admin.from("kol_portal_attempts").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).eq("success", false).gte("created_at", since);
  let until: string | null = null;
  if ((count ?? 0) >= MAX_FAILS) {
    until = new Date(Date.now() + BLOCK_MS).toISOString();
    await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: false, blocked_until: until });
  }
  if (pid) await log(pid, "kol_portal_login_failed", {
    descricao: until ? "Portal bloqueado por 1 hora" : `Falha de acesso ao portal (${motivo})`,
    motivo, bloqueado_ate: until, dedupe_key: `kol_tp_failed:${pid}:${Date.now()}`,
  });
  return until;
}

function phoneOf(l: any) {
  let to = (l.prof_wa_number ? `${l.prof_wa_ddi || "55"}${l.prof_wa_number}` : "") || l.wa_phone || l.telefone_normalized || "";
  to = String(to).replace(/\D/g, "");
  if (to.length === 10 || to.length === 11) to = "55" + to;
  return to;
}

async function notifyWa(lead: any, message: string, source: string) {
  const instance = Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
  const { data: cs } = await admin.from("team_members").select("id").eq("evolution_instance_name", instance).maybeSingle();
  const to = phoneOf(lead);
  if (!cs || !to) return false;
  const { data, error } = await admin.functions.invoke("smart-ops-wa-send", {
    body: { to, message, lead_id: lead.id, team_member_id: cs.id, source },
  });
  return !error && data?.success !== false && !data?.error;
}

async function sessionLead(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data: s } = await admin.from("kol_access_sessions").select("id, lead_id, expires_at, revoked_at")
    .eq("token_hash", await sha(token)).maybeSingle();
  if (!s || s.revoked_at || !s.expires_at || new Date(s.expires_at).getTime() < Date.now()) return null;
  return s;
}

const firstName = (n: any) => String(n || "").trim().split(/\s+/)[0] || "Cliente";
const maskPix = (p: string) => (!p ? "" : p.length <= 6 ? "••••" : `${p.slice(0, 3)}••••${p.slice(-3)}`);

async function loadAttribution(lead: any) {
  // Formulários do KOL → leads atribuídos (mínimo: primeiro nome + situação)
  const forms = Array.isArray(lead.prof_kol_form_ids) ? lead.prof_kol_form_ids : [];
  const ids = forms.map((f: any) => f?.id).filter((x: any) => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x));
  const names = new Set<string>(forms.map((f: any) => f?.name).filter(Boolean));
  if (ids.length) {
    const { data: fr } = await admin.from("smartops_forms").select("id, name, slug").in("id", ids);
    for (const f of fr ?? []) { if (f.name) names.add(f.name); if (f.slug) names.add(f.slug); }
  }
  let leadIds: string[] = [];
  if (names.size) {
    const { data } = await admin.rpc("fn_kol_form_leads", { _names: Array.from(names) });
    leadIds = Array.from(new Set((data ?? []).map((r: any) => r.lead_id))).filter((x) => x !== lead.id) as string[];
  }
  const indicacoes: any[] = [];
  const vendas: any[] = [];
  if (leadIds.length) {
    const { data: ls } = await admin.from("lia_attendances").select("id, nome, created_at")
      .in("id", leadIds.slice(0, 500)).is("merged_into", null).eq("is_test", false);
    const okIds = (ls ?? []).map((l: any) => l.id);
    const { data: ds } = okIds.length
      ? await admin.from("deals").select("id, lead_id, status, value, closed_at").in("lead_id", okIds)
      : { data: [] };
    for (const l of ls ?? []) {
      const mine = (ds ?? []).filter((d: any) => d.lead_id === l.id);
      const won = mine.filter((d: any) => /ganh|won/i.test(String(d.status)));
      const open = mine.some((d: any) => /abert|open/i.test(String(d.status)));
      const situacao = won.length ? "Comprou" : open ? "Em negociação" : mine.length ? "Não comprou" : "Em contato";
      indicacoes.push({ ref: l.id.slice(0, 8), nome: firstName(l.nome), desde: String(l.created_at).slice(0, 10), situacao });
      for (const d of won) vendas.push({
        ref: `deal:${String(d.id).slice(0, 8)}`, origem: "formulario", cliente: firstName(l.nome),
        data: d.closed_at ? String(d.closed_at).slice(0, 10) : null, valor: Number(d.value) || 0,
      });
    }
  }
  // Cupons do e-commerce → pedidos (sem dados do cliente)
  const codes = (Array.isArray(lead.prof_kol_coupons) ? lead.prof_kol_coupons : []).map((c: any) => c?.code).filter(Boolean);
  if (codes.length) {
    const { data: os } = await admin.from("loja_integrada_orders").select("numero_pedido, status, data_pedido, valor_total, cupom_codigo")
      .in("cupom_codigo", codes).order("data_pedido", { ascending: false }).limit(200);
    for (const o of os ?? []) vendas.push({
      ref: `pedido:${o.numero_pedido}`, origem: "cupom", cupom: o.cupom_codigo, cliente: "Pedido da loja",
      data: o.data_pedido ? String(o.data_pedido).slice(0, 10) : null, valor: Number(o.valor_total) || 0, situacao: o.status,
    });
  }
  return { indicacoes, vendas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const ip = ipOf(req) || "unknown";
    const ipHash = await sha(`kolportal:${ip}`);
    const ua = (req.headers.get("user-agent") || "").slice(0, 300);

    if (action === "login") {
      const digits = String(body?.phone ?? "").replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 13) return json({ error: "Informe o celular com DDD." }, 400);
      const key = digits.slice(-10);
      const { data: rows } = await admin.from("lia_attendances")
        .select("id, nome, prof_display_name, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized")
        .eq("kol_phone_key", key).eq("is_kol", true).is("merged_into", null).limit(2);
      const kol = rows && rows.length === 1 ? rows[0] : null;
      const blocked = await blockedUntil(kol?.id ?? null, ipHash);
      if (blocked) return json({ error: "Acesso bloqueado por 1 hora. Fale com a equipe Smart Dent.", blocked_until: blocked }, 429);
      if (!kol) {
        const until = await registerFail(null, ipHash, "celular_desconhecido");
        return json({ error: until ? "Acesso bloqueado por 1 hora. Fale com a equipe Smart Dent." : "Celular não encontrado como KOL." }, until ? 429 : 401);
      }
      // aparelho/IP novo?
      const { data: prev } = await admin.from("kol_access_sessions").select("ip_hash, user_agent")
        .eq("lead_id", kol.id).not("verified_at", "is", null).order("created_at", { ascending: false }).limit(50);
      const known = (prev ?? []).some((p: any) => p.ip_hash === ipHash && p.user_agent === ua);
      const isNew = (prev ?? []).length > 0 && !known;

      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("");
      const now = new Date();
      const { error: sErr } = await admin.from("kol_access_sessions").insert({
        lead_id: kol.id, phone_key: key, phone_last10: key, otp_required: false,
        verified_at: now.toISOString(), token_hash: await sha(token),
        expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(), ip_hash: ipHash, user_agent: ua,
      });
      if (sErr) throw sErr;
      await admin.from("kol_portal_attempts").insert({ professional_id: kol.id, ip_hash: ipHash, success: true });
      await log(kol.id, "kol_portal_login", {
        descricao: "Acesso ao Portal de Transparência pelo celular", metodo: "celular", aparelho_novo: isNew,
        dedupe_key: `kol_tp_login:${kol.id}:${now.getTime()}`,
      });
      if (isNew) {
        const sent = await notifyWa(kol,
          `Olá, ${firstName(kol.nome)}! Detectamos um acesso ao seu Portal KOL Smart Dent de um aparelho ou rede novos (${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}).\nSe não foi você, responda esta mensagem imediatamente.`,
          "kol_portal_new_device");
        await log(kol.id, "kol_portal_new_device_alert", { enviado: sent, dedupe_key: `kol_tp_newdev:${kol.id}:${now.getTime()}` });
      }
      return json({ ok: true, session_token: token, expires_in: SESSION_TTL_MS / 1000 });
    }

    // ===== Ações autenticadas: o lead vem SEMPRE da sessão =====
    const sess = await sessionLead(String(body?.session_token ?? ""));
    if (!sess) return json({ error: "Sessão expirada. Entre novamente com seu celular." }, 401);
    const leadId = sess.lead_id as string;

    const { data: c } = await admin.from("kol_contracts")
      .select("id, number, status, template_version, body_rendered, signed_at, accepted_text_hash, image_term_signed_at, pix_key, person_type, legal_name, wa_group_id")
      .eq("lead_id", leadId).neq("status", "revogado").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const signed = c?.status === "assinado";

    if (action === "logout") {
      await admin.from("kol_access_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sess.id);
      return json({ ok: true });
    }

    if (action === "accept") {
      const r = await acceptKolContract(admin, leadId, req, body?.checks ?? {});
      if (r.status === 200) await log(leadId, "kol_portal_accept", {
        numero: c?.number, dedupe_key: `kol_tp_accept:${c?.id}`,
      });
      return json(r.body, r.status);
    }

    if (action === "data") {
      const { data: lead } = await admin.from("lia_attendances")
        .select("id, nome, prof_display_name, prof_kol_commissions, prof_kol_form_ids, prof_kol_coupons")
        .eq("id", leadId).single();
      const base = {
        ok: true, signed,
        kol: { nome: lead?.prof_display_name || lead?.nome || "" },
        contrato: c ? {
          numero: c.number, status: c.status, versao: c.template_version, texto: c.body_rendered,
          assinado_em: c.signed_at, hash: c.accepted_text_hash, termo_imagem_em: c.image_term_signed_at,
        } : null,
      };
      if (!signed) return json(base);

      const [attr, loans, courses, timeline, contests] = await Promise.all([
        loadAttribution(lead),
        admin.from("kol_equipment_loans").select("product_name, serial_number, released_at, returned_at, value_brl, status").eq("lead_id", leadId),
        admin.from("professional_courses").select("title, status, modality, start_date, enrolled_count, max_students, views_count").eq("producer_lead_id", leadId).order("start_date", { ascending: false }),
        admin.from("lead_activity_log").select("event_type, created_at, event_data").eq("lead_id", leadId).like("event_type", "kol_%").order("created_at", { ascending: false }).limit(100),
        admin.from("kol_contestations").select("id, subject_type, subject_ref, reason, status, decision, staff_response, responded_at, due_at, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }),
      ]);
      const tl = (timeline.data ?? []) as any[];
      // Fase 2: turnos vêm de kol_event_slots; horas realizadas = fn_kol_slot_hours (gravadas em hours_done), mesma fonte da timeline
      const [slots, hours] = await Promise.all([
        admin.from("kol_event_slots").select("slot_type, slot_date, start_time, end_time, status, hours_done, created_at, event_id")
          .eq("lead_id", leadId).order("slot_date", { ascending: false }),
        admin.from("v_kol_event_hours").select("horas_palestra, horas_estande, horas_total, turnos_realizados, turnos_agendados, turnos_cancelados").eq("lead_id", leadId),
      ]);
      const evIds = [...new Set((slots.data ?? []).map((s: any) => s.event_id))];
      const { data: evs } = evIds.length ? await admin.from("smartops_events").select("id, name").in("id", evIds) : { data: [] };
      const evName = new Map((evs ?? []).map((e: any) => [e.id, e.name]));
      const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : null);
      const eventos = (slots.data ?? []).map((s: any) => ({
        tipo: s.slot_type, situacao: s.status, em: s.created_at, evento: evName.get(s.event_id) || "",
        data: s.slot_date, inicio: hhmm(s.start_time), fim: hhmm(s.end_time), horas: s.status === "realizado" ? Number(s.hours_done) : null,
      }));
      const horas = (hours.data ?? []).reduce((a: any, r: any) => ({
        palestra: a.palestra + Number(r.horas_palestra), estande: a.estande + Number(r.horas_estande), total: a.total + Number(r.horas_total),
      }), { palestra: 0, estande: 0, total: 0 });
      const hide = new Set(["kol_profile_update"]);
      const atividade = {
        logins: tl.filter((t) => t.event_type === "kol_portal_login").length,
        indicacoes: attr.indicacoes.length,
        vendas: attr.vendas.length,
        cursos: (courses.data ?? []).length,
        visitas_cursos: (courses.data ?? []).reduce((s: number, x: any) => s + (Number(x.views_count) || 0), 0),
      };
      return json({
        ...base,
        contrato: { ...base.contrato, pix: maskPix(String(c?.pix_key || "")), tipo: c?.person_type, nome_legal: c?.legal_name, grupo_criado: !!c?.wa_group_id },
        comissao: Array.isArray(lead?.prof_kol_commissions) ? lead!.prof_kol_commissions.map((r: any) => ({
          canal: r.channel || "cupom", categoria: r.category || r.product_name || "", subcategoria: r.subcategory || "",
          percent: r.percent, desconto_cupom: r.coupon_discount_percent ?? null, desde: r.active_from || null, ativo: r.active !== false,
        })).filter((r: any) => r.percent != null && r.ativo) : [],
        indicacoes: attr.indicacoes, vendas: attr.vendas,
        extrato: { disponivel: false, aviso: "Extrato completo em breve" },
        eventos, horas, cursos: courses.data ?? [], equipamentos: loans.data ?? [],
        atividade, linha_do_tempo: tl.filter((t) => !hide.has(t.event_type)).map((t) => ({ tipo: t.event_type, em: t.created_at, descricao: t.event_data?.descricao || null })),
        contestacoes: contests.data ?? [],
      });
    }

    if (!signed) return json({ error: "Disponível após o aceite do contrato." }, 403);

    if (action === "view_statement") {
      await log(leadId, "kol_statement_viewed", { descricao: "Visualizou o extrato", dedupe_key: `kol_tp_stmt:${leadId}:${Date.now()}` });
      return json({ ok: true });
    }

    if (action === "contest") {
      const reason = String(body?.reason ?? "").trim().slice(0, 2000);
      const subjectType = ["venda", "comissao", "indicacao", "outro"].includes(body?.subject_type) ? body.subject_type : "outro";
      const subjectRef = String(body?.subject_ref ?? "").slice(0, 80) || null;
      if (reason.length < 10) return json({ error: "Descreva a contestação (mínimo 10 caracteres)." }, 400);
      const { data: lk } = await admin.from("lia_attendances").select("is_test").eq("id", leadId).single();
      const { data: ins, error } = await admin.from("kol_contestations").insert({
        lead_id: leadId, subject_type: subjectType, subject_ref: subjectRef, reason, is_test: lk?.is_test === true,
      }).select("id").single();
      if (error) throw error;
      await log(leadId, "kol_contest_opened", {
        descricao: `Contestação aberta (${subjectType})`, referencia: subjectRef, motivo: reason,
        dedupe_key: `kol_tp_contest:${ins.id}`,
      });
      return json({ ok: true, id: ins.id });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[kol-transparency]", e);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
