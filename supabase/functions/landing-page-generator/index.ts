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

const DESIGN_SYSTEM = `
PADRÃO ESTÉTICO OBRIGATÓRIO (Smart Dent — odontologia digital premium):
- Paleta oficial (use EXATAMENTE estes hex):
  * Roxo principal #2C245B  (superfícies dominantes, chrome)
  * Roxo hero     #1D173E  (fundo do hero e seções escuras)
  * Laranja CTA   #F47C42  (botão principal e destaques)
  * Fundo suave   #F4F5F8  (seções alternadas claras)
  * Texto         #202331  (corpo)
  * Sucesso       #168B5B  (checkmarks / status aprovado)
  * Branco        #FFFFFF  (cards e superfícies claras)
- Tipografia: Inter no corpo, Manrope como display para headlines. Pesos 400/500/700/800.
  Use tipografia fluida (leading-tight em títulos, text-4xl md:text-6xl).
- SELO "ATIVAÇÃO INICIAL": obrigatório como badge grande no hero (uppercase, tracking-wider,
  bg-[#F47C42] text-white px-4 py-1.5 rounded-full text-xs md:text-sm shadow-lg)
  E como faixa laranja no card de preço quando o contexto mencionar ativação/licença/oferta.
- Hero: fundo #1D173E, composição visual com SVG inline geométrico
  (sorriso digital estilizado, malha CAD, círculos concêntricos) — NUNCA imagens externas,
  nunca watermarks. Detalhes tecnológicos discretos (linhas finas, dots grid).
- Ícones lineares SVG inline (stroke 1.5, currentColor). Biblioteca de referência:
    licença      → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>
    computador   → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
    treinamento  → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></svg>
    cartão       → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg>
    suporte      → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 016 0c0 2-3 3-3 5"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>
    Brasil       → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12h20M12 2v20"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/></svg>
    módulos      → <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  Use estes SVGs quando o contexto pedir os respectivos ícones.
- Botões:
  * primário: <button data-form-cta="primary" class="inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F47C42] focus-visible:ring-offset-2 transition">CTA</button>
  * secundário: outline com border border-white/40 text-white sobre roxo, ou border-[#2C245B] text-[#2C245B] sobre claro.
- CTA FIXO NO MOBILE: no fim do <main>, adicione uma barra fixa
  <div class="fixed inset-x-0 bottom-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-black/5 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
    <button data-form-cta="primary" class="w-full min-h-12 rounded-xl bg-[#F47C42] text-white font-semibold shadow-lg">Quero ativar agora</button>
  </div>
- Cards: rounded-2xl bg-white shadow-xl p-6 md:p-8, muito whitespace, textos curtos.
  Detalhes expansíveis via <details><summary class="cursor-pointer font-medium">Ver mais</summary>...</details>.
- FAQ: acordeão nativo <details><summary>. Preço e condições essenciais SEMPRE fora do acordeão.
- Ordem obrigatória das seções: hero (com badge ATIVAÇÃO INICIAL) → faixa de confiança/logos
  → dor & transformação → oferta com card de preço → módulos/benefícios (grid de ícones)
  → depoimentos ou prova social → FAQ (acordeão) → CTA final full-width roxo → footer legal minimal.
- Responsividade mobile-first: grid 1→2→3 colunas, tipografia fluida, tap-targets min-h-11 min-w-11.
- Acessibilidade AA: focus-visible:ring-2 ring-[#F47C42] em todos os elementos interativos;
  aria-label em botões icon-only; aria-hidden="true" em SVGs decorativos; alt="" em decorativas;
  contraste garantido (#F47C42 sobre #1D173E large-text AA; #202331 sobre #F4F5F8 AAA).
`.trim();

function buildSystemPrompt(form: { name: string; slug: string; form_purpose: string }) {
  return `Você é um diretor de arte, copywriter e engenheiro front-end sênior da Smart Dent, no nível de qualidade de estúdios premiados (Lovable / Awwwards). Sua tarefa é gerar UMA landing page completa em HTML semântico com classes Tailwind CSS já disponíveis no projeto.

${DESIGN_SYSTEM}

REGRAS TÉCNICAS:
1. Retorne APENAS o HTML da landing page (sem <html>, <head> ou <body>) — começando por um <main> ou <section>.
2. Use exclusivamente classes utilitárias Tailwind. NÃO use <style>, <script>, ou frameworks externos.
3. Todos os CTAs (botões) que devam abrir o formulário devem ter EXATAMENTE o marcador de placeholder:
   - Botão principal: <button data-form-cta="primary" class="...">Texto do CTA</button>
   - Botão secundário (opcional): <button data-form-cta="secondary" class="...">Texto</button>
4. NUNCA invente preços, prazos, números ou dados técnicos que não estejam no input.
5. Nunca inclua imagens externas (use ícones lucide via <svg> inline apenas se necessário, preferindo composições de tipografia + cores).
6. O formulário do card (${form.name} / /f/${form.slug}) será renderizado no lugar dos CTAs — não escreva um <form> HTML manualmente.
7. Use português brasileiro, tom Smart Dent (profissional, direto, orientado a resultado).
8. Idealmente 1600–2600 linhas de HTML puro, cobrindo todas as seções obrigatórias, com whitespace generoso.
9. Cada seção envolvida em <section aria-labelledby="..."> com heading próprio; hierarquia h1/h2/h3 correta.
10. Adicione o CTA fixo no mobile no fim do <main>.

CHECKLIST OBRIGATÓRIA — antes de retornar, verifique que TODOS estes itens existem no HTML:
  [ ] <main class="bg-white text-[#202331]">
  [ ] <section> hero com fundo bg-[#1D173E] text-white
  [ ] Badge visível "ATIVAÇÃO INICIAL" no hero (uppercase, bg-[#F47C42])
  [ ] <h1> grande com classes font-black tracking-tight text-4xl md:text-6xl leading-tight
  [ ] Botão primário com classes EXATAS: "inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg hover:brightness-110 transition"
  [ ] Seção de card de preço com faixa laranja "ATIVAÇÃO INICIAL" no topo
  [ ] Grid de 3+ benefícios com SVG inline (viewBox 24 24, stroke-width 1.5)
  [ ] FAQ em <details><summary> (mínimo 4 perguntas)
  [ ] CTA fixo mobile: <div class="fixed inset-x-0 bottom-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-black/5 p-3 shadow-lg"><button data-form-cta="primary" class="w-full min-h-12 rounded-xl bg-[#F47C42] text-white font-semibold shadow-lg">Quero ativar agora</button></div>
  [ ] Footer legal com texto pequeno

EXEMPLO GOLDEN (padrão de qualidade esperado — replicar essa densidade e riqueza):

<main class="bg-white text-[#202331]" style="font-family:'Inter',system-ui,sans-serif">
  <section aria-labelledby="hero-title" class="relative overflow-hidden bg-[#1D173E] text-white">
    <div class="absolute inset-0 opacity-30" aria-hidden="true">
      <svg viewBox="0 0 800 600" class="w-full h-full"><defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#F47C42" opacity="0.4"/></pattern></defs><rect width="800" height="600" fill="url(#dots)"/></svg>
    </div>
    <div class="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
      <span class="inline-block bg-[#F47C42] text-white uppercase tracking-widest text-xs md:text-sm font-bold px-4 py-1.5 rounded-full shadow-lg mb-6">Ativação Inicial</span>
      <h1 id="hero-title" class="font-black tracking-tight text-4xl md:text-6xl leading-tight max-w-3xl" style="font-family:'Manrope',sans-serif">Seu laboratório pronto para trabalhar com exocad completo e oficial.</h1>
      <p class="mt-6 text-lg md:text-xl text-white/80 max-w-2xl">Licença original, ativação assistida e treinamento com quem entende de fluxo digital odontológico.</p>
      <div class="mt-10 flex flex-col sm:flex-row gap-4">
        <button data-form-cta="primary" class="inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg hover:brightness-110 transition">Quero começar agora</button>
        <button data-form-cta="secondary" class="inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl border border-white/40 text-white font-semibold hover:bg-white/10 transition">Tirar uma dúvida</button>
      </div>
    </div>
  </section>

  <section aria-labelledby="oferta" class="bg-[#F4F5F8] py-20">
    <div class="max-w-3xl mx-auto px-6">
      <div class="rounded-2xl bg-white shadow-xl overflow-hidden">
        <div class="bg-[#F47C42] text-white uppercase tracking-widest text-center text-sm font-bold py-3">Ativação Inicial</div>
        <div class="p-8 md:p-10">
          <h2 id="oferta" class="text-3xl font-black" style="font-family:'Manrope',sans-serif">O que está incluso</h2>
          <ul class="mt-6 space-y-3 text-[#202331]">
            <li class="flex gap-3"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#168B5B" stroke-width="2" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg><span>Licença oficial exocad DentalCAD</span></li>
            <li class="flex gap-3"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#168B5B" stroke-width="2" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg><span>Treinamento remoto conduzido</span></li>
            <li class="flex gap-3"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#168B5B" stroke-width="2" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg><span>Suporte técnico Smart Dent Brasil</span></li>
          </ul>
          <button data-form-cta="primary" class="mt-8 w-full inline-flex items-center justify-center min-h-12 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg hover:brightness-110 transition">Ativar agora</button>
        </div>
      </div>
    </div>
  </section>

  <section aria-labelledby="faq" class="py-20 max-w-3xl mx-auto px-6">
    <h2 id="faq" class="text-3xl md:text-4xl font-black mb-8" style="font-family:'Manrope',sans-serif">Perguntas frequentes</h2>
    <div class="space-y-3">
      <details class="group rounded-xl bg-[#F4F5F8] p-5"><summary class="cursor-pointer font-semibold flex justify-between items-center">Como funciona a ativação? <span class="text-[#F47C42] group-open:rotate-45 transition">+</span></summary><p class="mt-3 text-[#202331]/80">Após a confirmação, a Smart Dent inicia a instalação e o treinamento.</p></details>
      <details class="group rounded-xl bg-[#F4F5F8] p-5"><summary class="cursor-pointer font-semibold flex justify-between items-center">Quem emite a licença? <span class="text-[#F47C42] group-open:rotate-45 transition">+</span></summary><p class="mt-3 text-[#202331]/80">A licença é emitida oficialmente pela exocad GmbH.</p></details>
    </div>
  </section>

  <div class="fixed inset-x-0 bottom-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-black/5 p-3 shadow-lg">
    <button data-form-cta="primary" class="w-full min-h-12 rounded-xl bg-[#F47C42] text-white font-semibold shadow-lg">Quero ativar agora</button>
  </div>
</main>

Fim do exemplo. AGORA, gere a landing page real com a MESMA densidade e o MESMO padrão de classes, expandindo com mais seções (prova social, transformação, módulos, depoimentos) conforme o input do usuário.

FORMULÁRIO ALVO: "${form.name}" — finalidade ${form.form_purpose} — slug ${form.slug}.`;
}

function buildUserPrompt(mode: "ai" | "briefing", input: string) {
  if (mode === "briefing") {
    return `MODO: BRIEFING (fidelidade total).\n\nO usuário colou o briefing/documento abaixo. Gere a landing page fielmente ao conteúdo — respeitando preços, ofertas, módulos, depoimentos e textos citados. Não invente informação que não está no briefing.\n\n=== BRIEFING ===\n${input}\n=== FIM DO BRIEFING ===`;
  }
  return `MODO: IA (expansão criativa).\n\nA ideia central da landing page é:\n\n${input}\n\nExpanda com hero envolvente, prova social, benefícios e FAQ dentro do padrão estético fixo. NÃO invente preços — se não houver preço na ideia, faça CTA sem número.`;
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

    // Cascade de modelos: GPT-5.5 (priority) → GPT-5.4 → Gemini 3.1 Pro → Gemini 3 Flash.
    const messages = [
      { role: "system", content: buildSystemPrompt(form) },
      { role: "user", content: buildUserPrompt(mode, input) },
    ];
    const callModel = async (model: string, opts: { priority?: boolean } = {}) => {
      const body: Record<string, unknown> = { model, messages, max_tokens: 16000 };
      // GPT-5.x são modelos de reasoning — não aceitam temperature custom.
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
      // Só faz fallback em erros transitórios/de modelo (429/402/400/404/5xx).
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
    let html: string = json?.choices?.[0]?.message?.content ?? "";
    // Strip markdown code fences if the model wrapped output
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
    html = sanitizeAndReinforce(html);

    return new Response(JSON.stringify({ html }), {
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

// ------------------------------------------------------------------
// Sanitizer: garante estética premium mesmo se o modelo pular itens.
// ------------------------------------------------------------------
const CANONICAL_PRIMARY_CLASSES =
  "inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg hover:brightness-110 transition";
const CANONICAL_SECONDARY_CLASSES =
  "inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl border border-current font-semibold hover:bg-current/10 transition";
const MOBILE_STICKY_CTA = `\n<div class="fixed inset-x-0 bottom-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-black/5 p-3 shadow-lg" style="padding-bottom:calc(env(safe-area-inset-bottom) + 0.75rem)"><button data-form-cta="primary" class="w-full min-h-12 rounded-xl bg-[#F47C42] text-white font-semibold shadow-lg">Quero ativar agora</button></div>\n`;
const HERO_BADGE = `<span class="inline-block bg-[#F47C42] text-white uppercase tracking-widest text-xs md:text-sm font-bold px-4 py-1.5 rounded-full shadow-lg mb-6">Ativação Inicial</span>`;

function sanitizeAndReinforce(input: string): string {
  let html = input.trim();
  if (!html) return html;

  // 1) Botões data-form-cta="primary" sem cor de fundo → aplica classes canônicas.
  html = html.replace(
    /<button([^>]*?)data-form-cta="primary"([^>]*)>/gi,
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