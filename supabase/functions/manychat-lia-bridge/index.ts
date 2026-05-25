// ManyChat → bridge de qualificação síncrona.
// Fluxo:
//   1. Procura lead por manychat_subscriber_id em lia_attendances
//      (merged_into IS NULL).
//   2. Se faltar nome/email/telefone, coleta nessa ordem antes de qualquer
//      coisa, respondendo direto no JSON do External Request do ManyChat.
//   3. Quando o perfil mínimo estiver completo, envia mensagem
//      "Como posso te ajudar?" com quick replies das rotas da LIA.
//   4. NUNCA usa Send API nem MANYCHAT_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMPTY_REPLY = {
  version: "v2",
  reply: "",
  qualification_state: "idle",
  content: { messages: [], actions: [], quick_replies: [] },
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Rotas da LIA oferecidas após a qualificação.
const LIA_ROUTES: Array<{ title: string; payload: string }> = [
  { title: "🌐 Visitar o site", payload: "rota_site" },
  { title: "🛒 Ver produtos", payload: "rota_produtos" },
  { title: "🎓 Cursos", payload: "rota_cursos" },
  { title: "💬 Falar com especialista", payload: "rota_especialista" },
];

const SITE_URL = "https://www.smartdent.com.br";

type ReplyMeta = {
  state: "ask_name" | "ask_email" | "ask_phone" | "ask_product" | "completed" | "error" | "idle";
  lead_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  lead_product?: string | null;
};

function buildReply(text: string, meta: ReplyMeta) {
  return {
    version: "v2",
    reply: text || "",
    lead_name: meta.lead_name || "",
    lead_email: meta.lead_email || "",
    lead_phone: meta.lead_phone || "",
    lead_product: meta.lead_product || "",
    qualification_state: meta.state,
    content: {
      messages: text ? [{ type: "text", text }] : [],
      actions: [],
      quick_replies: [],
    },
  };
}

function textReply(text: string, meta: ReplyMeta = { state: "idle" }) {
  return buildReply(text, meta);
}

function replyWithRoutes(greeting: string, meta: ReplyMeta) {
  const routesText = [
    "",
    "Escolha uma opção respondendo o número:",
    `1) 🌐 Site: ${SITE_URL}`,
    "2) 🛒 Ver produtos",
    "3) 🎓 Cursos",
    "4) 💬 Falar com especialista",
  ].join("\n");
  const fullText = `${greeting}\n${routesText}`;
  const payload = buildReply(fullText, { ...meta, state: "completed" });
  // Mantém quick_replies/buttons para clientes Dynamic Block (não usados pelo
  // "Enviar Mensagem" simples, mas inofensivos).
  payload.content.messages = [
    {
      type: "text",
      text: fullText,
      // @ts-ignore - extra fields aceitos pelo Dynamic Block
      buttons: [{ type: "url", caption: "🌐 Visitar o site", url: SITE_URL }],
      quick_replies: LIA_ROUTES.map((r) => ({
        type: "node", caption: r.title, target: r.payload,
      })),
    },
  ];
  payload.content.quick_replies = LIA_ROUTES.map((r) => ({
    type: "node", caption: r.title, target: r.payload,
  })) as any;
  return payload;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function isValidName(s: string): boolean {
  const n = s.trim();
  if (n.length < 2) return false;
  const alpha = n.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return alpha.length >= 2;
}

function extractEmail(s: string): string | null {
  const m = s.replace(/\s*@\s*/g, "@").match(EMAIL_REGEX);
  return m ? m[0].toLowerCase() : null;
}

type LeadRow = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone_normalized: string | null;
  manychat_subscriber_id: string | null;
  produto_interesse_auto: string | null;
};

async function findOrCreateLead(
  supabase: ReturnType<typeof createClient>,
  subscriberId: string,
  fallbackName: string,
): Promise<LeadRow> {
  const { data: existing } = await supabase
    .from("lia_attendances")
    .select("id, nome, email, telefone_normalized, manychat_subscriber_id")
    .eq("manychat_subscriber_id", subscriberId)
    .is("merged_into", null)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing as LeadRow;

  const syntheticEmail = `mc_${subscriberId}@instagram.lead`;
  const initialName = fallbackName && fallbackName.trim().length >= 2
    ? fallbackName.trim()
    : "Lead Instagram";

  const { data: created, error } = await supabase
    .from("lia_attendances")
    .insert({
      nome: initialName,
      email: syntheticEmail,
      manychat_subscriber_id: subscriberId,
      manychat_collected_at: new Date().toISOString(),
      instagram: initialName,
      origem_primeiro_contato: "Instagram - autoatendimento",
      lead_status: "novo",
      crm_creation_blocked: true,
      source: "Instagram - autoatendimento",
    })
    .select("id, nome, email, telefone_normalized, manychat_subscriber_id")
    .maybeSingle();

  if (error || !created) {
    throw new Error(`failed to create lead: ${error?.message || "unknown"}`);
  }
  return created as LeadRow;
}

function hasRealName(nome: string | null): boolean {
  if (!nome) return false;
  const n = nome.trim();
  if (n.length < 2) return false;
  if (/^lead\s+instagram$/i.test(n)) return false;
  return isValidName(n);
}

function hasRealEmail(email: string | null): boolean {
  if (!email) return false;
  if (email.endsWith("@manychat.internal")) return false;
  if (email.endsWith("@instagram.lead")) return false;
  return EMAIL_REGEX.test(email);
}

function hasRealPhone(phone: string | null): boolean {
  if (!phone) return false;
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(textReply("", { state: "idle" }), 200);
  }

  const subscriberId = String(body.subscriber_id ?? "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!subscriberId) {
    await logHealth(supabase, "warn", "missing_subscriber_id", { body });
    return jsonResponse(EMPTY_REPLY, 200);
  }

  const sessionId = `mc_${subscriberId}`;

  try {
    // 1. Carrega/cria lead canônico para este subscriber
    const lead = await findOrCreateLead(supabase, subscriberId, name);

    // 2. Carrega estado da sessão (qual campo estamos coletando)
    const { data: sess } = await supabase
      .from("agent_sessions")
      .select("extracted_entities")
      .eq("session_id", sessionId)
      .maybeSingle();
    const entities = (sess?.extracted_entities as Record<string, unknown>) || {};

    // Fonte de verdade combinada: DB + entidades da sessão (em caso de
    // conflito de email único no DB, mantemos o valor coletado em sessão).
    let nomeAtual = (entities.collected_name as string | undefined) || lead.nome;
    let emailAtual = (entities.collected_email as string | undefined) || lead.email;
    let phoneAtual = (entities.collected_phone as string | undefined) || lead.telefone_normalized;

    // 3. Se mensagem é resposta a uma pergunta pendente, processa
    if (message) {
      // Só honra a flag se for o PRÓXIMO campo faltante na ordem nome→email→telefone.
      // Isso evita responder "telefone inválido" quando na verdade ainda falta email
      // (caso de sessões antigas criadas antes do email sintético virar inválido).
      const nextMissing: "name" | "email" | "phone" | null =
        !hasRealName(nomeAtual) ? "name"
        : !hasRealEmail(emailAtual) ? "email"
        : !hasRealPhone(phoneAtual) ? "phone"
        : null;

      if (nextMissing === "name" && entities.awaiting_manychat_name) {
        if (isValidName(message)) {
          nomeAtual = message.trim();
          entities.collected_name = nomeAtual;
          await supabase.from("lia_attendances")
            .update({ nome: nomeAtual, instagram: nomeAtual, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
        }
      } else if (nextMissing === "email" && entities.awaiting_manychat_email) {
        const ext = extractEmail(message);
        if (ext) {
          emailAtual = ext;
          entities.collected_email = emailAtual;
          // Tenta atualizar; se conflito de unique, mantém o sintético
          const { error: upErr } = await supabase.from("lia_attendances")
            .update({ email: emailAtual, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
          if (upErr) {
            await logHealth(supabase, "warn", "manychat_email_update_conflict", {
              subscriberId, error: upErr.message, attempted_email: emailAtual,
            });
            // mantém leitura local mesmo se DB não atualizou (provável duplicidade)
          }
        } else {
          await logHealth(supabase, "info", "manychat_invalid_email", { subscriberId, message });
          const retry = "Não consegui identificar um e-mail válido. Pode me enviar seu **e-mail** novamente? (ex: nome@exemplo.com)";
          await supabase.from("agent_sessions").upsert({
            session_id: sessionId,
            lead_id: lead.id,
            extracted_entities: { ...entities, awaiting_manychat_email: true },
            current_state: "qualifying",
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "session_id" });
          return jsonResponse(textReply(retry, {
            state: "ask_email", lead_name: nomeAtual, lead_email: null, lead_phone: phoneAtual,
          }), 200);
        }
      } else if (nextMissing === "phone" && entities.awaiting_manychat_phone) {
        const normalized = normalizeBrazilianPhone(message);
        if (normalized) {
          phoneAtual = normalized;
          entities.collected_phone = phoneAtual;
          const { error: phErr } = await supabase.from("lia_attendances").update({
            telefone_normalized: phoneAtual,
            telefone_raw: message.trim(),
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          if (phErr) {
            await logHealth(supabase, "warn", "manychat_phone_update_conflict", {
              subscriberId, error: phErr.message,
            });
          }
        } else {
          await logHealth(supabase, "info", "manychat_invalid_phone", { subscriberId, message });
          const retry = "Não consegui identificar o número. Pode me enviar seu **celular com DDD**? (ex: 11 99999-8888)";
          await supabase.from("agent_sessions").upsert({
            session_id: sessionId,
            lead_id: lead.id,
            extracted_entities: { ...entities, awaiting_manychat_phone: true },
            current_state: "qualifying",
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "session_id" });
          return jsonResponse(textReply(retry, {
            state: "ask_phone", lead_name: nomeAtual, lead_email: emailAtual, lead_phone: null,
          }), 200);
        }
      }
      // Se a flag não bate com o nextMissing (sessão obsoleta), apenas cai
      // para o passo 4, que vai perguntar o campo correto.
    }

    // 4. Determina próxima pergunta com base no que ainda falta
    const missingName = !hasRealName(nomeAtual);
    const missingEmail = !hasRealEmail(emailAtual);
    const missingPhone = !hasRealPhone(phoneAtual);

    if (missingName) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: true,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_name", { subscriberId });
      return jsonResponse(textReply(
        "Olá! 👋 Sou a Dra. LIA da Smart Dent.\nPara te atender melhor, qual é o seu **nome completo**?",
        { state: "ask_name" },
      ), 200);
    }

    if (missingEmail) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: true,
          awaiting_manychat_phone: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_email", { subscriberId });
      const firstName = (nomeAtual || "").split(/\s+/)[0];
      return jsonResponse(textReply(
        `Obrigado, ${firstName}! Qual é o seu **melhor e-mail**?`,
        { state: "ask_email", lead_name: nomeAtual },
      ), 200);
    }

    if (missingPhone) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          lead_email: emailAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: true,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_phone", { subscriberId });
      return jsonResponse(textReply(
        "Perfeito! Agora me envie seu **celular com DDD** (ex: 11 99999-8888).",
        { state: "ask_phone", lead_name: nomeAtual, lead_email: emailAtual },
      ), 200);
    }

    // 5. Perfil completo → limpa flags de coleta e envia rotas
    await supabase.from("agent_sessions").upsert({
      session_id: sessionId,
      lead_id: lead.id,
      extracted_entities: {
        ...entities,
        lead_id: lead.id,
        lead_name: nomeAtual,
        lead_email: emailAtual,
        manychat_subscriber_id: subscriberId,
        channel: "Instagram - autoatendimento",
        awaiting_manychat_name: false,
        awaiting_manychat_email: false,
        awaiting_manychat_phone: false,
      },
      current_state: "idle",
      last_activity_at: new Date().toISOString(),
    }, { onConflict: "session_id" });

    const firstName = (nomeAtual || "").split(/\s+/)[0];
    const justCompleted = entities.awaiting_manychat_phone || entities.awaiting_manychat_email || entities.awaiting_manychat_name;
    const greeting = justCompleted
      ? `Cadastro confirmado, ${firstName}! ✅\nComo posso te ajudar hoje?`
      : `Olá, ${firstName}! 👋\nComo posso te ajudar hoje?`;

    await logHealth(supabase, "info",
      justCompleted ? "manychat_profile_completed" : "manychat_routes_sent",
      { subscriberId, lead_id: lead.id },
    );
    return jsonResponse(replyWithRoutes(greeting, {
      state: "completed",
      lead_name: nomeAtual,
      lead_email: emailAtual,
      lead_phone: phoneAtual,
    }), 200);
  } catch (err) {
    await logHealth(supabase, "error", "manychat_bridge_error", {
      subscriberId,
      error: (err as Error).message,
    });
    return jsonResponse(textReply(
      "Tive um probleminha agora. Pode me chamar novamente em instantes?",
      { state: "error" },
    ), 200);
  }
});
