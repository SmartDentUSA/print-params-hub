// evolution-webhook-fanout — Evolution só aceita UMA URL de webhook por instância.
// Esta função recebe o payload e replica (fan-out) para todos os destinos,
// preservando o handler legado (evolution-webhook-handler) e adicionando o Sentinela.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

// Destinos padrão. Ordem não importa — são disparados em paralelo.
const TARGETS = [
  `${FN_BASE}/evolution-webhook-handler`, // handler legado (CS / inbox)
  `${FN_BASE}/sentinela-webhook-receiver`, // inteligência de mercado
];

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function logHealth(severity: "info" | "warning" | "error", message: string, payload?: unknown) {
  try {
    await sb.from("system_health_logs").insert({
      function_name: "evolution-webhook-fanout",
      severity,
      error_type: "evolution_fanout",
      details: { message, payload: payload ?? null },
    });
  } catch (_) { /* noop */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();

  const results = await Promise.all(
    TARGETS.map(async (url) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
          },
          body: rawBody,
          signal: AbortSignal.timeout(15000),
        });
        return { url, status: r.status, ok: r.ok };
      } catch (e) {
        return { url, status: 0, ok: false, error: String(e) };
      }
    }),
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) await logHealth("warning", "fanout target failed", { failed });

  // Sempre 200 para a Evolution não reenfileirar/desabilitar o webhook.
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});