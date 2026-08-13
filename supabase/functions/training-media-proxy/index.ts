// Proxy somente-leitura das mídias de treinamento.
// Recebe um token HMAC de curta duração (emitido por smartops-marketing-agent-api)
// e devolve os bytes reais do arquivo no Google Drive. Nenhum segredo é exposto:
// o token só autoriza LEITURA de um único drive_file_id já validado como
// pertencente à turma.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { driveStreamFile, driveGetThumbnailLink } from "../_shared/drive.ts";
import { verifyMediaToken } from "../_shared/training-media-access.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const payload = await verifyMediaToken(token);
  if (!payload) {
    return new Response(JSON.stringify({ error: "ACCESS_EXPIRED_OR_INVALID" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (payload.v === "thumbnail" || payload.v === "preview") {
      const link = await driveGetThumbnailLink(payload.f, payload.v === "thumbnail" ? 640 : 1600);
      if (link) {
        const thumb = await fetch(link);
        if (thumb.ok) {
          return new Response(thumb.body, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": thumb.headers.get("content-type") || "image/jpeg",
              "Cache-Control": "private, max-age=300",
            },
          });
        }
      }
      // Sem thumbnail disponível: cai para o original.
    }

    const upstream = await driveStreamFile(payload.f, req.headers.get("Range"));
    if (!upstream.ok && upstream.status !== 206) {
      const body = await upstream.text();
      console.error(`[training-media-proxy] drive ${upstream.status}: ${body.slice(0, 300)}`);
      return new Response(JSON.stringify({ error: "MEDIA_UNAVAILABLE", status: upstream.status }), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const headers = new Headers(corsHeaders);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set("Cache-Control", "private, max-age=300");
    return new Response(req.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  } catch (e) {
    console.error("[training-media-proxy] erro", e);
    return new Response(JSON.stringify({ error: "MEDIA_UNAVAILABLE", details: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
