const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
import { z } from "npm:zod";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

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

    console.log("[event-web-research] scraping", url);
    const fcCtrl = new AbortController();
    const fcTimeout = setTimeout(() => fcCtrl.abort(), 45000);
    let fcRes: Response;
    try {
      fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        signal: fcCtrl.signal,
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
    } catch (e: any) {
      clearTimeout(fcTimeout);
      console.error("[event-web-research] firecrawl fetch error:", e?.message || e);
      return new Response(JSON.stringify({ error: "Firecrawl timeout/erro", details: String(e?.message || e) }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(fcTimeout);

    const data = await fcRes.json().catch(() => null);
    if (!fcRes.ok) {
      console.error("[event-web-research] firecrawl !ok", fcRes.status, data);
      return new Response(JSON.stringify({ error: "Firecrawl falhou", status: fcRes.status, details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const root = (data?.data ?? data) || {};
    const metadata = root.metadata ?? root?.data?.metadata ?? {};
    const markdown: string = typeof root.markdown === "string" ? root.markdown : "";
    console.log("[event-web-research] markdown chars:", markdown.length);

    // Extract structured fields via Gemini Flash (fast)
    let extracted: any = null;
    if (GOOGLE_AI_KEY && markdown) {
      try {
        const prompt = `Você é um extrator. A partir do conteúdo abaixo (site de evento odontológico), retorne APENAS um JSON válido (sem markdown/cercas) com as chaves: name (string|null), start_date (YYYY-MM-DD|null), end_date (YYYY-MM-DD|null), location (cidade|null), venue (local específico|null), country (nome em português|null), website_url (string|null), description_pt (200-400 palavras em português, sem preços|null), logo_url (string|null), hero_image_url (string|null).\n\nMETADADOS:\ntitle: ${metadata.title ?? ""}\ndescription: ${metadata.description ?? ""}\nogImage: ${metadata.ogImage ?? metadata["og:image"] ?? ""}\nsourceURL: ${metadata.sourceURL ?? url}\n\nCONTEÚDO (markdown, truncado):\n${markdown.slice(0, 8000)}`;
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
            }),
          },
        );
        const gJson = await gRes.json();
        const text = gJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        try { extracted = JSON.parse(text); }
        catch { extracted = { raw: text }; }
      } catch (e: any) {
        console.error("[event-web-research] gemini error:", e?.message || e);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      extracted,
      metadata: {
        title: metadata.title ?? null,
        description: metadata.description ?? null,
        ogImage: metadata.ogImage ?? metadata["og:image"] ?? null,
        sourceURL: metadata.sourceURL ?? url,
      },
      markdown_excerpt: markdown.slice(0, 1200),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[event-web-research] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});