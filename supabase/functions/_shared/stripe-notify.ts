// _shared/stripe-notify.ts
// Peças reintegradas do fluxo Stripe:
//  1. createStubLead()            — cria lead mínimo quando não há match no CDP
//  2. notifySellerOfPayment()     — avisa o vendedor dono do lead
//  3. notifyExecutivesOfPayment() — avisa SEMPRE os executivos configurados
// Envio institucional sai sempre pela instância de marketing (Evolution).
// deno-lint-ignore-file no-explicit-any
import { EVO_BASE, EVO_KEY, normalizePhone } from "./evolution.ts";
import { normalizeBrazilianPhone } from "./phone-normalize.ts";

const SENDER_INSTANCE = Deno.env.get("NOTIFY_SELLER_INSTANCE") ?? "smartdent_marketing";

export interface PaymentNotice {
  kind: "ativacao" | "mensalidade";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  amount: number | null;
  currency: string | null;
  internalProduct: string | null;
  stripeProduct: string | null;
  paidAt: Date;
}

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: (currency ?? "BRL").toUpperCase() }).format(amount);
  } catch {
    return `${amount}`;
  }
}

function spFmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(d);
}

export function buildPaymentMessage(n: PaymentNotice, sellerName: string | null): string {
  const header = n.kind === "ativacao" ? "💲 Nova ativação 💲" : "💲 Nova mensalidade 💲";
  const sub = n.kind === "ativacao" ? "💳 Pagamento da Ativação realizada" : "💳 Pagamento da Mensalidade realizado";
  return [
    header,
    sub,
    `-> ${n.internalProduct ?? "Produto não identificado"} <-`,
    `Cliente: ${n.customerName ?? "Não informado"}`,
    `Email: ${n.customerEmail ?? "Não informado"}`,
    `Telefone: ${n.customerPhone ?? "Não informado"}`,
    `Valor pago: ${money(n.amount, n.currency)}`,
    `Faturado às: ${spFmt(n.paidAt, { hour: "2-digit", minute: "2-digit" })}`,
    `Produto Stripe: ${n.stripeProduct ?? "Não informado"}`,
    `Data de pagamento: ${spFmt(n.paidAt, { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    `Vendedor: ${sellerName ?? "Não informado"}`,
  ].join("\n");
}

async function senderKey(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("team_members")
    .select("evolution_api_key")
    .eq("evolution_instance_name", SENDER_INSTANCE)
    .not("evolution_api_key", "is", null)
    .limit(1)
    .maybeSingle();
  return ((data as any)?.evolution_api_key as string | null)?.trim() || EVO_KEY;
}

async function sendAndLog(supabase: any, params: {
  phone: string | null;
  text: string;
  tipo: string;
  lead_id: string | null;
  team_member_id?: string | null;
}): Promise<boolean> {
  const clean = normalizePhone(params.phone || "");
  if (!clean || clean.length < 10) {
    await logMsg(supabase, { ...params, whatsapp_number: params.phone, status: "erro", error_details: "missing_or_invalid_phone" });
    return false;
  }
  const to = clean.startsWith("55") ? clean : `55${clean}`;
  let status: "enviado" | "erro" = "enviado";
  let error_details: string | null = null;
  try {
    const key = await senderKey(supabase);
    const res = await fetch(`${EVO_BASE}/message/sendText/${encodeURIComponent(SENDER_INSTANCE)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number: to, text: params.text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      status = "erro";
      error_details = `sendText ${res.status}: ${(await res.text()).slice(0, 300)}`;
    }
  } catch (e) {
    status = "erro";
    error_details = e instanceof Error ? e.message : String(e);
  }
  await logMsg(supabase, { ...params, whatsapp_number: to, status, error_details });
  return status === "enviado";
}

async function logMsg(supabase: any, p: {
  lead_id: string | null;
  team_member_id?: string | null;
  whatsapp_number: string | null;
  tipo: string;
  text?: string;
  status: string;
  error_details: string | null;
}) {
  try {
    await supabase.from("message_logs").insert({
      lead_id: p.lead_id,
      team_member_id: p.team_member_id ?? null,
      whatsapp_number: p.whatsapp_number,
      tipo: p.tipo,
      status: p.status,
      error_details: p.error_details,
      mensagem_preview: (p.text ?? "").slice(0, 500) || null,
      data_envio: new Date().toISOString(),
      evolution_instance: SENDER_INSTANCE,
    });
  } catch (e) {
    console.error("[stripe-notify] message_logs insert error:", (e as Error).message);
  }
}

/** Cria um lead mínimo quando resolveLead() não encontra ninguém. */
export async function createStubLead(supabase: any, params: {
  email: string | null;
  phone: string | null;
  name: string | null;
  product: string | null;
  platform: string | null;
}): Promise<string | null> {
  const { email, phone, name, product, platform } = params;
  // email é NOT NULL + unique em lia_attendances — sem ele não dá pra criar
  // um registro que depois vai casar direito.
  if (!email) return null;

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = normalizeBrazilianPhone(phone ?? undefined);
  const fallbackName = name || normalizedEmail.split("@")[0] || "Lead Stripe";

  const { data, error } = await supabase
    .from("lia_attendances")
    .insert({
      nome: fallbackName,
      email: normalizedEmail,
      telefone_raw: phone,
      telefone_normalized: normalizedPhone,
      source: "stripe_checkout",
      lead_status: "novo",
      produto_interesse: product,
      platform,
      origem_campanha: "stripe_checkout_auto_criado",
    })
    .select("id")
    .maybeSingle();

  if (!error && data?.id) return data.id as string;

  // Corrida: outro processo criou o mesmo email nesse meio-tempo.
  if ((error as any)?.code === "23505") {
    const { data: existing } = await supabase
      .from("lia_attendances")
      .select("id")
      .eq("email", normalizedEmail)
      .is("merged_into", null)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
  }

  console.error("[stripe-notify] createStubLead insert error:", error);
  return null;
}

/** Resolve o vendedor dono do lead (pode não existir). */
export async function resolveLeadSeller(supabase: any, leadId: string): Promise<
  { id: string; nome_completo: string | null; phone: string | null } | null
> {
  const { data: lead } = await supabase
    .from("lia_attendances")
    .select("piperun_owner_id, proprietario_lead_crm")
    .eq("id", leadId)
    .maybeSingle();
  const ownerId = (lead as any)?.piperun_owner_id;
  if (!ownerId) return null;
  const { data: member } = await supabase
    .from("team_members")
    .select("id, nome_completo, notification_phone, whatsapp_number, ativo")
    .eq("piperun_owner_id", ownerId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (!member) return null;
  return {
    id: (member as any).id,
    nome_completo: (member as any).nome_completo ?? null,
    phone: (member as any).notification_phone || (member as any).whatsapp_number || null,
  };
}

/** Avisa o vendedor dono do lead. Sem vendedor atribuído = no-op (não é erro). */
export async function notifySellerOfPayment(
  supabase: any,
  leadId: string,
  notice: PaymentNotice,
): Promise<{ sent: boolean; reason?: string }> {
  const seller = await resolveLeadSeller(supabase, leadId);
  if (!seller) return { sent: false, reason: "no_seller_assigned" };
  const text = buildPaymentMessage(notice, seller.nome_completo);
  const ok = await sendAndLog(supabase, {
    phone: seller.phone,
    text,
    tipo: "stripe_pagamento_vendedor",
    lead_id: leadId,
    team_member_id: seller.id,
  });
  return { sent: ok };
}

/** Avisa SEMPRE os executivos ativos em stripe_payment_notify_recipients. */
export async function notifyExecutivesOfPayment(
  supabase: any,
  leadId: string | null,
  notice: PaymentNotice,
  sellerName: string | null,
): Promise<{ sent: number; total: number }> {
  const { data: recipients, error } = await supabase
    .from("stripe_payment_notify_recipients")
    .select("nome, phone")
    .eq("ativo", true);
  if (error) {
    console.error("[stripe-notify] recipients fetch error:", error);
    return { sent: 0, total: 0 };
  }
  const list = (recipients ?? []) as Array<{ nome: string; phone: string }>;
  const text = buildPaymentMessage(notice, sellerName);
  let sent = 0;
  for (const r of list) {
    const ok = await sendAndLog(supabase, {
      phone: r.phone,
      text,
      tipo: "stripe_pagamento_executivo",
      lead_id: leadId,
    });
    if (ok) sent++;
  }
  return { sent, total: list.length };
}
