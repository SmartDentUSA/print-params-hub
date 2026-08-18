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
    const { phone, email, session_id, page_path, page_title, device_type, nome } =
      await req.json().catch(() => ({}));
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

    // Conexão (aba/dispositivo) do cliente: permite contar quantas conexões
    // simultâneas o mesmo usuário mantém abertas.
    if (session_id) {
      await admin.from("client_online_sessions").upsert(
        {
          session_id: String(session_id),
          identity_key: key,
          lead_id: leadId,
          nome: nome ? String(nome) : null,
          email: email ? String(email).toLowerCase() : null,
          phone: digits || null,
          page_path: page_path ? String(page_path).slice(0, 500) : null,
          page_title: page_title ? String(page_title).slice(0, 300) : null,
          device_type: device_type ? String(device_type) : null,
          user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          last_seen_at: nowIso,
        },
        { onConflict: "session_id" },
      );
    }

    return json({ ok: true, updated: !!rows?.[0] });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
