const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.awsli.com.br/v1";

interface WebhookRegistration {
  url: string;
  evento_tipo: string;
  formato: string;
}

interface LIResult {
  success: boolean;
  status: number;
  strategy: "header" | "querystring" | "none";
  data: unknown;
}

/**
 * Multi-strategy fetch: tenta header Authorization primeiro (padrão que
 * funciona hoje, confirmado em 18/08/2026), cai para querystring só se
 * o header retornar 401.
 */
async function apiFetchLI(
  method: "GET" | "POST" | "DELETE",
  path: string,
  apiKey: string,
  appKey: string | null,
  body?: unknown
): Promise<LIResult> {
  const headerAuth = `chave_api ${apiKey} aplicacao ${appKey || ""}`;
  const fetchOpts = (headers: Record<string, string>): RequestInit => ({
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // Estratégia 1: header Authorization
  try {
    const res = await fetch(`${API_BASE}${path}`, fetchOpts({
      "Authorization": headerAuth,
      "Content-Type": "application/json",
      "Accept": "application/json",
    }));

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }

    if (res.status !== 401) {
      return { success: res.ok, status: res.status, strategy: "header", data };
    }

    console.warn(`[register-loja-webhooks] 401 via header, tentando querystring...`);
  } catch (e) {
    console.warn(`[register-loja-webhooks] Erro na estratégia header:`, e);
  }

  // Estratégia 2: querystring (fallback)
  const qs = new URLSearchParams();
  qs.set("chave_api", apiKey);
  if (appKey) qs.set("chave_aplicacao", appKey);
  qs.set("format", "json");

  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API_BASE}${path}${sep}${qs.toString()}`, fetchOpts({
    "Content-Type": "application/json",
    "Accept": "application/json",
  }));

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }

  return { success: res.ok, status: res.status, strategy: "querystring", data };
}

async function registerWebhook(
  apiKey: string,
  appKey: string | null,
  webhook: WebhookRegistration
): Promise<{ success: boolean; evento: string; status: number; strategy: string; body: unknown }> {
  const result = await apiFetchLI("POST", "/webhook/", apiKey, appKey, webhook);
  return {
    success: result.success,
    evento: webhook.evento_tipo,
    status: result.status,
    strategy: result.strategy,
    body: result.data,
  };
}

async function listWebhooks(
  apiKey: string,
  appKey: string | null
): Promise<LIResult> {
  console.log(`[register-loja-webhooks] Listing webhooks...`);
  return await apiFetchLI("GET", "/webhook/", apiKey, appKey);
}

async function deleteWebhook(
  apiKey: string,
  appKey: string | null,
  webhookId: string
): Promise<LIResult> {
  return await apiFetchLI("DELETE", `/webhook/${webhookId}/`, apiKey, appKey);
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
    const action = body.action || "register";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/smart-ops-ecommerce-webhook`;

    if (action === "test_auth") {
      const result = await apiFetchLI("GET", "/pedido/?limit=1", apiKey, appKey || null);
      return new Response(JSON.stringify({
        status: result.status,
        success: result.success,
        strategy_used: result.strategy,
        data: result.data,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "raw_get" && body.path) {
      const result = await apiFetchLI("GET", body.path, apiKey, appKey || null);
      return new Response(JSON.stringify({
        success: result.success,
        strategy_used: result.strategy,
        status: result.status,
        data: result.data,
      }), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const result = await listWebhooks(apiKey, appKey || null);
      return new Response(JSON.stringify({
        success: result.success,
        strategy_used: result.strategy,
        status: result.status,
        data: result.data,
      }), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete" && body.webhook_id) {
      const result = await deleteWebhook(apiKey, appKey || null, body.webhook_id);
      return new Response(JSON.stringify({
        success: result.success,
        strategy_used: result.strategy,
        status: result.status,
      }), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Register webhooks
    const events = body.events || ["pedido_criado", "pedido_atualizado"];

    console.log(`[register-loja-webhooks] Registering ${events.length} webhooks → ${webhookUrl}`);

    const results = [];
    for (const evento of events) {
      const result = await registerWebhook(apiKey, appKey || null, {
        url: webhookUrl,
        evento_tipo: evento,
        formato: "json",
      });
      console.log(`[register-loja-webhooks] ${evento}: ${result.status} (${result.strategy}) ${result.success ? "✅" : "❌"} | body=${JSON.stringify(result.body).slice(0, 300)}`);
      results.push(result);
    }

    const allSuccess = results.every((r) => r.success);

    return new Response(
      JSON.stringify({ success: allSuccess, webhook_url: webhookUrl, results }),
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
