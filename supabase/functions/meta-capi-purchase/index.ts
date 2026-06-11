/**
 * meta-capi-purchase
 * Sends a server-side Purchase event to Meta Conversions API when a PipeRun
 * deal is marked as 'ganha' (won). Called by DB trigger fn_trigger_meta_capi_purchase.
 *
 * Required env vars:
 *   META_LEAD_ADS_TOKEN  — System User token with ads_management scope
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIXEL_ID   = "167413567155597";
const GRAPH_URL  = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

// ── helpers ──────────────────────────────────────────────────────────────────

async function sha256hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw.toLowerCase().trim());
  const buf   = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ── main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  const META_TOKEN = Deno.env.get("META_LEAD_ADS_TOKEN");
  if (!META_TOKEN) {
    console.error("[meta-capi] META_LEAD_ADS_TOKEN not configured");
    return json({ error: "META_LEAD_ADS_TOKEN not set" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let deal_id: string;
  try {
    ({ deal_id } = await req.json());
    if (!deal_id) throw new Error("missing deal_id");
  } catch {
    return json({ error: "deal_id required" }, 400);
  }

  // ── fetch deal ───────────────────────────────────────────────────────────

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, piperun_deal_id, value, product, product_category, closed_at, person_id, pipeline_name, origin_name, piperun_origin_name")
    .eq("id", deal_id)
    .single();

  if (dealErr || !deal) {
    console.error("[meta-capi] Deal not found:", deal_id, dealErr);
    return json({ error: "deal not found" }, 404);
  }

  // ── dedup check ──────────────────────────────────────────────────────────

  const { data: existing } = await supabase
    .from("meta_capi_event_log")
    .select("id")
    .eq("deal_id", deal_id)
    .eq("event_name", "Purchase")
    .limit(1);

  if (existing && existing.length > 0) {
    console.log("[meta-capi] Already sent for deal:", deal_id);
    return json({ skipped: true, reason: "already_sent" }, 200);
  }

  // ── fetch person for user_data ───────────────────────────────────────────

  const user_data: Record<string, string | string[]> = {};

  if (deal.person_id) {
    const { data: person } = await supabase
      .from("people")
      .select("email, telefone_normalized, nome")
      .eq("id", deal.person_id)
      .single();

    if (person?.email) {
      user_data.em = [await sha256hex(person.email)];
    }
    if (person?.telefone_normalized) {
      const phone = digitsOnly(person.telefone_normalized);
      if (phone.length >= 10) {
        user_data.ph = [await sha256hex(phone)];
      }
    }
    if (person?.nome) {
      const parts = person.nome.trim().split(/\s+/);
      if (parts[0]) user_data.fn = [await sha256hex(parts[0])];
      if (parts.length > 1) user_data.ln = [await sha256hex(parts[parts.length - 1])];
    }
  }

  // ── build CAPI event ─────────────────────────────────────────────────────

  const event_time = deal.closed_at
    ? Math.floor(new Date(deal.closed_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const value = parseFloat(deal.value ?? "0") || 0;

  const custom_data: Record<string, unknown> = {
    value,
    currency: "BRL",
    order_id: deal.piperun_deal_id,
    content_type: "product",
  };

  if (deal.product) {
    custom_data.content_name = deal.product;
    custom_data.contents = [
      { id: deal.product, quantity: 1, item_price: value },
    ];
  }
  if (deal.product_category) {
    custom_data.content_category = deal.product_category;
  }

  const capiEvent = {
    event_name:    "Purchase",
    event_time,
    event_id:      `piperun_${deal.piperun_deal_id}`,
    action_source: "physical_store",
    user_data,
    custom_data,
  };

  // ── send to Meta ─────────────────────────────────────────────────────────

  console.log("[meta-capi] Sending Purchase for deal", deal.piperun_deal_id, "value:", value);

  const metaResp = await fetch(`${GRAPH_URL}?access_token=${META_TOKEN}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ data: [capiEvent] }),
  });

  const metaResult = await metaResp.json();
  console.log("[meta-capi] Meta response:", JSON.stringify(metaResult));

  // ── log ──────────────────────────────────────────────────────────────────

  await supabase.from("meta_capi_event_log").insert({
    deal_id,
    piperun_deal_id: deal.piperun_deal_id,
    event_name:      "Purchase",
    event_time:      new Date(event_time * 1000).toISOString(),
    event_id:        capiEvent.event_id,
    value,
    currency:        "BRL",
    meta_response:   metaResult,
    success:         metaResp.ok,
  });

  return json({ ok: metaResp.ok, events_received: metaResult?.events_received, result: metaResult },
    metaResp.ok ? 200 : 500);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
