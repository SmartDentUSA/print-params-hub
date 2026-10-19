// Sync KOL → funil PipeRun "KOLs" (pipeline 107400).
// Cria/atualiza UM deal por profissional no funil KOLs, na etapa correspondente
// ao progresso real do credenciamento (movimento só para frente), e grava uma
// nota "Ficha KOL" com cupons, links dos formulários de indicação e comissionamento.
// Staff-only (JWT + fn_is_internal_staff). Leads is_test nunca são sincronizados.
// Não toca nos funis Vendas/CS nem na Golden Rule: o deal vive só no pipeline KOLs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  piperunGet,
  piperunPost,
  piperunPut,
  addDealNote,
} from "../_shared/piperun-field-map.ts";
import {
  findPersonByContact,
  validateCachedPerson,
  isValidEmailTld,
} from "../_shared/piperun-person-resolver.ts";
import { claimSellerNoteSlot, releaseSellerNoteSlot } from "../_shared/seller-note-lock.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const KOL_PIPELINE_ID = 107400;
// Etapas do funil KOLs (PipeRun), em ordem de progresso
const KOL_STAGES = [
  { order: 0, id: 694355, name: "Interessados" },
  { order: 1, id: 694359, name: "Envio de contrato" },
  { order: 2, id: 694360, name: "Contrato aceito" },
  { order: 3, id: 694356, name: "Vinculados ao SmartOps" },
  { order: 4, id: 694357, name: "Criar formulário de indicação" },
  { order: 5, id: 694358, name: "Criar cupom Lojaintegrda" },
  { order: 6, id: 694361, name: "Kol Ativo" },
] as const;

const PORTAL_BASE = Deno.env.get("PUBLIC_SITE_URL") || "https://parametros.smartdent.com.br";

interface Step { step: string; ok: boolean; detail: string }

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Etapa alvo conforme o progresso real do credenciamento. */
function computeTargetStage(args: {
  hasContract: boolean;
  contractSigned: boolean;
  hasReferralForm: boolean;
  hasActiveCoupon: boolean;
}): (typeof KOL_STAGES)[number] {
  const { hasContract, contractSigned, hasReferralForm, hasActiveCoupon } = args;
  if (contractSigned && hasReferralForm && hasActiveCoupon) return KOL_STAGES[6]; // Kol Ativo
  if (contractSigned && hasReferralForm) return KOL_STAGES[5]; // Criar cupom
  if (contractSigned) return KOL_STAGES[4]; // Criar formulário de indicação
  if (hasContract) return KOL_STAGES[2]; // Contrato aceito só com assinatura; draft = envio
  return KOL_STAGES[0]; // Interessados
}

function stageOrder(stageId: number | null | undefined): number {
  const s = KOL_STAGES.find((x) => x.id === Number(stageId));
  return s ? s.order : -1;
}

async function syncOneKol(leadId: string, steps: Step[]): Promise<{ ok: boolean; deal_id?: number }> {
  const token = Deno.env.get("PIPERUN_API_KEY");
  if (!token) {
    steps.push({ step: "crm", ok: false, detail: "PIPERUN_API_KEY não configurada." });
    return { ok: false };
  }

  const { data: lead } = await admin
    .from("lia_attendances")
    .select(
      "id, nome, email, telefone_normalized, telefone_raw, pessoa_piperun_id, is_kol, is_test, " +
      "prof_kol_commissions, prof_kol_coupons, prof_kol_coupon, prof_kol_form_ids, prof_specialist_team_member_id",
    )
    .eq("id", leadId)
    .is("merged_into", null)
    .maybeSingle();
  if (!lead) {
    steps.push({ step: "crm", ok: false, detail: "Ficha não encontrada." });
    return { ok: false };
  }
  if (lead.is_test) {
    steps.push({ step: "crm", ok: true, detail: "Lead de teste — não sincronizado com o CRM." });
    return { ok: true };
  }

  const nome = String(lead.nome ?? "").trim();
  const email = String(lead.email ?? "").trim().toLowerCase();
  const phone = String(lead.telefone_normalized || lead.telefone_raw || "").trim();
  const phoneDigits = digits(phone);
  const emailValid = email.includes("@") && isValidEmailTld(email);

  // 1) Pessoa no PipeRun (integridade: nunca criar sem e-mail OU telefone)
  let personId = Number(lead.pessoa_piperun_id) || 0;
  if (personId) {
    const check = await validateCachedPerson(token, personId);
    if (!check.exists) personId = 0;
  }
  if (!personId) {
    const found = await findPersonByContact(token, emailValid ? email : null, phoneDigits.length >= 10 ? phone : null, admin);
    if (found) personId = found.id;
  }
  if (!personId) {
    if (!emailValid && phoneDigits.length < 10) {
      steps.push({ step: "crm_pessoa", ok: false, detail: "Sem e-mail nem telefone válidos — pessoa não criada no CRM (regra de integridade)." });
      return { ok: false };
    }
    const payload: Record<string, unknown> = { name: nome || email || phone };
    if (emailValid) payload.email = email;
    if (phoneDigits.length >= 10) payload.cellphone = phone;
    const created = await piperunPost(token, "persons", payload);
    const newId = Number((created.data as any)?.data?.id ?? 0);
    if (!created.success || !newId) {
      steps.push({ step: "crm_pessoa", ok: false, detail: "Falha ao criar pessoa no PipeRun." });
      return { ok: false };
    }
    personId = newId;
    steps.push({ step: "crm_pessoa", ok: true, detail: `Pessoa criada no PipeRun (#${personId}).` });
  } else {
    steps.push({ step: "crm_pessoa", ok: true, detail: `Pessoa vinculada (#${personId}).` });
  }
  if (Number(lead.pessoa_piperun_id) !== personId) {
    await admin.from("lia_attendances").update({ pessoa_piperun_id: personId }).eq("id", leadId);
  }

  // 2) Dados do credenciamento
  const { data: contract } = await admin
    .from("kol_contracts")
    .select("id, number, status, signed_at, seller_team_member_id")
    .eq("lead_id", leadId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const contractSigned = contract?.status === "assinado" || !!contract?.signed_at;

  const formLinks = Array.isArray(lead.prof_kol_form_ids)
    ? (lead.prof_kol_form_ids as unknown[]).map((x: any) => (typeof x === "string" ? x : x?.id)).filter(Boolean)
    : [];
  const { data: forms } = formLinks.length
    ? await admin.from("smartops_forms").select("id, name, slug").in("id", formLinks)
    : { data: [] as any[] };
  const referralForms = (forms ?? []).filter((f: any) => /^#\s*-\s*INDICA[ÇC][ÃA]O/i.test(String(f.name ?? "")));

  const coupons: any[] = Array.isArray(lead.prof_kol_coupons)
    ? lead.prof_kol_coupons
    : lead.prof_kol_coupon
      ? [lead.prof_kol_coupon]
      : [];
  const today = new Date().toISOString().slice(0, 10);
  const activeCoupons = coupons.filter((c) => {
    const code = String(c?.code ?? c ?? "").trim();
    if (!code) return false;
    const from = c?.active_from ? String(c.active_from).slice(0, 10) : null;
    const to = c?.active_to ? String(c.active_to).slice(0, 10) : null;
    return (!from || from <= today) && (!to || to >= today);
  });

  const commissions: any[] = Array.isArray(lead.prof_kol_commissions) ? lead.prof_kol_commissions : [];

  // Vendedor responsável (contrato > especialista da ficha)
  const sellerTmId = contract?.seller_team_member_id ?? lead.prof_specialist_team_member_id ?? null;
  let sellerName: string | null = null;
  let sellerPiperunId: number | null = null;
  if (sellerTmId) {
    const { data: tm } = await admin
      .from("team_members")
      .select("nome_completo, piperun_owner_id")
      .eq("id", sellerTmId)
      .maybeSingle();
    sellerName = tm?.nome_completo ?? null;
    sellerPiperunId = tm?.piperun_owner_id ? Number(tm.piperun_owner_id) : null;
  }

  // 3) Deal no funil KOLs (um por profissional)
  const target = computeTargetStage({
    hasContract: !!contract,
    contractSigned,
    hasReferralForm: referralForms.length > 0,
    hasActiveCoupon: activeCoupons.length > 0,
  });

  let dealId = 0;
  let currentStageId: number | null = null;
  const existing = await piperunGet(token, "deals", { person_id: personId, pipeline_id: KOL_PIPELINE_ID, show: 50 });
  const existingDeals = ((existing.data as any)?.data ?? []) as any[];
  const kolDeal = existingDeals.find((d) => Number(d.pipeline_id) === KOL_PIPELINE_ID);
  if (kolDeal) {
    dealId = Number(kolDeal.id);
    currentStageId = Number(kolDeal.stage_id) || null;
  }

  if (!dealId) {
    const payload: Record<string, unknown> = {
      title: `KOL — ${nome}`,
      person_id: personId,
      pipeline_id: KOL_PIPELINE_ID,
      stage_id: target.id,
    };
    if (sellerPiperunId) payload.user_id = sellerPiperunId;
    const created = await piperunPost(token, "deals", payload);
    dealId = Number((created.data as any)?.data?.id ?? 0);
    if (!created.success || !dealId) {
      steps.push({ step: "crm_deal", ok: false, detail: "Falha ao criar o deal no funil KOLs." });
      return { ok: false };
    }
    steps.push({ step: "crm_deal", ok: true, detail: `Deal #${dealId} criado na etapa "${target.name}".` });
  } else {
    // Movimento só para frente: nunca regride a etapa
    if (stageOrder(target.id) > stageOrder(currentStageId)) {
      const upd: Record<string, unknown> = { stage_id: target.id };
      if (sellerPiperunId) upd.user_id = sellerPiperunId;
      await piperunPut(token, `deals/${dealId}`, upd);
      steps.push({ step: "crm_deal", ok: true, detail: `Deal #${dealId} movido para "${target.name}".` });
    } else {
      steps.push({ step: "crm_deal", ok: true, detail: `Deal #${dealId} já estava na etapa correta (ou mais avançada).` });
    }
  }

  // 4) Nota "Ficha KOL" com cupons, formulários e comissionamento
  const formLines = referralForms.length
    ? referralForms.map((f: any) => `• ${esc(f.name)} — <a href="${PORTAL_BASE}/f/${esc(f.slug)}">${PORTAL_BASE}/f/${esc(f.slug)}</a>`).join("<br>")
    : "• Nenhum formulário de indicação vinculado ainda";
  const couponLines = activeCoupons.length
    ? activeCoupons.map((c) => {
        const code = esc(c?.code ?? c);
        const pct = c?.commission_percent != null ? ` — comissão ${esc(c.commission_percent)}%` : "";
        const val = c?.active_to ? ` (válido até ${esc(String(c.active_to).slice(0, 10))})` : "";
        return `• ${code}${pct}${val}`;
      }).join("<br>")
    : "• Nenhum cupom ativo";
  const commissionLines = commissions.length
    ? commissions.map((r) => {
        const prod = esc(r?.product_key ?? r?.produto ?? r?.product ?? "Todos os produtos");
        const pct = r?.percent ?? r?.commission_percent ?? r?.percentual;
        const ch = r?.channel ? ` [canal: ${esc(r.channel)}]` : "";
        return `• ${prod}: ${pct != null ? esc(pct) + "%" : "—"}${ch}`;
      }).join("<br>")
    : "• Sem regras de comissão cadastradas";

  const noteHtml = [
    `<b>📋 Ficha KOL — Smart Dent</b>`,
    ``,
    `<b>Profissional:</b> ${esc(nome)}`,
    emailValid ? `<b>E-mail:</b> ${esc(email)}` : null,
    phoneDigits ? `<b>Celular:</b> ${esc(phone)}` : null,
    sellerName ? `<b>Vendedor responsável:</b> ${esc(sellerName)}` : null,
    ``,
    `<b>Contrato:</b> ${contract ? `${esc(contract.number ?? "")} — ${contractSigned ? "assinado" : esc(contract.status ?? "pendente")}` : "não gerado"}`,
    ``,
    `<b>Formulários de indicação:</b><br>${formLines}`,
    ``,
    `<b>Cupons de desconto:</b><br>${couponLines}`,
    ``,
    `<b>Comissionamento:</b><br>${commissionLines}`,
  ].filter((l) => l !== null).join("<br>");

  const hash = await sha256Hex(`${dealId}::${noteHtml}`);
  const claim = await claimSellerNoteSlot(admin, { dealId, leadId, contentHash: hash });
  if (claim.ok) {
    const posted = await addDealNote(token, dealId, noteHtml);
    if (posted?.success) {
      steps.push({ step: "crm_nota", ok: true, detail: "Nota 'Ficha KOL' gravada no deal (cupons, formulários, comissionamento)." });
    } else {
      await releaseSellerNoteSlot(admin, { dealId, contentHash: hash });
      steps.push({ step: "crm_nota", ok: false, detail: "Falha ao gravar a nota no PipeRun." });
    }
  } else {
    steps.push({ step: "crm_nota", ok: true, detail: "Nota já estava atualizada (sem alterações)." });
  }

  await admin.rpc("fn_kol_log", {
    _lead_id: leadId,
    _event_type: "kol_crm_sync",
    _entity_type: "piperun_deal",
    _entity_id: String(dealId),
    _entity_name: nome,
    _value: null,
    _channel: "kol",
    _data: {
      descricao: `Deal KOLs #${dealId} sincronizado — etapa "${target.name}"`,
      deal_id: dealId,
      stage: target.name,
      dedupe_key: `kol_crm:${leadId}:${dealId}:${target.id}`,
    },
  });

  return { ok: true, deal_id: dealId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: userRes } = await admin.auth.getUser(jwt);
    if (!userRes?.user) return json({ error: "unauthorized" }, 401);
    const { data: isStaff } = await admin.rpc("fn_is_internal_staff", { _user_id: userRes.user.id });
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.lead_id ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const syncAll = body?.all === true;

    // Modo em lote: sincroniza todos os KOLs (limite de segurança)
    if (syncAll) {
      const { data: kols } = await admin
        .from("lia_attendances")
        .select("id")
        .eq("is_kol", true)
        .eq("is_test", false)
        .is("merged_into", null)
        .limit(50);
      const results: unknown[] = [];
      for (const k of kols ?? []) {
        const steps: Step[] = [];
        const r = await syncOneKol(k.id, steps);
        results.push({ lead_id: k.id, ok: r.ok, deal_id: r.deal_id, steps });
      }
      return json({ ok: true, total: results.length, results });
    }

    let resolvedId = leadId;
    if (!resolvedId && email) {
      const { data: found } = await admin
        .from("lia_attendances")
        .select("id")
        .ilike("email", email)
        .is("merged_into", null)
        .limit(1)
        .maybeSingle();
      resolvedId = found?.id ?? "";
    }
    if (!resolvedId) return json({ error: "Informe lead_id ou email do profissional." }, 400);

    const steps: Step[] = [];
    const result = await syncOneKol(resolvedId, steps);
    return json({ ok: result.ok, lead_id: resolvedId, deal_id: result.deal_id, steps });
  } catch (e) {
    console.error("[kol-crm-sync]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
