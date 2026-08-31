// form-hero-brief — monta o briefing do banner Hero a partir da RAG do produto
// (system_a_catalog + API live do Sistema A) usando Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import {
  fetchEnrichedProductDossier,
  renderDossierForPrompt,
} from "../_shared/product-rag.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const BodySchema = z.object({
  form_id: z.string().uuid().optional(),
  product_name: z.string().trim().max(200).optional().default(""),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    let productLabel = parsed.data.product_name;
    let formCtx = "";
    let images: string[] = [];

    if (parsed.data.form_id) {
      const { data: form } = await supabase
        .from("smartops_forms")
        .select("name, subtitle, badge_text, cta_text, description, product_catalog_id")
        .eq("id", parsed.data.form_id)
        .maybeSingle();
      if (form) {
        formCtx = [
          `Formulário: ${form.name}`,
          form.subtitle ? `Subtítulo atual: ${form.subtitle}` : "",
          form.description ? `Descrição: ${String(form.description).slice(0, 600)}` : "",
        ].filter(Boolean).join("\n");
        if ((form as any).product_catalog_id) {
          const { data: prod } = await supabase
            .from("system_a_catalog")
            .select("name, image_url, og_image_url, gallery_images")
            .eq("id", (form as any).product_catalog_id)
            .maybeSingle();
          if (prod) {
            if (!productLabel) productLabel = String(prod.name || "");
            const gallery = Array.isArray((prod as any).gallery_images) ? (prod as any).gallery_images : [];
            images = [prod.image_url, prod.og_image_url, ...gallery]
              .map((v: any) => (typeof v === "string" ? v : v?.url))
              .filter((v: any) => typeof v === "string" && v.startsWith("http"))
              .slice(0, 5);
          }
        }
      }
    }

    if (!productLabel) {
      return new Response(JSON.stringify({ error: "Sem produto vinculado ao formulário. Informe product_name." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enriched = await fetchEnrichedProductDossier(supabase as any, productLabel);
    if (!enriched) {
      return new Response(JSON.stringify({ error: `Produto "${productLabel}" não encontrado na RAG.` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ragBlock = [
      renderDossierForPrompt(enriched.local, "Produto"),
      enriched.live ? `### Dados live\n${JSON.stringify(enriched.live).slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n\n");

    const prompt = [
      "Você é diretor de arte publicitária da Smart Dent (odontologia digital).",
      "Com base APENAS nos dados do produto abaixo, escreva o briefing de um banner hero.",
      "REGRAS: português do Brasil; NUNCA cite preços, descontos ou valores; sem inventar especificação que não esteja nos dados; headline com no máximo 90 caracteres; 4 bullets de vantagem com no máximo 26 caracteres cada.",
      "",
      formCtx,
      "",
      ragBlock,
      "",
      'Responda SOMENTE com JSON: {"headline":"","subheadline":"","badge_text":"","cta_text":"","bullets":["","","",""],"style_notes":""}',
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) {
      console.error("[form-hero-brief] gateway", resp.status, raw.slice(0, 400));
      return new Response(JSON.stringify({ error: "Falha na IA", status: resp.status, details: raw.slice(0, 400) }), {
        status: resp.status === 402 || resp.status === 429 ? resp.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let brief: any = null;
    try {
      const json = JSON.parse(raw);
      const txt = json?.choices?.[0]?.message?.content ?? "";
      brief = typeof txt === "string" ? JSON.parse(txt.replace(/^```json\s*|```$/g, "").trim()) : txt;
    } catch (e) {
      console.error("[form-hero-brief] parse", (e as Error).message, raw.slice(0, 300));
    }
    if (!brief?.headline) {
      return new Response(JSON.stringify({ error: "IA não retornou briefing válido" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      product_name: enriched.local.name || productLabel,
      images,
      brief: {
        headline: String(brief.headline || "").slice(0, 200),
        subheadline: String(brief.subheadline || "").slice(0, 200),
        badge_text: String(brief.badge_text || "").slice(0, 80),
        cta_text: String(brief.cta_text || "").slice(0, 60),
        bullets: (Array.isArray(brief.bullets) ? brief.bullets : []).map((b: any) => String(b).slice(0, 80)).filter(Boolean).slice(0, 6),
        style_notes: String(brief.style_notes || "").slice(0, 600),
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[form-hero-brief]", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
