// audit-vitality-protocol
// Detecta e substitui protocolos de pré/pós-processamento alucinados da
// Smart Print Bio Vitality em knowledge_contents, usando como fonte da
// verdade `resins.processing_instructions` da Vitality.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const VITALITY_SLUG = "resina-3d-smart-print-bio-vitality-longa-duracao";
const MIN_CONFIDENCE = 0.75;

// Markdown -> HTML simples (suficiente para o protocolo da Vitality)
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  const closeUl = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]/g, "<strong>$1</strong>");
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) { closeUl(); continue; }
    let m;
    if ((m = l.match(/^### (.+)/))) { closeUl(); out.push(`<h4>${inline(m[1])}</h4>`); continue; }
    if ((m = l.match(/^## (.+)/)))  { closeUl(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = l.match(/^# (.+)/)))   { closeUl(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = l.match(/^>\s?(.*)/))) { closeUl(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = l.match(/^\s*[•\-\*]\s+(.+)/))) {
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    closeUl();
    out.push(`<p>${inline(l)}</p>`);
  }
  closeUl();
  return out.join("\n");
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<any> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(raw); } catch { return {}; }
}

const SYSTEM_PROMPT = `Você é auditor técnico do protocolo oficial Smart Print Bio Vitality (Smart Dent).

PROTOCOLO CANÔNICO (resumo):
- PRÉ: filtrar resina em peneira 100 µm, homogeneizar 1 min, temperatura 25–35 °C.
- LAVAGEM: NanoClean Pod (cesta metálica, agitar 60 s), secagem com ar comprimido. NÃO usa IPA/álcool isopropílico nem agitação ultrassônica.
- PÓS-CURA UV: Elegoo Mercury 36 W, Anycubic Wash & Cure 25 W, ou ShapeCure D 150 W com presets Vitality.
- TRATAMENTO TÉRMICO: glicerina 130–150 °C, forno seco 150 °C, ou soprador térmico 60–170 °C.

SINAIS DE ALUCINAÇÃO (devem ser sinalizados):
- Menção a ASIGA Composer, Anycubic Photon (fora de pós-cura), ou outras impressoras como obrigatórias.
- IPA / álcool isopropílico / "IPA 90%" / "IPA 99%" como lavagem.
- Agitação ultrassônica como método oficial.
- Espessura de camada em microns (ex.: "50 microns", "100 microns").
- Inclinação de suportes em graus (ex.: "45°").
- Tempos de impressão por número de coroas (ex.: "35 min para 3 coroas").
- Valores de tempo/temperatura de pós-cura DIFERENTES dos canônicos.

NÃO sinalizar:
- Menção genérica a Vitality sem descrever protocolo.
- Referências corretas ao NanoClean Pod + Elegoo/Anycubic/ShapeCure.
- Texto sobre indicações clínicas, propriedades mecânicas, FDA, ANVISA, estudos.

Responda APENAS com JSON válido neste schema:
{
  "has_hallucinated_protocol": boolean,
  "hallucinated_html_block": string|null,  // trecho HTML LITERAL (copiado exatamente do artigo) a ser substituído. Inclua <h2>/<h3>/<p>/<ul>... que formam o bloco do protocolo errado. NÃO invente tags.
  "reason": string,
  "confidence": number  // 0.0 a 1.0
}`;

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function findAndReplace(haystack: string, needle: string, replacement: string): { ok: boolean; result: string } {
  if (!needle) return { ok: false, result: haystack };
  if (haystack.includes(needle)) {
    return { ok: true, result: haystack.replace(needle, replacement) };
  }
  // fallback: match normalizado
  const nHay = normalizeWs(haystack);
  const nNeedle = normalizeWs(needle);
  const idx = nHay.indexOf(nNeedle);
  if (idx < 0) return { ok: false, result: haystack };
  // mapear de volta para o offset original via regex flexível de whitespace
  const pattern = nNeedle
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+");
  const re = new RegExp(pattern);
  if (!re.test(haystack)) return { ok: false, result: haystack };
  return { ok: true, result: haystack.replace(re, replacement) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true
    const limit = Number(body.limit ?? 100);
    const onlySlug = body.slug as string | undefined;
    const asyncMode = body.async === true;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fonte da verdade
    const { data: resin, error: rErr } = await supabase
      .from("resins")
      .select("processing_instructions")
      .eq("slug", VITALITY_SLUG)
      .maybeSingle();
    if (rErr || !resin?.processing_instructions) {
      throw new Error("Vitality canonical protocol not found");
    }
    const canonicalHtml = `<section data-source="resins.vitality.canonical">\n<h2>Pré e Pós Processamento — Smart Print Bio Vitality</h2>\n${mdToHtml(resin.processing_instructions)}\n<p><em>Fonte oficial: <a href="https://parametros.smartdent.com.br/resina/${VITALITY_SLUG}">Smart Print Bio Vitality</a></em></p>\n</section>`;

    // 2. Candidatos
    let q = supabase
      .from("knowledge_contents")
      .select("id, slug, title, content_html")
      .eq("active", true)
      .ilike("content_html", "%vitality%")
      .limit(limit);
    if (onlySlug) q = q.eq("slug", onlySlug);
    const { data: articles, error: aErr } = await q;
    if (aErr) throw aErr;

    const runJob = async () => {
      const results: any[] = [];
      let updated = 0, flagged = 0, skipped = 0;
      for (const art of articles || []) {
        const html = String(art.content_html || "");
        if (!/(pós[- ]?processamento|pós[- ]?cura|lavagem|pré[- ]?processamento|pre[- ]?processamento|asiga|ipa\s*9|micron|inclinação|ultrass[oô]n)/i.test(html)) {
          results.push({ slug: art.slug, skipped: "no_protocol_keywords" });
          continue;
        }
        let verdict: any = {};
        try {
          const userPrompt = `TÍTULO: ${art.title}\nSLUG: ${art.slug}\n\nHTML DO ARTIGO:\n${html.slice(0, 18000)}`;
          verdict = await callAI(SYSTEM_PROMPT, userPrompt);
        } catch (e) {
          results.push({ slug: art.slug, error: String((e as Error).message) });
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        const hasHall = !!verdict.has_hallucinated_protocol;
        const conf = Number(verdict.confidence || 0);
        const block = verdict.hallucinated_html_block as string | null;
        if (!hasHall) { results.push({ slug: art.slug, flagged: false, confidence: conf }); await new Promise((r) => setTimeout(r, 800)); continue; }
        flagged++;
        if (conf < MIN_CONFIDENCE || !block || block.length < 30) { skipped++; results.push({ slug: art.slug, flagged: true, skipped: "low_confidence_or_no_block", confidence: conf }); await new Promise((r) => setTimeout(r, 800)); continue; }
        if (block.length > html.length * 0.4) { skipped++; results.push({ slug: art.slug, flagged: true, skipped: "block_too_large" }); await new Promise((r) => setTimeout(r, 800)); continue; }
        const { ok, result: newHtml } = findAndReplace(html, block, canonicalHtml);
        if (!ok) {
          skipped++;
          await supabase.from("system_health_logs").insert({ function_name: "audit-vitality-protocol", severity: "warning", error_type: "block_not_found", details: { slug: art.slug, reason: verdict.reason, block_preview: block.slice(0, 200) } });
          results.push({ slug: art.slug, flagged: true, skipped: "block_not_found" });
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        results.push({ slug: art.slug, flagged: true, confidence: conf, will_update: !dryRun });
        if (!dryRun) {
          const { error: upErr } = await supabase.from("knowledge_contents").update({ content_html: newHtml, updated_at: new Date().toISOString() }).eq("id", art.id);
          if (upErr) { results[results.length - 1].update_error = upErr.message; }
          else {
            updated++;
            await supabase.from("system_health_logs").insert({ function_name: "audit-vitality-protocol", severity: "info", error_type: "updated", details: { slug: art.slug, confidence: conf, reason: verdict.reason, before_html: html, after_html: newHtml } });
          }
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      await supabase.from("system_health_logs").insert({
        function_name: "audit-vitality-protocol",
        severity: "info",
        error_type: dryRun ? "batch_complete_dry_run" : "batch_complete_applied",
        details: { scanned: articles?.length || 0, flagged, updated, skipped, results },
      });
      return { scanned: articles?.length || 0, flagged, updated, skipped, results };
    };

    if (asyncMode) {
      // @ts-ignore EdgeRuntime
      EdgeRuntime.waitUntil(runJob());
      return new Response(JSON.stringify({ success: true, async: true, scheduled: articles?.length || 0, dry_run: dryRun }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const summary = await runJob();
    return new Response(JSON.stringify({ success: true, dry_run: dryRun, ...summary }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // legacy sync path (unreachable below)
    /*
    const results: any[] = [];
    let updated = 0, flagged = 0, skipped = 0;

    for (const art of articles || []) {
      const html = String(art.content_html || "");
      // pré-filtro: só vale a pena auditar se citar etapa de processamento
      if (!/(pós[- ]?processamento|pós[- ]?cura|lavagem|pré[- ]?processamento|pre[- ]?processamento|asiga|ipa\s*9|micron|inclinação|ultrass[oô]n)/i.test(html)) {
        results.push({ slug: art.slug, skipped: "no_protocol_keywords" });
        continue;
      }

      let verdict: any = {};
      try {
        const userPrompt = `TÍTULO: ${art.title}\nSLUG: ${art.slug}\n\nHTML DO ARTIGO:\n${html.slice(0, 18000)}`;
        verdict = await callAI(SYSTEM_PROMPT, userPrompt);
      } catch (e) {
        results.push({ slug: art.slug, error: String((e as Error).message) });
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      const hasHall = !!verdict.has_hallucinated_protocol;
      const conf = Number(verdict.confidence || 0);
      const block = verdict.hallucinated_html_block as string | null;

      if (!hasHall) {
        results.push({ slug: art.slug, flagged: false, confidence: conf, reason: verdict.reason });
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      flagged++;
      if (conf < MIN_CONFIDENCE || !block || block.length < 30) {
        skipped++;
        results.push({ slug: art.slug, flagged: true, skipped: "low_confidence_or_no_block", confidence: conf, reason: verdict.reason });
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      // Salvaguarda: bloco não pode ser >40% do artigo
      if (block.length > html.length * 0.4) {
        skipped++;
        results.push({ slug: art.slug, flagged: true, skipped: "block_too_large", block_len: block.length, html_len: html.length, reason: verdict.reason });
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const { ok, result: newHtml } = findAndReplace(html, block, canonicalHtml);
      if (!ok) {
        skipped++;
        await supabase.from("system_health_logs").insert({
          function_name: "audit-vitality-protocol",
          severity: "warning",
          error_type: "block_not_found",
          details: { slug: art.slug, reason: verdict.reason, block_preview: block.slice(0, 200) },
        });
        results.push({ slug: art.slug, flagged: true, skipped: "block_not_found", reason: verdict.reason });
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      results.push({ slug: art.slug, flagged: true, confidence: conf, reason: verdict.reason, will_update: !dryRun, new_html_len: newHtml.length });

      if (!dryRun) {
        const { error: upErr } = await supabase
          .from("knowledge_contents")
          .update({ content_html: newHtml, updated_at: new Date().toISOString() })
          .eq("id", art.id);
        if (upErr) {
          results[results.length - 1].update_error = upErr.message;
        } else {
          updated++;
          await supabase.from("system_health_logs").insert({
            function_name: "audit-vitality-protocol",
            severity: "info",
            error_type: "updated",
            details: {
              slug: art.slug,
              confidence: conf,
              reason: verdict.reason,
              before_html: html,
              after_html: newHtml,
            },
          });
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      scanned: articles?.length || 0,
      flagged,
      updated,
      skipped,
      results,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    */
  } catch (e) {
    console.error("[audit-vitality-protocol] error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});