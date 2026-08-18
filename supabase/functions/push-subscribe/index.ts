// push-subscribe — registra / remove assinaturas de Web Push do cliente logado.
// Ações: public-key (sem auth), subscribe, unsubscribe, ping.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function detectPlatform(ua: string): string {
  const u = (ua || "").toLowerCase();
  if (/iphone|ipad|ipod/.test(u)) return "ios";
  if (/android/.test(u)) return "android";
  return "desktop";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "public-key");

    if (action === "public-key") {
      return json({ ok: true, public_key: Deno.env.get("VAPID_PUBLIC_KEY") ?? null });
    }

    // Ações autenticadas
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Não autenticado." }, 401);
    const { data: userData, error: eUser } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (eUser || !user) return json({ ok: false, error: "Sessão inválida." }, 401);

    const leadId = (user.user_metadata as Record<string, unknown> | null)?.lead_id as string | undefined;

    if (action === "unsubscribe") {
      const endpoint = String(body?.endpoint || "");
      if (!endpoint) return json({ ok: false, error: "Endpoint ausente." }, 400);
      await admin.from("push_subscriptions")
        .update({ enabled: false })
        .eq("endpoint", endpoint)
        .eq("user_id", user.id);
      return json({ ok: true });
    }

    if (action === "ping") {
      const endpoint = String(body?.endpoint || "");
      if (endpoint) {
        await admin.from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("endpoint", endpoint);
      }
      return json({ ok: true });
    }

    if (action === "subscribe") {
      const endpoint = String(body?.endpoint || "");
      const p256dh = String(body?.keys?.p256dh || body?.p256dh || "");
      const auth = String(body?.keys?.auth || body?.auth || "");
      if (!endpoint || !p256dh || !auth) return json({ ok: false, error: "Assinatura incompleta." }, 400);

      const ua = req.headers.get("user-agent") ?? "";
      const nowIso = new Date().toISOString();

      const { error } = await admin.from("push_subscriptions").upsert({
        endpoint,
        p256dh,
        auth,
        lead_id: leadId ?? null,
        user_id: user.id,
        platform: detectPlatform(ua),
        user_agent: ua.slice(0, 400),
        enabled: true,
        last_seen_at: nowIso,
      }, { onConflict: "endpoint" });
      if (error) throw error;

      if (leadId) {
        await admin.from("lead_activity_log").insert({
          lead_id: leadId,
          event_type: "push_opt_in",
          event_timestamp: nowIso,
          source_channel: "push_app",
          entity_type: "push_subscription",
          entity_name: detectPlatform(ua),
          event_data: { label: "Cliente autorizou notificações no app", platform: detectPlatform(ua) },
          dedupe_hash: `push_opt_in:${endpoint.slice(-40)}`,
        }).then(() => undefined, () => undefined);
      }

      return json({ ok: true });
    }

    return json({ ok: false, error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
