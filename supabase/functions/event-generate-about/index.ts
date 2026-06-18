import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const BodySchema = z.object({
  event_id: z.string().uuid(),
  language: z.enum(["pt", "en", "es"]),
  extra_context: z.string().trim().max(4000).optional().default(""),
});

const LANG_LABEL: Record<string, string> = {
  pt: "português brasileiro",
  en: "inglês",
  es: "espanhol",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { event_id, language, extra_context } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: ev, error: evErr } = await supabase
      .from("smartops_events")
      .select("*")
      .eq("id", event_id)
      .maybeSingle();
    if (evErr || !ev) {
      return new Response(JSON.stringify({ error: "Evento não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `Você é um redator técnico de Ciência & Tecnologia odontológica. Escreva em ${LANG_LABEL[language]}, 300–500 palavras, tom editorial premium. NUNCA cite preços, valores comerciais ou ofertas. Foque em relevância científica/clínica do evento, público-alvo, temas, tecnologias abordadas e por que profissionais devem acompanhar.`;

    const user = [
      `Evento: ${ev.name}`,
      ev.country ? `País: ${ev.country}` : "",
      ev.location ? `Local: ${ev.location}` : "",
      ev.start_date || ev.end_date ? `Datas: ${[ev.start_date, ev.end_date].filter(Boolean).join(" → ")}` : "",
      ev.company_stand ? `Stand Smart Dent: ${ev.company_stand}` : "",
      ev.website_url ? `Site oficial: ${ev.website_url}` : "",
      extra_context ? `Contexto adicional:\n${extra_context}` : "",
      `\nProduza um texto pronto para publicação em "Artigos — Ciência & Tecnologia".`,
    ].filter(Boolean).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.6,
      }),
    });
    const aiJson = await aiRes.json().catch(() => null);
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: "AI Gateway falhou", status: aiRes.status, details: aiJson }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = aiJson?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const column = `about_event_${language}`;
    const { error: upErr } = await supabase
      .from("smartops_events")
      .update({ [column]: text })
      .eq("id", event_id);
    if (upErr) {
      return new Response(JSON.stringify({ error: "Falha ao salvar", details: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, language, text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[event-generate-about] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});