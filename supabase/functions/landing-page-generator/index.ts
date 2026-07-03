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
PADRÃO ESTÉTICO OBRIGATÓRIO (fixo em toda LP):
- Paleta: roxo profundo #2A0F4C / #3A1566 (fundos dominantes), branco #FFFFFF (superfícies claras),
  laranja luminoso #FF6A1A (CTA principal), texto #202331, superfícies suaves #F4F5F8, sucesso #168B5B.
- Tipografia: Inter, pesos 400/500/700. Títulos grandes e diretos (text-4xl a text-6xl).
- Estética: premium de odontologia digital — hero escuro roxo com detalhes laranja,
  cards claros rounded-2xl com sombra discreta, badges "Licença oficial",
  numerais grandes de preço, seções full-width alternando roxo/branco.
- Botões: primário laranja preenchido (bg-[#FF6A1A] text-white hover:brightness-110);
  secundário outline (border border-white/40 text-white ou border-[#2A0F4C] text-[#2A0F4C]).
- Ordem obrigatória das seções: hero → faixa de confiança (logos/badges) → dor/transformação
  → oferta e preços → módulos/benefícios → depoimentos → FAQ → CTA final → footer legal.
- Cantos: rounded-2xl padrão. Sombras: shadow-xl discreto em cards.
`.trim();

function buildSystemPrompt(form: { name: string; slug: string; form_purpose: string }) {
  return `Você é um diretor de arte e copywriter sênior da Smart Dent. Sua tarefa é gerar UMA landing page completa em HTML semântico com classes Tailwind CSS já disponíveis no projeto.

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
8. Idealmente 1400–2200 linhas de HTML puro, cobrindo todas as seções obrigatórias.

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

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: buildSystemPrompt(form) },
          { role: "user", content: buildUserPrompt(mode, input) },
        ],
        temperature: 0.6,
      }),
    });

    if (!aiRes.ok) {
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