/**
 * Register webhooks at Loja Integrada API
 * 
 * Loja Integrada webhook API:
 *   POST https://api.awsli.com.br/v1/webhook/
 *   Body: { url, evento_tipo, formato }
 * 
 * For listing (GET), use query params auth:
 *   GET https://api.awsli.com.br/v1/webhook/?chave_api=X&chave_aplicacao=Y
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

function buildAuthParams(apiKey: string, appKey: string | null): string {
  const params = new URLSearchParams();
  params.set("chave_api", apiKey);
  if (appKey) params.set("chave_aplicacao", appKey);
  return params.toString();
}

function buildAuthHeader(apiKey: string, appKey: string | null): string {
  return appKey
    ? `chave_api ${apiKey} aplicacao ${appKey}`
    : `chave_api ${apiKey}`;
}

async function registerWebhook(
  apiKey: string,
  appKey: string | null,
  webhook: WebhookRegistration
): Promise<{ success: boolean; evento: string; status: number; body: string }> {
  // POST uses both header auth AND query params for maximum compatibility
  const queryParams = buildAuthParams(apiKey, appKey);
  const url = `https://api.awsli.com.br/v1/webhook/?${queryParams}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(apiKey, appKey),
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
  // GET uses query params auth (header alone may not work for reads)
  const queryParams = buildAuthParams(apiKey, appKey);
  const url = `https://api.awsli.com.br/v1/webhook/?${queryParams}`;

  console.log(`[register-loja-webhooks] Listing webhooks from: ${url.replace(apiKey, "***")}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(apiKey, appKey),
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

async function deleteWebhook(
  apiKey: string,
  appKey: string | null,
  webhookId: string
): Promise<{ success: boolean; status: number }> {
  const queryParams = buildAuthParams(apiKey, appKey);
  const url = `https://api.awsli.com.br/v1/webhook/${webhookId}/?${queryParams}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: buildAuthHeader(apiKey, appKey),
    },
  });
  await res.text();
  return { success: res.ok, status: res.status };
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
    const action = body.action || "register"; // "register" | "list" | "delete"

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

    if (action === "delete" && body.webhook_id) {
      const result = await deleteWebhook(apiKey, appKey || null, body.webhook_id);
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
      console.log(`[register-loja-webhooks] ${evento}: ${result.status} ${result.success ? "✅" : "❌"} | body=${result.body}`);
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
