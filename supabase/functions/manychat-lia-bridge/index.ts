// ManyChat → dra-lia bridge.
// Recebe POST do ManyChat External Request (Instagram DM) e retorna no
// formato v2 esperado pelo flow. Aplica short-circuits anti-loop antes
// de invocar dra-lia.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMPTY_REPLY = {
  version: "v2",
  content: { messages: [], actions: [], quick_replies: [] },
};

function textReply(text: string) {
  return {
    version: "v2",
    content: {
      messages: text ? [{ type: "text", text }] : [],
      actions: [],
      quick_replies: [],
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GREETING_RE = /^\s*(oi+|ol[áa]|hello|hi|hey|bom dia|boa tarde|boa noite|e ?a[ií]|tudo bem)\s*[!.?]*\s*$/i;
const EMOJI_ONLY_RE = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}\p{P}\p{S}]+$/u;
const URL_ONLY_RE = /^\s*https?:\/\/\S+\s*$/i;

// Consome o SSE do dra-lia e retorna o texto completo concatenado.
async function consumeSSE(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return full;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "meta") continue;
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) full += c;
      } catch { /* partial */ }
    }
  }
  return full;
}

async function logHealth(
  supabase: ReturnType<typeof createClient>,
  level: string,
  message: string,
  context: Record<string, unknown>,
) {
  try {
    await supabase.from("system_health_logs").insert({
      source: "manychat_bridge",
      level,
      message,
      context,
    });
  } catch (_) { /* noop */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(textReply(""), 200);
  }

  const subscriberId = String(body.subscriber_id ?? "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!subscriberId) {
    await logHealth(supabase, "warn", "missing_subscriber_id", { body });
    return jsonResponse(EMPTY_REPLY, 200);
  }

  const sessionId = `mc_${subscriberId}`;

  // No-op se vier mensagem vazia
  if (!message) {
    await logHealth(supabase, "info", "empty_message_skip", { subscriberId });
    return jsonResponse(EMPTY_REPLY, 200);
  }

  // SHORT-CIRCUIT 1: anti-loop curto (< 3 chars dentro de 20s)
  if (message.length < 3) {
    const since = new Date(Date.now() - 20_000).toISOString();
    const { data: recent } = await supabase
      .from("agent_interactions")
      .select("id")
      .eq("session_id", sessionId)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      await logHealth(supabase, "info", "shortcircuit_loop_guard", { subscriberId, message });
      return jsonResponse(EMPTY_REPLY, 200);
    }
  }

  // SHORT-CIRCUIT 2: só emoji / URL / pontuação
  if (EMOJI_ONLY_RE.test(message) || URL_ONLY_RE.test(message)) {
    await logHealth(supabase, "info", "shortcircuit_emoji_or_url", { subscriberId, message });
    return jsonResponse(EMPTY_REPLY, 200);
  }

  // SHORT-CIRCUIT 3: saudação de lead já identificado
  if (GREETING_RE.test(message)) {
    const { data: lead } = await supabase
      .from("lia_attendances")
      .select("nome")
      .eq("manychat_subscriber_id", subscriberId)
      .is("merged_into", null)
      .limit(1)
      .maybeSingle();
    if (lead?.nome) {
      const firstName = String(lead.nome).split(/\s+/)[0];
      await logHealth(supabase, "info", "shortcircuit_greeting_known", { subscriberId });
      return jsonResponse(textReply(`Oi, ${firstName}! 👋 Como posso te ajudar?`), 200);
    }
  }

  // Chama dra-lia com o canal Instagram
  try {
    const draLiaUrl = `${SUPABASE_URL}/functions/v1/dra-lia`;
    const resp = await fetch(draLiaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        source: "manychat_instagram",
        manychat_subscriber_id: subscriberId,
        manychat_name: name || null,
        lang: "pt-BR",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      await logHealth(supabase, "error", "dra_lia_http_error", {
        subscriberId,
        status: resp.status,
        body: errText.slice(0, 500),
      });
      return jsonResponse(EMPTY_REPLY, 200);
    }

    const reply = (await consumeSSE(resp)).trim();
    if (!reply) {
      await logHealth(supabase, "warn", "dra_lia_empty_reply", { subscriberId });
      return jsonResponse(EMPTY_REPLY, 200);
    }
    return jsonResponse(textReply(reply), 200);
  } catch (err) {
    await logHealth(supabase, "error", "bridge_exception", {
      subscriberId,
      error: (err as Error).message,
    });
    return jsonResponse(EMPTY_REPLY, 200);
  }
});
