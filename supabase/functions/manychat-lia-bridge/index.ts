// ManyChat → dra-lia bridge (síncrono).
// ManyChat External Request tem timeout ~10s. Bridge chama dra-lia com
// AbortController de 8s e devolve a resposta direto no JSON do External
// Request (sem Send API, sem token). Se estourar timeout, devolve
// EMPTY_REPLY e ManyChat aciona o fallback do bloco.

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_CHUNK = 900; // ManyChat IG ~1000 chars/msg, margem de segurança.
const DRA_LIA_TIMEOUT_MS = 8000; // < 10s do External Request do ManyChat.

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

function multiTextReply(chunks: string[]) {
  return {
    version: "v2",
    content: {
      messages: chunks.map((text) => ({ type: "text", text })),
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
  try {
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
  } catch {
    // Stream abortado (timeout): retorna o que já temos.
  }
  return full;
}

// Quebra texto em chunks <= MAX_CHUNK respeitando parágrafos/quebras.
function chunkText(text: string, max = MAX_CHUNK): string[] {
  const clean = text.trim();
  if (clean.length <= max) return [clean];
  const out: string[] = [];
  const paragraphs = clean.split(/\n{2,}/);
  let cur = "";
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    if ((cur + "\n\n" + p).trim().length <= max) {
      cur = cur ? cur + "\n\n" + p : p;
    } else {
      if (cur) { out.push(cur); cur = ""; }
      if (p.length <= max) {
        cur = p;
      } else {
        // quebra um parágrafo muito grande por sentença
        const sentences = p.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          if ((cur + " " + s).trim().length <= max) {
            cur = (cur ? cur + " " : "") + s;
          } else {
            if (cur) { out.push(cur); cur = ""; }
            if (s.length <= max) cur = s;
            else {
              // último recurso: corte hard
              for (let i = 0; i < s.length; i += max) {
                out.push(s.slice(i, i + max));
              }
            }
          }
        }
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function logHealth(
  supabase: ReturnType<typeof createClient>,
  severity: "info" | "warn" | "error",
  errorType: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "manychat-lia-bridge",
      severity,
      error_type: errorType,
      details,
    });
  } catch (_) { /* noop */ }
}

// Chama dra-lia síncrono com timeout. Retorna o texto da resposta
// (ou string vazia em caso de timeout/erro — o caller decide o fallback).
async function callDraLiaSync(
  supabase: ReturnType<typeof createClient>,
  subscriberId: string,
  sessionId: string,
  message: string,
  name: string,
): Promise<{ reply: string; elapsedMs: number; timedOut: boolean }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DRA_LIA_TIMEOUT_MS);
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
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      await logHealth(supabase, "error", "dra_lia_http_error_sync", {
        subscriberId,
        status: resp.status,
        body: errText.slice(0, 500),
      });
      return { reply: "", elapsedMs: Date.now() - started, timedOut: false };
    }

    const reply = (await consumeSSE(resp)).trim();
    const elapsedMs = Date.now() - started;
    const timedOut = controller.signal.aborted;
    return { reply, elapsedMs, timedOut };
  } catch (err) {
    const elapsedMs = Date.now() - started;
    const timedOut = controller.signal.aborted;
    await logHealth(supabase, timedOut ? "warn" : "error",
      timedOut ? "dra_lia_timeout" : "dra_lia_error_sync", {
      subscriberId,
      error: (err as Error).message,
      elapsed_ms: elapsedMs,
    });
    return { reply: "", elapsedMs, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

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

  // Caminho LLM: responde JÁ ao ManyChat (evita timeout 10s) e processa
  // Caminho LLM síncrono: aguarda dra-lia até 8s e devolve direto.
  await logHealth(supabase, "info", "sync_dispatch", { subscriberId, msg_len: message.length });
  const { reply, elapsedMs, timedOut } = await callDraLiaSync(
    supabase, subscriberId, sessionId, message, name,
  );

  if (timedOut || !reply || reply.length < 2) {
    await logHealth(supabase, "warn",
      timedOut ? "dra_lia_timeout" : "dra_lia_empty_reply", {
      subscriberId, elapsed_ms: elapsedMs, reply_len: reply.length,
    });
    return jsonResponse(EMPTY_REPLY, 200);
  }

  const chunks = chunkText(reply);
  await logHealth(supabase, "info", "sync_reply_ok", {
    subscriberId,
    reply_len: reply.length,
    chunks: chunks.length,
    elapsed_ms: elapsedMs,
  });
  return jsonResponse(multiTextReply(chunks), 200);
});
