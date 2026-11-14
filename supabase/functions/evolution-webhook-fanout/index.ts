// evolution-webhook-fanout — Evolution só aceita UMA URL de webhook por instância.
// Esta função recebe o payload e replica (fan-out) para todos os destinos,
// preservando o handler legado (evolution-webhook-handler) e adicionando o Sentinela.
// Números com team_members.lia_auto_reply = true também têm as mensagens diretas
// recebidas respondidas pela Dra. LIA (dra-lia-whatsapp) a partir do próprio número.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFreshInbound, parseEvolutionInbound } from "../_shared/evolution-inbound.ts";

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

// ── Dra. LIA no número que recebeu a mensagem ───
async function forwardToLia(body: unknown) {
  const inbound = parseEvolutionInbound(body).filter((m) => isFreshInbound(m, Date.now()));
  if (!inbound.length) return;

  const { data: member } = await sb
    .from("team_members")
    .select("id")
    .eq("evolution_instance_name", inbound[0].instance)
    .eq("ativo", true)
    .eq("lia_auto_reply", true)
    .limit(1)
    .maybeSingle();
  if (!member?.id) return;

  for (const m of inbound) {
    // Uma resposta por mensagem, mesmo que a Evolution reenvie o webhook.
    const { error: claimErr } = await sb
      .from("wa_message_dedup")
      .insert({ msg_id: `lia_autoreply:${m.instance}:${m.messageId}`, phone: m.phoneDigits ?? m.lidDigits });
    if (claimErr) continue;

    let phone = m.phoneDigits;
    if (!phone && m.lidDigits) {
      const { data: mapped } = await sb
        .from("wa_lid_phone_map")
        .select("phone_digits")
        .eq("lid_id", m.lidDigits)
        .maybeSingle();
      phone = mapped?.phone_digits ?? null;
    }
    if (!phone) {
      await logHealth("warning", "lia_autoreply_unresolved_lid", { instance: m.instance, lid: m.lidDigits, message_id: m.messageId });
      continue;
    }

    try {
      const r = await fetch(`${FN_BASE}/dra-lia-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({
          phone,
          message: m.text,
          pushName: m.pushName,
          lid: m.lidDigits,
          instance: m.instance,
          wa_message_id: m.messageId,
          remote_jid: m.remoteJid,
          reply_team_member_id: member.id,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const text = await r.text();
      if (!r.ok) await logHealth("error", "lia_autoreply_failed", { instance: m.instance, status: r.status, body: text.slice(0, 500) });
    } catch (e) {
      await logHealth("error", "lia_autoreply_error", { instance: m.instance, error: String(e) });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();

  let parsed: unknown = null;
  try { parsed = JSON.parse(rawBody); } catch { /* corpo não-JSON: só replica */ }
  if (parsed) {
    const task = forwardToLia(parsed).catch((e) => logHealth("error", "lia_autoreply_crash", { error: String(e) }));
    // Responde à Evolution sem esperar a LIA (resposta pode levar ~30s).
    (globalThis as any).EdgeRuntime?.waitUntil?.(task);
  }

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
