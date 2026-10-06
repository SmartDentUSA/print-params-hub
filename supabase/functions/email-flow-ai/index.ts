// email-flow-ai — gera assunto, pré-cabeçalho e HTML de e-mail no padrão Smart Dent
// a partir de produtos, posts do Instagram, base de conhecimento, eventos e cursos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, ...extra, "Content-Type": "application/json" } });

const TYPES: Record<string, string> = {
  boas_vindas: "E-mail de boas-vindas: acolhe, apresenta a Smart Dent e o próximo passo.",
  promocional: "E-mail promocional: destaca benefícios e uma oferta/ação clara (sem preços ou valores).",
  prospeccao: "E-mail de prospecção: primeiro contato consultivo, gera curiosidade e convida a conversar.",
  follow_up: "E-mail de follow-up: retoma o contato anterior, curto e direto, com um único próximo passo.",
  educacional: "E-mail de conteúdo educacional: ensina algo útil do fluxo digital antes de qualquer oferta.",
  reengajamento: "E-mail de reengajamento: reconecta com quem esfriou, leve, sem cobrança.",
  transacional: "E-mail transacional: informa algo objetivo (inscrição, certificado, confirmação), claro e sem marketing.",
  feedback: "E-mail de feedback: pede a opinião do cliente de forma breve e respeitosa.",
  agradecimento: "E-mail de agradecimento: agradece genuinamente e reforça o relacionamento.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Faça login para usar a IA" }, 401);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA não configurada" }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 10) : []) as string[];
    const productIds = arr(body.product_ids), postIds = arr(body.post_ids), kbIds = arr(body.knowledge_ids),
      eventIds = arr(body.event_ids), courseIds = arr(body.course_ids);
    const emailType = TYPES[String(body.email_type || "")] ? String(body.email_type) : "educacional";
    const instructions = String(body.instructions || "").slice(0, 2000);
    const tone = String(body.tone || "consultivo").slice(0, 100);

    const parts: string[] = [];
    const images: string[] = [];
    if (productIds.length) {
      const { data } = await supabase.from("system_a_catalog").select("name, description, image_url, cta_1_url, product_category").in("id", productIds);
      for (const p of data || []) { parts.push(`PRODUTO: ${p.name}\nCategoria: ${p.product_category || "-"}\nDescrição: ${String(p.description || "").replace(/<[^>]+>/g, " ").slice(0, 900)}\nLink: ${p.cta_1_url || "-"}\nImagem: ${p.image_url || "-"}`); if (p.image_url) images.push(p.image_url); }
    }
    if (postIds.length) {
      const { data } = await supabase.from("social_posts").select("caption, media_url, thumbnail_url, post_url, platform").in("id", postIds);
      for (const p of data || []) { const img = p.thumbnail_url || p.media_url; parts.push(`POST ${p.platform || "Instagram"}: ${String(p.caption || "").slice(0, 1200)}\nImagem: ${img || "-"}\nLink do post: ${p.post_url || "-"}`); if (img) images.push(img); }
    }
    if (kbIds.length) {
      const { data } = await supabase.from("knowledge_contents").select("title, excerpt, meta_description, slug, og_image_url, content_html").in("id", kbIds);
      for (const k of data || []) parts.push(`ARTIGO DA BASE: ${k.title}\nResumo: ${k.excerpt || k.meta_description || String(k.content_html || "").replace(/<[^>]+>/g, " ").slice(0, 900)}\nImagem: ${k.og_image_url || "-"}`);
    }
    if (eventIds.length) {
      const { data } = await supabase.from("smartops_events").select("name, start_date, end_date, location, website_url, cover_image_url, about_event_pt, company_stand").in("id", eventIds);
      for (const e of data || []) { parts.push(`EVENTO: ${e.name}\nDatas: ${e.start_date || "-"} a ${e.end_date || "-"}\nLocal: ${e.location || "-"} ${e.company_stand ? `(estande ${e.company_stand})` : ""}\nSobre: ${String(e.about_event_pt || "").slice(0, 700)}\nSite: ${e.website_url || "-"}\nImagem: ${e.cover_image_url || "-"}`); if (e.cover_image_url) images.push(e.cover_image_url); }
    }
    if (courseIds.length) {
      const { data } = await supabase.from("smartops_courses").select("id, title, description, modality, location, signup_form_url, cover_image_url, duration_days").in("id", courseIds);
      for (const c of data || []) {
        const { data: t } = await supabase.from("smartops_course_turmas").select("label, start_date, end_date, location").eq("course_id", c.id).eq("active", true).gte("start_date", new Date().toISOString().slice(0, 10)).order("start_date").limit(3);
        parts.push(`CURSO: ${c.title}\nModalidade: ${c.modality || "-"} · Local: ${c.location || "-"} · ${c.duration_days || "?"} dia(s)\nDescrição: ${String(c.description || "").slice(0, 700)}\nPróximas turmas: ${(t || []).map((x: any) => `${x.label || ""} ${x.start_date}${x.end_date ? `–${x.end_date}` : ""} ${x.location || ""}`).join("; ") || "a definir"}\nInscrição: ${c.signup_form_url || "-"}\nImagem: ${c.cover_image_url || "-"}`);
        if (c.cover_image_url) images.push(c.cover_image_url);
      }
    }

    const prompt = `Você escreve e-mails HTML para a Smart Dent | Fluxo Digital (odontologia digital, impressão 3D, scanners, resinas).
TIPO: ${TYPES[emailType]}
TOM: ${tone}
REGRAS:
- Português do Brasil, para dentistas e laboratórios. Texto curto, escaneável.
- NUNCA inclua preços, valores, descontos em R$ ou condições comerciais.
- Use SOMENTE fatos do material abaixo; não invente datas, números, depoimentos ou links.
- Use apenas links e imagens presentes no material. Imagens com <img> largura 100% máx 560px.
- Personalize com {{primeiro_nome}}. Botão principal pode apontar para {{link_wa_vendedor}} se não houver link no material.
- Padrão visual Smart Dent: HTML de e-mail com tabelas e estilos inline, largura 600px, fundo #f4f6f8, cartão branco com cantos arredondados, cabeçalho azul-escuro #0b2545 com o texto "Smart Dent | Fluxo Digital" em branco, títulos #0b2545, texto #334155, botão #0ea5a4 com texto branco, rodapé discreto cinza. NÃO inclua assinatura pessoal (ela é adicionada depois).
- Documento completo <!doctype html> com <body>.
${instructions ? `INSTRUÇÕES DO USUÁRIO: ${instructions}` : ""}

MATERIAL SELECIONADO:
${parts.join("\n\n---\n\n") || "(nenhum material selecionado — escreva com base no tipo de e-mail e nas instruções)"}`;

    const runId = req.headers.get("X-Lovable-AIG-Run-ID")?.trim();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
        ...(runId ? { "X-Lovable-AIG-Run-ID": runId } : {}),
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: {
          format: {
            type: "json_schema", name: "email", strict: true,
            schema: {
              type: "object", additionalProperties: false, required: ["subject", "preheader", "html"],
              properties: { subject: { type: "string" }, preheader: { type: "string" }, html: { type: "string" } },
            },
          },
        },
      }),
      signal: req.signal,
    });
    const aigHeaders: Record<string, string> = {};
    const rid = res.headers.get("X-Lovable-AIG-Run-ID"); if (rid) aigHeaders["X-Lovable-AIG-Run-ID"] = rid;

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      console.error("[email-flow-ai] gateway", res.status, txt.slice(0, 400));
      let msg = "Falha ao gerar o e-mail com IA.";
      try { msg = JSON.parse(txt)?.message || JSON.parse(txt)?.error?.message || msg; } catch { /* keep */ }
      if (res.status === 402) msg = msg || "Créditos de IA esgotados.";
      return json({ error: msg, status: res.status }, res.status, aigHeaders);
    }

    // Consume SSE stream
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "", refusal = "", failed = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") out += ev.delta || "";
          else if (ev.type === "response.refusal.delta") refusal += ev.delta || "";
          else if (ev.type === "response.failed" || ev.type === "error") failed = ev?.response?.error?.message || ev?.message || "falha";
        } catch { /* ignore */ }
      }
    }
    if (refusal) return json({ error: "A IA recusou gerar este conteúdo." }, 422, aigHeaders);
    if (failed && !out) return json({ error: failed }, 502, aigHeaders);
    let parsed: any = null;
    try { parsed = JSON.parse(out); } catch { /* */ }
    if (!parsed?.html) return json({ error: "A IA não retornou um e-mail válido." }, 502, aigHeaders);
    return json({ ...parsed, images }, 200, aigHeaders);
  } catch (err: any) {
    if (err?.name === "AbortError") return json({ error: "cancelado" }, 499);
    console.error("[email-flow-ai]", err);
    return json({ error: String(err?.message || err) }, 500);
  }
});
