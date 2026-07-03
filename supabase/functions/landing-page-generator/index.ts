import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CANONICAL_MODULES = `LISTA CANÔNICA DOS 15 MÓDULOS ULTIMATE LAB BUNDLE (sempre que o input for sobre exocad/DentalCAD/Ultimate Lab Bundle):
1. DentalCAD Core Version — Coroas, pontes, copings, inlays, onlays, overlays, facetas, enceramentos, telescópicas e fluxos restauradores essenciais.
2. Virtual Articulator — Simulação de movimentos mandibulares e análise de oclusão dinâmica.
3. Provisional Module — Desenho de provisórios, incluindo estruturas do tipo eggshell com base em escaneamentos pré-operatórios.
4. TruSmile™ Module — Visualização e renderização realista das restaurações.
5. ZRS Tooth Library — Biblioteca adicional de formas dentais naturais.
6. Implant Module — Pilares personalizados, coroas sobre implante e restaurações parafusadas.
7. Bar Module — Desenho de barras simples e complexas para soluções implantossuportadas.
8. DICOM Viewer Module — Visualização de dados volumétricos durante o processo de desenho. Não substitui o exoplan nem constitui ferramenta autônoma de diagnóstico.
9. Model Creator Module — Criação de modelos físicos a partir de escaneamentos digitais, para impressão 3D.
10. Smile Creator Module — Planejamento estético com integração de dados 2D e 3D.
11. Full Denture Module — Desenho digital de próteses totais, incluindo fluxos compatíveis previstos no pacote.
12. Inspira™ Denture Tooth Library — Biblioteca de dentes para fluxos digitais de prótese total, conforme disponibilidade da versão.
13. PartialCAD Module — Desenho de estruturas metálicas ou digitais para próteses parciais removíveis.
14. Bite Splint Module — Placas oclusais, night guards, splints e estruturas tabletop.
15. Jaw Motion Import Module — Importação de movimentos reais de sistemas de registro mandibular e arco facial digital.`;

const CONTENT_SCHEMA_DOC = `Retorne APENAS JSON válido no schema abaixo. Nada de HTML, CSS, markdown, comentários, texto fora do JSON.

{
  "brandName": string (opcional, ex: "SMART DENT"),
  "resellerBadge": string OPCIONAL (ex: "Official Reseller exocad"),
  "nav": { "items": [ { "label": string, "anchor": string } ] (4-6 itens curtos, ex: Produto, Módulos, Como funciona, Preço, FAQ), "cta": string (ex: "Assinar Agora") },
  "hero": {
    "badge": string (obrigatório, ex: "Licença Oficial · RMS para o Brasil"),
    "eyebrow": string OPCIONAL (curto, uppercase),
    "headline": string (uma frase impactante, 6-14 palavras),
    "headlineParts": [ { "text": string, "highlight": boolean } ] (3-5 chunks que somados reconstroem a headline letra por letra; marque 1 chunk semanticamente central como highlight:true — será renderizado em gradiente roxo→laranja),
    "sub": string (uma frase de apoio, 12-24 palavras),
    "trustInline": [ { "icon": "shield"|"headphones"|"infinity"|"check"|"clock", "label": string } ] (2-4 selos inline curtos),
    "pricePill": { "label": string (ex: "Ativação + 1º mês"), "value": string (ex: "R$ 2.390"), "note": string OPCIONAL (ex: "depois"), "noteStrong": string OPCIONAL (ex: "R$ 1.199/mês") } (OPCIONAL — SÓ inclua se houver preço EXPLÍCITO no input; caso contrário OMITA),
    "primaryCta": string,
    "secondaryCta": string OPCIONAL,
    "productCardCaption": string OPCIONAL (ex: "Revenda Oficial exocad")
  },
  "positioning": { "eyebrow": string, "headline": string (use o placeholder literal "{strike}" onde entra o preço-âncora), "strikePrice": string OPCIONAL, "highlightPrice": string OPCIONAL, "body": string OPCIONAL } (OPCIONAL — SÓ quando o input compara preço anterior vs. atual),
  "howItWorks": { "title": string, "items": [ { "title": string, "desc": string } ] (exatamente 3 passos) },
  "price": {
    "ribbon": string (ex: "Ativação inicial"),
    "title": string,
    "priceLabel": string OPCIONAL (SÓ inclua se o briefing trouxer preço EXPLÍCITO),
    "priceNote": string OPCIONAL,
    "includes": string[] (4-7 itens),
    "cta": string,
    "footnote": string OPCIONAL
  },
  "benefits": { "title": string, "items": [ { "icon": "licenca"|"computador"|"treinamento"|"cartao"|"suporte"|"brasil"|"modulos"|"shield"|"sparkles"|"rocket"|"clock", "title": string, "desc": string } ] (6 itens) },
  "modules": { "eyebrow": string OPCIONAL (uppercase curto, ex: "O QUE ESTÁ INCLUÍDO"), "title": string, "subtitle": string, "items": [ { "name": string, "application": string } ], "footnote": string OPCIONAL } (OPCIONAL — só inclua se o input listar módulos/features explicitamente; NUNCA invente módulos além dos oficialmente listados),
  "regionalRules": { "title": string, "intro": string OPCIONAL, "items": string[], "footnote": string OPCIONAL } (OPCIONAL — regras de uso da licença; tom institucional e informativo, NUNCA ameaçador),
  "implementation": { "title": string, "subtitle": string OPCIONAL, "activation": { "title": string, "items": string[] }, "training": { "title": string, "body": string }, "support": { "title": string, "items": string[] } } (OPCIONAL — para treinamento, use exatamente: "Treinamento inicial remoto, conforme agenda e formato definidos pela Smart Dent, voltado à introdução ao ambiente, fluxo de trabalho e recursos essenciais do plano."),
  "testimonials": { "title": string, "items": [ { "quote": string, "author": string, "role": string } ] (2-3; OMITA se sem depoimentos reais) },
  "faq": { "title": string, "items": [ { "q": string, "a": string } ] (5-8) },
  "finalCta": { "headline": string, "sub": string, "cta": string },
  "legal": string
}

REGRAS CRÍTICAS:
- NUNCA invente preços, prazos, números, depoimentos ou dados fora do input.
- Sem preço explícito → OMITA priceLabel/priceNote e hero.pricePill.
- headline + headlineParts DEVEM ser consistentes: concatenar todos os "text" na ordem deve reproduzir "headline" letra por letra.
- positioning só quando o input compara preços; use exatamente "{strike}" como placeholder.
- Sem depoimentos reais → OMITA "testimonials".
- Tom Smart Dent: profissional, direto, PT-BR. Copy curta e potente.
- Icons apenas da lista permitida.
- Para landing pages de exocad / Ultimate Lab Bundle / DentalCAD, a seção "modules" DEVE conter obrigatoriamente os 15 módulos canônicos na ordem e com as descrições fornecidas abaixo. Não omita nenhum, não altere os nomes e não adicione módulos extras.

${CANONICAL_MODULES}`;

function buildSystemPrompt(form: { name: string; slug: string; form_purpose: string }) {
  return `Você é copywriter sênior da Smart Dent (odontologia digital premium). Sua tarefa é preencher o conteúdo estruturado de uma landing page.

O design é fixo (template React premium já feito). Você SÓ escreve o conteúdo em JSON.

${CONTENT_SCHEMA_DOC}

${CANONICAL_MODULES}

FORMULÁRIO ALVO: "${form.name}" — finalidade ${form.form_purpose} — slug ${form.slug}.`;
}

function buildUserPrompt(mode: "ai" | "briefing", input: string) {
  if (mode === "briefing") {
    return `MODO: BRIEFING (fidelidade total).\n\nProduza o JSON de conteúdo baseado FIELMENTE no briefing abaixo — respeitando preços, ofertas, módulos e textos citados. Não invente nada que não esteja no briefing.\n\n=== BRIEFING ===\n${input}\n=== FIM DO BRIEFING ===`;
  }
  return `MODO: IA (expansão criativa).\n\nA ideia central da landing page é:\n\n${input}\n\nProduza o JSON de conteúdo com hero envolvente, prova social, benefícios e FAQ. NÃO invente preços — se não houver preço na ideia, omita priceLabel.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { form_id, mode, input } = body ?? {};
    if (!form_id || (mode !== "ai" && mode !== "briefing") || typeof input !== "string" || !input.trim()) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: form, error: formErr } = await admin
      .from("smartops_forms")
      .select("id,name,slug,form_purpose,title,subtitle")
      .eq("id", form_id)
      .maybeSingle();

    if (formErr || !form) {
      return new Response(JSON.stringify({ error: "form_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cascade: GPT-5.5 → GPT-5.4 → Gemini 3.1 Pro → Gemini 3 Flash. Todos com JSON mode.
    const messages = [
      { role: "system", content: buildSystemPrompt(form) },
      { role: "user", content: buildUserPrompt(mode, input) },
    ];
    const callModel = async (model: string, opts: { priority?: boolean } = {}) => {
      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      };
      if (!model.startsWith("openai/")) body.temperature = 0.55;
      if (opts.priority) body.service_tier = "priority";
      return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
        },
        body: JSON.stringify(body),
      });
    };

    const cascade: Array<{ model: string; priority?: boolean }> = [
      { model: "openai/gpt-5.5", priority: true },
      { model: "openai/gpt-5.4", priority: true },
      { model: "google/gemini-3.1-pro-preview" },
      { model: "google/gemini-3-flash-preview" },
    ];

    let aiRes: Response | null = null;
    for (const step of cascade) {
      aiRes = await callModel(step.model, { priority: step.priority });
      if (aiRes.ok) break;
      if (![400, 402, 404, 429, 500, 502, 503].includes(aiRes.status)) break;
    }

    if (!aiRes || !aiRes.ok) {
      const errText = await aiRes.text();
      const status = aiRes.status;
      return new Response(
        JSON.stringify({
          error: status === 429 ? "rate_limited" : status === 402 ? "credits_exhausted" : "ai_error",
          detail: errText.slice(0, 500),
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await aiRes.json();
    let raw: string = json?.choices?.[0]?.message?.content ?? "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let content: unknown;
    try {
      content = JSON.parse(raw);
    } catch {
      // try to salvage — extract first {...} block
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          content = JSON.parse(m[0]);
        } catch {
          return new Response(
            JSON.stringify({ error: "ai_invalid_json", detail: raw.slice(0, 400) }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "ai_invalid_json", detail: raw.slice(0, 400) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "unexpected", detail: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
