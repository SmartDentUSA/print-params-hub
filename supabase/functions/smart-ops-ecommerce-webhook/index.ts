import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mergeTagsCrm,
  detectProductTags,
  ECOMMERCE_TAGS,
  JOURNEY_TAGS,
} from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Loja Integrada situação ID → event type mapping ───
// These are the standard status IDs from the Loja Integrada API
const SITUACAO_MAP: Record<number, string> = {
  1: "order_created",          // Aguardando pagamento
  2: "boleto_generated",       // Em produção / Boleto gerado
  3: "order_cancelled",        // Cancelado
  4: "order_paid",             // Pago / Aprovado
  5: "order_paid",             // Pagamento em análise → treat as paid
  6: "order_invoiced",         // Enviado
  7: "order_delivered",        // Entregue
  8: "order_cancelled",        // Devolvido
  9: "order_paid",             // Pagamento confirmado
  10: "boleto_expired",        // Boleto vencido
};

// Event → EC tags + SellFlux campaign template
const EVENT_MAP: Record<string, { tags: string[] }> = {
  order_created: {
    tags: [ECOMMERCE_TAGS.EC_INICIOU_CHECKOUT],
  },
  order_paid: {
    tags: [ECOMMERCE_TAGS.EC_PAGAMENTO_APROVADO, JOURNEY_TAGS.J04_COMPRA],
  },
  order_cancelled: {
    tags: [ECOMMERCE_TAGS.EC_PEDIDO_CANCELADO],
  },
  order_invoiced: {
    tags: [ECOMMERCE_TAGS.EC_PEDIDO_ENVIADO],
  },
  order_delivered: {
    tags: [ECOMMERCE_TAGS.EC_PEDIDO_ENTREGUE],
  },
  boleto_generated: {
    tags: [ECOMMERCE_TAGS.EC_GEROU_BOLETO],
  },
  boleto_expired: {
    tags: [ECOMMERCE_TAGS.EC_BOLETO_VENCIDO],
  },
  cart_abandoned: {
    tags: [ECOMMERCE_TAGS.EC_ABANDONOU_CARRINHO],
  },
};

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = "55" + digits;
  if (digits.length >= 12 && digits.length <= 13) return "+" + digits;
  return null;
}

/**
 * Parse the incoming Loja Integrada webhook payload.
 * LI sends different formats depending on the event:
 * - pedido_criado: { "resource_uri": "/api/v1/pedido/123", ... }
 * - pedido_atualizado: { "resource_uri": "/api/v1/pedido/123", "situacao": { "id": 4, ... } }
 * - Or a full order object with cliente, itens, etc.
 */
function parseLojaIntegradaPayload(payload: Record<string, unknown>): {
  eventType: string;
  order: Record<string, unknown>;
  resourceUri: string | null;
  situacaoId: number | null;
} {
  // Check if this is a LI webhook with resource_uri
  const resourceUri = (payload.resource_uri as string) || null;

  // Determine situação (status)
  const situacao = payload.situacao as Record<string, unknown> | undefined;
  const situacaoId = situacao?.id
    ? Number(situacao.id)
    : (payload.situacao_id ? Number(payload.situacao_id) : null);

  // Determine event type
  let eventType: string;
  if (payload.event || payload.tipo || payload.type) {
    // Explicit event type (legacy format or manual trigger)
    eventType = String(payload.event || payload.tipo || payload.type);
  } else if (situacaoId !== null && SITUACAO_MAP[situacaoId]) {
    // Map from LI situação ID
    eventType = SITUACAO_MAP[situacaoId];
  } else if (resourceUri?.includes("/pedido/") && !situacao) {
    // pedido_criado webhook (no situacao = newly created)
    eventType = "order_created";
  } else {
    eventType = "order_created";
  }

  // The order data might be the payload itself or nested
  const order = (payload.order || payload.pedido || payload) as Record<string, unknown>;

  return { eventType, order, resourceUri, situacaoId };
}

/**
 * If we only got a resource_uri, fetch full order data from LI API
 */
async function fetchOrderFromLI(
  resourceUri: string,
  apiKey: string,
  appKey: string | null
): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://api.awsli.com.br${resourceUri}`;
    const authHeader = appKey
      ? `chave_api ${apiKey} aplicacao ${appKey}`
      : `chave_api ${apiKey}`;

    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`[ecommerce-webhook] Failed to fetch order from LI: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("[ecommerce-webhook] Error fetching LI order:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // === DEBUG: Log ALL incoming requests (headers + raw body) ===
  const rawBody = await req.text();
  const incomingHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => { incomingHeaders[k] = v; });
  console.log("[ecommerce-webhook] === INCOMING REQUEST ===");
  console.log("[ecommerce-webhook] Method:", req.method);
  console.log("[ecommerce-webhook] Headers:", JSON.stringify(incomingHeaders));
  console.log("[ecommerce-webhook] Raw body:", rawBody.slice(0, 1500));
  console.log("[ecommerce-webhook] === END REQUEST ===");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LI_API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY");
    const LI_APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    
    // Parse from already-read body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[ecommerce-webhook] Failed to parse JSON body:", rawBody.slice(0, 500));
      return new Response(JSON.stringify({ error: "Invalid JSON body", raw: rawBody.slice(0, 200) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ecommerce-webhook] Payload:", JSON.stringify(payload).slice(0, 800));

    // Parse the LI webhook payload
    let { eventType, order, resourceUri, situacaoId } = parseLojaIntegradaPayload(payload);

    console.log(`[ecommerce-webhook] Parsed: event=${eventType} situacao=${situacaoId} resourceUri=${resourceUri}`);

    // If we only got a resource_uri (minimal webhook), fetch full order from LI API
    if (resourceUri && !order.cliente && !order.customer && LI_API_KEY) {
      console.log("[ecommerce-webhook] Fetching full order from LI API...");
      const fullOrder = await fetchOrderFromLI(resourceUri, LI_API_KEY, LI_APP_KEY || null);
      if (fullOrder) {
        order = fullOrder;
        // Re-check situação from full order
        if (!situacaoId && fullOrder.situacao) {
          const sit = fullOrder.situacao as Record<string, unknown>;
          situacaoId = Number(sit.id || 0);
          if (situacaoId && SITUACAO_MAP[situacaoId]) {
            eventType = SITUACAO_MAP[situacaoId];
          }
        }
      }
    }

    // Extract customer data (LI format: cliente.nome, cliente.email, etc.)
    const customer = (order.cliente || order.customer || order.contact || {}) as Record<string, unknown>;
    const nome = String(customer.nome || customer.name || order.nome || "Lead E-commerce");
    const email = String(customer.email || order.email || "").trim().toLowerCase();
    const phoneRaw = String(
      customer.telefone_principal || customer.telefone_celular ||
      customer.phone || customer.telefone || order.telefone || ""
    ) || null;
    const phoneNormalized = normalizePhone(phoneRaw);

    if (!email) {
      console.warn("[ecommerce-webhook] Pedido sem email, ignorando");
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine tags from event
    const eventConfig = EVENT_MAP[eventType] || { tags: [ECOMMERCE_TAGS.EC_INICIOU_CHECKOUT] };
    const tagsToAdd = [...eventConfig.tags];

    // Extract product tags from items
    const items = (order.itens || order.items || order.produtos || []) as Array<Record<string, unknown>>;
    for (const item of items) {
      const productName = String(item.nome || item.name || item.produto || item.produto_nome || "");
      if (productName) {
        tagsToAdd.push(...detectProductTags(productName));
      }
    }

    // Extract order value
    const valorTotal = Number(
      order.valor_total || order.total || order.valor || 0
    ) || null;
    const numeroPedido = order.numero || order.id || order.order_id || null;

    // Check if lead exists
    const { data: existingLead } = await supabase
      .from("lia_attendances")
      .select("id, tags_crm, lead_status, telefone_normalized")
      .eq("email", email)
      .single();

    let leadId: string;

    if (existingLead) {
      const newTags = mergeTagsCrm(existingLead.tags_crm, tagsToAdd);
      const updateData: Record<string, unknown> = { tags_crm: newTags };

      if (eventType === "order_paid") {
        updateData.status_oportunidade = "ganha";
        updateData.ativo_insumos = true;
      }

      if (phoneNormalized && !existingLead.telefone_normalized) {
        updateData.telefone_normalized = phoneNormalized;
        if (phoneRaw) updateData.telefone_raw = phoneRaw;
      }

      if (valorTotal) {
        updateData.valor_oportunidade = valorTotal;
      }

      await supabase.from("lia_attendances").update(updateData).eq("id", existingLead.id);
      leadId = existingLead.id;
      console.log(`[ecommerce-webhook] Lead ATUALIZADO: ${leadId} | event=${eventType} | pedido=${numeroPedido} | +tags=${tagsToAdd.join(",")}`);
    } else {
      // Create new lead
      const cidade = String(customer.cidade || customer.city || "") || null;
      const uf = String(customer.estado || customer.state || "") || null;

      const { data: newLead, error: insertError } = await supabase
        .from("lia_attendances")
        .insert({
          nome,
          email,
          telefone_raw: phoneRaw,
          telefone_normalized: phoneNormalized,
          source: "loja_integrada",
          lead_status: eventType === "order_paid" ? "contato_feito" : "novo",
          tags_crm: [...new Set(tagsToAdd)].sort(),
          cidade,
          uf,
          status_oportunidade: eventType === "order_paid" ? "ganha" : "aberta",
          ativo_insumos: eventType === "order_paid",
          valor_oportunidade: valorTotal,
        })
        .select("id")
        .single();

      if (insertError || !newLead) {
        console.error("[ecommerce-webhook] Erro ao criar lead:", insertError);
        return new Response(JSON.stringify({ error: insertError?.message || "Erro ao criar lead" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      leadId = newLead.id;
      console.log(`[ecommerce-webhook] Lead CRIADO: ${leadId} | email=${email} | event=${eventType} | pedido=${numeroPedido}`);
    }

    // Log the event
    await supabase.from("message_logs").insert({
      lead_id: leadId,
      tipo: `ecommerce_${eventType}`,
      mensagem_preview: `[E-commerce] ${eventType}: ${nome} (${email}) pedido=${numeroPedido || "?"}`.slice(0, 200),
      status: "recebido",
    });

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId,
        event: eventType,
        situacao_id: situacaoId,
        pedido: numeroPedido,
        tags_added: tagsToAdd,
        message_status: messageStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[ecommerce-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
