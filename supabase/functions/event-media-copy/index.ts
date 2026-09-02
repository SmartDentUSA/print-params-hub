// Gera a copy contextual de cada mídia enviada ao Drive do evento.
// Contexto usado: Smart Dent + objetivo da pasta (destination) + dados do evento
// (nome, local, estande, dias, palestrantes) + transcrição do vídeo quando houver.
// Toda copy cita o local: estande da Smart Dent no evento.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { driveDownloadFile, getDriveAccessToken } from "../_shared/drive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-2.5-flash";
const STT_MODEL = "openai/gpt-4o-transcribe";
const STT_MAX_BYTES = 24 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authorize(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token === ANON_KEY) return { ok: false, status: 401, error: "Autenticação obrigatória" };
  if (token === SERVICE_ROLE) return { ok: true }; // chamada interna do upload
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return { ok: false, status: 401, error: "Sessão inválida ou expirada" };
  const { data: allowed } = await userClient.rpc("can_manage_training_media", { _user_id: data.user.id });
  if (allowed !== true) return { ok: false, status: 403, error: "Usuário sem permissão de equipe" };
  return { ok: true };
}

async function transcribe(bytes: Uint8Array, filename: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([bytes]), filename);
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Transcrição ${res.status}: ${text.slice(0, 300)}`);
  return String(JSON.parse(text)?.text || "").trim();
}

async function chatJson(system: string, user: string): Promise<any> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`IA ${res.status}: ${text.slice(0, 300)}`);
  const content = JSON.parse(text)?.choices?.[0]?.message?.content;
  if (!content) throw new Error("IA retornou conteúdo vazio");
  return JSON.parse(String(content).replace(/^```json\s*|\s*```$/g, ""));
}

const SYSTEM = `Você é o redator de redes sociais da Smart Dent | Fluxo Digital, distribuidora brasileira de impressão 3D e fluxo digital odontológico (scanners, impressoras, resinas e treinamentos).

REGRAS ABSOLUTAS:
- Português do Brasil, tom humano, direto, sem "marketês" e sem emojis em excesso (máx. 4).
- SEMPRE citar o local: estande da Smart Dent no evento (com o nome do evento).
- NUNCA citar preço, promessa de resultado clínico, garantia, dados pessoais, telefone ou documento.
- Não inventar fatos: use apenas o contexto e a transcrição fornecidos.
- Se houver transcrição, a copy deve refletir o que foi realmente dito.
- Mencionar palestrante/KOL e o @ dele apenas se estiverem no contexto.

Responda SOMENTE JSON:
{
  "caption": "legenda principal pronta para publicar (máx. 600 caracteres)",
  "variations": ["variação curta para Stories", "variação para Reels/TikTok"],
  "hashtags": ["#semEspacos"],
  "alt_text": "descrição objetiva da imagem/vídeo para acessibilidade"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authorize(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const mediaId = String(body?.media_id || "");
    if (!mediaId) return json({ error: "media_id obrigatório" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: media, error } = await db
      .from("event_drive_media")
      .select("*")
      .eq("id", mediaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!media) return json({ error: "Mídia não encontrada" }, 404);
    if (media.status !== "completed") return json({ error: "Upload ainda não concluído" }, 409);
    if (media.copy_status === "done" && !body?.force) {
      return json({ ok: true, skipped: true, caption: media.copy_caption });
    }

    const { data: ev } = await db
      .from("smartops_events")
      .select("id, name, location, country, company_stand, start_date, end_date, about_event_pt, audience_areas, audience_specialties, instagram_handle, speakers, partner_brands, drive_destinations")
      .eq("id", media.event_id)
      .maybeSingle();
    if (!ev) return json({ error: "Evento não encontrado" }, 404);

    await db.from("event_drive_media").update({ copy_status: "processing", copy_error: null }).eq("id", mediaId);

    // Transcrição só para vídeos dentro do limite do gateway de STT.
    let transcript: string | null = media.transcript ?? null;
    if (!transcript && String(media.mime_type).startsWith("video/") && Number(media.size_bytes) <= STT_MAX_BYTES) {
      try {
        const token = await getDriveAccessToken();
        const bytes = await driveDownloadFile(token, media.drive_file_id);
        transcript = await transcribe(bytes, media.generated_filename);
      } catch (e) {
        console.warn("[event-media-copy] transcrição falhou", String((e as any)?.message || e));
      }
    }

    const dest = ((ev.drive_destinations || []) as any[]).find((d) => d?.key === media.destination_key);
    const speaker = media.speaker_name
      ? ((ev.speakers || []) as any[]).find((s) => String(s?.name || "").trim() === media.speaker_name)
      : null;

    const context = [
      `EVENTO: ${ev.name}`,
      `LOCAL: ${[ev.location, ev.country].filter(Boolean).join(" - ") || "—"}`,
      `ESTANDE SMART DENT: ${ev.company_stand || "—"}`,
      `PERÍODO: ${ev.start_date || "—"}${ev.end_date && ev.end_date !== ev.start_date ? ` a ${ev.end_date}` : ""}`,
      `INSTAGRAM DO EVENTO: ${ev.instagram_handle || "—"}`,
      `SOBRE O EVENTO: ${String(ev.about_event_pt || "—").slice(0, 1200)}`,
      `PÚBLICO: ${[...(ev.audience_areas || []), ...(ev.audience_specialties || [])].join(", ") || "—"}`,
      `MARCAS PARCEIRAS: ${((ev.partner_brands || []) as any[]).map((b) => `${b?.name || ""} ${b?.instagram || ""}`.trim()).filter(Boolean).join(", ") || "—"}`,
      "",
      `TIPO DE ARQUIVO: ${String(media.mime_type).startsWith("video/") ? "vídeo" : "foto"}`,
      `PASTA DE DESTINO: ${media.destination_label || media.destination_key}`,
      `OBJETIVO DO CONTEÚDO: ${dest?.purpose || media.destination_label || media.destination_key}`,
      media.event_day ? `DIA DO EVENTO: dia ${media.event_day}${media.event_date ? ` (${media.event_date})` : ""}` : "",
      media.speaker_name ? `PALESTRANTE/KOL: ${media.speaker_name}${speaker?.instagram ? ` (${speaker.instagram})` : ""}${speaker?.theme ? ` — tema: ${speaker.theme}` : ""}` : "",
      media.orientation ? `ORIENTAÇÃO: ${media.orientation}` : "",
      "",
      transcript ? `TRANSCRIÇÃO DO VÍDEO:\n${transcript.slice(0, 6000)}` : "TRANSCRIÇÃO: não disponível",
    ].filter(Boolean).join("\n");

    try {
      const out = await chatJson(SYSTEM, context);
      const hashtags = Array.isArray(out?.hashtags)
        ? out.hashtags.map((h: any) => String(h).trim().replace(/\s+/g, "")).filter(Boolean).slice(0, 12)
        : [];
      await db.from("event_drive_media").update({
        transcript,
        copy_status: "done",
        copy_error: null,
        copy_caption: String(out?.caption || "").slice(0, 2000),
        copy_variations: [
          ...(Array.isArray(out?.variations) ? out.variations.map((v: any) => String(v)) : []),
          ...(out?.alt_text ? [`ALT: ${String(out.alt_text)}`] : []),
        ],
        copy_hashtags: hashtags,
        copy_generated_at: new Date().toISOString(),
      }).eq("id", mediaId);
      console.log(JSON.stringify({ event: "event_media_copy_done", media_id: mediaId, has_transcript: !!transcript }));
      return json({ ok: true, caption: out?.caption, hashtags, transcript_used: !!transcript });
    } catch (e: any) {
      await db.from("event_drive_media").update({
        transcript,
        copy_status: "failed",
        copy_error: String(e?.message || e).slice(0, 500),
      }).eq("id", mediaId);
      return json({ error: e?.message || String(e) }, 502);
    }
  } catch (err: any) {
    console.error("[event-media-copy]", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
