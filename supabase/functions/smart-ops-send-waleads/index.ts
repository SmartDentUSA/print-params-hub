// smart-ops-send-waleads — envio de WhatsApp via Evolution API (WaLeads descontinuado).
// Mantém o nome da função por retrocompat com os call-sites existentes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVO_BASE = Deno.env.get("EVOLUTION_API_URL") ?? "http://82.25.75.61:8080";
const GLOBAL_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "SmartDent_LIA_2026";

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : "55" + digits;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      team_member_id,
      phone,
      to,
      message,
      lead_id = null,
      source = "manual_inbox",
      metadata = null,
    } = body ?? {};

    const target = normalizePhone(String(phone ?? to ?? ""));
    if (!target) return json({ success: false, error: "phone_invalid" }, 400);
    if (!message || !String(message).trim()) return json({ success: false, error: "message_required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve instância Evolution: por team_member, senão primeira ativa configurada.
    let tm: any = null;
    if (team_member_id) {
      const { data } = await supabase
        .from("team_members")
        .select("id, nome_completo, evolution_instance_name, evolution_api_key")
        .eq("id", team_member_id)
        .maybeSingle();
      tm = data;
    }
    if (!tm?.evolution_instance_name) {
      const { data } = await supabase
        .from("team_members")
        .select("id, nome_completo, evolution_instance_name, evolution_api_key")
        .eq("ativo", true)
        .not("evolution_instance_name", "is", null)
        .limit(1)
        .maybeSingle();
      tm = tm?.evolution_instance_name ? tm : data;
    }
    if (!tm?.evolution_instance_name) {
      return json({ success: false, error: "no_evolution_instance_configured" }, 400);
    }

    const apikey = tm.evolution_api_key || GLOBAL_KEY;
    const url = `${EVO_BASE}/message/sendText/${encodeURIComponent(tm.evolution_instance_name)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number: target, text: String(message) }),
    });
    const text = await res.text();

    if (!res.ok) {
      console.error(JSON.stringify({ event: "wa.send.fail", instance: tm.evolution_instance_name, status: res.status, body: text.slice(0, 500) }));
      return json({ success: false, error: `evolution_${res.status}`, detail: text.slice(0, 500) }, 502);
    }

    let payload: any = null;
    try { payload = JSON.parse(text); } catch { /* ignore */ }

    await supabase.from("whatsapp_inbox").insert({
      phone: target,
      phone_normalized: target,
      direction: "outbound",
      message_text: String(message),
      lead_id,
      team_member_id: tm.id,
      instance_name: tm.evolution_instance_name,
      wa_message_id: payload?.key?.id ?? null,
      remote_jid: payload?.key?.remoteJid ?? `${target}@s.whatsapp.net`,
      is_group: false,
      sender_name: tm.nome_completo ?? null,
      raw_payload: { source, metadata, response: payload },
    });

    return json({ success: true, instance: tm.evolution_instance_name, message_id: payload?.key?.id ?? null });
  } catch (err) {
    console.error("send error", err);
    return json({ success: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
