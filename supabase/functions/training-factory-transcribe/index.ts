import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB cap to avoid memory/timeout issues

const BodySchema = z.object({
  asset_id: z.string().uuid(),
  audio_url: z.string().url(),
});

async function fetchCapped(url: string, maxBytes: number) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetch ${res.status}`);
  const mime = res.headers.get("content-type") || "video/mp4";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= maxBytes) {
        try { await reader.cancel(); } catch (_) {}
        break;
      }
    }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const remaining = out.length - offset;
    if (remaining <= 0) break;
    const slice = c.length <= remaining ? c : c.subarray(0, remaining);
    out.set(slice, offset);
    offset += slice.length;
  }
  return { bytes: out, mime };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as any,
    );
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let assetIdForError: string | null = null;
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { asset_id, audio_url } = parsed.data;
    assetIdForError = asset_id;

    const { bytes, mime } = await fetchCapped(audio_url, MAX_BYTES);
    const b64 = toBase64(bytes);

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcreva este depoimento odontológico em português. Retorne apenas a transcrição limpa, sem formatação adicional.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${b64}` },
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const transcription = (data?.choices?.[0]?.message?.content ?? "").trim();

    const { error: updErr } = await supabase
      .from("training_factory_assets")
      .update({ transcription, status: "pronto" })
      .eq("id", asset_id);
    if (updErr) throw new Error(`asset update: ${updErr.message}`);

    return new Response(JSON.stringify({ success: true, asset_id, length: transcription.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("training-factory-transcribe error", err);
    if (assetIdForError) {
      await supabase
        .from("training_factory_assets")
        .update({ status: "erro_transcricao", transcription: null })
        .eq("id", assetIdForError)
        .then(() => {}, () => {});
    }
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});