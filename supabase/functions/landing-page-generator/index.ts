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

const CONTENT_SCHEMA_DOC = `Retorne APENAS JSON válido no schema abaixo. Nada de HTML, CSS, markdown, comentários, texto fora do JSON.

{
  "brandName": string (opcional, ex: "Smart Dent | Fluxo Digital"),
  "trustBar": string[] (3-5 selos curtos: "Revenda oficial", "Suporte em português", "Licença legítima"...),
  "hero": {
    "badge": string (obrigatório, ex: "Ativação inicial" — vira selo laranja),
    "eyebrow": string (opcional, curto, uppercase),
    "headline": string (uma frase impactante, 6-14 palavras),
    "sub": string (uma frase de apoio, 12-24 palavras),
    "primaryCta": string (ex: "Quero ativar agora"),
    "secondaryCta": string (opcional, ex: "Falar com especialista"),
    "bullets": string[] (3 bullets curtos, sem repetir subheadline)
  },
  "howItWorks": {
    "title": string (ex: "Como funciona a ativação"),
    "items": [ { "title": string, "desc": string } ]  (exatamente 3 passos)
  },
  "price": {
    "ribbon": string (ex: "Ativação inicial"),
    "title": string (ex: "Pacote completo, sem surpresas"),
    "priceLabel": string OPCIONAL (SÓ inclua se o briefing trouxer preço EXPLÍCITO; caso contrário OMITA),
    "priceNote": string OPCIONAL (ex: "à vista" ou "em até 12x"),
    "includes": string[] (4-7 itens do pacote),
    "cta": string (ex: "Quero ativar agora"),
    "footnote": string OPCIONAL
  },
  "benefits": {
    "title": string,
    "items": [ { "icon": "licenca"|"computador"|"treinamento"|"cartao"|"suporte"|"brasil"|"modulos"|"shield"|"sparkles"|"rocket"|"clock", "title": string, "desc": string } ]  (6 itens)
  },
  "testimonials": {
    "title": string,
    "items": [ { "quote": string, "author": string, "role": string } ]  (2-3 itens; OMITA seção inteira se briefing não trouxer depoimentos)
  },
  "faq": {
    "title": string,
    "items": [ { "q": string, "a": string } ]  (5-8 perguntas)
  },
  "finalCta": {
    "headline": string (frase de fechamento),
    "sub": string,
    "cta": string
  },
  "legal": string (rodapé curto)
}

REGRAS CRÍTICAS:
- NUNCA invente preços, prazos, números de vendas, depoimentos ou dados que não estejam no input.
- Se não houver preço explícito no briefing, OMITA os campos priceLabel/priceNote (o card ainda vai mostrar bem sem preço).
- Se não houver depoimentos reais no briefing, OMITA "testimonials" inteiramente.
- Tom: Smart Dent — profissional, direto, orientado a resultado, português brasileiro.
- Copy curta e potente. Nada de blocos com 3+ frases.
- O selo "Ativação inicial" no hero.badge e price.ribbon é obrigatório quando o contexto for ativação/licença/pacote.
- Icons: escolha o mais fiel entre a lista permitida. NÃO invente ícones fora dela.`;

function buildSystemPrompt(form: { name: string; slug: string; form_purpose: string }) {
  return `Você é copywriter sênior da Smart Dent (odontologia digital premium). Sua tarefa é preencher o conteúdo estruturado de uma landing page.

O design é fixo (template React premium já feito). Você SÓ escreve o conteúdo em JSON.

${CONTENT_SCHEMA_DOC}

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
    (match, before, after) => {
      const combined = `${before} ${after}`;
      if (/bg-\[#F47C42\]|bg-\[#f47c42\]/.test(combined)) return match;
      // reescreve preservando outros atributos, forçando class canônica
      const cleaned = `${before} ${after}`
        .replace(/\sclass="[^"]*"/i, "")
        .replace(/\sclass='[^']*'/i, "");
      return `<button${cleaned} data-form-cta="primary" class="${CANONICAL_PRIMARY_CLASSES}">`;
    },
  );
  html = html.replace(
    /<button([^>]*?)data-form-cta="secondary"([^>]*)>/gi,
    (match, before, after) => {
      const combined = `${before} ${after}`;
      if (/border|bg-/.test(combined)) return match;
      const cleaned = `${before} ${after}`
        .replace(/\sclass="[^"]*"/i, "")
        .replace(/\sclass='[^']*'/i, "");
      return `<button${cleaned} data-form-cta="secondary" class="${CANONICAL_SECONDARY_CLASSES}">`;
    },
  );

  // 2) Se não existe badge "Ativação Inicial" (case-insensitive) → injeta no início da primeira <section>.
  if (!/Ativa[cç][aã]o\s+Inicial/i.test(html)) {
    html = html.replace(/<section([^>]*)>/i, `<section$1><div class="max-w-6xl mx-auto px-6 pt-6">${HERO_BADGE}</div>`);
  }

  // 3) Se não existe CTA fixo mobile → append antes de </main> (ou no fim se não houver <main>).
  if (!/fixed[^"']*bottom-0[^"']*md:hidden/i.test(html)) {
    if (/<\/main>/i.test(html)) {
      html = html.replace(/<\/main>/i, `${MOBILE_STICKY_CTA}</main>`);
    } else {
      html += MOBILE_STICKY_CTA;
    }
  }

  return html;
}