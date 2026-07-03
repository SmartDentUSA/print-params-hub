import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CtaRef {
  tipo: "landing" | "form" | "knowledge" | "social_post" | "store" | "seller_wa" | "custom";
  id?: string;
  url?: string;
  label?: string;
}

interface Body {
  produto?: string;
  produto_id?: string;
  cta_principal?: CtaRef;
  ctas_secundarios?: CtaRef[];
  segmento_resumo?: string;
  tom?: string;
  regenerate?: "all" | "subject";
  base_html?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: Body = await req.json();
    const {
      produto, produto_id, cta_principal, ctas_secundarios = [],
      segmento_resumo, tom = "consultivo, profissional, direto",
      regenerate = "all", base_html,
    } = body;

    // Fetch product context from system_a_catalog if provided
    let produtoCtx: Record<string, unknown> | null = null;
    if (produto_id) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select("title,short_description,long_description,benefits,image_url,product_url,category,tags")
        .eq("id", produto_id).maybeSingle();
      produtoCtx = data;
    } else if (produto) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select("title,short_description,long_description,benefits,image_url,product_url,category,tags")
        .ilike("title", `%${produto}%`).limit(1).maybeSingle();
      produtoCtx = data;
    }

    const ctaLabel = (c?: CtaRef) => c?.label || {
      landing: "Acessar Landing Page",
      form: "Preencher Formulário",
      knowledge: "Ler o artigo completo",
      social_post: "Ver publicação",
      store: "Comprar na loja",
      seller_wa: "Falar no WhatsApp",
      custom: "Saiba mais",
    }[c?.tipo || "custom"];

    const ctaLine = (c: CtaRef) => `- [${c.tipo}] ${ctaLabel(c)} → ${c.url || "{{url}}"}`;

    const systemPrompt = `Você é um copywriter sênior da Smart Dent | Fluxo Digital, especializado em odontologia digital (impressão 3D, escaneamento, CAD/CAM). Escreve emails B2B para dentistas e laboratórios.

REGRAS ABSOLUTAS:
- NUNCA cite preços, valores em R$, descontos numéricos ou promoções com valor.
- Tom: ${tom}.
- Português do Brasil, sem gírias, sem exagero, sem emojis em excesso (no máx. 1-2 no assunto).
- HTML responsivo, inline styles (compatível Gmail/Outlook), largura máx 600px, fontes web-safe.
- Personalizar com placeholders: {{nome}} (primeiro nome do lead), {{vendedor_nome}}, {{link_wa_vendedor}}.
- CTA principal como botão destacado. CTAs secundários como links no rodapé.
- Estrutura: preheader (invisível) → saudação → hook → 2-3 benefícios do produto → CTA botão → PS/rodapé com CTAs secundários + assinatura.

SAÍDA: apenas JSON válido, sem markdown, sem texto extra.`;

    const userPrompt = `Produto: ${produtoCtx?.title || produto || "produto Smart Dent"}
Descrição curta: ${produtoCtx?.short_description || "-"}
Benefícios: ${produtoCtx?.benefits || produtoCtx?.long_description?.toString().slice(0, 600) || "-"}
Categoria: ${produtoCtx?.category || "-"}
Imagem: ${produtoCtx?.image_url || "-"}

Segmento de destino: ${segmento_resumo || "leads da base Smart Dent"}

CTA principal:
${cta_principal ? ctaLine(cta_principal) : "- (nenhum)"}
CTAs secundários:
${(ctas_secundarios || []).map(ctaLine).join("\n") || "- (nenhum)"}

${regenerate === "subject"
  ? `Regere APENAS o assunto e preheader para o HTML abaixo, mantendo o restante:\n${base_html?.slice(0, 3000) || ""}`
  : "Gere o email completo agora."}

Retorne JSON no formato:
{
  "subject": "assunto curto (máx 70 chars), sem clickbait",
  "preheader": "pré-cabeçalho (máx 110 chars)",
  "cta_button_label": "texto do botão principal",
  "html_body": "<HTML completo do email, responsivo, com placeholders {{nome}} etc>",
  "plain_text": "versão texto puro do email"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("[generate-email-ai] gateway error", aiRes.status, errTxt);
      return new Response(JSON.stringify({
        error: "AI gateway error",
        status: aiRes.status,
        detail: errTxt.slice(0, 500),
      }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    return new Response(JSON.stringify({
      success: true,
      subject: parsed.subject || "",
      preheader: parsed.preheader || "",
      cta_button_label: parsed.cta_button_label || ctaLabel(cta_principal) || "Saiba mais",
      html_body: parsed.html_body || "",
      plain_text: parsed.plain_text || "",
      produto_context: produtoCtx,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-email-ai] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});