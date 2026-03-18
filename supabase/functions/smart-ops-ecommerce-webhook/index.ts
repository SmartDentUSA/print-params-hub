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

// ─── Loja Integrada situação CÓDIGO → event type mapping ───
// Using `codigo` string instead of numeric ID (IDs can vary per store)
const SITUACAO_CODIGO_MAP: Record<string, string> = {
  // Codes without prefix (legacy/some stores)
  aguardando_pagamento: "order_created",
  pagamento_em_analise: "order_created",
  pagamento_devolvido: "order_cancelled",
  pago: "order_paid",
  pagamento_confirmado: "order_paid",
  pagamento_aprovado: "order_paid",
  em_producao: "order_paid",
  pronto_envio: "order_paid",
  enviado: "order_invoiced",
  entregue: "order_delivered",
  cancelado: "order_cancelled",
  devolvido: "order_cancelled",
  boleto_impresso: "boleto_generated",
  boleto_vencido: "boleto_expired",
  // Codes WITH "pedido_" prefix (actual LI webhook format)
  pedido_pago: "order_paid",
  pedido_em_separacao: "order_paid",
  pedido_em_producao: "order_paid",
  pronto_para_envio: "order_paid",
  pedido_enviado: "order_invoiced",
  pedido_entregue: "order_delivered",
  pedido_cancelado: "order_cancelled",
};

// Fallback: numeric ID mapping (less reliable but covers edge cases)
const SITUACAO_ID_MAP: Record<number, string> = {
  1: "order_created",
  2: "order_created",       // Aguardando pagamento
  3: "order_cancelled",
  4: "order_paid",
  5: "order_paid",
  6: "order_invoiced",
  7: "order_delivered",
  8: "order_cancelled",
  9: "order_paid",
  10: "boleto_expired",
};

// Event → EC tags
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
 * Unwrap the LI payload. LI can send:
 * 1. { data: { ...order }, origin: "loja_integrada", reque_code: "..." }
 * 2. { resource_uri: "/api/v1/pedido/123", situacao: {...} }
 * 3. A full order object directly
 */
function unwrapPayload(raw: Record<string, unknown>): Record<string, unknown> {
  // Case 1: wrapped in "data" key (most common from LI webhooks)
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data as Record<string, unknown>;
  }
  return raw;
}

/**
 * Resolve event type from situação object using codigo (preferred) or id (fallback)
 */
function resolveEventFromSituacao(situacao: Record<string, unknown>): {
  eventType: string;
  situacaoId: number | null;
} {
  const codigo = String(situacao.codigo || "").toLowerCase();
  const situacaoId = situacao.id ? Number(situacao.id) : null;

  // Prefer codigo-based mapping
  if (codigo && SITUACAO_CODIGO_MAP[codigo]) {
    return { eventType: SITUACAO_CODIGO_MAP[codigo], situacaoId };
  }

  // Fallback to numeric ID
  if (situacaoId !== null && SITUACAO_ID_MAP[situacaoId]) {
    return { eventType: SITUACAO_ID_MAP[situacaoId], situacaoId };
  }

  return { eventType: "order_created", situacaoId };
}

/**
 * Parse the incoming Loja Integrada webhook payload.
 */
function parseLojaIntegradaPayload(order: Record<string, unknown>): {
  eventType: string;
  resourceUri: string | null;
  situacaoId: number | null;
} {
  const resourceUri = (order.resource_uri as string) || null;
  const situacao = order.situacao as Record<string, unknown> | undefined;

  // If we have situação, resolve from it
  if (situacao && typeof situacao === "object") {
    const resolved = resolveEventFromSituacao(situacao);
    return { ...resolved, resourceUri };
  }

  // Explicit event type (manual trigger)
  if (order.event || order.tipo || order.type) {
    return {
      eventType: String(order.event || order.tipo || order.type),
      resourceUri,
      situacaoId: null,
    };
  }

  // Default: new order
  return { eventType: "order_created", resourceUri, situacaoId: null };
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
    const authParams = `chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey || '')}`;
    const separator = resourceUri.includes('?') ? '&' : '?';
    const url = `https://api.awsli.com.br${resourceUri}${separator}${authParams}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[ecommerce-webhook] Failed to fetch order from LI: ${res.status} ${errText.slice(0, 200)}`);
      return null;
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("[ecommerce-webhook] Invalid JSON from LI:", text.slice(0, 150));
      return null;
    }
  } catch (err) {
    console.error("[ecommerce-webhook] Error fetching LI order:", err);
    return null;
  }
}

/**
 * Fetch client data from LI when order only has a resource_uri string for cliente
 */
async function fetchClienteFromLI(
  clienteUri: string,
  apiKey: string,
  appKey: string | null
): Promise<Record<string, unknown> | null> {
  try {
    // Extract client ID from URI like /api/v1/cliente/12345/ or /cliente/12345
    const match = clienteUri.match(/\/cliente\/(\d+)/);
    if (!match) {
      console.warn(`[ecommerce-webhook] Could not extract client ID from URI: ${clienteUri}`);
      return null;
    }
    const clienteId = match[1];
    const authParams = `chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey || '')}`;
    const url = `https://api.awsli.com.br/api/v1/cliente/${clienteId}/?${authParams}`;

    console.log(`[ecommerce-webhook] Fetching client ${clienteId} from LI API...`);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[ecommerce-webhook] Failed to fetch client from LI: ${res.status} ${errText.slice(0, 200)}`);
      return null;
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("[ecommerce-webhook] Invalid JSON from LI client endpoint:", text.slice(0, 150));
      return null;
    }
  } catch (err) {
    console.error("[ecommerce-webhook] Error fetching LI client:", err);
    return null;
  }
}

// Situação codes considered as "paid/delivered"
const PAID_SITUACAO_CODIGOS = new Set([
  "pago", "pagamento_confirmado", "pagamento_aprovado",
  "em_producao", "pronto_envio", "enviado", "entregue",
  // Loja Integrada returns codes with "pedido_" prefix
  "pedido_pago", "pedido_enviado", "pedido_entregue",
  "pedido_em_producao", "pedido_em_separacao", "pronto_para_envio",
]);

/**
 * Fetch order history for a client from Loja Integrada API
 */
async function fetchClienteOrderHistory(
  clienteId: number,
  apiKey: string,
  appKey: string | null
): Promise<Array<Record<string, unknown>>> {
  try {
    const authParams = `chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey || '')}`;
    const url = `https://api.awsli.com.br/api/v1/pedido/?cliente_id=${clienteId}&limit=20&${authParams}`;

    console.log(`[ecommerce-webhook] Fetching order history for cliente ${clienteId}...`);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      console.warn(`[ecommerce-webhook] Order history fetch failed: ${res.status}`);
      return [];
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      const objects = data.objects || data.results || (Array.isArray(data) ? data : []);
      console.log(`[ecommerce-webhook] Found ${objects.length} orders for cliente ${clienteId}`);
      return objects;
    } catch {
      console.error("[ecommerce-webhook] Invalid JSON from order history:", text.slice(0, 150));
      return [];
    }
  } catch (err) {
    console.error("[ecommerce-webhook] Error fetching order history:", err);
    return [];
  }
}

// Map Loja Integrada situacao IDs to codigo strings
const SITUACAO_ID_TO_CODIGO: Record<number, string> = {
  1: "aguardando_pagamento",
  2: "pagamento_confirmado",
  3: "pago",
  4: "enviado",
  5: "entregue",
  6: "cancelado",
  7: "pagamento_devolvido",
  8: "aguardando_envio",
  9: "em_producao",
};

/** Resolve situacao field (URI string, object, or unknown) to a codigo string */
function resolveSituacaoCodigo(sit: unknown): string {
  if (!sit) return "";
  // URI string: "/api/v1/situacao/5/" → extract ID
  if (typeof sit === "string") {
    const match = sit.match(/\/situacao\/(\d+)/);
    if (match) {
      const id = Number(match[1]);
      return (SITUACAO_ID_TO_CODIGO[id] || "").toLowerCase();
    }
    return sit.toLowerCase();
  }
  // Object with codigo field
  if (typeof sit === "object" && sit !== null) {
    const obj = sit as Record<string, unknown>;
    return String(obj.codigo || obj.nome || "").toLowerCase();
  }
  return "";
}

/**
 * Enrich lead data with order history (LTV, recurrence, inactivity)
 */
function enrichWithOrderHistory(
  orders: Array<Record<string, unknown>>,
  tagsToAdd: string[]
): {
  ltv: number;
  totalPedidosPagos: number;
  dataPrimeiraCompra: string | null;
  dataUltimaCompra: string | null;
  historicoPedidos: Array<Record<string, unknown>>;
  extraUpdateData: Record<string, unknown>;
} {
  // Debug: log situacao format of first order
  if (orders.length > 0) {
    console.log(`[ecommerce-webhook] situacao format sample:`, JSON.stringify(orders[0].situacao));
  }

  // Filter paid/delivered orders using normalized situacao
  const paidOrders = orders.filter((o) => {
    const codigo = resolveSituacaoCodigo(o.situacao);
    return PAID_SITUACAO_CODIGOS.has(codigo);
  });

  const ltv = paidOrders.reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0);
  const totalPedidosPagos = paidOrders.length;

  // Sort by date
  const dates = paidOrders
    .map((o) => String(o.data_criacao || ""))
    .filter(Boolean)
    .sort();
  const dataPrimeiraCompra = dates[0] || null;
  const dataUltimaCompra = dates[dates.length - 1] || null;

  // Build full order list (append-only, dedup by numero)
  const allOrderSnapshots = orders.map((o) => {
    const codigo = resolveSituacaoCodigo(o.situacao);
    return {
      numero: o.numero || o.id,
      valor: Number(o.valor_total) || 0,
      status: codigo || "?",
      data: o.data_criacao || null,
    };
  });

  const extraUpdateData: Record<string, unknown> = {
    lojaintegrada_ltv: ltv != null ? ltv : null,
    lojaintegrada_total_pedidos_pagos: totalPedidosPagos != null ? totalPedidosPagos : null,
    // Append-only: will be merged with existing history in upsert logic
    lojaintegrada_historico_pedidos: allOrderSnapshots,
  };
  if (dataPrimeiraCompra) extraUpdateData.lojaintegrada_primeira_compra = dataPrimeiraCompra;

  if (totalPedidosPagos > 0) {
    tagsToAdd.push(ECOMMERCE_TAGS.EC_CLIENTE_RECORRENTE);
    extraUpdateData.status_oportunidade = "ganha";
    extraUpdateData.ativo_insumos = true;

    // Check inactivity (>12 months since last purchase)
    if (dataUltimaCompra) {
      const lastPurchase = new Date(dataUltimaCompra);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      if (lastPurchase < twelveMonthsAgo) {
        tagsToAdd.push(ECOMMERCE_TAGS.EC_CLIENTE_INATIVO);
      }
    }

    // Use LTV as valor_oportunidade if higher
    if (ltv > 0) {
      extraUpdateData.valor_oportunidade = ltv;
    }
  }

  return { ltv, totalPedidosPagos, dataPrimeiraCompra, dataUltimaCompra, historicoPedidos: allOrderSnapshots, extraUpdateData };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // === DEBUG: Log ALL incoming requests ===
  const rawBody = await req.text();
  const incomingHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => { incomingHeaders[k] = v; });
  console.log("[ecommerce-webhook] === INCOMING REQUEST ===");
  console.log("[ecommerce-webhook] Method:", req.method);
  console.log("[ecommerce-webhook] Headers:", JSON.stringify(incomingHeaders));
  console.log("[ecommerce-webhook] Raw body:", rawBody.slice(0, 2000));
  console.log("[ecommerce-webhook] === END REQUEST ===");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LI_API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY");
    const LI_APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    
    let rawPayload: Record<string, unknown>;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      console.error("[ecommerce-webhook] Failed to parse JSON body:", rawBody.slice(0, 500));
      return new Response(JSON.stringify({ error: "Invalid JSON body", raw: rawBody.slice(0, 200) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unwrap from "data" envelope if present
    let order = unwrapPayload(rawPayload);

    console.log("[ecommerce-webhook] Unwrapped order keys:", Object.keys(order).join(", "));

    // Parse event type from order data
    let { eventType, resourceUri, situacaoId } = parseLojaIntegradaPayload(order);

    console.log(`[ecommerce-webhook] Parsed: event=${eventType} situacao=${situacaoId} resourceUri=${resourceUri}`);

    // If we only got a resource_uri or minimal payload (no items), fetch full order from LI API
    const hasItems = Array.isArray(order.itens) && order.itens.length > 0 || Array.isArray(order.items) && order.items.length > 0;
    const needsFullFetch = !hasItems && LI_API_KEY;
    const orderResourceUri = resourceUri || order.resource_uri as string | undefined;

    if (needsFullFetch && orderResourceUri) {
      console.log("[ecommerce-webhook] Order missing items, fetching full order from LI API...");
      const fullOrder = await fetchOrderFromLI(orderResourceUri, LI_API_KEY, LI_APP_KEY || null);
      if (fullOrder) {
        // Merge full order data but keep existing cliente if already resolved
        const existingCliente = order.cliente;
        order = { ...order, ...fullOrder };
        if (existingCliente && !fullOrder.cliente) order.cliente = existingCliente;
        // Re-check situação from full order
        if (fullOrder.situacao && typeof fullOrder.situacao === "object") {
          const resolved = resolveEventFromSituacao(fullOrder.situacao as Record<string, unknown>);
          eventType = resolved.eventType;
          situacaoId = resolved.situacaoId;
        }
        console.log(`[ecommerce-webhook] Full order fetched: itens=${(fullOrder.itens || []).length} items`);
      }
    } else if (needsFullFetch && !orderResourceUri && order.numero) {
      // Build resource URI from order number
      const builtUri = `/api/v1/pedido/${order.numero}/`;
      console.log(`[ecommerce-webhook] Building resource URI from numero: ${builtUri}`);
      const fullOrder = await fetchOrderFromLI(builtUri, LI_API_KEY, LI_APP_KEY || null);
      if (fullOrder) {
        const existingCliente = order.cliente;
        order = { ...order, ...fullOrder };
        if (existingCliente && !fullOrder.cliente) order.cliente = existingCliente;
        if (fullOrder.situacao && typeof fullOrder.situacao === "object") {
          const resolved = resolveEventFromSituacao(fullOrder.situacao as Record<string, unknown>);
          eventType = resolved.eventType;
          situacaoId = resolved.situacaoId;
        }
        console.log(`[ecommerce-webhook] Full order fetched via numero: itens=${(fullOrder.itens || []).length} items`);
      }
    }

    // ─── Extract customer data ───
    let customer = (typeof order.cliente === "object" && order.cliente !== null
      ? order.cliente
      : (order.customer || {})) as Record<string, unknown>;

    // If cliente is a resource_uri string, resolve via API
    if (typeof order.cliente === "string" && /\/cliente\//.test(order.cliente) && LI_API_KEY) {
      const inlineEmail = String(customer.email || order.email || "").trim();
      if (!inlineEmail) {
        console.log(`[ecommerce-webhook] cliente is URI string: ${order.cliente} — resolving via API...`);
        const resolvedCliente = await fetchClienteFromLI(order.cliente, LI_API_KEY, LI_APP_KEY || null);
        if (resolvedCliente) {
          // Merge resolved client data into customer object
          customer = { ...customer, ...resolvedCliente };
          console.log(`[ecommerce-webhook] Client resolved: email=${resolvedCliente.email || "?"} nome=${resolvedCliente.nome || "?"}`);
        } else {
          console.warn(`[ecommerce-webhook] Could not resolve client from URI: ${order.cliente}`);
        }
      }
    }

    const nome = String(customer.nome || customer.name || order.nome || "Lead E-commerce");
    const email = String(customer.email || order.email || "").trim().toLowerCase();

    // Prefer celular over principal (principal is often null/landline)
    const phoneRaw = String(
      customer.telefone_celular || customer.telefone_principal ||
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

    // ─── Extract address data from endereco_entrega ───
    const endereco = (order.endereco_entrega || {}) as Record<string, unknown>;
    const cidade = String(endereco.cidade || customer.cidade || "") || null;
    const uf = String(endereco.estado || customer.estado || "") || null;

    // ─── Extract CPF/CNPJ ───
    const cpf = String(customer.cpf || endereco.cpf || "") || null;
    const cnpj = String(customer.cnpj || endereco.cnpj || "") || null;
    const razaoSocial = String(customer.razao_social || "") || null;

    // ─── Extract Loja Integrada-specific fields ───
    const liClienteId = customer.id ? Number(customer.id) : null;
    const liClienteObs = order.cliente_obs ? String(order.cliente_obs) : null;
    const liCupomDesconto = order.cupom_desconto ? String(order.cupom_desconto) : null;
    const liDataNascimento = customer.data_nascimento ? String(customer.data_nascimento) : null;
    const liSexo = customer.sexo ? String(customer.sexo) : null;
    const liEndereco = endereco.endereco ? String(endereco.endereco) : null;
    const liNumero = endereco.numero ? String(endereco.numero) : null;
    const liComplemento = endereco.complemento ? String(endereco.complemento) : null;
    const liBairro = endereco.bairro ? String(endereco.bairro) : null;
    const liCep = endereco.cep ? String(endereco.cep) : null;
    const liReferencia = endereco.referencia ? String(endereco.referencia) : null;
    const liPedidoNumero = order.numero ? Number(order.numero) : null;
    const liPedidoData = order.data_criacao ? String(order.data_criacao) : null;
    const liPedidoValor = Number(order.valor_total || 0) || null;
    const situacaoObj = order.situacao as Record<string, unknown> | undefined;
    const liPedidoStatus = situacaoObj?.nome ? String(situacaoObj.nome) : null;
    const liUtmCampaign = order.utm_campaign ? String(order.utm_campaign) : null;

    // Extract forma_pagamento from first payment
    const pagamentos = (order.pagamentos || []) as Array<Record<string, unknown>>;
    let liFormaPagamento: string | null = null;
    if (pagamentos.length > 0) {
      const fp = pagamentos[0].forma_pagamento as Record<string, unknown> | undefined;
      liFormaPagamento = fp?.nome ? String(fp.nome) : (pagamentos[0].pagamento_tipo ? String(pagamentos[0].pagamento_tipo) : null);
    }

    // Extract forma_envio from first shipment
    const envios = (order.envios || []) as Array<Record<string, unknown>>;
    let liFormaEnvio: string | null = null;
    if (envios.length > 0) {
      const fe = envios[0].forma_envio as Record<string, unknown> | undefined;
      liFormaEnvio = fe?.nome ? String(fe.nome) : null;
    }

    // ─── Determine tags from event ───
    const eventConfig = EVENT_MAP[eventType] || { tags: [ECOMMERCE_TAGS.EC_INICIOU_CHECKOUT] };
    const tagsToAdd = [...eventConfig.tags];

    // Extract product tags from items
    const items = (order.itens || order.items || []) as Array<Record<string, unknown>>;
    const productNames: string[] = [];
    for (const item of items) {
      const productName = String(item.nome || item.name || "");
      if (productName) {
        productNames.push(productName);
        tagsToAdd.push(...detectProductTags(productName));
      }
    }

    // ─── Extract order value ───
    const valorTotal = Number(order.valor_total || order.total || 0) || null;
    const numeroPedido = order.numero || order.id || null;

    console.log(`[ecommerce-webhook] Customer: ${nome} <${email}> | phone=${phoneRaw} | cidade=${cidade}/${uf} | cpf=${cpf} | valor=${valorTotal} | pedido=${numeroPedido} | produtos=${productNames.join("; ")}`);

    // ─── Deduplication check ───
    if (numeroPedido) {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: dupeCheck } = await supabase
          .from("message_logs")
          .select("id")
          .eq("tipo", `ecommerce_${eventType}`)
          .ilike("mensagem_preview", `%pedido=${numeroPedido}%`)
          .gte("created_at", thirtyDaysAgo)
          .limit(1);
        if (dupeCheck && dupeCheck.length > 0) {
          console.log(`[ecommerce-webhook] Duplicate detected: pedido=${numeroPedido} event=${eventType}, skipping`);
          return new Response(JSON.stringify({ skipped: true, reason: "duplicate", pedido: numeroPedido }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.warn("[ecommerce-webhook] Dedupe check failed, proceeding:", e);
      }
    }

    // ─── Enrich with order history if we have a client ID ───
    let enrichmentData: Record<string, unknown> = {};
    if (liClienteId && LI_API_KEY) {
      const orderHistory = await fetchClienteOrderHistory(liClienteId, LI_API_KEY, LI_APP_KEY || null);
      if (orderHistory.length > 0) {
        const enrichment = enrichWithOrderHistory(orderHistory, tagsToAdd);
        enrichmentData = enrichment.extraUpdateData;
        console.log(`[ecommerce-webhook] Enrichment: LTV=${enrichment.ltv} | pedidosPagos=${enrichment.totalPedidosPagos} | primeiraCompra=${enrichment.dataPrimeiraCompra} | ultimaCompra=${enrichment.dataUltimaCompra}`);
      }
    }

    // ─── Upsert lead in lia_attendances ───
    const { data: existingLead } = await supabase
      .from("lia_attendances")
      .select("id, tags_crm, lead_status, telefone_normalized, pessoa_cpf, lojaintegrada_historico_pedidos")
      .eq("email", email)
      .single();

    let leadId: string;

    if (existingLead) {
      const newTags = mergeTagsCrm(existingLead.tags_crm, tagsToAdd);

      // ─── Merge historico_pedidos incrementally (append + dedup by numero) ───
      if (enrichmentData.lojaintegrada_historico_pedidos && Array.isArray(enrichmentData.lojaintegrada_historico_pedidos)) {
        const existingHistory = Array.isArray(existingLead.lojaintegrada_historico_pedidos) 
          ? existingLead.lojaintegrada_historico_pedidos as Array<Record<string, unknown>>
          : [];
        const newHistory = enrichmentData.lojaintegrada_historico_pedidos as Array<Record<string, unknown>>;
        const seen = new Set(existingHistory.map((h) => String(h.numero)));
        const merged = [...existingHistory];
        for (const h of newHistory) {
          if (!seen.has(String(h.numero))) {
            merged.push(h);
            seen.add(String(h.numero));
          } else {
            // Update existing entry with latest status
            const idx = merged.findIndex((m) => String(m.numero) === String(h.numero));
            if (idx !== -1) merged[idx] = h;
          }
        }
        enrichmentData.lojaintegrada_historico_pedidos = merged;
      }

      const updateData: Record<string, unknown> = { tags_crm: newTags, ...enrichmentData };

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

      // Fill CPF if not already set
      if (cpf && !existingLead.pessoa_cpf) {
        updateData.pessoa_cpf = cpf;
      }

      // Fill cidade/uf if available
      if (cidade) updateData.cidade = cidade;
      if (uf) updateData.uf = uf;

      // Fill empresa fields from CNPJ
      if (cnpj) updateData.empresa_cnpj = cnpj;
      if (razaoSocial) updateData.empresa_razao_social = razaoSocial;

      // ─── Loja Integrada specific fields (always overwrite with latest) ───
      if (liClienteId) updateData.lojaintegrada_cliente_id = liClienteId;
      if (liClienteObs) updateData.lojaintegrada_cliente_obs = liClienteObs;
      if (liCupomDesconto) updateData.lojaintegrada_cupom_desconto = liCupomDesconto;
      if (liDataNascimento) updateData.lojaintegrada_data_nascimento = liDataNascimento;
      if (liSexo) updateData.lojaintegrada_sexo = liSexo;
      if (liEndereco) updateData.lojaintegrada_endereco = liEndereco;
      if (liNumero) updateData.lojaintegrada_numero = liNumero;
      if (liComplemento) updateData.lojaintegrada_complemento = liComplemento;
      if (liBairro) updateData.lojaintegrada_bairro = liBairro;
      if (liCep) updateData.lojaintegrada_cep = liCep;
      if (liReferencia) updateData.lojaintegrada_referencia = liReferencia;
      if (liPedidoNumero) updateData.lojaintegrada_ultimo_pedido_numero = liPedidoNumero;
      if (liPedidoData) updateData.lojaintegrada_ultimo_pedido_data = liPedidoData;
      if (liPedidoValor) updateData.lojaintegrada_ultimo_pedido_valor = liPedidoValor;
      if (liPedidoStatus) updateData.lojaintegrada_ultimo_pedido_status = liPedidoStatus;
      if (liFormaPagamento) updateData.lojaintegrada_forma_pagamento = liFormaPagamento;
      if (liFormaEnvio) updateData.lojaintegrada_forma_envio = liFormaEnvio;
      if (items.length > 0) updateData.lojaintegrada_itens_json = items;
      if (liUtmCampaign) updateData.lojaintegrada_utm_campaign = liUtmCampaign;
      updateData.lojaintegrada_updated_at = new Date().toISOString();

      await supabase.from("lia_attendances").update(updateData).eq("id", existingLead.id);
      leadId = existingLead.id;
      console.log(`[ecommerce-webhook] Lead ATUALIZADO: ${leadId} | event=${eventType} | pedido=${numeroPedido} | +tags=${tagsToAdd.join(",")}`);
    } else {
      // Create new lead
      const insertData: Record<string, unknown> = {
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
        ...enrichmentData,
      };

      if (cpf) insertData.pessoa_cpf = cpf;
      if (cnpj) insertData.empresa_cnpj = cnpj;
      if (razaoSocial) insertData.empresa_razao_social = razaoSocial;

      // Store product interest from first item
      if (productNames.length > 0) {
        insertData.produto_interesse = productNames.join(", ").slice(0, 200);
      }

      // ─── Loja Integrada specific fields ───
      if (liClienteId) insertData.lojaintegrada_cliente_id = liClienteId;
      if (liClienteObs) insertData.lojaintegrada_cliente_obs = liClienteObs;
      if (liCupomDesconto) insertData.lojaintegrada_cupom_desconto = liCupomDesconto;
      if (liDataNascimento) insertData.lojaintegrada_data_nascimento = liDataNascimento;
      if (liSexo) insertData.lojaintegrada_sexo = liSexo;
      if (liEndereco) insertData.lojaintegrada_endereco = liEndereco;
      if (liNumero) insertData.lojaintegrada_numero = liNumero;
      if (liComplemento) insertData.lojaintegrada_complemento = liComplemento;
      if (liBairro) insertData.lojaintegrada_bairro = liBairro;
      if (liCep) insertData.lojaintegrada_cep = liCep;
      if (liReferencia) insertData.lojaintegrada_referencia = liReferencia;
      if (liPedidoNumero) insertData.lojaintegrada_ultimo_pedido_numero = liPedidoNumero;
      if (liPedidoData) insertData.lojaintegrada_ultimo_pedido_data = liPedidoData;
      if (liPedidoValor) insertData.lojaintegrada_ultimo_pedido_valor = liPedidoValor;
      if (liPedidoStatus) insertData.lojaintegrada_ultimo_pedido_status = liPedidoStatus;
      if (liFormaPagamento) insertData.lojaintegrada_forma_pagamento = liFormaPagamento;
      if (liFormaEnvio) insertData.lojaintegrada_forma_envio = liFormaEnvio;
      if (items.length > 0) insertData.lojaintegrada_itens_json = items;
      if (liUtmCampaign) insertData.lojaintegrada_utm_campaign = liUtmCampaign;
      insertData.lojaintegrada_updated_at = new Date().toISOString();

      const { data: newLead, error: insertError } = await supabase
        .from("lia_attendances")
        .insert(insertData)
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

    // ─── Record timeline event in lead_activity_log (append-only, with dedup) ───
    const orderDate = liPedidoData || new Date().toISOString();
    const activityEntityId = numeroPedido ? String(numeroPedido) : null;
    let skipActivityInsert = false;
    if (activityEntityId) {
      const { data: existingActivity } = await supabase
        .from("lead_activity_log")
        .select("id")
        .eq("lead_id", leadId)
        .eq("event_type", `ecommerce_${eventType}`)
        .eq("entity_id", activityEntityId)
        .limit(1);
      if (existingActivity && existingActivity.length > 0) {
        skipActivityInsert = true;
        console.log(`[ecommerce-webhook] activity_log dedup: skipping ${eventType} pedido=${numeroPedido} for lead ${leadId}`);
      }
    }
    if (!skipActivityInsert) {
      await supabase.from("lead_activity_log").insert({
        lead_id: leadId,
        event_type: `ecommerce_${eventType}`,
        entity_type: "order",
        entity_id: activityEntityId,
        entity_name: productNames.length > 0 ? productNames.join(", ").slice(0, 200) : null,
        event_data: {
          pedido: numeroPedido,
          valor: valorTotal,
          status: liPedidoStatus,
          produtos: productNames,
          tags_added: tagsToAdd,
          fonte: "loja_integrada",
        },
        source_channel: "ecommerce",
        value_numeric: valorTotal,
        event_timestamp: orderDate,
      }).then(({ error }) => {
        if (error) console.warn("[ecommerce-webhook] timeline insert error:", error.message);
      });
    }

    // ─── Populate lead_product_history for each item ───
    if (items.length > 0) {
      const isPaid = ["order_paid", "order_invoiced", "order_delivered"].includes(eventType);
      const isCarted = eventType === "order_created";
      const now = new Date().toISOString();

      for (const item of items) {
        const productId = String(item.id || item.sku || item.nome || "unknown");
        const productName = String(item.nome || item.name || "Produto");
        const qty = Number(item.quantidade || item.quantity || 1);
        const unitPrice = Number(item.preco_venda || item.preco_custo || item.price || 0);
        const totalPrice = unitPrice * qty;

        // Check if entry already exists for this lead+product
        const { data: existingPH } = await supabase
          .from("lead_product_history")
          .select("id, purchase_count, total_purchased_qty, total_purchased_value, cart_count")
          .eq("lead_id", leadId)
          .eq("product_id", productId)
          .maybeSingle();

        if (existingPH) {
          const updatePH: Record<string, unknown> = {
            last_interaction_type: isPaid ? "purchase" : (isCarted ? "cart" : eventType),
            last_interaction_at: now,
            updated_at: now,
          };
          if (isPaid) {
            updatePH.purchased_at = now;
            updatePH.purchase_count = (existingPH.purchase_count || 0) + 1;
            updatePH.total_purchased_qty = (existingPH.total_purchased_qty || 0) + qty;
            updatePH.total_purchased_value = (existingPH.total_purchased_value || 0) + totalPrice;
          }
          if (isCarted) {
            updatePH.added_to_cart_at = now;
            updatePH.cart_count = (existingPH.cart_count || 0) + 1;
          }
          await supabase.from("lead_product_history").update(updatePH).eq("id", existingPH.id);
        } else {
          await supabase.from("lead_product_history").insert({
            lead_id: leadId,
            product_id: productId,
            product_name: productName,
            first_viewed_at: now,
            last_viewed_at: now,
            view_count: 1,
            added_to_cart_at: isCarted ? now : null,
            cart_count: isCarted ? 1 : 0,
            purchased_at: isPaid ? now : null,
            purchase_count: isPaid ? 1 : 0,
            total_purchased_qty: isPaid ? qty : 0,
            total_purchased_value: isPaid ? totalPrice : 0,
            last_interaction_type: isPaid ? "purchase" : (isCarted ? "cart" : eventType),
            last_interaction_at: now,
          });
        }
      }
      console.log(`[ecommerce-webhook] lead_product_history: ${items.length} items upserted for lead ${leadId}`);
    }

    // ─── Populate lead_cart_history for unpaid orders ───
    const cartStatuses = ["order_created", "boleto_generated", "boleto_expired"];
    if (cartStatuses.includes(eventType) && numeroPedido && items.length > 0) {
      const cartItems = items.map((item) => ({
        name: String(item.nome || item.name || ""),
        qty: Number(item.quantidade || item.quantity || 1),
        price: Number(item.preco_venda || item.price || 0),
      }));

      await supabase.from("lead_cart_history").upsert({
        lead_id: leadId,
        cart_id: String(numeroPedido),
        items: cartItems,
        total_value: valorTotal || 0,
        created_at: liPedidoData || new Date().toISOString(),
        status: eventType === "boleto_expired" ? "abandoned" : "active",
        abandoned_at: eventType === "boleto_expired" ? (liPedidoData || new Date().toISOString()) : null,
        abandoned_reason: eventType === "boleto_expired" ? "boleto_vencido" : null,
      }, { onConflict: "cart_id" }).then(({ error: cartErr }) => {
        if (cartErr) console.warn("[ecommerce-webhook] cart_history upsert error:", cartErr.message);
        else console.log(`[ecommerce-webhook] lead_cart_history: pedido=${numeroPedido} status=${eventType}`);
      });
    }

    // ─── Convert cart to "converted" when paid ───
    if (["order_paid", "order_invoiced", "order_delivered"].includes(eventType) && numeroPedido) {
      await supabase.from("lead_cart_history")
        .update({ status: "converted", converted_at: new Date().toISOString() })
        .eq("lead_id", leadId)
        .eq("cart_id", String(numeroPedido))
        .then(({ error: convErr }) => {
          if (convErr) console.warn("[ecommerce-webhook] cart conversion update error:", convErr.message);
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId,
        event: eventType,
        situacao_id: situacaoId,
        pedido: numeroPedido,
        tags_added: tagsToAdd,
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
