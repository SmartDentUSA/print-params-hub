// Fluxo da "Inscrição KOL" (Agenda): o vendedor logado cadastra um candidato a KOL.
// Etapas (cada uma reporta status; falha em uma não esconde as anteriores e o
// reenvio refaz só o que falhou — estado em kol_candidate_registrations):
//   ficha do profissional → portal → pessoa PipeRun → deal funil KOL (Interessados,
//   proprietário Beatriz) → grupo WhatsApp (Beatriz + vendedor + KOL) → mensagem
//   da Beatriz → nota completa no deal → timeline do lead.
// Não toca em funis Vendas/CS: o deal vive só no pipeline KOL.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { piperunGet, piperunPost, addDealNote, normalizePipeRunDealStatus } from "../_shared/piperun-field-map.ts";
import { findPersonByContact, validateCachedPerson, isValidEmailTld } from "../_shared/piperun-person-resolver.ts";
import { claimSellerNoteSlot, releaseSellerNoteSlot } from "../_shared/seller-note-lock.ts";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";
import { requireConnectedEvolutionGo, WA_PROVIDER_COLUMNS } from "../_shared/wa-provider-router.ts";
import { buildLeadSummary } from "./summary.ts";
import {
  buildKolCandidateNote, buildKolCandidateOrigin, buildKolGroupName, buildKolInviteMessage,
  groupParticipants, KOL_CANDIDATE_OWNER_PIPERUN_ID, KOL_PIPELINE_ID, KOL_STAGE_INTERESSADOS,
  parseGroupJid, waDigits, type NoteSection,
} from "./kol-candidate.ts";

const PIPERUN_KEY = Deno.env.get("PIPERUN_API_KEY") ?? "";
const PORTAL_BASE = Deno.env.get("PUBLIC_SITE_URL") || "https://www.smartdent.com.br";
/** Beatriz Marketing Smart Dent (oraculosmartdent@gmail.com · 5516997501531). */
const BEATRIZ_TM_ID = "09166137-34a0-40a8-8857-211eda7a2233";

export const KolSubmitSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  telefone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  area_atuacao: z.string().trim().min(1).max(120),
  especialidade: z.string().trim().min(1).max(120),
  empresa_nome: z.string().trim().max(200).optional().nullable(),
  empresa_cnpj: z.string().trim().max(30).optional().nullable(),
  base: z.object({ kind: z.enum(["pessoa", "organizacao", "deal", "ficha"]), id: z.string().max(64) }).optional().nullable(),
});
export type KolSubmitInput = z.infer<typeof KolSubmitSchema>;

type Step = { step: string; ok: boolean; detail: string };
type Tm = { id: string; nome_completo: string; email: string | null };

const isEmpty = (v: unknown) => v == null || String(v).trim() === "";
const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const brl = (v: unknown) => {
  const n = Number(v);
  return v == null || !Number.isFinite(n) || n === 0 ? "" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

async function resolveOriginId(name: string): Promise<number | null> {
  const r = await piperunGet(PIPERUN_KEY, "origins", { name, show: 10 }).catch(() => null);
  const items = ((r?.data as any)?.data ?? []) as any[];
  const exact = items.find((o) => String(o.name ?? "").trim().toLowerCase() === name.toLowerCase());
  if (exact?.id) return Number(exact.id);
  const c = await piperunPost(PIPERUN_KEY, "origins", { name, active: true, description: "Inscrição KOL pela Agenda (vendedor que indicou)" }).catch(() => null);
  const id = Number((c?.data as any)?.data?.id ?? 0);
  return id || null;
}

async function evoGoPost(base: string, token: string, path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* texto puro */ }
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 240)}`);
  return parsed;
}

export async function runKolCandidate(deps: {
  sb: SupabaseClient;
  tm: Tm;
  userId: string;
  input: KolSubmitInput;
  searchRecords: (phone: string, email?: string | null) => Promise<any>;
}) {
  const { sb, tm, input } = deps;
  const steps: Step[] = [];
  const phoneDigits = input.telefone.replace(/\D/g, "");
  const phoneNorm = normalizeBrazilianPhone(phoneDigits);
  const email = (input.email || "").trim().toLowerCase();
  const origin = buildKolCandidateOrigin(tm.nome_completo);

  // ── 1) Ficha: lead canônico encontrado pela busca (ou o escolhido), senão cria ──
  const found = await deps.searchRecords(phoneDigits, email || null);
  const chosen = input.base?.kind === "ficha" ? found.leads.find((l: any) => l.id === input.base!.id) : null;
  let lead: any = chosen ?? found.leads[0] ?? null;
  if (lead) {
    const { data: signed } = await sb.from("kol_contracts").select("number")
      .eq("lead_id", lead.id).eq("status", "assinado").is("revoked_at", null).eq("is_test", false).limit(1).maybeSingle();
    if (signed) return { ok: false, error: `${lead.nome ?? "Este profissional"} já é KOL com contrato assinado (${signed.number ?? "sem número"}).`, status: 409 };
  }
  if (!lead) {
    const { data: created, error } = await sb.from("lia_attendances").insert({
      nome: input.nome, email: email || null, telefone_raw: phoneDigits, telefone_normalized: phoneNorm,
      area_atuacao: input.area_atuacao, especialidade: input.especialidade,
      empresa_nome: input.empresa_nome || null, empresa_cnpj: input.empresa_cnpj || null,
      lead_status: "novo", origem_primeiro_contato: origin, source: "kol_candidato",
    }).select("id, nome, email, telefone_normalized, pessoa_piperun_id").single();
    if (error || !created) return { ok: false, error: `Falha ao criar a ficha: ${error?.message ?? "erro"}`, status: 500 };
    lead = created;
    steps.push({ step: "ficha", ok: true, detail: "Ficha nova criada." });
  }
  const { data: cur } = await sb.from("lia_attendances")
    .select("id, nome, email, telefone_raw, telefone_normalized, area_atuacao, especialidade, empresa_nome, empresa_cnpj, pessoa_cpf, cidade, uf, prof_display_name, prof_cro, prof_wa_ddi, prof_wa_number, prof_specialist_team_member_id, pessoa_piperun_id, is_kol, equip_scanner, equip_impressora, equip_cad, created_at, origem_primeiro_contato, real_status, proprietario_lead_crm, form_name, produto_interesse, produto_interesse_auto, ltv_total, omie_faturamento_total, omie_ultima_compra, lojaintegrada_ultimo_pedido_data, lojaintegrada_ultimo_pedido_valor, astron_courses_total, astron_courses_completed")
    .eq("id", lead.id).single();
  // Só preenche o que está vazio; nunca sobrescreve dados existentes.
  const patch: Record<string, unknown> = { is_kol: true, prof_updated_at: new Date().toISOString() };
  if (isEmpty(cur.prof_display_name)) patch.prof_display_name = cur.nome || input.nome;
  if (isEmpty(cur.email) && email) patch.email = email;
  if (isEmpty(cur.telefone_normalized)) { patch.telefone_raw = phoneDigits; patch.telefone_normalized = phoneNorm; }
  if (isEmpty(cur.area_atuacao)) patch.area_atuacao = input.area_atuacao;
  if (isEmpty(cur.especialidade)) patch.especialidade = input.especialidade;
  if (isEmpty(cur.empresa_nome) && input.empresa_nome) patch.empresa_nome = input.empresa_nome;
  if (isEmpty(cur.empresa_cnpj) && input.empresa_cnpj) patch.empresa_cnpj = input.empresa_cnpj;
  if (isEmpty(cur.prof_wa_number)) { patch.prof_wa_ddi = "55"; patch.prof_wa_number = waDigits(phoneDigits) || phoneDigits; }
  if (isEmpty(cur.prof_specialist_team_member_id)) patch.prof_specialist_team_member_id = tm.id;
  const { error: upErr } = await sb.from("lia_attendances").update(patch).eq("id", cur.id);
  if (upErr) return { ok: false, error: `Falha ao atualizar a ficha: ${upErr.message}`, status: 500 };
  const prof = { ...cur, ...patch } as any;
  const profName = String(prof.prof_display_name || prof.nome || input.nome).trim();
  if (!steps.length) steps.push({ step: "ficha", ok: true, detail: "Ficha existente marcada como profissional (Cursos > KOLs)." });

  // Registro (idempotência: reenvio refaz só o que falhou)
  await sb.from("kol_candidate_registrations").upsert({ lead_id: prof.id }, { onConflict: "lead_id", ignoreDuplicates: true });
  const { data: reg } = await sb.from("kol_candidate_registrations").select("*").eq("lead_id", prof.id).single();
  const isFirst = !reg.registrant_team_member_id;
  const regPatch: Record<string, unknown> = {};
  if (isFirst) { regPatch.registrant_team_member_id = tm.id; regPatch.seller_team_member_id = tm.id; }

  // ── 2) Portal do Profissional Parceiro (token reutilizado) ──
  let portalUrl = reg.portal_url as string | null;
  if (!portalUrl) {
    const { data: tok } = await sb.from("professional_portal_tokens").select("token")
      .eq("lead_id", prof.id).is("revoked_at", null).gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false }).limit(1).maybeSingle();
    let token = tok?.token as string | undefined;
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
      await sb.from("professional_portal_tokens").insert({ token, lead_id: prof.id, created_by: "kol_candidato_agenda", expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
    }
    portalUrl = `${PORTAL_BASE}/portal-cursos/${token}`;
    regPatch.portal_url = portalUrl;
  }
  steps.push({ step: "portal", ok: true, detail: portalUrl });

  // ── 3) Pessoa no PipeRun (nunca sem e-mail ou celular) ──
  let personId = Number(reg.piperun_person_id) || 0;
  let dealId = Number(reg.piperun_deal_id) || 0;
  if (!PIPERUN_KEY) {
    steps.push({ step: "crm", ok: false, detail: "Chave do PipeRun não configurada." });
  } else {
    if (!personId && input.base?.kind === "pessoa") personId = Number(input.base.id) || 0;
    if (!personId) personId = Number(prof.pessoa_piperun_id) || 0;
    if (personId) { const v = await validateCachedPerson(PIPERUN_KEY, personId); if (!v.exists) personId = 0; }
    const emailOk = !!(prof.email && isValidEmailTld(prof.email));
    if (!personId) {
      const f = await findPersonByContact(PIPERUN_KEY, emailOk ? prof.email : null, phoneNorm ?? phoneDigits, sb).catch(() => null);
      if (f) personId = f.id;
    }
    if (!personId) {
      const body: Record<string, unknown> = { name: profName, cellphone: phoneNorm ?? phoneDigits };
      if (emailOk) body.email = prof.email;
      const c = await piperunPost(PIPERUN_KEY, "persons", body);
      personId = Number((c.data as any)?.data?.id ?? 0);
      steps.push(personId ? { step: "crm_pessoa", ok: true, detail: `Pessoa criada no PipeRun (#${personId}).` } : { step: "crm_pessoa", ok: false, detail: "Falha ao criar a pessoa no PipeRun." });
    } else {
      steps.push({ step: "crm_pessoa", ok: true, detail: `Pessoa vinculada (#${personId}).` });
    }
    if (personId) {
      regPatch.piperun_person_id = personId;
      if (Number(prof.pessoa_piperun_id) !== personId) await sb.from("lia_attendances").update({ pessoa_piperun_id: personId }).eq("id", prof.id);
    }

    // ── 4) Deal no funil KOL · Interessados · proprietário Beatriz ──
    if (personId && !dealId) {
      const ex = await piperunGet(PIPERUN_KEY, "deals", { person_id: personId, pipeline_id: KOL_PIPELINE_ID, show: 50 }).catch(() => null);
      const open = (((ex?.data as any)?.data ?? []) as any[]).find((d) => Number(d.pipeline_id) === KOL_PIPELINE_ID && !d.deleted && normalizePipeRunDealStatus(d.status) === "open");
      if (open) {
        dealId = Number(open.id);
        steps.push({ step: "crm_deal", ok: true, detail: `Deal #${dealId} já existia no funil KOL — reaproveitado sem mudar a etapa.` });
      } else {
        const originId = await resolveOriginId(origin).catch(() => null);
        const payload: Record<string, unknown> = {
          title: `KOL — ${profName}`, person_id: personId, pipeline_id: KOL_PIPELINE_ID,
          stage_id: KOL_STAGE_INTERESSADOS, user_id: KOL_CANDIDATE_OWNER_PIPERUN_ID,
        };
        if (originId) payload.origin_id = originId;
        const c = await piperunPost(PIPERUN_KEY, "deals", payload);
        dealId = Number((c.data as any)?.data?.id ?? 0);
        steps.push(dealId
          ? { step: "crm_deal", ok: true, detail: `Deal #${dealId} criado no funil KOL, etapa Interessados (origem "${origin}").` }
          : { step: "crm_deal", ok: false, detail: `Falha ao criar o deal no funil KOL (${c.status}).` });
      }
      if (dealId) regPatch.piperun_deal_id = dealId;
    } else if (dealId) {
      steps.push({ step: "crm_deal", ok: true, detail: `Deal #${dealId} já criado nesta inscrição.` });
    }
  }

  // ── 5) Grupo de WhatsApp (instância Beatriz) + mensagem ──
  let groupJid = reg.wa_group_jid as string | null;
  const groupName = reg.wa_group_name || buildKolGroupName(profName);
  const { data: beatriz } = await sb.from("team_members").select(`${WA_PROVIDER_COLUMNS}, whatsapp_number, evo_go_instance_name`).eq("id", BEATRIZ_TM_ID).maybeSingle();
  const { data: sellerRow } = await sb.from("team_members").select("whatsapp_number").eq("id", tm.id).maybeSingle();
  const { data: dry } = await sb.from("kol_program_settings").select("value").eq("key", "group_creation_dry_run").maybeSingle();
  const dryRun = dry?.value === true || dry?.value === "true";
  let provider: ReturnType<typeof requireConnectedEvolutionGo> | null = null;
  try { provider = requireConnectedEvolutionGo(beatriz as any, "group_management"); }
  catch (e) { if (!groupJid) { regPatch.wa_group_error = (e as Error).message; steps.push({ step: "grupo", ok: false, detail: `WhatsApp da Beatriz indisponível: ${(e as Error).message}` }); } }
  if (!groupJid && provider) {
    const participants = groupParticipants(sellerRow?.whatsapp_number, prof.telefone_normalized || phoneDigits, beatriz?.whatsapp_number);
    if (dryRun) {
      steps.push({ step: "grupo", ok: true, detail: `Simulação ligada — grupo "${groupName}" não foi criado (${participants.length} participantes).` });
    } else if (participants.length < 2) {
      regPatch.wa_group_error = "missing_participants";
      steps.push({ step: "grupo", ok: false, detail: sellerRow?.whatsapp_number ? "Celular do profissional inválido para o grupo." : "Seu celular não está no cadastro da equipe (Team Members)." });
    } else {
      try {
        const r = await evoGoPost(provider.baseUrl, provider.credential, "/group/create", { groupName, participants });
        groupJid = parseGroupJid(r);
        if (!groupJid) throw new Error("grupo criado sem identificador na resposta");
        regPatch.wa_group_jid = groupJid; regPatch.wa_group_name = groupName; regPatch.wa_group_error = null;
        steps.push({ step: "grupo", ok: true, detail: `Grupo "${groupName}" criado com você, o profissional e a Beatriz (administradora).` });
      } catch (e) {
        regPatch.wa_group_error = String((e as Error).message).slice(0, 400);
        steps.push({ step: "grupo", ok: false, detail: `Falha ao criar o grupo: ${regPatch.wa_group_error}` });
      }
    }
  } else if (groupJid) {
    steps.push({ step: "grupo", ok: true, detail: `Grupo "${groupName}" já criado.` });
  }
  if (groupJid && !reg.wa_message_sent_at && provider) {
    if (!reg.wa_group_jid) await new Promise((r) => setTimeout(r, 2500)); // grupo recém-criado
    try {
      const text = buildKolInviteMessage({ professional: profName, seller: tm.nome_completo, portalUrl: portalUrl! });
      const r: any = await evoGoPost(provider.baseUrl, provider.credential, "/send/text", { number: groupJid, text });
      regPatch.wa_message_id = String(r?.data?.Info?.ID ?? r?.data?.id ?? r?.key?.id ?? "") || null;
      regPatch.wa_message_sent_at = new Date().toISOString(); regPatch.wa_message_error = null;
      steps.push({ step: "mensagem", ok: true, detail: "Mensagem da Beatriz enviada no grupo com o link do portal." });
    } catch (e) {
      regPatch.wa_message_error = String((e as Error).message).slice(0, 400);
      steps.push({ step: "mensagem", ok: false, detail: `Falha ao enviar a mensagem: ${regPatch.wa_message_error}` });
    }
  } else if (reg.wa_message_sent_at) {
    steps.push({ step: "mensagem", ok: true, detail: "Mensagem já enviada anteriormente." });
  }

  // ── 6) Nota completa no deal (validação do Marketing) ──
  if (dealId && PIPERUN_KEY && !reg.note_posted_at) {
    const leadSummary = buildLeadSummary({ ...prof, doc: found.leads.find((l: any) => l.id === prof.id)?.doc }, found.deals ?? [], []);
    const wonDeals = (found.deals ?? []).filter((d: any) => d.status === "ganha");
    const sections: NoteSection[] = [
      { title: "Indicação", rows: [["Indicado por", tm.nome_completo], ["Data", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })], ["Status", "Candidato a KOL — contrato pendente"]] },
      { title: "Profissional", rows: [
        ["Nome", profName], ["Celular", prof.telefone_normalized || phoneDigits], ["E-mail", prof.email],
        ["Área de atuação", prof.area_atuacao], ["Especialidade", prof.especialidade], ["CRO", prof.prof_cro],
        ["Documento", found.leads.find((l: any) => l.id === prof.id)?.doc?.label], ["Empresa", prof.empresa_nome],
        ["Cidade/UF", [prof.cidade, prof.uf].filter(Boolean).join("/")],
      ] },
      { title: "Equipamentos", rows: [["Scanner", prof.equip_scanner], ["Impressora 3D", prof.equip_impressora], ["CAD", prof.equip_cad]] },
      { title: "Compras e relacionamento", rows: [
        ["Negócios ganhos", wonDeals.length ? `${wonDeals.length} (${brl(wonDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0))})` : ""],
        ["LTV", brl(prof.ltv_total)], ["Faturado ERP", brl(prof.omie_faturamento_total)], ["Última compra ERP", dt(prof.omie_ultima_compra)],
        ["Último pedido e-commerce", prof.lojaintegrada_ultimo_pedido_data ? `${dt(prof.lojaintegrada_ultimo_pedido_data)} ${brl(prof.lojaintegrada_ultimo_pedido_valor)}` : ""],
        ["Responsável no CRM", prof.proprietario_lead_crm],
      ] },
      ...leadSummary.filter((b) => b.title !== "Quem é").map((b) => ({ title: b.title, lines: b.lines })),
      { title: "Credenciamento", rows: [
        ["Contrato", "Pendente (não gerado)"], ["Portal do Profissional Parceiro", portalUrl],
        ["Grupo de WhatsApp", groupJid ? `${groupName} (Beatriz + ${tm.nome_completo} + profissional)` : dryRun ? "Simulação — não criado" : `Não criado: ${regPatch.wa_group_error ?? reg.wa_group_error ?? "—"}`],
        ["Mensagem de boas-vindas", (regPatch.wa_message_sent_at || reg.wa_message_sent_at) ? "Enviada no grupo" : "Não enviada"],
      ] },
    ];
    const html = buildKolCandidateNote({ origin, sections });
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${dealId}::${html}`));
    const hash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    const claim = await claimSellerNoteSlot(sb, { dealId, leadId: prof.id, contentHash: hash });
    if (claim.ok) {
      const posted = await addDealNote(PIPERUN_KEY, dealId, html);
      if (posted?.success) { regPatch.note_posted_at = new Date().toISOString(); steps.push({ step: "crm_nota", ok: true, detail: "Nota completa gravada no deal para validação do Marketing." }); }
      else { await releaseSellerNoteSlot(sb, { dealId, contentHash: hash }); steps.push({ step: "crm_nota", ok: false, detail: "Falha ao gravar a nota no deal." }); }
    } else {
      steps.push({ step: "crm_nota", ok: true, detail: "Nota já gravada." });
    }
  } else if (reg.note_posted_at) {
    steps.push({ step: "crm_nota", ok: true, detail: "Nota já gravada anteriormente." });
  }

  // ── 7) Timeline do lead ──
  await sb.rpc("fn_kol_log", {
    _lead_id: prof.id,
    _event_type: isFirst ? "kol_candidato" : "kol_candidato_reprocessado",
    _entity_type: "kol_candidato", _entity_id: String(reg.id),
    _entity_name: isFirst ? `Candidato a KOL — indicado por ${tm.nome_completo}` : `Candidato a KOL — etapas reprocessadas por ${tm.nome_completo}`,
    _value: null, _channel: "insercao_crm",
    _data: { origin, registrant: tm.nome_completo, actor: tm.nome_completo, deal_id: dealId || null, wa_group: groupJid, portal_url: portalUrl, steps, dedupe_key: `kol_candidato:${reg.id}:${Date.now()}` },
  });

  regPatch.steps = steps;
  await sb.from("kol_candidate_registrations").update(regPatch).eq("id", reg.id);
  return { ok: steps.every((s) => s.ok), lead_id: prof.id, nome: profName, deal_id: dealId || null, wa_group: groupJid, origin, steps };
}
