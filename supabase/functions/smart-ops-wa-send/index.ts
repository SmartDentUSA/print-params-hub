// smart-ops-wa-send — envio de WhatsApp via Evolution API (WhatsApp descontinuado).
// Mantém o nome da função por retrocompat com os call-sites existentes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVO_BASE = Deno.env.get("EVOLUTION_API_URL") ?? "http://82.25.75.61:8080";
const GLOBAL_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "SmartDent_LIA_2026";
const ACK_OK = new Set(["SERVER_ACK", "DELIVERY_ACK", "READ", "PLAYED"]);

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// O Evolution só devolve `status` no POST de envio (sempre "PENDING").
// O ACK real fica em `MessageUpdate[]` no registro de /chat/findMessages —
// ler apenas `record.status` marcava toda mensagem como não confirmada.
const ACK_RANK: Record<string, number> = {
  ERROR: 0,
  PENDING: 1,
  SERVER_ACK: 2,
  DELIVERY_ACK: 3,
  READ: 4,
  PLAYED: 5,
};

function baileysStatus(payload: any): string | null {
  const candidates: string[] = [];
  const push = (v: unknown) => { if (v) candidates.push(String(v).toUpperCase()); };
  push(payload?.status);
  push(payload?.message?.status);
  const updates = payload?.MessageUpdate ?? payload?.messageUpdate ?? payload?.message_update;
  if (Array.isArray(updates)) for (const u of updates) push(u?.status);
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) => ((ACK_RANK[cur] ?? -1) > (ACK_RANK[best] ?? -1) ? cur : best));
}

async function warmupContact(instance: string, apikey: string, target: string) {
  try {
    await fetch(`${EVO_BASE}/chat/whatsappNumbers/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ numbers: [target] }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn(JSON.stringify({ event: "wa.send.warmup_contact_failed", instance, error: String((e as Error)?.message ?? e) }));
  }
}

async function findMessageStatus(instance: string, apikey: string, remoteJid: string, messageId: string) {
  try {
    const res = await fetch(`${EVO_BASE}/chat/findMessages/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ where: { key: { remoteJid, id: messageId } }, limit: 5 }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const records = Array.isArray(data) ? data : (data?.messages?.records ?? data?.records ?? []);
    const found = Array.isArray(records) && records.length ? records[0] : null;
    return baileysStatus(found);
  } catch (e) {
    console.warn(JSON.stringify({ event: "wa.send.find_status_failed", instance, error: String((e as Error)?.message ?? e) }));
    return null;
  }
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
      media_url = null,
      media_type = "image",
    } = body ?? {};

    // Mídia opcional: quando informada, a mensagem sai como imagem/vídeo com legenda.
    const mediaUrl = typeof media_url === "string" && /^https?:\/\//.test(media_url)
      ? media_url
      : (typeof (metadata as any)?.media === "string" && /^https?:\/\//.test((metadata as any).media)
        ? (metadata as any).media
        : null);

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
        .select("id, nome_completo, evolution_instance_name, evolution_api_key, evolution_enabled, evolution_status")
        .eq("id", team_member_id)
        .maybeSingle();
      tm = data;
    }
    // Fallback só entra em cena quando o membro escolhido não tem instância utilizável
    // (sem nome, desabilitada ou desconectada) — senão a mensagem sai por um número
    // que não está ativo e nunca é entregue.
    const usable = (m: any) =>
      !!m?.evolution_instance_name &&
      m?.evolution_enabled !== false &&
      (m?.evolution_status ?? "connected") === "connected";
    if (!usable(tm)) {
      const { data } = await supabase
        .from("team_members")
        .select("id, nome_completo, evolution_instance_name, evolution_api_key, evolution_enabled, evolution_status")
        .eq("ativo", true)
        .eq("evolution_enabled", true)
        .eq("evolution_status", "connected")
        .not("evolution_instance_name", "is", null)
        .limit(1)
        .maybeSingle();
      if (data) {
        console.warn(JSON.stringify({
          event: "wa_send.instance_fallback",
          requested_team_member_id: team_member_id ?? null,
          requested_instance: tm?.evolution_instance_name ?? null,
          fallback_instance: data.evolution_instance_name,
        }));
        tm = data;
      }
    }
    if (!tm?.evolution_instance_name) {
      return json({ success: false, error: "no_evolution_instance_configured" }, 400);
    }

    const apikey = tm.evolution_api_key || GLOBAL_KEY;
    const instance = tm.evolution_instance_name;

    // Pre-flight: instância precisa estar "open". Se estiver "connecting"/"close",
    // o Baileys aceita o POST mas a mensagem nunca é entregue de fato — o
    // destinatário vê "Aguardando mensagem. Esta ação pode levar alguns minutos".
    try {
      const stRes = await fetch(
        `${EVO_BASE}/instance/connectionState/${encodeURIComponent(instance)}`,
        { headers: { apikey } },
      );
      if (!stRes.ok) {
        const t = await stRes.text();
        console.error(JSON.stringify({ event: "wa.send.state_http_error", instance, status: stRes.status }));
        return json({
          success: false,
          error: `evolution_state_${stRes.status}`,
          instance,
          detail: stRes.status === 401
            ? `Credencial inválida para a instância "${instance}". Atualize o campo evolution_api_key do membro do time.`
            : `Não foi possível verificar a conexão da instância "${instance}": ${t.slice(0, 200)}`,
        }, 409);
      }
      const stJson = await stRes.json().catch(() => null);
      const state = stJson?.instance?.state ?? stJson?.state ?? null;
      if (state && state !== "open") {
        console.error(JSON.stringify({ event: "wa.send.instance_not_open", instance, state }));
        return json({
          success: false,
          error: "instance_not_connected",
          state,
          instance,
          detail: `A instância "${instance}" está com status "${state}". Reconecte o WhatsApp (QR Code) antes de enviar — mensagens enviadas nesse estado ficam como "Aguardando mensagem" para o destinatário.`,
        }, 409);
      }
    } catch (e) {
      console.warn("connectionState check failed", e);
    }

    const pendingSince = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: lastPending } = await supabase
      .from("whatsapp_inbox")
      .select("wa_message_id, remote_jid, raw_payload, created_at")
      .eq("direction", "outbound")
      .eq("instance_name", instance)
      .not("wa_message_id", "is", null)
      .gte("created_at", pendingSince)
      .or("raw_payload->response->>status.eq.PENDING,raw_payload->>delivery_status_raw.eq.PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPending?.wa_message_id && lastPending?.remote_jid) {
      const currentStatus = await findMessageStatus(instance, apikey, lastPending.remote_jid, lastPending.wa_message_id);
      if (!currentStatus || currentStatus === "PENDING") {
        return json({
          success: false,
          error: "instance_has_stuck_pending_message",
          instance,
          status: currentStatus ?? "unknown",
          detail: `A instância "${instance}" tem mensagem recente ainda sem confirmação do WhatsApp. Reconecte/atualize a sessão antes de novos envios para evitar "Aguardando mensagem" no destinatário.`,
        }, 409);
      }
    }

    await warmupContact(instance, apikey, target);

    const url = mediaUrl
      ? `${EVO_BASE}/message/sendMedia/${encodeURIComponent(instance)}`
      : `${EVO_BASE}/message/sendText/${encodeURIComponent(instance)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify(
        mediaUrl
          ? {
              number: target,
              mediatype: media_type === "video" ? "video" : "image",
              media: mediaUrl,
              caption: String(message),
            }
          : { number: target, text: String(message) },
      ),
    });
    const text = await res.text();

    if (!res.ok) {
      console.error(JSON.stringify({ event: "wa.send.fail", instance, status: res.status, body: text.slice(0, 500) }));
      return json({ success: false, error: `evolution_${res.status}`, detail: text.slice(0, 500) }, 502);
    }

    let payload: any = null;
    try { payload = JSON.parse(text); } catch { /* ignore */ }

    const messageId = payload?.key?.id ?? null;
    const remoteJid = payload?.key?.remoteJid ?? `${target}@s.whatsapp.net`;
    let status = baileysStatus(payload);

    // O ACK do WhatsApp chega de forma assíncrona: consulta em janelas curtas
    // até o Baileys registrar SERVER_ACK/DELIVERY_ACK/READ.
    if (messageId) {
      for (const wait of [1_500, 2_000, 3_000]) {
        if (status && ACK_OK.has(status)) break;
        await sleep(wait);
        status = (await findMessageStatus(instance, apikey, remoteJid, messageId)) ?? status;
      }
    }

    const rawPayload = {
      source,
      metadata,
      response: payload,
      delivery_status_raw: status,
      delivery_guard_checked_at: new Date().toISOString(),
    };

    if (!status || !ACK_OK.has(status)) {
      console.error(JSON.stringify({ event: "wa.send.pending_or_unknown", instance, target, messageId, status }));
      return json({
        success: false,
        error: "message_not_acknowledged",
        instance,
        message_id: messageId,
        status: status ?? "unknown",
        detail: `A instância "${instance}" aceitou a mensagem, mas o WhatsApp não confirmou entrega ao servidor (status ${status ?? "unknown"}). Reconecte/atualize a sessão desta instância antes de enviar novamente para evitar "Aguardando mensagem" no destinatário.`,
      }, 409);
    }

    await supabase.from("whatsapp_inbox").insert({
      phone: target,
      phone_normalized: target,
      direction: "outbound",
      message_text: String(message),
      lead_id,
      team_member_id: tm.id,
      instance_name: instance,
      wa_message_id: messageId,
      remote_jid: remoteJid,
      is_group: false,
      sender_name: tm.nome_completo ?? null,
      raw_payload: rawPayload,
    });

    return json({ success: true, instance, message_id: messageId, status });
  } catch (err) {
    console.error("send error", err);
    return json({ success: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
