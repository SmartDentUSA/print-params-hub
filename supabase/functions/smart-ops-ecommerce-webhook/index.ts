import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mergeTagsCrm,
  detectProductTags,
  sendViaSellFlux,
  ECOMMERCE_TAGS,
  JOURNEY_TAGS,
} from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Loja Integrada event → EC tags + SellFlux template
const EVENT_MAP: Record<string, { tags: string[]; template?: string }> = {
  "order_created": {
    tags: [ECOMMERCE_TAGS.EC_INICIOU_CHECKOUT],
    template: "EC_CHECKOUT_INICIADO",
  },
  "order_paid": {
    tags: [ECOMMERCE_TAGS.EC_PAGAMENTO_APROVADO, JOURNEY_TAGS.J04_COMPRA],
    template: "EC_PAGAMENTO_APROVADO",
  },
  "order_cancelled": {
    tags: [ECOMMERCE_TAGS.EC_PEDIDO_CANCELADO],
    template: "EC_PEDIDO_CANCELADO",
  },
  "order_invoiced": {
    tags: [ECOMMERCE_TAGS.EC_PEDIDO_ENVIADO],
    template: "EC_PEDIDO_ENVIADO",
  },
  "boleto_generated": {
    tags: [ECOMMERCE_TAGS.EC_GEROU_BOLETO],
    template: "EC_BOLETO_GERADO",
  },
  "cart_abandoned": {
    tags: [ECOMMERCE_TAGS.EC_ABANDONOU_CARRINHO],
    template: "EC_CARRINHO_ABANDONADO",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SELLFLUX_API_TOKEN = Deno.env.get("SELLFLUX_API_TOKEN");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();

    console.log("[ecommerce-webhook] Payload:", JSON.stringify(payload).slice(0, 500));

    // Extract event type — Loja Integrada sends different formats
    const eventType = payload.event || payload.tipo || payload.type || "order_created";
    const order = payload.order || payload.pedido || payload;

    // Extract customer data
    const customer = order.cliente || order.customer || order.contact || {};
    const nome = customer.nome || customer.name || order.nome || "Lead E-commerce";
    const email = (customer.email || order.email || "").trim().toLowerCase();
    const phoneRaw = customer.telefone_principal || customer.phone || customer.telefone || order.telefone || null;
    const phoneNormalized = normalizePhone(phoneRaw);

    if (!email) {
      console.warn("[ecommerce-webhook] Pedido sem email, ignorando");
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine tags from event
    const eventConfig = EVENT_MAP[eventType] || { tags: [ECOMMERCE_TAGS.EC_INICIOU_CHECKOUT] };
    const tagsToAdd = [...eventConfig.tags];

    // Extract product tags from items
    const items = order.itens || order.items || order.produtos || [];
    for (const item of items) {
      const productName = item.nome || item.name || item.produto || "";
      if (productName) {
        tagsToAdd.push(...detectProductTags(productName));
      }
    }

    // Check if lead exists
    const { data: existingLead } = await supabase
      .from("lia_attendances")
      .select("id, tags_crm, lead_status")
      .eq("email", email)
      .single();

    let leadId: string;

    if (existingLead) {
      // Update existing lead with new tags
      const newTags = mergeTagsCrm(existingLead.tags_crm, tagsToAdd);
      const updateData: Record<string, unknown> = { tags_crm: newTags };

      // If payment approved, update status
      if (eventType === "order_paid") {
        updateData.status_oportunidade = "ganha";
        updateData.ativo_insumos = true;
      }

      // Update phone if missing
      if (phoneNormalized) {
        updateData.telefone_normalized = phoneNormalized;
        if (phoneRaw) updateData.telefone_raw = phoneRaw;
      }

      await supabase.from("lia_attendances").update(updateData).eq("id", existingLead.id);
      leadId = existingLead.id;
      console.log(`[ecommerce-webhook] Lead atualizado: ${leadId} | event: ${eventType} | +tags: ${tagsToAdd.join(",")}`);
    } else {
      // Create new lead
      const cidade = customer.cidade || customer.city || null;
      const uf = customer.estado || customer.state || null;

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
          valor_oportunidade: order.valor_total || order.total || null,
        })
        .select("id")
        .single();

      if (insertError || !newLead) {
        console.error("[ecommerce-webhook] Erro ao criar lead:", insertError);
        return new Response(JSON.stringify({ error: insertError?.message || "Erro ao criar lead" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      leadId = newLead.id;
      console.log(`[ecommerce-webhook] Lead CRIADO: ${leadId} | email: ${email} | event: ${eventType}`);
    }

    // Dispatch SellFlux notification
    let messageStatus = "skipped";
    let errorDetails: string | null = null;

    if (SELLFLUX_API_TOKEN && eventConfig.template && phoneNormalized) {
      const { data: fullLead } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("id", leadId)
        .single();

      if (fullLead) {
        const result = await sendViaSellFlux(
          SELLFLUX_API_TOKEN,
          fullLead as Record<string, unknown>,
          eventConfig.template
        );
        messageStatus = result.success ? "enviado" : "erro";
        if (!result.success) errorDetails = result.response;
      }
    }

    // Log
    await supabase.from("message_logs").insert({
      lead_id: leadId,
      tipo: `ecommerce_${eventType}`,
      mensagem_preview: `[E-commerce] ${eventType}: ${nome} (${email})`.slice(0, 200),
      status: messageStatus,
      error_details: errorDetails,
    });

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      event: eventType,
      tags_added: tagsToAdd,
      message_status: messageStatus,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ecommerce-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
