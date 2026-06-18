import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const BodySchema = z.object({
  url: z.string().url(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY não configurada. Conecte o Firecrawl em Connectors." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { url } = parsed.data;

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [
          "markdown",
          {
            type: "json",
            prompt:
              "Extraia metadados deste site de evento odontológico/dentista. Retorne um objeto JSON com: name (nome oficial do evento), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), location (cidade), venue (local específico), country (em português), website_url, description_pt (300-500 palavras em português sobre o evento, sem preços), logo_url, hero_image_url. Use null para campos não encontrados.",
          },
        ],
        onlyMainContent: true,
      }),
    });

    const data = await fcRes.json().catch(() => null);
    if (!fcRes.ok) {
      return new Response(JSON.stringify({ error: "Firecrawl falhou", status: fcRes.status, details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // V2 result location can vary: try several paths.
    const root = (data?.data ?? data) || {};
    const json = root.json ?? root.extract ?? root?.data?.json ?? null;
    const metadata = root.metadata ?? root?.data?.metadata ?? {};

    return new Response(JSON.stringify({
      ok: true,
      extracted: json,
      metadata: {
        title: metadata.title ?? null,
        description: metadata.description ?? null,
        ogImage: metadata.ogImage ?? metadata["og:image"] ?? null,
        sourceURL: metadata.sourceURL ?? url,
      },
      markdown_excerpt: typeof root.markdown === "string" ? root.markdown.slice(0, 1200) : null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[event-web-research] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});