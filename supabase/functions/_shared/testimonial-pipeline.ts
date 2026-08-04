// Pipeline de depoimentos de treinamento: guardas de autenticação, log de
// eventos, transições de status e validações editoriais.
// Nunca inventa dados: tudo vem do Drive, do banco e da RAG interna.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeadersTestimonial = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const CATEGORY_E_ID = "ff524477-c553-4518-868e-8435e16a5c57";
export const TESTIMONIAL_DESTINATION_KEY = "videos_depoimentos";
export const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const CHAT_MODEL = "openai/gpt-5.6-sol";
export const STT_MODEL = "openai/gpt-4o-transcribe";
/** Limite do gateway de transcrição (25 MiB). */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersTestimonial, "Content-Type": "application/json" },
  });
}

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Autoriza a chamada. Aceita:
 *  - service role (chamadas internas)
 *  - chave do agente SmartOps Marketing (x-api-key)
 *  - JWT de usuário com permissão can_manage_training_media
 */
export async function authorizeTestimonialCall(req: Request): Promise<
  { ok: true; actor: string | null } | { ok: false; status: number; error: string }
> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const agentKey = Deno.env.get("SMARTOPS_MARKETING_AGENT_API_KEY");
  const headerKey = req.headers.get("x-api-key");
  if (agentKey && headerKey && headerKey === agentKey) return { ok: true, actor: null };

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Não autenticado" };
  }
  const token = authHeader.slice(7);
  if (token === serviceKey) return { ok: true, actor: null };

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { ok: false, status: 401, error: "Sessão inválida" };

  const { data: allowed, error: rpcErr } = await userClient.rpc("can_manage_training_media", {
    _user_id: user.id,
  });
  if (rpcErr) return { ok: false, status: 500, error: `Falha na checagem de permissão: ${rpcErr.message}` };
  if (allowed !== true) return { ok: false, status: 403, error: "Sem permissão para mídias de treinamento" };
  return { ok: true, actor: user.id };
}

export async function logEvent(
  db: any,
  testimonialId: string,
  step: string,
  status: string,
  message?: string,
  details?: unknown,
  actor?: string | null,
) {
  try {
    await db.from("training_testimonial_events").insert({
      testimonial_id: testimonialId,
      step,
      status,
      message: message ? String(message).slice(0, 2000) : null,
      details: details ?? null,
      actor: actor ?? null,
    });
  } catch (e) {
    console.warn("[testimonial-event]", String((e as any)?.message || e));
  }
}

export async function setStatus(
  db: any,
  testimonialId: string,
  status: string,
  patch: Record<string, unknown> = {},
) {
  const { error } = await db
    .from("training_testimonials")
    .update({ status, ...patch })
    .eq("id", testimonialId);
  if (error) throw new Error(`Falha ao atualizar status (${status}): ${error.message}`);
}

export async function failTestimonial(
  db: any,
  testimonialId: string,
  step: string,
  message: string,
  details?: unknown,
) {
  await logEvent(db, testimonialId, step, "error", message, details);
  await setStatus(db, testimonialId, "failed", { review_notes: message.slice(0, 2000) });
}

/** Chamada de chat no gateway Lovable AI. Erros são propagados com status. */
export async function chat(
  messages: Array<{ role: string; content: string }>,
  opts: { json?: boolean } = {},
): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`IA ${res.status}: ${text.slice(0, 500)}`);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Resposta da IA não é JSON");
  }
  const out = parsed?.choices?.[0]?.message?.content;
  if (!out || typeof out !== "string") throw new Error("IA retornou conteúdo vazio");
  return out;
}

export function parseJsonBlock<T>(raw: string): T {
  const cleaned = String(raw || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

export function slugify(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Extensão coerente com o mime real — o STT infere o formato pelo nome. */
export function extensionForMime(mime: string, fallbackName?: string): string {
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };
  const key = String(mime || "").split(";")[0].toLowerCase();
  if (map[key]) return map[key];
  const ext = String(fallbackName || "").split(".").pop()?.toLowerCase();
  return ext && /^[a-z0-9]{2,4}$/.test(ext) ? ext : "mp4";
}

/** Frases proibidas: promessa clínica, dado numérico e preço inventados. */
const FORBIDDEN_PATTERNS: Array<{ re: RegExp; msg: string }> = [
  { re: /\bR\$\s?\d/i, msg: "Conteúdo não pode conter preços" },
  { re: /\b(garantimos?|garantia de resultado|cura|curar|100%\s*de\s*sucesso)\b/i, msg: "Promessa clínica ou garantia de resultado não permitida" },
  { re: /\b(melhor do mercado|imbatível|único no mundo)\b/i, msg: "Superlativo não comprovável não permitido" },
];

export function validateTestimonialArticle(input: {
  title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  content_html: string;
  quotes: string[];
  transcript: string;
}): string[] {
  const errors: string[] = [];
  if (!input.title || input.title.length < 15) errors.push("Título muito curto");
  if (input.title && input.title.length > 120) errors.push("Título acima de 120 caracteres");
  if (!input.slug) errors.push("Slug ausente");
  if (!input.meta_description || input.meta_description.length < 70 || input.meta_description.length > 165) {
    errors.push("Meta description deve ter entre 70 e 165 caracteres");
  }
  if (!input.excerpt || input.excerpt.length < 40) errors.push("Resumo muito curto");
  if (!input.content_html || input.content_html.length < 600) errors.push("Corpo do artigo muito curto");

  const haystack = `${input.title} ${input.meta_description} ${input.excerpt} ${input.content_html}`;
  for (const { re, msg } of FORBIDDEN_PATTERNS) {
    if (re.test(haystack)) errors.push(msg);
  }

  // Toda citação atribuída ao participante deve existir na transcrição.
  const normalizedTranscript = normalizeForMatch(input.transcript);
  for (const q of input.quotes || []) {
    const nq = normalizeForMatch(q);
    if (nq.length < 12) continue;
    if (!normalizedTranscript.includes(nq)) {
      errors.push(`Citação não encontrada na transcrição: "${q.slice(0, 60)}…"`);
    }
  }
  return errors;
}

export function normalizeForMatch(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}