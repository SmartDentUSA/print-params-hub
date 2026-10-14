// kol-portal — lado público do contrato do KOL (acesso pelo token do portal).
// contract: devolve o rascunho para leitura; após o aceite, devolve também comissões e equipamentos.
// accept: aceite eletrônico com 3 caixas (contrato, imagem/voz/nome, LGPD) + hash SHA-256 do texto.
// request_adjust: KOL pede ajuste com uma nota.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/kol-contract-render.ts";
import { EVO_BASE, resolveApiKey } from "../_shared/evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function ipOf(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
}

async function kolLog(admin: any, leadId: string, type: string, data: Record<string, any>, entityId?: string, entityName?: string) {
  const { error } = await admin.rpc("fn_kol_log", {
    _lead_id: leadId, _event_type: type, _entity_type: "kol_contract",
    _entity_id: entityId ?? null, _entity_name: entityName ?? null, _data: data,
  });
  if (error) console.error("[kol-portal] fn_kol_log", type, error.message);
}

async function resolveLeadByToken(admin: any, token: string) {
  if (!token || token.length < 20) return null;
  const { data } = await admin.from("professional_portal_tokens").select("lead_id")
    .eq("token", token).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  return data?.lead_id ?? null;
}

/** Cria o grupo de WhatsApp do KOL na instância escolhida, com KOL + integrantes como participantes. */
async function getSetting(admin: any, key: string, fallback: any) {
  const { data } = await admin.from("kol_program_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
}

type Participant = { phone: string; role: "kol" | "acompanhamento" | "equipe"; team_member_id?: string; nome?: string };

async function createKolGroup(admin: any, contract: any, lead: any): Promise<{ groupId?: string; participants?: Participant[]; error?: string; simulated?: boolean }> {
  try {
    const instance = contract.wa_instance_name;
    if (!instance) return { error: "instância não definida" };
    const { data: tm } = await admin.from("team_members")
      .select("evolution_api_key, evolution_group_key_broken_at")
      .eq("evolution_instance_name", instance).maybeSingle();
    const apikey = resolveApiKey({ teamMember: tm, isGroup: true });

    const memberIds: string[] = (Array.isArray(contract.wa_group_members) ? contract.wa_group_members : [])
      .map((m: any) => (typeof m === "string" ? m : m?.team_member_id)).filter(Boolean);
    if (contract.seller_team_member_id && !memberIds.includes(contract.seller_team_member_id)) memberIds.push(contract.seller_team_member_id);
    const { data: members } = memberIds.length
      ? await admin.from("team_members").select("id, nome_completo, evolution_phone").in("id", memberIds)
      : { data: [] };

    const kolPhone = String(
      (lead.prof_wa_number ? `${lead.prof_wa_ddi || "55"}${lead.prof_wa_number}` : "") || lead.wa_phone || lead.telefone_normalized || "",
    ).replace(/\D/g, "");
    const always = await getSetting(admin, "group_always_members", []);
    const list: Participant[] = [
      { phone: kolPhone, role: "kol", nome: lead.prof_display_name || lead.nome || "" },
      ...(Array.isArray(always) ? always : []).map((p: any) => ({ phone: String(p).replace(/\D/g, ""), role: "acompanhamento" as const })),
      ...(members ?? []).map((m: any) => ({ phone: String(m.evolution_phone || "").replace(/\D/g, ""), role: "equipe" as const, team_member_id: m.id, nome: m.nome_completo })),
    ];
    const seen = new Set<string>();
    const participants = list.filter((p) => p.phone.length >= 12 && !seen.has(p.phone) && seen.add(p.phone));

    const dryRun = contract.is_test === true || (await getSetting(admin, "group_creation_dry_run", false)) === true;
    if (dryRun) return { groupId: `SIMULADO-${contract.id}`, participants, simulated: true };

    const subject = `KOL ${String(lead.prof_display_name || lead.nome || "").slice(0, 40)} × Smart Dent`;
    const res = await fetch(`${EVO_BASE}/group/create/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ subject, participants: participants.map((p) => p.phone) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: `Evolution ${res.status}: ${JSON.stringify(j).slice(0, 200)}`, participants };
    return { groupId: j?.id || j?.groupId || j?.jid || "", participants };
  } catch (e: any) {
    return { error: String(e?.message ?? e).slice(0, 300) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const token = String(body?.token ?? "");
    const leadId = await resolveLeadByToken(admin, token);
    if (!leadId) return json({ error: "invalid_token" }, 401);

    if (action === "contract") {
      const { data: c } = await admin.from("kol_contracts")
        .select("id, number, status, template_version, body_rendered, pending_fields, signed_at, adjust_notes, person_type, legal_name, document, created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!c) return json({ ok: true, contract: null });

      const signed = c.status === "assinado";
      let commissions: any[] = [];
      let equipment: any[] = [];
      if (signed) {
        const { data: lead } = await admin.from("lia_attendances").select("prof_kol_commissions").eq("id", leadId).single();
        commissions = Array.isArray(lead?.prof_kol_commissions) ? lead!.prof_kol_commissions : [];
        const { data: loans } = await admin.from("kol_equipment_loans").select("product_name, serial_number, released_at, returned_at, value_brl, status").eq("lead_id", leadId);
        equipment = loans ?? [];
      }
      return json({ ok: true, contract: c, signed, commissions, equipment });
    }

    if (action === "request_adjust") {
      const note = String(body?.note ?? "").trim();
      if (note.length < 5) return json({ error: "Descreva o ajuste desejado." }, 400);
      const { data: c } = await admin.from("kol_contracts").select("id, number, status").eq("lead_id", leadId)
        .in("status", ["enviado", "rascunho"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!c) return json({ error: "Nenhum contrato aguardando aceite" }, 404);
      await admin.from("kol_contracts").update({ status: "ajuste_solicitado", adjust_notes: note, updated_at: new Date().toISOString() }).eq("id", c.id);
      await kolLog(admin, leadId, "kol_contract_adjust_requested", { numero: c.number, nota: note, dedupe_key: `kol_contract_adjust:${c.id}:${Date.now()}` }, c.id, c.number);
      return json({ ok: true });
    }

    if (action === "accept") {
      const checks = body?.checks ?? {};
      if (!checks.contrato || !checks.imagem || !checks.lgpd) {
        return json({ error: "É preciso marcar as 3 confirmações para aceitar." }, 400);
      }
      const { data: c } = await admin.from("kol_contracts").select("*").eq("lead_id", leadId)
        .in("status", ["enviado", "rascunho"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!c) return json({ error: "Nenhum contrato aguardando aceite" }, 404);
      if (!c.body_rendered) return json({ error: "Contrato sem texto renderizado" }, 500);

      const ip = ipOf(req);
      const ua = (req.headers.get("user-agent") || "").slice(0, 300);
      const hash = await sha256Hex(c.body_rendered);
      const now = new Date().toISOString();

      const { data: lead } = await admin.from("lia_attendances")
        .select("id, nome, prof_display_name, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized, kol_phone_key")
        .eq("id", leadId).single();

      const phoneDigits = String(
        (lead?.prof_wa_number ? `${lead.prof_wa_ddi || "55"}${lead.prof_wa_number}` : "") || lead?.wa_phone || lead?.telefone_normalized || "",
      ).replace(/\D/g, "");
      const last10 = lead?.kol_phone_key ?? (phoneDigits.length >= 10 ? phoneDigits.slice(-10) : null);
      if (!last10) return json({ error: "Celular cadastrado inválido para registrar o aceite." }, 400);

      const { error: upErr } = await admin.from("kol_contracts").update({
        status: "assinado",
        signed_at: now,
        signed_ip: ip,
        signed_user_agent: ua,
        accepted_text_hash: hash,
        accepted_phone_last10: last10,
        acceptance_method: "aceite_eletronico",
        image_term_signed_at: now,
        commission_addendum_accepted_at: now,
        updated_at: now,
      }).eq("id", c.id);
      if (upErr) {
        console.error("[kol-portal] accept update", upErr.message);
        return json({ error: `Falha ao registrar o aceite: ${upErr.message}` }, 500);
      }

      await admin.from("lia_attendances").update({
        prof_marketing_consent: true,
        prof_marketing_consent_at: now,
      }).eq("id", leadId);

      await kolLog(admin, leadId, "kol_contract_signed", {
        numero: c.number, versao: c.template_version, hash, ip,
        dedupe_key: `kol_contract_signed:${c.id}`,
      }, c.id, c.number);
      await kolLog(admin, leadId, "kol_image_term_signed", {
        numero: c.number, hash, dedupe_key: `kol_image_term_signed:${c.id}`,
      }, c.id, c.number);
      await kolLog(admin, leadId, "kol_portal_unlocked", {
        numero: c.number, dedupe_key: `kol_portal_unlocked:${c.id}`,
      }, c.id, c.number);

      // Grupo de WhatsApp do KOL: criado automaticamente após o aceite
      const grp = await createKolGroup(admin, c, lead ?? {});
      await admin.from("kol_contracts").update({
        wa_group_id: grp.groupId ?? null,
        wa_group_error: grp.error ?? null,
      }).eq("id", c.id);
      await kolLog(admin, leadId, "kol_group_created", {
        numero: c.number, grupo: grp.groupId ?? null, erro: grp.error ?? null,
        participantes: grp.participants ?? [],
        dedupe_key: `kol_group_created:${c.id}`,
      }, c.id, c.number);

      // Aviso por WhatsApp com a confirmação do aceite
      let to = (lead?.prof_wa_number ? `${lead.prof_wa_ddi || "55"}${lead.prof_wa_number}` : "") || lead?.wa_phone || lead?.telefone_normalized || "";
      to = String(to).replace(/\D/g, "");
      if (to.length === 10 || to.length === 11) to = "55" + to;
      const instance = c.wa_instance_name || Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
      const { data: tm } = await admin.from("team_members").select("id").eq("evolution_instance_name", instance).maybeSingle();
      if (tm && to) {
        const first = String(lead?.nome || "").trim().split(" ")[0];
        const message = `Pronto${first ? `, ${first}` : ""}! Seu contrato KOL Smart Dent (nº ${c.number}) foi aceito e registrado. ✅\nCódigo de integridade: ${hash.slice(0, 16)}…\nSeu portal já está liberado com a tabela de comissões e equipamentos.`;
        const { data: sent, error: sErr } = await admin.functions.invoke("smart-ops-wa-send", {
          body: { to, message, lead_id: leadId, team_member_id: tm.id, source: "kol_contract_accepted" },
        });
        if (sErr || sent?.error) console.error("[kol-portal] aviso aceite", sErr?.message ?? sent?.error);
      }

      return json({ ok: true, signed_at: now, hash, group_created: !!grp.groupId, group_error: grp.error ?? null });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[kol-portal]", e);
    return json({ error: e?.message ?? "erro interno" }, 500);
  }
});
