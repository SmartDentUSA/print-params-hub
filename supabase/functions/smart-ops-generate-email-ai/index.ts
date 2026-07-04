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
      segmento_resumo, tom = "consultivo",
      regenerate = "all", base_html,
    } = body;

    // Preset tone expansions → concrete writing guidance for the LLM
    const TOM_PRESETS: Record<string, string> = {
      consultivo: "Consultivo, profissional, direto ao ponto. Orienta o dentista/laboratório sem pressionar. Foco em ajudar a decidir.",
      tecnico: "Técnico especialista. Vocabulário odontológico preciso (fluxo digital, CAD/CAM, ISO, precisão em µm). Zero hype, dados objetivos.",
      educativo: "Educativo e didático. Ensina antes de vender. Referencia casos clínicos, artigos e boas práticas.",
      direto_comercial: "Direto e comercial, para leads quentes. Foco em benefício concreto e próximo passo claro. Frases curtas.",
      storytelling: "Storytelling clínico. Conta a jornada de um profissional que adotou o produto e o resultado obtido. Emoção controlada.",
      urgencia_soft: "Urgência suave, sem gatilhos agressivos. Comunica escassez real (vagas, prazo) com respeito.",
      celebrativo: "Celebrativo e otimista. Lançamento, marco, novidade. Tom de compartilhamento de conquista.",
      reativacao_amigavel: "Reativação amigável e leve. Reconecta com o lead frio sem cobrar. Reconhece o tempo sem contato.",
      pos_venda_cs: "Pós-venda / customer success. Acolhedor, orientador, foco em fazer o cliente usar bem o produto que já tem.",
      evento_convite: "Convite para evento (curso, webinar, feira). Datas, benefícios da participação, call-to-action de inscrição.",
    };
    const tomInstruction = TOM_PRESETS[tom] || tom;

    // ── Product context (REAL columns from system_a_catalog) ──
    let produtoCtx: Record<string, any> | null = null;
    const PRODUCT_COLS =
      "id, name, description, image_url, product_category, product_subcategory, " +
      "technical_specs, clinical_indications, contraindications, compatibility_list, " +
      "certifications, cta_1_label, cta_1_url, cta_1_description, keywords, category";
    if (produto_id) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select(PRODUCT_COLS)
        .eq("id", produto_id).maybeSingle();
      produtoCtx = data as any;
    } else if (produto) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select(PRODUCT_COLS)
        .ilike("name", `%${produto}%`).limit(1).maybeSingle();
      produtoCtx = data as any;
    }

    // ── RAG: content related to the product (title/keyword match) ──
    const searchTerm =
      produtoCtx?.name || produtoCtx?.product_category || produto || "impressão 3D odontológica";
    const [{ data: relatedContent }, { data: relatedLibrary }, { data: stories }, { data: reviews }] = await Promise.all([
      supabase.from("knowledge_contents")
        .select("title, slug, excerpt, og_image_url, content_image_url, category_id")
        .eq("active", true)
        .or(`title.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%`)
        .limit(3),
      supabase.from("system_a_content_library")
        .select("title, content_text, landing_page_url, cta_url, thumbnail_url, media_url, product_category")
        .eq("is_active", true)
        .or(`title.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%`)
        .limit(3),
      supabase.from("success_stories")
        .select("client_name, client_role, city, state, challenge, solution, results, testimonial, image_url")
        .eq("published", true)
        .limit(2),
      supabase.from("google_reviews")
        .select("reviewer_name, star_rating, comment")
        .gte("star_rating", 4)
        .not("comment", "is", null)
        .order("create_time", { ascending: false })
        .limit(3),
    ]);

    const contentBlock = (relatedContent || [])
      .map((c: any, i: number) => `[${i + 1}] "${c.title}" → https://smartdent.com.br/base-conhecimento/${c.category_id || "a"}/${c.slug}${c.og_image_url ? ` (img: ${c.og_image_url})` : ""}${c.excerpt ? ` — ${String(c.excerpt).slice(0, 150)}` : ""}`)
      .join("\n") || "-";

    const libraryBlock = (relatedLibrary || [])
      .map((c: any, i: number) => `[L${i + 1}] "${c.title}" → ${c.landing_page_url || c.cta_url || ""}${c.thumbnail_url ? ` (thumb: ${c.thumbnail_url})` : ""}`)
      .join("\n") || "-";

    const proofBlock = [
      ...(stories || []).map((s: any) => `• ${s.client_name}${s.client_role ? `, ${s.client_role}` : ""}${s.city ? ` (${s.city}/${s.state})` : ""}: "${String(s.testimonial || s.results || "").slice(0, 200)}"`),
      ...(reviews || []).map((r: any) => `⭐ ${r.reviewer_name}: "${String(r.comment).slice(0, 160)}"`),
    ].slice(0, 3).join("\n") || "-";

    // Technical specs as bullets
    const techSpecs = produtoCtx?.technical_specs;
    let techBullets = "-";
    if (techSpecs && typeof techSpecs === "object") {
      techBullets = Object.entries(techSpecs)
        .slice(0, 6)
        .map(([k, v]) => `• ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join("\n");
    } else if (typeof techSpecs === "string") {
      techBullets = techSpecs.slice(0, 400);
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
- Tom: ${tomInstruction}
- Português do Brasil, sem gírias, sem exagero, sem emojis em excesso (no máx. 1-2 no assunto).
- HTML DEVE ser um documento COMPLETO começando em \`<!doctype html><html><head><meta charset="UTF-8"></head><body ...>\` e terminando em \`</body></html>\`. Inline styles (Gmail/Outlook), largura máx 600px, fontes web-safe.
- NUNCA gere tags <table>, <tr> ou <td> soltas sem envolver em uma tabela completa e fechada corretamente. Se usar tabela para layout, feche todas as tags.
- Personalizar com placeholders: {{nome}} (primeiro nome do lead), {{vendedor_nome}}, {{link_wa_vendedor}}.
- CTA principal como botão destacado. CTAs secundários como links no rodapé.
- OBRIGATÓRIO: use a imagem do produto (\`<img src="…" alt="…" style="max-width:100%;height:auto">\`) no topo, logo após a saudação.
- OBRIGATÓRIO: cite pelo menos 1 indicação clínica concreta E 1 spec técnica real do dossiê fornecido. NÃO invente números.
- OBRIGATÓRIO: inclua um bloco "Aprofunde-se" com 2 cards de conteúdo relacionado (title + link + thumbnail quando disponível).
- OBRIGATÓRIO: se houver depoimento/review, incluir 1 bloco de prova social em itálico com o nome do cliente.
- Estrutura sugerida: preheader (invisível) → saudação → hero image do produto → hook (1 parágrafo) → 2-3 benefícios com bullets (usando as specs/indicações) → CTA botão → prova social → "Aprofunde-se" (cards de conteúdo) → PS/rodapé com CTAs secundários + assinatura + link WhatsApp.
- O link WhatsApp deve estar em uma \`<a href="{{link_wa_vendedor}}">\` — nunca escreva "link" solto.

SAÍDA: apenas JSON válido, sem markdown, sem texto extra.`;

    const userPrompt = `═══ DOSSIÊ DO PRODUTO ═══
Nome: ${produtoCtx?.name || produto || "produto Smart Dent"}
Categoria: ${produtoCtx?.product_category || produtoCtx?.category || "-"} / ${produtoCtx?.product_subcategory || ""}
Descrição: ${produtoCtx?.description ? String(produtoCtx.description).slice(0, 800) : "-"}
Imagem hero (USAR NO HTML): ${produtoCtx?.image_url || "-"}

Especificações técnicas (usar 1 no email):
${techBullets}

Indicações clínicas:
${produtoCtx?.clinical_indications ? (Array.isArray(produtoCtx.clinical_indications) ? produtoCtx.clinical_indications.slice(0, 5).join("; ") : String(produtoCtx.clinical_indications).slice(0, 400)) : "-"}

Compatibilidade: ${produtoCtx?.compatibility_list ? (Array.isArray(produtoCtx.compatibility_list) ? produtoCtx.compatibility_list.slice(0, 5).join(", ") : String(produtoCtx.compatibility_list).slice(0, 200)) : "-"}
Certificações: ${produtoCtx?.certifications ? (Array.isArray(produtoCtx.certifications) ? produtoCtx.certifications.join(", ") : String(produtoCtx.certifications)) : "-"}
CTA oficial: ${produtoCtx?.cta_1_label || "-"} → ${produtoCtx?.cta_1_url || "-"}

═══ CONTEÚDO RELACIONADO (base de conhecimento) — usar 2 no bloco "Aprofunde-se" ═══
${contentBlock}

═══ BIBLIOTECA System A (posts oficiais) ═══
${libraryBlock}

═══ PROVA SOCIAL (usar 1) ═══
${proofBlock}

═══ AUDIÊNCIA ═══
Segmento de destino: ${segmento_resumo || "leads da base Smart Dent"}

═══ CALLS-TO-ACTION ═══
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