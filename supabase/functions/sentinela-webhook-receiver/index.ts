// sentinela-webhook-receiver — recebe MESSAGES_UPSERT da Evolution
// (instância "Danilo Henrique") e armazena mensagens de grupos (@g.us)
// em sentinela_group_messages. Não processa IA — apenas persiste.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Nome canônico = como está cadastrado em wa_groups/team_members/UI.
const TARGET_INSTANCE = "Danilo-Henrique";
// Aceita aliases: "Danilo-Henrique", "danilo_henrique", "DANILO HENRIQUE", etc.
const normalizeInstance = (s: string) => (s ?? "").toLowerCase().replace(/[\s_-]/g, "");
const ALLOWED_INSTANCES = ["Danilo Henrique", "Danilo-Henrique"].map(normalizeInstance);
const isAllowedInstance = (s: string) => ALLOWED_INSTANCES.includes(normalizeInstance(s));

function canonicalInstanceName(_instanceName: string): string {
  return TARGET_INSTANCE;
}

function safeGroupName(remoteJid: string, raw: any, existingName?: string | null): string {
  const candidates = [
    raw?.subject,
    raw?.groupName,
    raw?.chatName,
    raw?.pushName,
    raw?.notifyName,
    raw?.message?.subject,
    raw?.message?.groupName,
    raw?.message?.pushName,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && !c.endsWith("@g.us")) return c.trim().slice(0, 200);
  }
  if (existingName?.trim()) return existingName.trim().slice(0, 200);
  const shortId = remoteJid.replace("@g.us", "").slice(-12);
  return `Grupo WA ${shortId}`;
}

function extractPictureUrl(raw: any): string | null {
  const candidates = [raw?.profilePicUrl, raw?.pictureUrl, raw?.picture_url, raw?.imageUrl, raw?.avatarUrl];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}

async function ensureWaGroup(instance: string, remoteJid: string, raw: any) {
  const canonicalInstance = canonicalInstanceName(instance);
  const now = new Date().toISOString();
  const { data: existing, error: lookupErr } = await sb
    .from("wa_groups")
    .select("id, name, picture_url")
    .eq("group_jid", remoteJid)
    .maybeSingle();

  if (lookupErr) {
    await logHealth("warning", "wa_groups lookup error", { instance: canonicalInstance, remoteJid, msg: lookupErr.message });
    return { group: null, error: lookupErr };
  }

  const name = safeGroupName(remoteJid, raw, existing?.name ?? null);
  const picture = extractPictureUrl(raw);

  if (existing?.id) {
    const patch: Record<string, unknown> = {
      instance_name: canonicalInstance,
      synced_at: now,
      updated_at: now,
    };
    if ((!existing.name || existing.name.startsWith("Grupo WA ")) && name) patch.name = name;
    if (!existing.picture_url && picture) patch.picture_url = picture;

    const { error: updateErr } = await sb.from("wa_groups").update(patch).eq("id", existing.id);
    if (updateErr) {
      await logHealth("warning", "wa_groups update error", { instance: canonicalInstance, remoteJid, msg: updateErr.message });
      return { group: existing, error: updateErr };
    }
    return { group: { ...existing, name: (patch.name as string | undefined) ?? existing.name }, error: null };
  }

  const { data: inserted, error: insertErr } = await sb
    .from("wa_groups")
    .insert({
      group_jid: remoteJid,
      instance_name: canonicalInstance,
      name,
      picture_url: picture,
      is_admin: true,
      ativo: true,
      enabled: true,
      synced_at: now,
      updated_at: now,
    })
    .select("id, name")
    .maybeSingle();

  if (insertErr) {
    await logHealth("warning", "wa_groups insert error", { instance: canonicalInstance, remoteJid, msg: insertErr.message });
    return { group: null, error: insertErr };
  }
  await logHealth("info", "wa_groups discovered", { instance: canonicalInstance, remoteJid, name });
  return { group: inserted, error: null };
}

function digits(s?: string | null): string {
  return (s ?? "").replace(/\D/g, "");
}

function extractText(message: any): { text: string | null; mediaType: string; mediaUrl: string | null } {
  if (!message) return { text: null, mediaType: "text", mediaUrl: null };
  if (message.conversation) return { text: message.conversation, mediaType: "text", mediaUrl: null };
  if (message.extendedTextMessage?.text) return { text: message.extendedTextMessage.text, mediaType: "text", mediaUrl: null };
  if (message.imageMessage) return { text: message.imageMessage.caption ?? null, mediaType: "image", mediaUrl: message.imageMessage.url ?? null };
  if (message.videoMessage) return { text: message.videoMessage.caption ?? null, mediaType: "video", mediaUrl: message.videoMessage.url ?? null };
  if (message.audioMessage) return { text: null, mediaType: "audio", mediaUrl: message.audioMessage.url ?? null };
  if (message.documentMessage) return { text: message.documentMessage.fileName ?? null, mediaType: "document", mediaUrl: message.documentMessage.url ?? null };
  if (message.stickerMessage) return { text: null, mediaType: "sticker", mediaUrl: message.stickerMessage.url ?? null };
  return { text: null, mediaType: "unknown", mediaUrl: null };
}

async function logHealth(level: "info" | "warning" | "error", message: string, payload?: any) {
  try {
    await sb.from("system_health_logs").insert({
      function_name: "sentinela-webhook-receiver",
      severity: level,
      error_type: "sentinela",
      details: { message, payload: payload ?? null },
    });
  } catch (_) {}
}

async function resolveLeadId(phone: string | null): Promise<string | null> {
  if (!phone) return null;
  const { data } = await sb
    .from("lia_attendances")
    .select("id")
    .eq("telefone_normalized", phone)
    .is("merged_into", null)
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function handleMessage(instance: string, raw: any) {
  const canonicalInstance = canonicalInstanceName(instance);
  const key = raw?.key ?? raw?.message?.key ?? {};
  const remoteJid: string | undefined =
    key?.remoteJid ?? raw?.remoteJid ?? raw?.chatId ?? raw?.chat ?? raw?.from;
  if (!remoteJid || !String(remoteJid).endsWith("@g.us")) return { skipped: "not_group", remoteJid: remoteJid ?? null };

  const messageId: string | undefined = key?.id ?? raw?.messageId ?? raw?.id;
  const fromMe: boolean = !!(key?.fromMe ?? raw?.fromMe ?? raw?.isFromMe);
  if (fromMe) return { skipped: "from_me" };

  // Descobre/atualiza o grupo em wa_groups antes de registrar a mensagem.
  const { group } = await ensureWaGroup(canonicalInstance, remoteJid, raw);

  // Check sentinela_config if group is known
  if (group?.id) {
    const { data: cfg } = await sb
      .from("sentinela_config")
      .select("monitoring_active")
      .eq("group_id", group.id)
      .maybeSingle();
    if (cfg && cfg.monitoring_active === false) return { skipped: "monitoring_off" };
  }

  const participant: string | undefined =
    key?.participant ?? raw?.participant ?? key?.participantPn ?? raw?.senderPn;
  const senderJid = participant ?? null;
  const senderPhone = senderJid && senderJid.includes("@s.whatsapp.net") ? digits(senderJid) : null;
  const senderName = raw?.pushName ?? raw?.notifyName ?? null;

  const messageObj = raw?.message ?? raw?.msgContent ?? raw?.messageStubParameters ?? null;
  const extracted = extractText(messageObj);

  const tsRaw = raw?.messageTimestamp ?? raw?.timestamp ?? raw?.t ?? null;
  let messageTs: string | null = null;
  if (tsRaw) {
    const num = typeof tsRaw === "number" ? tsRaw : parseInt(String(tsRaw), 10);
    if (Number.isFinite(num)) messageTs = new Date(num * 1000).toISOString();
  }

  const leadId = await resolveLeadId(senderPhone);

  const row = {
    // Persistimos sempre como nome canônico para casar com wa_groups/team_members/UI.
    instance_name: canonicalInstance,
    group_id: group?.id ?? null,
    group_jid: remoteJid,
    group_name: group?.name ?? null,
    message_id: messageId ?? null,
    sender_jid: senderJid,
    sender_phone: senderPhone,
    sender_name: senderName,
    lead_id: leadId,
    message_text: extracted.text,
    media_type: extracted.mediaType,
    media_url: extracted.mediaUrl,
    from_me: fromMe,
    message_ts: messageTs,
    raw_payload: raw,
    processed: false,
  };

  const { error } = await sb
    .from("sentinela_group_messages")
    .upsert(row, { onConflict: "instance_name,message_id", ignoreDuplicates: true });

  if (error) {
    await logHealth("error", `upsert failed: ${error.message}`, { messageId, remoteJid });
    return { error: error.message };
  }
  return { saved: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    // Aceita formatos da Evolution v1/v2:
    //   { event, instance, data }
    //   { event, instance: { instanceName }, data }
    //   { event, instanceName, data }
    const event: string | undefined = body?.event ?? body?.eventName ?? body?.type;
    const instanceName: string =
      (typeof body?.instance === "string" ? body.instance : body?.instance?.instanceName) ??
      body?.instanceName ??
      body?.sender ??
      TARGET_INSTANCE;

    if (!isAllowedInstance(instanceName)) {
      await logHealth("info", "skipped_other_instance", { instanceName, event });
      return Response.json({ skipped: "other_instance", instanceName }, { headers: corsHeaders });
    }

    if (event && !/messages[._-]?upsert|MESSAGES_UPSERT|message[._-]?received/i.test(event)) {
      return Response.json({ skipped: "non_message_event", event }, { headers: corsHeaders });
    }

    // Extrai a lista de mensagens cobrindo wrappers comuns da Evolution.
    const data = body?.data ?? body;
    const messages: any[] = Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data)
      ? data
      : data?.message || data?.key
      ? [data]
      : [body];

    const results = [] as any[];
    for (const m of messages) {
      if (!m) continue;
      // Sempre usa nome canônico para casar com wa_groups/team_members/UI.
      results.push(await handleMessage(canonicalInstanceName(instanceName), m));
    }

    const savedCount = results.filter((r) => r?.saved).length;
    if (savedCount === 0 && messages.length > 0) {
      await logHealth("info", "no_messages_saved", {
        event,
        instanceName,
        count: messages.length,
        reasons: results.map((r) => r?.skipped ?? (r?.error ? "error" : "ok")),
      });
    }

    return Response.json({ ok: true, count: results.length, saved: savedCount, results }, { headers: corsHeaders });
  } catch (e) {
    await logHealth("error", `webhook crash: ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: corsHeaders });
  }
});