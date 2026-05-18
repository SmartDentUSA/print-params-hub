import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classifyMessage, deriveTopicContext } from "../_shared/wa-intent.ts";
import { mergeTagsCrm } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


const MAX_WHATSAPP_LENGTH = 4000;
const DEDUP_OUTBOUND_MS = 30000;
const DEDUP_CONTENT_MINUTES = 5;
const STALE_MESSAGE_MS = 120000;

// ── Phone normalization ───
function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

// ── Strip markdown for WhatsApp plain text ───
function stripMarkdownForWhatsApp(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Strip WhatsApp suffixes from phone/chat IDs ───
function stripWaSuffix(raw: string): string {
  return raw.replace(/@(c\.us|s\.whatsapp\.net|lid)$/i, "");
}

// ── Smart truncation: cut at last full paragraph + RAG fallback link ───
function smartTruncateForWhatsApp(text: string, maxLen: number, fallbackUrl: string | null): string {
  if (text.length <= maxLen) return text;
  const reserve = 120;
  const sliceEnd = maxLen - reserve;
  const slice = text.slice(0, sliceEnd);
  const lastParaBreak = slice.lastIndexOf("\n\n");
  const cut = lastParaBreak > sliceEnd * 0.6 ? slice.slice(0, lastParaBreak) : slice;
  const tail = fallbackUrl
    ? `\n\n📖 Resposta completa: ${fallbackUrl}`
    : `\n\n📖 Resposta completa em: https://parametros.smartdent.com.br`;
  return cut.trimEnd() + tail;
}

// ── Extract media (image) from Evolution payload ───
function extractMedia(body: Record<string, unknown>): { url: string | null; type: string | null } {
  const data = (body.data || {}) as Record<string, unknown>;
  const msg = (data.message || body.message_obj || {}) as Record<string, unknown>;
  const url = String(
    body.media_url || body.mediaUrl || (msg as any).imageMessage?.url ||
    (msg as any).image?.url || (body as any).file_url || ""
  ) || null;
  const type = String(
    body.media_type || body.mediaType || (data as any).messageType ||
    ((msg as any).imageMessage ? "image" : "") || ""
  ) || null;
  return { url, type };
}

// ── Extract fields from flexible payload shapes ───
function extractFields(body: Record<string, unknown>): { phone: string; messageText: string; senderName: string; lastMessageDate: string | null } {
  const nested = (body.data || body.contact || {}) as Record<string, unknown>;
  const customer = (body.customer || {}) as Record<string, unknown>;
  const combined = (body.combinedCardCustomer || {}) as Record<string, unknown>;
  const keyData = (body.key || body._data && (body._data as Record<string, unknown>).key || {}) as Record<string, unknown>;

  const rawPhone = String(
    body.phone || body.from || body.sender || body.contact_phone ||
    body.chatId || body.chat || customer.phone || nested.phone || nested.chatId || ""
  );
  let phone = stripWaSuffix(rawPhone);

  // @lid resolution: WhatsApp sends internal IDs instead of real phone numbers.
  // The real phone is available in alternative payload fields.
  if (rawPhone.includes("@lid") || (phone.replace(/\D/g, "").length > 13)) {
    const nestedKey = (nested.key || {}) as Record<string, unknown>;
    const nestedMsg = (nested.message || {}) as Record<string, unknown>;
    const ctxInfo = ((nestedMsg as any).extendedTextMessage?.contextInfo ||
                     (nestedMsg as any).imageMessage?.contextInfo ||
                     (body as any).contextInfo || {}) as Record<string, unknown>;
    const senderPn = String(
      body.senderPn || nested.senderPn || keyData.senderPn ||
      nestedKey.senderPn || nestedKey.participantPn || nestedKey.remoteJidAlt ||
      ctxInfo.participant || (ctxInfo as any).participantPn ||
      body.remoteJidAlt || nested.remoteJidAlt || keyData.remoteJidAlt ||
      body.participant || nested.participant ||
      (body as any).wa_id || (customer as any).wa_id || (nested as any).wa_id || ""
    );
    const altPhone = stripWaSuffix(senderPn);
    const altDigits = altPhone.replace(/\D/g, "");
    if (altDigits.length >= 10 && altDigits.length <= 15) {
      console.log(`[dra-lia-wa] Resolved @lid "${phone}" → real phone "${altPhone}"`);
      phone = altPhone;
    } else {
      console.warn(`[dra-lia-wa] @lid detected but no real phone found in payload. Using LID as fallback.`);
    }
  }

  const messageText = String(
    body.message || body.text || body.body || body.lastMessage ||
    body.content || combined.lastMessage ||
    nested.message || nested.text || nested.lastMessage || ""
  );

  const senderName = String(
    body.sender_name || body.name || body.contact_name ||
    body.pushName || customer.name || nested.name || nested.pushName || ""
  );

  // Extract lastMessageDate for recency filter
  const rawDate = combined.lastMessageDate || body.lastMessageDate || nested.lastMessageDate || null;
  const lastMessageDate = rawDate ? String(rawDate) : null;

  return { phone, messageText, senderName, lastMessageDate };
}

// ── Check if message should be ignored (anti-loop) ───
function shouldIgnore(body: Record<string, unknown>): string | null {
  if (body.fromMe === true || body.isFromMe === true || (body as any).key?.fromMe === true) {
    return "fromMe";
  }
  if (body.isGroup === true || body.isGroupMsg === true) {
    return "isGroup";
  }
  return null;
}

// ── Normalize text for anti-echo comparison ───
function normalizeForEcho(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Consume SSE stream from dra-lia and return full text ───
async function consumeSSEStream(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") return fullText;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === "meta") continue;
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) fullText += content;
      } catch { /* partial JSON, skip */ }
    }
  }

  return fullText;
}

// ── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const isDebug = url.searchParams.get("debug") === "true";

    // Log everything we can for debug
    const contentType = req.headers.get("content-type") || "";
    console.log("[dra-lia-wa] Content-Type:", contentType);
    console.log("[dra-lia-wa] URL search params:", url.searchParams.toString());

    // Parse body flexibly: JSON, form-data, or empty
    let body: Record<string, unknown> = {};
    const rawText = await req.text();
    console.log("[dra-lia-wa] Raw body length:", rawText.length, "preview:", rawText.slice(0, 1500));

    if (rawText.length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch {
        // Try URL-encoded form data
        try {
          const params = new URLSearchParams(rawText);
          for (const [key, value] of params.entries()) {
            body[key] = value;
          }
        } catch {
          console.warn("[dra-lia-wa] Could not parse body as JSON or form-data");
        }
      }
    }

    // Merge query params into body (ChatCenter may send data via URL)
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "debug") {
        body[key] = value;
      }
    }

    console.log("[dra-lia-wa] Parsed body keys:", Object.keys(body).join(", "));
    console.log("[dra-lia-wa] Parsed body:", JSON.stringify(body).slice(0, 1500));

    // ── Debug mode: log everything and return 200 ───
    if (isDebug) {
      console.log("[dra-lia-wa] DEBUG MODE — full payload logged, no processing");
      return new Response(JSON.stringify({
        debug: true,
        received_keys: Object.keys(body),
        received_body: body,
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Anti-loop: ignore own messages and groups ───
    const ignoreReason = shouldIgnore(body);
    if (ignoreReason) {
      console.log(`[dra-lia-wa] Ignored: ${ignoreReason}`);
      return new Response(JSON.stringify({ ignored: true, reason: ignoreReason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extract fields with flexible mapping ───
    const { phone, messageText, senderName, lastMessageDate } = extractFields(body);

    // Warn about unresolved template variables but continue processing
    if (messageText.includes("{{") || phone.includes("{{") || senderName.includes("{{")) {
      console.warn("[dra-lia-wa] WARNING: Possible unresolved template variables detected — continuing anyway", {
        phone, message: messageText.slice(0, 100), senderName,
      });
    }

    if (!phone || phone === "undefined" || phone === "null") {
      return new Response(JSON.stringify({ error: "phone is required", received_keys: Object.keys(body) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messageText || messageText.trim().length < 1 || messageText === "undefined") {
      console.log("[dra-lia-wa] No message content — likely a non-message webhook event, ignoring gracefully");
      return new Response(JSON.stringify({ ignored: true, reason: "no_message_content", received_keys: Object.keys(body) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Recency filter: ignore stale messages (lastMessageDate > 2 min ago) ───
    if (lastMessageDate) {
      const msgTime = new Date(lastMessageDate).getTime();
      if (!isNaN(msgTime)) {
        const ageMs = Date.now() - msgTime;
        if (ageMs > STALE_MESSAGE_MS) {
          console.log(`[dra-lia-wa] Stale message: lastMessageDate ${lastMessageDate} is ${Math.round(ageMs / 1000)}s old — ignoring`);
          return new Response(JSON.stringify({ ignored: true, reason: "stale_message", age_seconds: Math.round(ageMs / 1000) }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const phoneDigits = phone.replace(/\D/g, "");
    const phoneSuffix = normalizePhoneForMatch(phone);
    console.log(`[dra-lia-wa] Received: phone=${phoneDigits} msg="${messageText.slice(0, 80)}"`);

    // ── Extract media (image) so we can pass image_data to dra-lia (parity with site) ──
    const media = extractMedia(body);
    const hasImage = !!(media.url && (media.type === "image" || /image\//i.test(media.type || "")));

    // ── Intent classification + topic_context derivation (mirror site routes) ──
    const { intent, confidence } = classifyMessage(messageText);
    const topicContext = deriveTopicContext(messageText, intent, hasImage);
    console.log(`[dra-lia-wa] Intent=${intent} (${confidence}%) topic_context=${topicContext} hasImage=${hasImage}`);

    // ── Content dedup: check if same phone+message already processed in last 5 min ───
    const fiveMinAgo = new Date(Date.now() - DEDUP_CONTENT_MINUTES * 60 * 1000).toISOString();
    const { data: recentInbound } = await supabase
      .from("whatsapp_inbox")
      .select("id")
      .eq("phone_normalized", phoneSuffix)
      .eq("message_text", messageText)
      .eq("direction", "inbound")
      .gte("created_at", fiveMinAgo)
      .limit(1);

    if (recentInbound && recentInbound.length > 0) {
      console.log(`[dra-lia-wa] Duplicate content: same phone+message found in last ${DEDUP_CONTENT_MINUTES}min — ignoring`);
      return new Response(JSON.stringify({ ignored: true, reason: "duplicate_content" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Outbound dedup: check recent outbound for same phone ───
    const { data: recentOutbound } = await supabase
      .from("whatsapp_inbox")
      .select("id, created_at")
      .eq("phone_normalized", phoneSuffix)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentOutbound && recentOutbound.length > 0) {
      const lastOutAt = new Date(recentOutbound[0].created_at).getTime();
      if (Date.now() - lastOutAt < DEDUP_OUTBOUND_MS) {
        console.log(`[dra-lia-wa] Dedup: last outbound ${Date.now() - lastOutAt}ms ago — skipping`);
        return new Response(JSON.stringify({ ignored: true, reason: "dedup_window" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Find lead in lia_attendances (DO NOT create placeholder — let dra-lia qualify)
    let leadId: string | null = null;
    let leadEmail: string | null = null;
    let leadNome: string | null = null;

    if (phoneSuffix.length >= 8) {
      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, email, nome, total_messages, total_sessions, proprietario_lead_crm, especialidade, ultima_etapa_comercial, lead_stage_detected, urgency_level, recommended_approach, tags_crm")
        .ilike("telefone_normalized", `%${phoneSuffix}`)
        .is("merged_into", null)
        .limit(1);

      if (leads && leads.length > 0) {
        leadId = leads[0].id;
        leadEmail = leads[0].email;
        leadNome = leads[0].nome;
        console.log(`[dra-lia-wa] Matched lead: ${leadNome} (${leadId})`);
      }
    }

    // No placeholder creation: dra-lia runs progressive qualification (nome → email → tel → área → especialidade)
    // and merge engine vinculates the lia_attendances row once minimum identity exists.
    if (!leadId) {
      console.log(`[dra-lia-wa] Unknown phone ${phoneDigits} — dra-lia will run full qualification flow`);
    }

    // 2. Build conversation history from agent_interactions (query by session_id, not lead_id)
    const sessionId = `wa_${phoneDigits}`;
    const history: Array<{ role: string; content: string }> = [];
    {
      const { data: interactions } = await supabase
        .from("agent_interactions")
        .select("user_message, agent_response")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (interactions && interactions.length > 0) {
        for (const int of interactions.reverse()) {
          history.push({ role: "user", content: int.user_message });
          if (int.agent_response) {
            history.push({ role: "assistant", content: int.agent_response });
          }
        }
      }
    }

    // If lead is already known, remove prior assistant prompts asking for email
    // to avoid reinforcing an unnecessary email-collection loop.
    const filteredHistory = (leadEmail && leadNome)
      ? history.filter((msg) => !(msg.role === "assistant" && /e-?mail|email|correo/i.test(msg.content) && /reconhecer|recognize|reconocerte|token|informe|informar|forneça|provide/i.test(msg.content)))
      : history;

    // 2b. Pre-seed agent_sessions ONLY for real leads with real email (parity with site recognition).
    // Includes topic_context so dra-lia uses the same route as the site (commercial/support/parameters).
    const isRealLead = !!(leadId && leadEmail && !/@whatsapp\.lead$/i.test(leadEmail));
    if (isRealLead) {
      const { error: sessErr } = await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        current_state: "chatting",
        extracted_entities: {
          lead_id: leadId,
          lead_name: leadNome || `WhatsApp ${phoneDigits.slice(-4)}`,
          lead_email: leadEmail,
          topic_context: topicContext,
        },
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });

      if (sessErr) {
        console.warn("[dra-lia-wa] Failed to upsert agent_sessions:", sessErr.message);
      } else {
        console.log(`[dra-lia-wa] Pre-seeded agent_sessions for ${sessionId} (lead ${leadId}, topic=${topicContext})`);
      }
    } else {
      // Unknown / placeholder — store topic_context + phone so qualification persists across turns
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        current_state: "chatting",
        extracted_entities: {
          wa_phone: phoneDigits,
          topic_context: topicContext,
        },
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" }).then(({ error: e }) => { if (e) console.warn("[wa] session upsert error:", e.message); });
    }

    // 3. If image present, download and base64-encode for dra-lia visual classifier (parity with site)
    let imageData: { base64: string; mime_type: string } | null = null;
    if (hasImage && media.url) {
      try {
        const imgRes = await fetch(media.url, { signal: AbortSignal.timeout(10000) });
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const mime = imgRes.headers.get("content-type") || "image/jpeg";
          imageData = { base64: b64, mime_type: mime };
          console.log(`[dra-lia-wa] Image fetched: ${buf.byteLength}B mime=${mime}`);
        } else {
          console.warn(`[dra-lia-wa] Image fetch failed status=${imgRes.status}`);
        }
      } catch (e) {
        console.warn("[dra-lia-wa] Image fetch error:", e);
      }
    }

    // 4. Call dra-lia internally (SSE stream) with topic_context + image_data
    let liaResponse = "";
    let ragLinks: string[] = [];

    try {
      const liaUrl = `${SUPABASE_URL}/functions/v1/dra-lia?action=chat`;
      const liaRes = await fetch(liaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          message: messageText || (hasImage ? "Analise esta imagem" : ""),
          history: filteredHistory,
          lang: "pt-BR",
          session_id: sessionId,
          topic_context: topicContext,
          image_data: imageData,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!liaRes.ok) {
        const errText = await liaRes.text();
        console.error(`[dra-lia-wa] dra-lia returned ${liaRes.status}: ${errText.slice(0, 200)}`);

        if (liaRes.status === 429) {
          liaResponse = "Estou com muitas conversas no momento! 😊 Pode me enviar sua pergunta novamente em alguns instantes? Obrigada pela paciência!";
        } else {
          liaResponse = "Desculpe, tive um problema técnico agora. Pode repetir sua pergunta? Se preferir, fale com nosso time: wa.me/5516993831794";
        }
      } else {
        liaResponse = await consumeSSEStream(liaRes);
      }
    } catch (err) {
      console.error("[dra-lia-wa] Fetch to dra-lia failed:", err);
      liaResponse = "Desculpe, tive um problema técnico agora. Pode repetir sua pergunta? Se preferir, fale com nosso time: wa.me/5516993831794";
    }

    if (!liaResponse) {
      liaResponse = "Desculpe, não consegui processar sua mensagem. Pode tentar novamente? 😊";
    }

    // Safety-net: if lead is already known, don't allow repeated email-collection responses.
    if (leadEmail && leadNome && /e-?mail|email|correo/i.test(liaResponse) && /reconhecer|recognize|reconocerte|token|informe|informar|forneça|provide/i.test(liaResponse)) {
      console.warn("[dra-lia-wa] Email-loop guard activated for known lead", { leadId, sessionId });
      liaResponse = `${leadNome}, já te reconheci por aqui ✅\n\nComo posso te ajudar agora?`;
    }

    // Extract candidate fallback URL from RAG links present in the response
    {
      const re = /https?:\/\/[^\s)>\]]+/g;
      const matches = liaResponse.match(re);
      if (matches) ragLinks = matches.slice(0, 3);
    }

    // 5. Format for WhatsApp + smart truncation with RAG fallback link
    let waMessage = stripMarkdownForWhatsApp(liaResponse);
    waMessage = smartTruncateForWhatsApp(waMessage, MAX_WHATSAPP_LENGTH, ragLinks[0] || null);

    // 5. Send reply via smart-ops-send-waleads (same path as manual card)
    let replySent = false;
    let teamMemberId: string | null = null;

    // Find team_member_id: first try lead owner, then fallback
    if (leadId) {
      const { data: att } = await supabase
        .from("lia_attendances")
        .select("proprietario_lead_crm")
        .eq("id", leadId)
        .single();

      if (att?.proprietario_lead_crm) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("id")
          .ilike("nome_completo", `%${att.proprietario_lead_crm.split(" ")[0]}%`)
          .eq("ativo", true)
          .not("waleads_api_key", "is", null)
          .limit(1)
          .single();

        if (tm) teamMemberId = tm.id;
      }
    }

    if (!teamMemberId) {
      const { data: fallbackTm } = await supabase
        .from("team_members")
        .select("id")
        .eq("ativo", true)
        .not("waleads_api_key", "is", null)
        .limit(1)
        .single();

      if (fallbackTm) {
        teamMemberId = fallbackTm.id;
      } else {
        console.warn("[dra-lia-wa] No team member with waleads_api_key found — reply NOT sent");
      }
    }

    // Call smart-ops-send-waleads internally (same code path as the manual card)
    if (teamMemberId) {
      try {
        const sendUrl = `${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`;
        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            team_member_id: teamMemberId,
            phone: phoneDigits,
            message: waMessage,
            lead_id: leadId,
            tipo: "text",
          }),
          signal: AbortSignal.timeout(15000),
        });

        const sendBody = await sendRes.text();
        console.log(`[dra-lia-wa] send-waleads status=${sendRes.status} body=${sendBody.slice(0, 300)}`);

        try {
          const parsed = JSON.parse(sendBody);
          replySent = parsed.success === true;
        } catch {
          replySent = sendRes.ok;
        }
      } catch (e) {
        console.error("[dra-lia-wa] send-waleads call error:", e);
      }
    }

    // 6. Log inbound in whatsapp_inbox (outbound is persisted by smart-ops-send-waleads)
    await supabase.from("whatsapp_inbox").insert({
      phone: phoneDigits,
      phone_normalized: phoneSuffix,
      message_text: messageText || (hasImage ? "[image]" : ""),
      media_url: media.url,
      media_type: media.type,
      direction: "inbound",
      lead_id: leadId,
      matched_by: leadId ? `ilike_%${phoneSuffix}` : "created_new",
      intent_detected: intent,
      confidence_score: confidence,
      raw_payload: body,
      processed_at: new Date().toISOString(),
    });

    // 7. Hot lead alert: notify seller for immediate/future interest
    if (leadId && (intent === "interesse_imediato" || intent === "interesse_futuro")) {
      try {
        const { data: hotLead } = await supabase
          .from("lia_attendances")
          .select("nome, especialidade, proprietario_lead_crm, ultima_etapa_comercial, lead_stage_detected, urgency_level, recommended_approach")
          .eq("id", leadId)
          .single();
        const ownerName = hotLead?.proprietario_lead_crm || "Sem owner";
        const firstName = ownerName.split(" ")[0];
        const { data: members } = await supabase
          .from("team_members")
          .select("id, nome_completo, whatsapp_number, waleads_api_key")
          .ilike("nome_completo", `%${firstName}%`)
          .eq("ativo", true)
          .not("waleads_api_key", "is", null)
          .limit(1);
        if (members && members.length > 0 && members[0].whatsapp_number) {
          const m = members[0];
          const alertMsg = [
            "🚨 OPORTUNIDADE QUENTE",
            `Lead: ${hotLead?.nome || "?"} (${hotLead?.especialidade || "?"})`,
            `Owner: ${ownerName}`,
            `Resposta: "${messageText.slice(0, 200)}"`,
            `Etapa CRM: ${hotLead?.ultima_etapa_comercial || "?"}`,
            `Cognitivo: ${hotLead?.lead_stage_detected || "?"} | Urgência: ${hotLead?.urgency_level || "?"}`,
            `Ação: ${hotLead?.recommended_approach || "Contato imediato"}`,
          ].join("\n");
          await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ team_member_id: m.id, phone: m.whatsapp_number, tipo: "text", message: alertMsg, lead_id: leadId }),
          });
          console.log(`[dra-lia-wa] Hot lead alert sent to ${m.nome_completo}`);
        }
      } catch (e) {
        console.warn("[dra-lia-wa] Hot lead alert error:", e);
      }
    }

    // 8. sem_interesse → tag lead
    if (leadId && intent === "sem_interesse") {
      try {
        const { data: tagLead } = await supabase
          .from("lia_attendances").select("tags_crm").eq("id", leadId).single();
        const newTags = mergeTagsCrm(tagLead?.tags_crm as string[] | null, ["A_SEM_RESPOSTA"]);
        await supabase.from("lia_attendances")
          .update({ tags_crm: newTags, updated_at: new Date().toISOString() })
          .eq("id", leadId);
      } catch (e) {
        console.warn("[dra-lia-wa] sem_interesse tag error:", e);
      }
    }

    const result = {
      success: true,
      lead_id: leadId,
      reply_sent: replySent,
      reply_length: waMessage.length,
      team_member_id: teamMemberId,
      intent,
      topic_context: topicContext,
      had_image: hasImage,
    };

    console.log("[dra-lia-wa] Result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dra-lia-wa] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
