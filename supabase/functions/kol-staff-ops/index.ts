// kol-staff-ops — operações internas do Programa KOL (equipe: admin e comercial via fn_is_internal_staff).
// Ações: list_contests, answer_contest, list_blocks, unblock, test_new_device_alert.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { kolLog } from "../_shared/kol-accept.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/;

async function csSender() {
  const instance = Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
  const { data } = await admin.from("team_members").select("id").eq("evolution_instance_name", instance).maybeSingle();
  return data?.id ?? null;
}
function normPhone(v: string) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}
async function sendWa(to: string, message: string, source: string, leadId?: string) {
  const sender = await csSender();
  if (!sender) return { ok: false, detail: "instância de CS não encontrada" };
  if (!to) return { ok: false, detail: "sem número de destino" };
  const { data, error } = await admin.functions.invoke("smart-ops-wa-send", {
    body: { to, message, lead_id: leadId ?? null, team_member_id: sender, source },
  });
  const ok = !error && data?.success !== false && !data?.error;
  return { ok, detail: error ? String(error.message ?? error) : data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    const { data: cl } = await admin.auth.getClaims(jwt).catch(() => ({ data: null } as any));
    const uid = cl?.claims?.sub as string | undefined;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await admin.rpc("fn_is_internal_staff", { _user_id: uid });
    if (staff !== true) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list_contests") {
      let q = admin.from("kol_contestations")
        .select("id, lead_id, subject_type, subject_ref, reason, status, decision, staff_response, responded_at, due_at, is_test, created_at")
        .order("created_at", { ascending: false }).limit(300);
      if (["aberta", "respondida"].includes(body?.status)) q = q.eq("status", body.status);
      if (!body?.include_tests) q = q.eq("is_test", false);
      const { data, error } = await q;
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.lead_id))];
      const [{ data: leads }, { data: cts }] = await Promise.all([
        ids.length ? admin.from("lia_attendances").select("id, nome, prof_display_name").in("id", ids) : { data: [] },
        ids.length ? admin.from("kol_contracts").select("lead_id, number, seller_team_member_id, created_at").in("lead_id", ids).neq("status", "revogado").order("created_at", { ascending: false }) : { data: [] },
      ]);
      const sellerIds = [...new Set((cts ?? []).map((c: any) => c.seller_team_member_id).filter(Boolean))];
      const { data: sellers } = sellerIds.length ? await admin.from("team_members").select("id, nome_completo").in("id", sellerIds) : { data: [] };
      const rows = (data ?? []).map((r) => {
        const l = (leads ?? []).find((x: any) => x.id === r.lead_id);
        const c = (cts ?? []).find((x: any) => x.lead_id === r.lead_id);
        const s = (sellers ?? []).find((x: any) => x.id === c?.seller_team_member_id);
        return { ...r, kol_nome: l?.prof_display_name || l?.nome || "—", contrato: c?.number ?? null, vendedor: s?.nome_completo ?? null };
      });
      return json({ ok: true, rows });
    }

    if (action === "answer_contest") {
      const id = String(body?.id ?? "");
      const decision = ["acatada", "negada"].includes(body?.decision) ? body.decision : null;
      const response = String(body?.response ?? "").trim().slice(0, 3000);
      if (!UUID.test(id)) return json({ error: "id inválido" }, 400);
      if (!decision) return json({ error: "Escolha acatar ou negar." }, 400);
      if (response.length < 5) return json({ error: "Escreva a resposta ao KOL." }, 400);
      const { data: ct } = await admin.from("kol_contestations").select("id, lead_id, subject_type, subject_ref, status").eq("id", id).maybeSingle();
      if (!ct) return json({ error: "Contestação não encontrada" }, 404);
      const now = new Date().toISOString();
      const { error } = await admin.from("kol_contestations").update({
        status: "respondida", decision, staff_response: response, responded_at: now, responded_by: uid, updated_at: now,
      }).eq("id", id);
      if (error) throw error;
      await kolLog(admin, ct.lead_id, "kol_contest_answered", {
        descricao: `Contestação ${decision} pela equipe`, decisao: decision, resposta: response,
        referencia: ct.subject_ref, actor: `equipe:${uid}`, dedupe_key: `kol_contest_answered:${id}:${now}`,
      }, id);
      // avisa o vendedor responsável
      const { data: c } = await admin.from("kol_contracts").select("seller_team_member_id")
        .eq("lead_id", ct.lead_id).neq("status", "revogado").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: lead } = await admin.from("lia_attendances").select("nome, prof_display_name").eq("id", ct.lead_id).single();
      let seller: any = { ok: false, detail: "sem vendedor responsável no contrato" };
      if (c?.seller_team_member_id) {
        const { data: tm } = await admin.from("team_members").select("nome_completo, whatsapp_number, notification_phone").eq("id", c.seller_team_member_id).maybeSingle();
        seller = await sendWa(normPhone(tm?.notification_phone || tm?.whatsapp_number || ""),
          `Contestação do KOL ${lead?.prof_display_name || lead?.nome || ""} foi ${decision}.\nReferência: ${ct.subject_ref || ct.subject_type}\nResposta: ${response}`,
          "kol_contest_answered", ct.lead_id);
      }
      await kolLog(admin, ct.lead_id, "kol_contest_seller_notified", {
        descricao: seller.ok ? "Vendedor avisado da resposta à contestação" : "Aviso ao vendedor não entregue",
        enviado: seller.ok, actor: `equipe:${uid}`, dedupe_key: `kol_contest_seller:${id}:${now}`,
      }, id);
      return json({ ok: true, seller_notified: seller.ok, seller_detail: seller.ok ? null : seller.detail });
    }

    if (action === "list_blocks") {
      const { data } = await admin.from("kol_portal_attempts").select("id, professional_id, ip_hash, blocked_until, created_at")
        .gt("blocked_until", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
      return json({ ok: true, rows: data ?? [] });
    }

    if (action === "unblock") {
      const ipHash = String(body?.ip_hash ?? "");
      const pid = String(body?.professional_id ?? "");
      if (!/^[a-f0-9]{64}$/.test(ipHash) && !UUID.test(pid)) return json({ error: "Informe ip_hash ou professional_id" }, 400);
      const now = new Date().toISOString();
      let q = admin.from("kol_portal_attempts").update({ blocked_until: now }).gt("blocked_until", now);
      q = /^[a-f0-9]{64}$/.test(ipHash) ? q.eq("ip_hash", ipHash) : q.eq("professional_id", pid);
      const { data, error } = await q.select("id, professional_id");
      if (error) throw error;
      for (const p of new Set((data ?? []).map((r: any) => r.professional_id).filter(Boolean))) {
        await kolLog(admin, p as string, "kol_portal_unblocked", { descricao: "Bloqueio do portal liberado pela equipe", actor: `equipe:${uid}`, dedupe_key: `kol_unblock:${p}:${now}` });
      }
      return json({ ok: true, liberados: (data ?? []).length });
    }

    if (action === "test_new_device_alert") {
      const to = normPhone(String(body?.phone ?? ""));
      if (to.length < 12 || to.length > 13) return json({ error: "Informe o celular com DDD." }, 400);
      const r = await sendWa(to,
        `[TESTE] Olá! Detectamos um acesso ao seu Portal KOL Smart Dent de um aparelho ou rede novos (${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}).\nSe não foi você, responda esta mensagem imediatamente.`,
        "kol_portal_new_device_test");
      return json({ ok: r.ok, to, detail: r.detail });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[kol-staff-ops]", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
