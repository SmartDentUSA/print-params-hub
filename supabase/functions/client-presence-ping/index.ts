// client-presence-ping — mantém o last_seen_at do cliente logado atualizado enquanto ele navega.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone, email } = await req.json().catch(() => ({}));
    const digits = String(phone || "").replace(/\D+/g, "");
    if (!digits && !email) return json({ ok: false, error: "identidade ausente" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const nowIso = new Date().toISOString();
    const key = digits ? digits.slice(-11) : String(email);

    const { data: rows } = await admin
      .from("client_access_invites")
      .select("id, lead_id")
      .ilike("destino", `%${key}%`)
      .order("sent_at", { ascending: false })
      .limit(1);

    if (rows?.[0]) {
      await admin.from("client_access_invites").update({ last_seen_at: nowIso }).eq("id", rows[0].id);
    }

    // Também mantém as assinaturas de push vivas (segmentação "online agora")
    const leadId = (rows?.[0] as { lead_id?: string | null } | undefined)?.lead_id ?? null;
    if (leadId) {
      await admin.from("push_subscriptions").update({ last_seen_at: nowIso }).eq("lead_id", leadId);
    }

    return json({ ok: true, updated: !!rows?.[0] });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
