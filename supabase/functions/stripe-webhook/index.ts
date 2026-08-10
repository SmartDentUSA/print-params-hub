// deno-lint-ignore-file no-explicit-any
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";
import { isRealEmail } from "../_shared/email-sanitize.ts";
import { reconcileStripeToLead } from "../_shared/stripe-lead-reconcile.ts";
import {
  createStubLead,
  notifyExecutivesOfPayment,
  notifySellerOfPayment,
  resolveLeadSeller,
  type PaymentNotice,
} from "../_shared/stripe-notify.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY || "sk_placeholder", {
      apiVersion: "2025-08-27.basil" as any,
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}

let _cryptoProvider: ReturnType<typeof Stripe.createSubtleCryptoProvider> | null = null;
function getCryptoProvider() {
  if (!_cryptoProvider) _cryptoProvider = Stripe.createSubtleCryptoProvider();
  return _cryptoProvider;
}

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const EVENT_MAP: Record<string, { event_type: string; activity: "payment" | "subscription" }> = {
  "checkout.session.completed": { event_type: "stripe_checkout_completed", activity: "payment" },
  "checkout.session.async_payment_succeeded": { event_type: "stripe_checkout_paid", activity: "payment" },
  "checkout.session.async_payment_failed": { event_type: "stripe_checkout_failed", activity: "payment" },
  "payment_intent.succeeded": { event_type: "stripe_payment_succeeded", activity: "payment" },
  "payment_intent.payment_failed": { event_type: "stripe_payment_failed", activity: "payment" },
  "charge.refunded": { event_type: "stripe_refund", activity: "payment" },
  "invoice.paid": { event_type: "stripe_invoice_paid", activity: "payment" },
  "invoice.payment_failed": { event_type: "stripe_invoice_failed", activity: "payment" },
  "invoice.payment_action_required": { event_type: "stripe_invoice_action_required", activity: "payment" },
  "customer.subscription.created": { event_type: "stripe_subscription_created", activity: "subscription" },
  "customer.subscription.updated": { event_type: "stripe_subscription_updated", activity: "subscription" },
  "customer.subscription.deleted": { event_type: "stripe_subscription_canceled", activity: "subscription" },
};

function extractCustomer(event: Stripe.Event): {
  phone: string | null;
  email: string | null;
  name: string | null;
  stripe_customer_id: string | null;
} {
  const obj = event.data.object as any;
  const phone =
    obj?.customer_details?.phone ??
    obj?.billing_details?.phone ??
    obj?.charges?.data?.[0]?.billing_details?.phone ??
    obj?.customer_phone ??
    obj?.metadata?.phone ??
    null;
  const email =
    obj?.customer_details?.email ??
    obj?.billing_details?.email ??
    obj?.charges?.data?.[0]?.billing_details?.email ??
    obj?.customer_email ??
    obj?.receipt_email ??
    obj?.metadata?.email ??
    null;
  const name =
    obj?.customer_details?.name ??
    obj?.billing_details?.name ??
    obj?.charges?.data?.[0]?.billing_details?.name ??
    obj?.metadata?.name ??
    null;
  const stripe_customer_id =
    typeof obj?.customer === "string" ? obj.customer : obj?.customer?.id ?? null;
  return { phone, email, name, stripe_customer_id };
}

function extractAmount(event: Stripe.Event): { amount: number | null; currency: string | null; status: string | null } {
  const obj = event.data.object as any;
  let cents: number | null = null;
  if (typeof obj?.amount_total === "number") cents = obj.amount_total;
  else if (typeof obj?.amount_paid === "number") cents = obj.amount_paid;
  else if (typeof obj?.amount === "number") cents = obj.amount;
  else if (typeof obj?.amount_received === "number") cents = obj.amount_received;
  else if (typeof obj?.amount_refunded === "number") cents = obj.amount_refunded;
  else if (typeof obj?.plan?.amount === "number") cents = obj.plan.amount;
  else if (typeof obj?.items?.data?.[0]?.price?.unit_amount === "number")
    cents = obj.items.data[0].price.unit_amount;

  const amount = cents != null ? Number((cents / 100).toFixed(2)) : null;
  const currency: string | null = obj?.currency ?? obj?.plan?.currency ?? null;
  const status: string | null = obj?.status ?? obj?.payment_status ?? null;
  return { amount, currency, status };
}

function extractProducts(event: Stripe.Event): Array<{ name: string | null; price_id: string | null; product_id: string | null; qty: number | null; amount: number | null }> {
  const obj = event.data.object as any;
  const lines: any[] =
    obj?.line_items?.data ??
    obj?.lines?.data ??
    obj?.items?.data ??
    [];
  return lines.map((li: any) => ({
    name: li?.description ?? li?.price?.nickname ?? li?.price?.product?.name ?? null,
    price_id: li?.price?.id ?? null,
    product_id: typeof li?.price?.product === "string" ? li.price.product : li?.price?.product?.id ?? null,
    qty: li?.quantity ?? null,
    amount: typeof li?.amount_total === "number" ? Number((li.amount_total / 100).toFixed(2)) : (typeof li?.price?.unit_amount === "number" ? Number((li.price.unit_amount / 100).toFixed(2)) : null),
  }));
}

async function resolveLead(
  phoneRaw: string | null,
  email: string | null,
  hints?: { leadIdHint?: string | null; taxIds?: string[] },
): Promise<string | null> {
  // 0. lead_id/client_reference_id explícito no checkout — sempre vence.
  const hint = hints?.leadIdHint?.trim();
  if (hint && /^[0-9a-f-]{36}$/i.test(hint)) {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, merged_into")
      .eq("id", hint)
      .maybeSingle();
    if (data?.id) return ((data as any).merged_into ?? data.id) as string;
  }

  // 1. CNPJ/CPF do checkout (tax_ids) — identidade forte.
  for (const raw of hints?.taxIds ?? []) {
    const d = String(raw ?? "").replace(/\D/g, "");
    if (d.length !== 14 && d.length !== 11) continue;
    // Casa ignorando pontuação: o CRM pode guardar "21.257.735/0001-75"
    // enquanto o Stripe envia só dígitos (e vice-versa).
    const { data } = await supabase.rpc("fn_find_lead_by_tax_id", { _tax_id: d });
    const hit = Array.isArray(data) ? data[0] : null;
    if (hit?.lead_id) return hit.lead_id as string;
  }

  const normalized = normalizeBrazilianPhone(phoneRaw ?? undefined);
  if (normalized) {
    const digits = normalized.replace(/\D/g, "");
    const { data } = await supabase
      .from("lia_attendances")
      .select("id")
      .is("merged_into", null)
      .or(`telefone_normalized.eq.${normalized},wa_phone.eq.${digits}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (email && isRealEmail(email)) {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id")
      .is("merged_into", null)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

function buildTitle(mapped: string, amount: number | null, currency: string | null, products: Array<{ name: string | null }>): string {
  const cur = (currency ?? "BRL").toUpperCase();
  const money = amount != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(amount)
    : null;
  const productName = products.map((p) => p.name).filter(Boolean).join(", ") || null;
  const label = mapped
    .replace(/^stripe_/, "")
    .replace(/_/g, " ");
  return [`Stripe: ${label}`, money, productName].filter(Boolean).join(" — ");
}

/** Assinatura (mensalidade) vs pagamento único (ativação). */
function isSubscriptionEvent(event: Stripe.Event): boolean {
  const obj = event.data.object as any;
  if (event.type.startsWith("customer.subscription")) return true;
  if (obj?.mode === "subscription") return true;
  if (obj?.subscription || obj?.parent?.subscription_details?.subscription) return true;
  const names = [obj?.metadata?.product, ...(extractProducts(event).map((p) => p.name) ?? [])]
    .filter(Boolean).join(" ").toLowerCase();
  if (/mensalidade|monthly|recorren/.test(names)) return true;
  const lines: any[] = obj?.lines?.data ?? obj?.line_items?.data ?? [];
  return lines.some((li) => li?.price?.recurring || li?.plan);
}

function subscriptionIdOf(event: Stripe.Event): string | null {
  const obj = event.data.object as any;
  if (event.type.startsWith("customer.subscription")) return obj?.id ?? null;
  const s = obj?.subscription ?? obj?.parent?.subscription_details?.subscription ?? null;
  return typeof s === "string" ? s : s?.id ?? null;
}

function periodEndOf(event: Stripe.Event): string | null {
  const obj = event.data.object as any;
  const ts =
    obj?.current_period_end ??
    obj?.items?.data?.[0]?.current_period_end ??
    obj?.lines?.data?.[0]?.period?.end ??
    null;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
}

/** Espelha a assinatura em stripe_subscriptions (status, vencimento, MRR do painel RMS). */
async function upsertSubscription(event: Stripe.Event, leadId: string, products: Array<{ name: string | null }>) {
  const subId = subscriptionIdOf(event);
  if (!subId) return;
  const obj = event.data.object as any;
  const customerId = typeof obj?.customer === "string" ? obj.customer : obj?.customer?.id ?? null;

  let status: string | null = event.type.startsWith("customer.subscription") ? obj?.status ?? null : null;
  let cancelAtPeriodEnd: boolean | null = event.type.startsWith("customer.subscription")
    ? Boolean(obj?.cancel_at_period_end)
    : null;
  let canceledAt: string | null = typeof obj?.canceled_at === "number"
    ? new Date(obj.canceled_at * 1000).toISOString()
    : null;
  let periodEnd = periodEndOf(event);
  let productName = products.map((p) => p.name).filter(Boolean)[0] ?? obj?.metadata?.product ?? null;

  // invoice.paid não traz o estado da assinatura: busca na API quando possível.
  if ((!status || !periodEnd) && STRIPE_SECRET_KEY) {
    try {
      const s = await getStripe().subscriptions.retrieve(subId);
      status = status ?? s.status ?? null;
      cancelAtPeriodEnd = cancelAtPeriodEnd ?? Boolean((s as any).cancel_at_period_end);
      canceledAt = canceledAt ?? (typeof (s as any).canceled_at === "number" ? new Date((s as any).canceled_at * 1000).toISOString() : null);
      const pe = (s as any).current_period_end ?? (s as any).items?.data?.[0]?.current_period_end ?? null;
      periodEnd = periodEnd ?? (typeof pe === "number" ? new Date(pe * 1000).toISOString() : null);
      productName = productName ?? ((s as any).items?.data?.[0]?.price?.nickname ?? null);
    } catch (e) {
      console.error("[stripe-webhook] subscriptions.retrieve failed:", (e as Error).message);
    }
  }

  const row: Record<string, unknown> = {
    stripe_subscription_id: subId,
    stripe_customer_id: customerId,
    lead_id: leadId,
    status: status ?? (event.type === "invoice.paid" ? "active" : null),
    product: productName,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    canceled_at: canceledAt,
    platform: obj?.metadata?.platform ?? null,
    updated_at: new Date().toISOString(),
  };
  for (const k of Object.keys(row)) if (row[k] === null || row[k] === undefined) delete row[k];
  row.stripe_subscription_id = subId;
  row.lead_id = leadId;

  const { error } = await supabase
    .from("stripe_subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) console.error("[stripe-webhook] subscription upsert error:", error);
}

/** Marca a mensalidade paga nas unidades (dongles) já existentes do lead. */
async function markMensalidadePaid(leadId: string, paidAt: Date, periodEnd: string | null, customerId: string | null, productName: string | null) {
  const { data: units } = await supabase
    .from("stripe_payment_units")
    .select("id, paid_at")
    .eq("lead_id", leadId)
    .order("paid_at", { ascending: true });

  const dueDate = (periodEnd ? new Date(periodEnd) : paidAt).toISOString().slice(0, 10);

  if (units?.length) {
    const ids = units.map((u: any) => u.id);
    const { error } = await supabase
      .from("stripe_payment_units")
      .update({ mensalidade_data: dueDate, mensalidade_status: "Paga" })
      .in("id", ids);
    if (error) console.error("[stripe-webhook] mensalidade update error:", error);
    return;
  }

  // Nenhuma unidade ainda (mensalidade chegou antes da ativação): cria uma para
  // o cliente aparecer no painel RMS.
  const { error } = await supabase.from("stripe_payment_units").insert({
    lead_id: leadId,
    stripe_customer_id: customerId,
    unit_index: 1,
    product_name: productName,
    paid_at: paidAt.toISOString(),
    mensalidade_data: dueDate,
    mensalidade_status: "Paga",
  } as any);
  if (error) console.error("[stripe-webhook] mensalidade unit insert error:", error);
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  if (!WEBHOOK_SECRET) {
    console.error("[stripe-webhook] missing STRIPE_WEBHOOK_SECRET env var");
    return new Response("missing webhook secret", { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      WEBHOOK_SECRET,
      undefined,
      getCryptoProvider(),
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", (err as Error).message);
    return new Response(`signature error: ${(err as Error).message}`, { status: 400 });
  }

  // Idempotency: try to insert first. If conflict, we've seen it → ack immediately.
  const { error: dedupErr } = await supabase
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      payload: event as any,
    });
  if (dedupErr) {
    // Unique violation = already processed → return 200 so Stripe stops retrying.
    if ((dedupErr as any).code === "23505") {
      return new Response(JSON.stringify({ ok: true, dedup: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    console.error("[stripe-webhook] dedup insert error:", dedupErr);
    // Still continue — better to double-log than lose data.
  }

  const mapping = EVENT_MAP[event.type];
  if (!mapping) {
    // Unmapped event: dedup row is enough.
    return new Response(JSON.stringify({ ok: true, ignored: event.type }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const customer = extractCustomer(event);
  const { amount, currency, status } = extractAmount(event);
  const products = extractProducts(event);
  const obj = event.data.object as any;
  const internalProduct: string | null = obj?.metadata?.product ?? products?.[0]?.name ?? null;
  const platform: string | null = obj?.metadata?.platform ?? null;

  const taxIds: string[] = [
    ...(Array.isArray(obj?.customer_details?.tax_ids)
      ? obj.customer_details.tax_ids.map((t: any) => t?.value)
      : []),
    obj?.metadata?.cnpj,
    obj?.metadata?.cpf,
    obj?.metadata?.tax_id,
  ].filter(Boolean).map((v: any) => String(v));

  let leadId = await resolveLead(customer.phone, customer.email, {
    leadIdHint: obj?.metadata?.lead_id ?? obj?.client_reference_id ?? null,
    taxIds,
  });

  if (!leadId) {
    // Comprador ainda não existe no CDP: cria lead-stub em vez de perder a venda.
    leadId = await createStubLead(supabase, {
      email: customer.email,
      phone: customer.phone,
      name: customer.name,
      product: internalProduct,
      platform,
    });

    if (leadId) {
      await supabase
        .from("stripe_webhook_events")
        .update({ lead_id: leadId, error: "lead_auto_created" })
        .eq("event_id", event.id);
    } else {
      await supabase
        .from("stripe_webhook_events")
        .update({ error: "lead_not_found_no_email" })
        .eq("event_id", event.id);
      return new Response(JSON.stringify({ ok: true, lead_not_found: true, phone: customer.phone, email: customer.email }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  }

  const stripeObjectId: string | null = obj?.id ?? null;
  const mode: string | null = obj?.mode ?? (event.type.startsWith("customer.subscription") ? "subscription" : "payment");
  const title = buildTitle(mapping.event_type, amount, currency, products);
  const description = products.map((p) => p.name).filter(Boolean).join(" | ") || obj?.description || obj?.failure_message || null;

  const eventData = {
    activity_type: mapping.activity,
    channel: "stripe",
    source: "stripe_webhook",
    title,
    description,
    amount,
    currency,
    status,
    mode,
    stripe_event_id: event.id,
    stripe_object_id: stripeObjectId,
    stripe_customer_id: customer.stripe_customer_id,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    products,
    livemode: event.livemode,
  };

  const { error: activityErr } = await supabase
    .from("lead_activity_log")
    .insert({
      lead_id: leadId,
      event_type: mapping.event_type,
      event_timestamp: new Date(event.created * 1000).toISOString(),
      event_data: eventData,
      entity_type: "stripe",
      entity_id: stripeObjectId,
      entity_name: title,
      value_numeric: amount,
      source_channel: "stripe",
    });

  if (activityErr) {
    console.error("[stripe-webhook] activity insert error:", activityErr);
    await supabase
      .from("stripe_webhook_events")
      .update({ lead_id: leadId, error: `activity_insert_failed: ${activityErr.message}` })
      .eq("event_id", event.id);
  } else {
    await supabase
      .from("stripe_webhook_events")
      .update({ lead_id: leadId })
      .eq("event_id", event.id);
  }

  const recurring = isSubscriptionEvent(event);
  const paidAtDate = new Date(event.created * 1000);

  // Espelha a assinatura (status/vencimento) para o painel RMS
  if (recurring) {
    try {
      await upsertSubscription(event, leadId, products);
    } catch (e) {
      console.error("[stripe-webhook] upsertSubscription error:", (e as Error).message);
    }
  }

  // Mensalidade paga → atualiza as unidades existentes em vez de criar linha nova
  if (recurring && (event.type === "invoice.paid" || event.type === "checkout.session.completed")) {
    try {
      await markMensalidadePaid(
        leadId,
        paidAtDate,
        periodEndOf(event),
        customer.stripe_customer_id,
        products.map((p) => p.name).filter(Boolean)[0] ?? internalProduct,
      );
    } catch (e) {
      console.error("[stripe-webhook] markMensalidadePaid error:", (e as Error).message);
    }
  }

  // Expand into stripe_payment_units (one row per dongle unit) on checkout.completed
  // Somente compras de ativação criam unidade — mensalidade recorrente não gera dongle novo.
  if (event.type === "checkout.session.completed" && !recurring) {
    // Build unit rows. Attempt to expand via listLineItems, but never let a
    // Stripe API error skip the insert — always fall back to a single unit
    // row so the RMS dashboard reflects the payment.
    let units: Array<{ product_name: string | null; unit_total: number | null }> = [];
    try {
      const sessionId = stripeObjectId;
      if (sessionId && STRIPE_SECRET_KEY) {
        const li = await getStripe().checkout.sessions.listLineItems(sessionId, { limit: 100 });
        const lineItems = li?.data ?? [];
        for (const it of lineItems) {
          const qty = Number(it?.quantity ?? 1) || 1;
          const unitCents = typeof it?.price?.unit_amount === "number"
            ? it.price.unit_amount
            : (typeof it?.amount_total === "number" && qty > 0 ? Math.round(it.amount_total / qty) : null);
          const unitTotal = unitCents != null ? Number((unitCents / 100).toFixed(2)) : (amount && qty > 0 ? Number((amount / qty).toFixed(2)) : null);
          const name = it?.description ?? it?.price?.nickname ?? null;
          for (let i = 0; i < qty; i++) units.push({ product_name: name, unit_total: unitTotal });
        }
      }
    } catch (e) {
      console.error("[stripe-webhook] listLineItems failed, using fallback unit:", (e as Error).message);
      units = [];
    }
    if (units.length === 0) {
      units.push({ product_name: products?.[0]?.name ?? null, unit_total: amount });
    }
    try {
      const rows = units.map((u, idx) => ({
        lead_id: leadId,
        stripe_event_id: event.id,
        stripe_checkout_id: stripeObjectId,
        stripe_customer_id: customer.stripe_customer_id,
        unit_index: idx + 1,
        unit_total: u.unit_total,
        product_name: u.product_name,
        paid_at: paidAtDate.toISOString(),
        ativacao_data: paidAtDate.toISOString().slice(0, 10),
        ativacao_status: "Pendente",
      }));
      const { error: unitsErr } = await supabase
        .from("stripe_payment_units")
        .upsert(rows, { onConflict: "stripe_checkout_id,unit_index", ignoreDuplicates: true });
      if (unitsErr) console.error("[stripe-webhook] payment_units upsert error:", unitsErr);
    } catch (e) {
      console.error("[stripe-webhook] payment_units insert error:", (e as Error).message);
    }
  }

  await runPaymentNotifications({
    event,
    leadId,
    amount,
    currency,
    customer: { name: customer.name, email: customer.email, phone: customer.phone },
    internalProduct,
    stripeProduct: products.map((p) => p.name).filter(Boolean)[0] ?? null,
  });

  // Mesh: reaponta pagamentos anteriores do mesmo comprador (stubs/placeholders)
  // para o cadastro resolvido agora.
  await reconcileStripeToLead(supabase, leadId, { source: "stripe-webhook" });

  return new Response(JSON.stringify({ ok: true, lead_id: leadId, event_type: mapping.event_type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function runPaymentNotifications(args: {
  event: Stripe.Event;
  leadId: string;
  amount: number | null;
  currency: string | null;
  customer: { name: string | null; email: string | null; phone: string | null };
  internalProduct: string | null;
  stripeProduct: string | null;
}) {
  const { event, leadId } = args;
  const obj = event.data.object as any;

  let kind: PaymentNotice["kind"] | null = null;
  if (event.type === "checkout.session.completed") kind = "ativacao";
  else if (event.type === "invoice.paid" && (obj?.subscription || obj?.parent?.subscription_details)) kind = "mensalidade";
  if (!kind) return;

  const notice: PaymentNotice = {
    kind,
    customerName: args.customer.name,
    customerEmail: args.customer.email,
    customerPhone: args.customer.phone,
    amount: args.amount,
    currency: args.currency,
    internalProduct: args.internalProduct,
    stripeProduct: args.stripeProduct,
    paidAt: new Date(event.created * 1000),
  };

  try {
    const seller = await resolveLeadSeller(supabase, leadId);
    await notifySellerOfPayment(supabase, leadId, notice);
    await notifyExecutivesOfPayment(supabase, leadId, notice, seller?.nome_completo ?? null);
  } catch (e) {
    console.error("[stripe-webhook] notification error:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    console.error("[stripe-webhook] unhandled error:", msg, (err as Error)?.stack);
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "stripe-webhook",
        severity: "error",
        error_type: "unhandled_exception",
        details: {
          message: msg.slice(0, 500),
          stack: ((err as Error)?.stack ?? "").slice(0, 2000),
          has_stripe_secret_key: Boolean(STRIPE_SECRET_KEY),
        },
      });
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});