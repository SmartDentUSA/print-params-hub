// kol-contract — ações da equipe sobre o contrato do KOL.
// generate: monta o rascunho a partir do modelo ativo em kol_contract_templates
// send: marca como enviado e manda o link do portal pelo WhatsApp do KOL
// revoke: revoga o contrato
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderKolContract,
  KOL_CONTRACT_PARAM_DEFAULTS,
  KOL_CONTRACT_BRAND_DEFAULTS,
  KOL_CONTRACT_IMAGE_DEFAULTS,
} from "../_shared/kol-contract-render.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://parametros.smartdent.com.br";

function fmtPhone(ddi: string | null, num: string | null): string {
  const d = String(num || "").replace(/\D/g, "");
  if (!d) return "";
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  const fmt = local.length === 11
    ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    : local.length === 10 ? `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}` : local;
  return `+${ddi || "55"} ${fmt}`;
}

function enderecoCompleto(l: any): string {
  return [l.prof_street, l.prof_number, l.prof_complement, l.prof_neighborhood].filter(Boolean).join(", ");
}

async function kolLog(admin: any, leadId: string, type: string, data: Record<string, any>, entityId?: string, entityName?: string) {
  const { error } = await admin.rpc("fn_kol_log", {
    _lead_id: leadId, _event_type: type, _entity_type: "kol_contract",
    _entity_id: entityId ?? null, _entity_name: entityName ?? null, _data: data,
  });
  if (error) console.error("[kol-contract] fn_kol_log", type, error.message);
}

async function ensurePortalToken(admin: any, leadId: string): Promise<string> {
  const nowIso = new Date().toISOString();
  const { data: tok } = await admin.from("professional_portal_tokens").select("token")
    .eq("lead_id", leadId).is("revoked_at", null).gt("expires_at", nowIso)
    .order("expires_at", { ascending: false }).limit(1).maybeSingle();
  if (tok?.token) return tok.token as string;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
  const { error } = await admin.from("professional_portal_tokens").insert({
    token, lead_id: leadId, created_by: "kol_contract",
    expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
  });
  if (error) throw error;
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // exige usuário autenticado com papel admin
    const auth = req.headers.get("authorization") || "";
    const { data: userData } = await createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: auth } } },
    ).auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list") {
      const leadId = String(body?.lead_id ?? "");
      const { data, error } = await admin.from("kol_contracts").select("*")
        .eq("lead_id", leadId).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ ok: true, contracts: data ?? [] });
    }

    if (action === "generate") {
      const leadId = String(body?.lead_id ?? "");
      if (!leadId) return json({ error: "lead_id obrigatório" }, 400);

      const { data: ready } = await admin.rpc("fn_kol_contract_ready", { _lead_id: leadId });
      if (!ready?.ok) return json({ error: `Contrato bloqueado: ${ready?.motivo ?? "celular inválido"}` }, 400);

      const { data: lead, error: lErr } = await admin.from("lia_attendances").select(
        "id, nome, prof_display_name, email, prof_cro, prof_wa_ddi, prof_wa_number, prof_cep, prof_city, prof_state, prof_street, prof_number, prof_complement, prof_neighborhood, pessoa_cpf, empresa_cnpj, prof_kol_commissions, prof_kol_coupons, prof_kol_form_ids",
      ).eq("id", leadId).is("merged_into", null).single();
      if (lErr || !lead) return json({ error: "Profissional não encontrado" }, 404);

      const { data: tpl } = await admin.from("kol_contract_templates").select("version, body_md")
        .eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!tpl) return json({ error: "Nenhum modelo de contrato ativo" }, 500);

      const personType = String(body?.person_type ?? "PF").toUpperCase();
      const document = String(body?.document ?? (personType === "PF" ? lead.pessoa_cpf : lead.empresa_cnpj) ?? "").trim();
      const legalName = String(body?.legal_name ?? lead.prof_display_name ?? lead.nome ?? "").trim();
      const pixKey = String(body?.pix_key ?? "").trim();
      const repName = String(body?.rep_name ?? "").trim();
      const repCpf = String(body?.rep_cpf ?? "").trim();
      const waInstance = String(body?.wa_instance_name ?? "").trim();
      const waMembers = Array.isArray(body?.wa_group_members) ? body.wa_group_members : [];
      const sellerId = String(body?.seller_team_member_id ?? "").trim();

      const pending: string[] = [];
      if (!document) pending.push("documento (CPF/CNPJ)");
      if (!legalName) pending.push("nome/razão social");
      if (!pixKey) pending.push("chave PIX");
      if (personType === "PJ" && (!repName || !repCpf)) pending.push("representante legal (nome e CPF)");
      if (personType === "PF" && !lead.prof_cro) pending.push("CRO");
      if (!waInstance) pending.push("instância de WhatsApp do grupo");
      if (!sellerId) pending.push("vendedor responsável");

      const { data: seller } = sellerId
        ? await admin.from("team_members").select("id, nome_completo, evolution_phone").eq("id", sellerId).maybeSingle()
        : { data: null };

      const commissions = Array.isArray(lead.prof_kol_commissions) ? lead.prof_kol_commissions : [];
      const regras = commissions.filter((r: any) => r && (r.percent != null)).map((r: any) => ({
        produto_ou_categoria: r.product_name || r.category || "—",
        subcategoria: r.subcategory || "",
        percent: r.percent,
        active_from: r.active_from || "—",
        channel: r.channel || "cupom",
      }));

      const { data: loans } = await admin.from("kol_equipment_loans").select("*")
        .eq("lead_id", leadId).neq("status", "devolvido").order("created_at");
      const equipamentos: any[] = (loans ?? []).map((l: any, i: number) => ({
        n: i + 1,
        produto_nome: l.product_name || "—",
        produto_sku: "",
        serial_number: l.serial_number || "—",
        value_brl: l.value_brl != null ? Number(l.value_brl).toFixed(2) : "—",
        released_at: l.released_at ? String(l.released_at).slice(0, 10) : "—",
        return_due_at: "—",
        condicao_entrega: "novo / revisado",
      }));
      (equipamentos as any).total_value = (loans ?? []).reduce((s: number, l: any) => s + (Number(l.value_brl) || 0), 0).toFixed(2);

      const cupons = (Array.isArray(lead.prof_kol_coupons) ? lead.prof_kol_coupons : []).map((c: any) => ({
        code: c.code, beneficio: c.benefit_label || "benefício", commission_percent: c.commission_percent ?? "—",
        valid_from: c.active_from || "—", valid_until: c.active_to || "—",
      }));
      const formularios = (Array.isArray(lead.prof_kol_form_ids) ? lead.prof_kol_form_ids : []).map((f: any) => ({
        name: f.name || f.id, url: f.url || "",
      }));

      const { data: numData } = await admin.rpc("fn_kol_next_contract_number");
      const numero = String(numData ?? `KOL-${new Date().getFullYear()}-0000`);
      const params = { ...KOL_CONTRACT_PARAM_DEFAULTS, ...(body?.params ?? {}) };

      const ctx = {
        contrato: {
          numero, versao_modelo: tpl.version, data_aceite: "",
          ...params,
        },
        marca: { ...KOL_CONTRACT_BRAND_DEFAULTS, ...(body?.brand ?? {}) },
        imagem: { ...KOL_CONTRACT_IMAGE_DEFAULTS, ...(body?.image ?? {}) },
        kol: {
          tipo_pessoa: personType,
          nome: lead.prof_display_name || lead.nome || legalName,
          nome_legal: legalName,
          razao_social: personType === "PJ" ? legalName : "",
          documento: document,
          documento_pessoa_fisica: personType === "PF" ? document : repCpf,
          cro: lead.prof_cro || "",
          email: lead.email || "",
          celular_formatado: fmtPhone(lead.prof_wa_ddi, lead.prof_wa_number),
          endereco_completo: enderecoCompleto(lead),
          cidade: [lead.prof_city, lead.prof_state].filter(Boolean).join(" - "),
          cep: lead.prof_cep || "",
          representante_nome: repName,
          representante_cpf: repCpf,
          dados_pagamento_resumo: pixKey ? `chave PIX ${pixKey}` : "—",
        },
        PJ: personType === "PJ",
        PF: personType === "PF",
        vendedor: seller ? { nome: seller.nome_completo, celular: seller.evolution_phone || "" } : null,
        grupo: { nome: `KOL ${lead.prof_display_name || lead.nome || ""} × Smart Dent` },
        comissao: { aceita_em: "", versao: tpl.version, regras },
        cupons,
        formularios,
        equipamentos,
        aceite: { data_hora: "", ip: "", aparelho: "", hash: "" },
      };

      const rendered = renderKolContract(tpl.body_md, ctx);

      // um rascunho por lead: atualiza o rascunho existente ou cria
      const { data: existing } = await admin.from("kol_contracts").select("id, status")
        .eq("lead_id", leadId).in("status", ["rascunho", "ajuste_solicitado"]).order("created_at", { ascending: false }).limit(1).maybeSingle();

      const payload = {
        lead_id: leadId,
        status: "rascunho",
        template_version: tpl.version,
        person_type: personType,
        legal_name: legalName,
        document,
        pix_key: pixKey,
        rep_name: repName || null,
        rep_cpf: repCpf || null,
        number: numero,
        body_rendered: rendered,
        pending_fields: pending,
        commission_snapshot: commissions,
        wa_instance_name: waInstance || null,
        wa_group_members: waMembers,
        created_by: uid,
        adjust_notes: null,
        updated_at: new Date().toISOString(),
      };

      let contractId: string;
      if (existing) {
        const { error } = await admin.from("kol_contracts").update(payload).eq("id", existing.id);
        if (error) throw error;
        contractId = existing.id;
      } else {
        const { data: ins, error } = await admin.from("kol_contracts").insert(payload).select("id").single();
        if (error) throw error;
        contractId = ins.id;
      }

      await kolLog(admin, leadId, "kol_contract_draft_generated", {
        numero, versao: tpl.version, pendencias: pending,
        dedupe_key: `kol_contract_draft:${contractId}:${Date.now()}`,
      }, contractId, numero);

      return json({ ok: true, contract_id: contractId, number: numero, pending_fields: pending, body_rendered: rendered });
    }

    if (action === "send") {
      const contractId = String(body?.contract_id ?? "");
      const { data: c, error } = await admin.from("kol_contracts").select("*").eq("id", contractId).single();
      if (error || !c) return json({ error: "Contrato não encontrado" }, 404);
      if (c.status !== "rascunho" && c.status !== "ajuste_solicitado") return json({ error: `Contrato está '${c.status}'` }, 400);
      if (Array.isArray(c.pending_fields) && c.pending_fields.length > 0) {
        return json({ error: `Pendências: ${c.pending_fields.join(", ")}` }, 400);
      }

      const { data: lead } = await admin.from("lia_attendances").select("id, nome, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized")
        .eq("id", c.lead_id).single();
      const token = await ensurePortalToken(admin, c.lead_id);
      const portalUrl = `${SITE}/portal-cursos/${token}`;

      let to = (lead?.prof_wa_number ? `${lead.prof_wa_ddi || "55"}${lead.prof_wa_number}` : "") || lead?.wa_phone || lead?.telefone_normalized || "";
      to = String(to).replace(/\D/g, "");
      if (to.length === 10 || to.length === 11) to = "55" + to;

      const instance = c.wa_instance_name || Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
      const { data: tm } = await admin.from("team_members").select("id").eq("evolution_instance_name", instance).maybeSingle();
      const first = String(lead?.nome || "").trim().split(" ")[0];
      const message = `Olá${first ? `, ${first}` : ""}! Seu contrato de parceria KOL Smart Dent (nº ${c.number}) está pronto para leitura e aceite no seu portal:\n${portalUrl}\n\nLeia com calma e, estando de acordo, marque as 3 confirmações no final da página. Qualquer dúvida, é só responder esta mensagem.`;

      let sendOk = false; let sendErr = "";
      if (tm && to) {
        const { data: sent, error: sErr } = await admin.functions.invoke("smart-ops-wa-send", {
          body: { to, message, lead_id: c.lead_id, team_member_id: tm.id, source: "kol_contract_send" },
        });
        sendOk = !sErr && sent?.success !== false && !sent?.error;
        sendErr = sendOk ? "" : String(sErr?.message ?? sent?.error ?? "").slice(0, 300);
      } else {
        sendErr = "instância ou celular não encontrado";
      }

      await admin.from("kol_contracts").update({ status: "enviado", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contractId);
      await kolLog(admin, c.lead_id, "kol_contract_sent", {
        numero: c.number, enviado: sendOk, erro: sendErr || null,
        dedupe_key: `kol_contract_sent:${contractId}:${Date.now()}`,
      }, contractId, c.number);

      return json({ ok: true, whatsapp_sent: sendOk, send_error: sendErr || null, portal_url: portalUrl });
    }

    if (action === "revoke") {
      const contractId = String(body?.contract_id ?? "");
      const reason = String(body?.reason ?? "");
      const { data: c, error } = await admin.from("kol_contracts").select("id, lead_id, number, status").eq("id", contractId).single();
      if (error || !c) return json({ error: "Contrato não encontrado" }, 404);
      await admin.from("kol_contracts").update({ status: "revogado", revoked_at: new Date().toISOString(), adjust_notes: reason || null, updated_at: new Date().toISOString() }).eq("id", contractId);
      await kolLog(admin, c.lead_id, "kol_contract_revoked", { numero: c.number, motivo: reason, dedupe_key: `kol_contract_revoked:${contractId}:${Date.now()}` }, contractId, c.number);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[kol-contract]", e);
    return json({ error: e?.message ?? "erro interno" }, 500);
  }
});
