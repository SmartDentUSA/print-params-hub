// deno-lint-ignore-file no-explicit-any
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil" as any,
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

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

async function resolveLead(phoneRaw: string | null, email: string | null): Promise<string | null> {
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
  if (email) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET, undefined, cryptoProvider);
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
  const leadId = await resolveLead(customer.phone, customer.email);

  if (!leadId) {
    await supabase
      .from("stripe_webhook_events")
      .update({ error: "lead_not_found" })
      .eq("event_id", event.id);
    return new Response(JSON.stringify({ ok: true, lead_not_found: true, phone: customer.phone, email: customer.email }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const obj = event.data.object as any;
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

  // Expand into stripe_payment_units (one row per dongle unit) on checkout.completed
  if (event.type === "checkout.session.completed") {
    // Build unit rows. Attempt to expand via listLineItems, but never let a
    // Stripe API error skip the insert — always fall back to a single unit
    // row so the RMS dashboard reflects the payment.
    let units: Array<{ product_name: string | null; unit_total: number | null }> = [];
    try {
      const sessionId = stripeObjectId;
      if (sessionId) {
        const li = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
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
        paid_at: new Date(event.created * 1000).toISOString(),
      }));
      const { error: unitsErr } = await supabase
        .from("stripe_payment_units")
        .upsert(rows, { onConflict: "stripe_checkout_id,unit_index", ignoreDuplicates: true });
      if (unitsErr) console.error("[stripe-webhook] payment_units upsert error:", unitsErr);
    } catch (e) {
      console.error("[stripe-webhook] payment_units insert error:", (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ ok: true, lead_id: leadId, event_type: mapping.event_type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});