/**
 * Register webhooks at Loja Integrada API
 * 
 * Loja Integrada webhook API:
 *   POST https://api.awsli.com.br/v1/webhook/
 *   Body: { url, evento_tipo, formato }
 * 
 * Events supported:
 *   - pedido_criado     (order created)
 *   - pedido_atualizado (order status changed — covers paid, cancelled, shipped, etc.)
 *   - produto_criado    (product created)
 *   - produto_atualizado(product edited)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookRegistration {
  url: string;
  evento_tipo: string;
  formato: string;
}

async function registerWebhook(
  apiKey: string,
  appKey: string | null,
  webhook: WebhookRegistration
): Promise<{ success: boolean; evento: string; status: number; body: string }> {
  const authHeader = appKey
    ? `chave_api ${apiKey} aplicacao ${appKey}`
    : `chave_api ${apiKey}`;

  const res = await fetch("https://api.awsli.com.br/v1/webhook/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(webhook),
  });

  const body = await res.text();
  return {
    success: res.ok,
    evento: webhook.evento_tipo,
    status: res.status,
    body: body.slice(0, 500),
  };
}

async function listWebhooks(
  apiKey: string,
  appKey: string | null
): Promise<{ success: boolean; status: number; data: unknown }> {
  const authHeader = appKey
    ? `chave_api ${apiKey} aplicacao ${appKey}`
    : `chave_api ${apiKey}`;

  const res = await fetch("https://api.awsli.com.br/v1/webhook/", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  });

  const body = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    data = body.slice(0, 1000);
  }
  return { success: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOJA_INTEGRADA_API_KEY");
    const appKey = Deno.env.get("LOJA_INTEGRADA_APP_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOJA_INTEGRADA_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "register"; // "register" | "list" | "register_single"

    // The public URL of our ecommerce webhook edge function
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/smart-ops-ecommerce-webhook`;

    if (action === "list") {
      const result = await listWebhooks(apiKey, appKey || null);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Register webhooks for all order + product events
    const events = body.events || [
      "pedido_criado",
      "pedido_atualizado",
    ];

    console.log(`[register-loja-webhooks] Registering ${events.length} webhooks → ${webhookUrl}`);

    const results = [];
    for (const evento of events) {
      const result = await registerWebhook(apiKey, appKey || null, {
        url: webhookUrl,
        evento_tipo: evento,
        formato: "json",
      });
      console.log(`[register-loja-webhooks] ${evento}: ${result.status} ${result.success ? "✅" : "❌"}`);
      results.push(result);
    }

    const allSuccess = results.every((r) => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        webhook_url: webhookUrl,
        results,
      }),
      {
        status: allSuccess ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[register-loja-webhooks] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
