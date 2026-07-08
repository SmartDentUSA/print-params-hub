import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CtaRef {
  tipo: "landing" | "form" | "custom";
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
  use_landing_page?: boolean;
}

// ── Smart Dent LP palette (mirrors PremiumLandingTemplate) ──
const BRAND = {
  purple: "#7C3AED",
  orange: "#F97316",
  ink: "#1B1030",
  inkSoft: "#4A4458",
  muted: "#6B6478",
  bgSoft: "#F4EEFB",
  bgHero: "#FAF7FF",
  border: "#EEE7FA",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

// Strip anything price-shaped from LP text (Core rule: no prices in AI content).
function stripPrices(s: string): string {
  if (!s) return s;
  return s
    .replace(/R\$\s*[\d.,]+/gi, "")
    .replace(/\{strike\}/gi, "")
    .replace(/\bpor\s+R\$[^.,]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanLpText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(cleanLpText).filter(Boolean).join(" ");
  if (typeof v === "object") return "";
  return stripPrices(String(v));
}

type LPDossier = {
  hero_image_url?: string | null;
  brand_name?: string;
  reseller_badge?: string;
  hero: {
    eyebrow?: string;
    badge?: string;
    headline_parts?: { text: string; highlight?: boolean }[];
    headline?: string;
    sub?: string;
    bullets?: string[];
    trust?: string[];
  };
  positioning?: { eyebrow?: string; headline?: string; body?: string };
  how_it_works?: { title: string; desc: string }[];
  benefits?: { title: string; desc: string }[];
  trust_bar?: string[];
};

async function loadLpDossier(
  supabase: any,
  ctaPrincipal: CtaRef | undefined,
  produtoId: string | undefined,
): Promise<LPDossier | null> {
  try {
    let row: any = null;

    // Prefer explicit landing CTA id.
    if (ctaPrincipal?.tipo === "landing" && ctaPrincipal.id) {
      const { data } = await supabase
        .from("smartops_form_landing_pages")
        .select("id, hero_image_url, content, status, form_id")
        .eq("id", ctaPrincipal.id)
        .maybeSingle();
      if (data && data.status === "published") row = data;
    }

    // Fallback: any published LP whose form belongs to this product.
    if (!row && produtoId) {
      const { data: forms } = await supabase
        .from("smartops_forms").select("id").eq("product_catalog_id", produtoId);
      const ids = (forms || []).map((f: any) => f.id);
      if (ids.length) {
        const { data } = await supabase
          .from("smartops_form_landing_pages")
          .select("id, hero_image_url, content, status, form_id")
          .in("form_id", ids)
          .eq("status", "published")
          .limit(1);
        if (data && data[0]) row = data[0];
      }
    }

    if (!row || !row.content) return null;
    const c = row.content as any;

    const parts = Array.isArray(c?.hero?.headlineParts)
      ? c.hero.headlineParts
          .map((p: any) => ({ text: cleanLpText(p?.text), highlight: !!p?.highlight }))
          .filter((p: any) => p.text)
      : undefined;

    const trustInline = Array.isArray(c?.hero?.trustInline)
      ? c.hero.trustInline.map((t: any) => cleanLpText(t?.label)).filter(Boolean)
      : undefined;

    const bullets = Array.isArray(c?.hero?.bullets)
      ? c.hero.bullets.map(cleanLpText).filter(Boolean).slice(0, 5)
      : undefined;

    const how = Array.isArray(c?.howItWorks?.items)
      ? c.howItWorks.items
          .map((it: any) => ({ title: cleanLpText(it?.title), desc: cleanLpText(it?.desc) }))
          .filter((x: any) => x.title || x.desc)
          .slice(0, 3)
      : undefined;

    const benefits = Array.isArray(c?.benefits?.items)
      ? c.benefits.items
          .map((it: any) => ({ title: cleanLpText(it?.title), desc: cleanLpText(it?.desc) }))
          .filter((x: any) => x.title || x.desc)
          .slice(0, 6)
      : undefined;

    const trustBar = Array.isArray(c?.trustBar)
      ? c.trustBar.map(cleanLpText).filter(Boolean).slice(0, 4)
      : undefined;

    return {
      hero_image_url: row.hero_image_url || null,
      brand_name: cleanLpText(c?.brandName) || "Smart Dent",
      reseller_badge: cleanLpText(c?.resellerBadge),
      hero: {
        eyebrow: cleanLpText(c?.hero?.eyebrow),
        badge: cleanLpText(c?.hero?.badge),
        headline_parts: parts,
        headline: cleanLpText(c?.hero?.headline),
        sub: cleanLpText(c?.hero?.sub),
        bullets,
        trust: trustInline,
      },
      positioning: c?.positioning ? {
        eyebrow: cleanLpText(c.positioning.eyebrow),
        headline: cleanLpText(c.positioning.headline),
        body: cleanLpText(c.positioning.body),
      } : undefined,
      how_it_works: how,
      benefits,
      trust_bar: trustBar,
    };
  } catch (e) {
    console.warn("[generate-email-ai] loadLpDossier failed:", e);
    return null;
  }
}

// ── Deterministic Gmail-safe skeleton mirroring PremiumLandingTemplate ──
function buildLpEmailHtml(opts: {
  subject: string;
  preheader: string;
  heroImageUrl?: string | null;
  eyebrow?: string;
  headlineHtml: string;             // may include <span class="hl">…</span>
  sub?: string;
  bullets?: string[];
  trust?: string[];
  positioning?: { eyebrow?: string; headline?: string; body?: string };
  howItWorks?: { title: string; desc: string }[];
  ctaPrimary: { label: string; url: string };
  ctaSecondary?: { label: string; url: string } | null;
  resellerBadge?: string;
}): string {
  const {
    preheader, heroImageUrl, eyebrow, headlineHtml, sub, bullets, trust,
    positioning, howItWorks, ctaPrimary, ctaSecondary, resellerBadge,
  } = opts;

  const grad = `linear-gradient(90deg, ${BRAND.purple} 0%, ${BRAND.orange} 100%)`;

  const hl = (h: string) => h.replace(
    /<span class="hl">([\s\S]*?)<\/span>/g,
    `<span style="background:${grad};-webkit-background-clip:text;background-clip:text;color:transparent;">$1</span>`,
  );

  const bulletsHtml = (bullets && bullets.length)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 4px 0;">${
        bullets.map(b => `
          <tr><td valign="top" style="padding:6px 0;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:${BRAND.inkSoft};">
            <span style="display:inline-block;width:8px;height:8px;background:${BRAND.purple};border-radius:50%;margin-right:10px;vertical-align:middle;"></span>${esc(b)}
          </td></tr>`).join("")
      }</table>`
    : "";

  const trustHtml = (trust && trust.length)
    ? `<div style="margin:14px 0 0 0;font-family:Inter,Arial,sans-serif;font-size:13px;color:${BRAND.muted};">
         ${trust.map(t => `<span style="display:inline-block;margin:0 14px 6px 0;"><span style="color:${BRAND.purple};font-weight:700;">✓</span> ${esc(t)}</span>`).join("")}
       </div>`
    : "";

  const howHtml = (howItWorks && howItWorks.length)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0 0;">
         ${howItWorks.map((it, i) => `
           <tr><td style="padding:10px 0;">
             <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
               <tr>
                 <td width="42" valign="top" style="padding-right:14px;">
                   <div style="width:36px;height:36px;border-radius:50%;background:${grad};color:#fff;font-family:Manrope,Arial,sans-serif;font-weight:800;font-size:14px;text-align:center;line-height:36px;">${String(i+1).padStart(2,"0")}</div>
                 </td>
                 <td valign="top">
                   <div style="font-family:Manrope,Arial,sans-serif;font-weight:700;font-size:16px;color:${BRAND.ink};margin-bottom:4px;">${esc(it.title)}</div>
                   <div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.55;color:${BRAND.inkSoft};">${esc(it.desc)}</div>
                 </td>
               </tr>
             </table>
           </td></tr>`).join("")}
       </table>`
    : "";

  const positioningHtml = positioning && (positioning.headline || positioning.body)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0 0;">
         <tr><td style="background:${BRAND.bgSoft};border-radius:16px;padding:24px 26px;">
           ${positioning.eyebrow ? `<div style="font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.purple};font-weight:700;margin-bottom:8px;">${esc(positioning.eyebrow)}</div>` : ""}
           ${positioning.headline ? `<div style="font-family:Manrope,Arial,sans-serif;font-weight:800;font-size:20px;line-height:1.3;color:${BRAND.ink};margin-bottom:8px;">${esc(positioning.headline)}</div>` : ""}
           ${positioning.body ? `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:${BRAND.inkSoft};">${esc(positioning.body)}</div>` : ""}
         </td></tr>
       </table>`
    : "";

  const heroImgHtml = heroImageUrl
    ? `<div style="margin:22px 0 6px 0;text-align:center;"><img src="${esc(heroImageUrl)}" alt="Produto" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 12px 28px rgba(124,58,237,0.12);" /></div>`
    : "";

  const resellerHtml = resellerBadge
    ? `<div style="display:inline-block;font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.purple};font-weight:700;background:${BRAND.bgSoft};border:1px solid ${BRAND.border};border-radius:999px;padding:6px 12px;">${esc(resellerBadge)}</div>`
    : "";

  const ctaBtn = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 0 auto;">
      <tr><td align="center" style="border-radius:12px;background:${grad};">
        <a href="${esc(ctaPrimary.url)}" style="display:inline-block;padding:16px 32px;font-family:Manrope,Arial,sans-serif;font-weight:800;font-size:15px;letter-spacing:0.3px;color:#ffffff;text-decoration:none;border-radius:12px;">
          ${esc(ctaPrimary.label)} →
        </a>
      </td></tr>
    </table>`;

  const secondaryHtml = ctaSecondary
    ? `<div style="margin:18px 0 0 0;text-align:center;font-family:Inter,Arial,sans-serif;font-size:13px;color:${BRAND.muted};">
         Ou <a href="${esc(ctaSecondary.url)}" style="color:${BRAND.purple};font-weight:600;text-decoration:underline;">${esc(ctaSecondary.label)}</a>
       </div>`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(opts.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#F7F5FB;font-family:Inter,Arial,sans-serif;color:${BRAND.ink};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F7F5FB;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:20px;box-shadow:0 20px 48px rgba(27,16,48,0.08);overflow:hidden;">
        <tr><td style="padding:22px 28px 0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-family:Manrope,Arial,sans-serif;font-weight:800;font-size:16px;color:${BRAND.ink};">Smart Dent <span style="color:${BRAND.purple};">| Fluxo Digital</span></td>
              <td align="right">${resellerHtml}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 28px 8px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg, ${BRAND.bgHero} 0%, #FFFFFF 100%);border:1px solid ${BRAND.border};border-radius:16px;">
            <tr><td style="padding:28px 26px 22px 26px;">
              ${eyebrow ? `<div style="font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.purple};font-weight:700;margin-bottom:10px;">${esc(eyebrow)}</div>` : ""}
              <h1 style="margin:0;font-family:Manrope,Arial,sans-serif;font-weight:800;font-size:30px;line-height:1.18;color:${BRAND.ink};">${hl(headlineHtml)}</h1>
              ${sub ? `<p style="margin:14px 0 0 0;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:${BRAND.inkSoft};">${esc(sub)}</p>` : ""}
              ${heroImgHtml}
              ${bulletsHtml}
              ${trustHtml}
              ${ctaBtn}
              ${secondaryHtml}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:8px 28px 28px 28px;">
          ${positioningHtml}
          ${howHtml}
        </td></tr>

        <tr><td style="padding:0 28px 28px 28px;">
          <div style="border-top:1px solid ${BRAND.border};padding-top:18px;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.55;color:${BRAND.muted};text-align:center;">
            Enviado por <strong style="color:${BRAND.ink};">Smart Dent | Fluxo Digital</strong> para {{nome}}.<br/>
            Consultoria e revenda oficial em odontologia digital.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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
      use_landing_page = true,
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

    const ctaLabel = (c?: CtaRef) => c?.label || ({
      landing: "Acessar landing page do produto",
      form: "Preencher formulário do produto",
      custom: "Saiba mais",
    } as Record<string, string>)[c?.tipo || "custom"];

    const ctaLine = (c: CtaRef) => `- [${c.tipo}] ${ctaLabel(c)} → ${c.url || "{{url}}"}`;

    const allowedUrls = [cta_principal?.url, ...(ctas_secundarios || []).map(c => c.url)]
      .filter((u): u is string => !!u);

    // ── Load Landing Page dossier (primary copy + visual source of truth) ──
    const lp = use_landing_page ? await loadLpDossier(supabase, cta_principal, produto_id) : null;

    // If we have an LP, take the deterministic-assembly path:
    // ask the LLM ONLY for the copy fields, then render the branded skeleton server-side.
    if (lp && cta_principal?.url && regenerate === "all") {
      const heroImage = lp.hero_image_url || (produtoCtx?.image_url as string | undefined) || null;

      const lpBrief = {
        hero: {
          eyebrow: lp.hero.eyebrow || "",
          headline: lp.hero.headline_parts?.map(p => (p.highlight ? `«${p.text}»` : p.text)).join("").trim() || lp.hero.headline || "",
          sub: lp.hero.sub || "",
          bullets: lp.hero.bullets || [],
          trust: lp.hero.trust || [],
        },
        positioning: lp.positioning || null,
        howItWorks: lp.how_it_works || [],
        benefits: lp.benefits || [],
      };

      const copySystem = `Você é copywriter sênior da Smart Dent | Fluxo Digital. Reescreve a copy da LANDING PAGE do produto para um e-mail, aplicando o TOM escolhido, sem inventar nada além do que está no dossiê da LP.

REGRAS ABSOLUTAS:
- NUNCA cite preços, valores em R$, descontos numéricos ou promoções com valor. NUNCA cite "assinatura mensal de R$…", "de R$… por R$…".
- Preserve o significado e o posicionamento originais da LP. Reescreva no TOM: ${tomInstruction}
- Português do Brasil. Sem emojis exagerados (máx 1 no assunto).
- Headline: mantenha a intenção da headline da LP. Se a LP marcou parte com «…», envolva a MESMA ideia com <span class="hl">…</span> no seu HTML (será renderizada com gradiente roxo→laranja no e-mail).
- Bullets: 3-5 no máximo, curtos (máx 90 chars), sem valores monetários.
- Positioning body: máx 260 chars, sem preços.
- How it works: até 3 passos, título curto (máx 32 chars) e desc (máx 140 chars).

SAÍDA: apenas JSON válido, sem markdown, sem texto extra, com este schema:
{
  "subject": string (máx 70 chars),
  "preheader": string (máx 110 chars),
  "cta_button_label": string (máx 32 chars),
  "eyebrow": string (máx 40 chars, uppercase-friendly),
  "headline_html": string (uma linha, pode conter <span class="hl">trecho destacado</span>, sem outras tags),
  "sub": string (máx 220 chars),
  "bullets": string[] (3-5 itens),
  "positioning": { "eyebrow": string, "headline": string, "body": string } | null,
  "how_it_works": [{ "title": string, "desc": string }] (0 a 3),
  "plain_text": string (versão texto puro do email, com CTA no final)
}`;

      const copyUser = `═══ DOSSIÊ DA LANDING PAGE (fonte primária) ═══
Produto: ${produtoCtx?.name || produto || "produto Smart Dent"}
Marca/badge: ${lp.reseller_badge || "-"}
Imagem hero disponível no e-mail: ${heroImage || "(sem imagem)"}

Hero:
- Eyebrow LP: ${lpBrief.hero.eyebrow || "-"}
- Headline LP: ${lpBrief.hero.headline || "-"}
- Sub LP: ${lpBrief.hero.sub || "-"}
- Bullets LP: ${(lpBrief.hero.bullets || []).map(b => `• ${b}`).join("\n") || "-"}
- Trust inline LP: ${(lpBrief.hero.trust || []).join(" · ") || "-"}

Positioning LP: ${lpBrief.positioning ? JSON.stringify(lpBrief.positioning) : "(nenhum)"}

How it works LP: ${(lpBrief.howItWorks || []).length ? JSON.stringify(lpBrief.howItWorks) : "(nenhum)"}

Benefícios LP (opcional para inspirar bullets se hero.bullets estiver vazio): ${(lpBrief.benefits || []).length ? JSON.stringify(lpBrief.benefits) : "(nenhum)"}

═══ AUDIÊNCIA ═══
${segmento_resumo || "leads da base Smart Dent"}

═══ CTA principal ═══
Rótulo sugerido (pode ser reescrito no tom): ${ctaLabel(cta_principal)}
Destino: ${cta_principal.url}

Gere o JSON agora. NÃO invente preços. NÃO invente seções.`;

      const copyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: copySystem },
            { role: "user", content: copyUser },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!copyRes.ok) {
        const errTxt = await copyRes.text();
        console.error("[generate-email-ai/lp] gateway error", copyRes.status, errTxt);
        // Fall through to the legacy dossier path below.
      } else {
        const aiJson = await copyRes.json();
        const content = aiJson.choices?.[0]?.message?.content || "{}";
        let parsed: any = {};
        try { parsed = JSON.parse(content); }
        catch { const m = content.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

        const bulletsClean = Array.isArray(parsed.bullets)
          ? parsed.bullets.map((b: any) => stripPrices(String(b))).filter(Boolean).slice(0, 5)
          : [];

        const howClean = Array.isArray(parsed.how_it_works)
          ? parsed.how_it_works
              .map((h: any) => ({ title: stripPrices(String(h?.title || "")), desc: stripPrices(String(h?.desc || "")) }))
              .filter((h: any) => h.title || h.desc)
              .slice(0, 3)
          : [];

        const positioningClean = parsed.positioning && (parsed.positioning.headline || parsed.positioning.body)
          ? {
              eyebrow: stripPrices(String(parsed.positioning.eyebrow || "")),
              headline: stripPrices(String(parsed.positioning.headline || "")),
              body: stripPrices(String(parsed.positioning.body || "")),
            }
          : undefined;

        const ctaBtnLabel = String(parsed.cta_button_label || ctaLabel(cta_principal) || "Saiba mais").slice(0, 40);

        const secondary = (ctas_secundarios || []).find(c => !!c.url) || null;
        const html = buildLpEmailHtml({
          subject: String(parsed.subject || produtoCtx?.name || "Smart Dent"),
          preheader: stripPrices(String(parsed.preheader || "")),
          heroImageUrl: heroImage,
          eyebrow: stripPrices(String(parsed.eyebrow || lp.hero.eyebrow || "")),
          headlineHtml: stripPrices(String(parsed.headline_html || lp.hero.headline || "")),
          sub: stripPrices(String(parsed.sub || "")),
          bullets: bulletsClean,
          trust: lp.hero.trust || [],
          positioning: positioningClean,
          howItWorks: howClean,
          ctaPrimary: { label: ctaBtnLabel, url: cta_principal.url },
          ctaSecondary: secondary ? { label: ctaLabel(secondary) || "Ver detalhes", url: secondary.url! } : null,
          resellerBadge: lp.reseller_badge,
        });

        return new Response(JSON.stringify({
          success: true,
          subject: String(parsed.subject || "").slice(0, 90),
          preheader: stripPrices(String(parsed.preheader || "")).slice(0, 130),
          cta_button_label: ctaBtnLabel,
          html_body: html,
          plain_text: stripPrices(String(parsed.plain_text || "")),
          produto_context: produtoCtx,
          source: "landing_page",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const systemPrompt = `Você é um copywriter sênior da Smart Dent | Fluxo Digital, especializado em odontologia digital (impressão 3D, escaneamento, CAD/CAM). Escreve emails B2B para dentistas e laboratórios.

REGRAS ABSOLUTAS:
- NUNCA cite preços, valores em R$, descontos numéricos ou promoções com valor.
- Tom: ${tomInstruction}
- Português do Brasil, sem gírias, sem exagero, sem emojis em excesso (no máx. 1-2 no assunto).
- HTML DEVE ser um documento COMPLETO começando em \`<!doctype html><html><head><meta charset="UTF-8"></head><body ...>\` e terminando em \`</body></html>\`. Inline styles (Gmail/Outlook), largura máx 600px, fontes web-safe.
- NUNCA gere tags <table>, <tr> ou <td> soltas sem envolver em uma tabela completa e fechada corretamente. Se usar tabela para layout, feche todas as tags.
- Personalizar com placeholders: {{nome}} (primeiro nome do lead) e {{vendedor_nome}}. NUNCA use {{link_wa_vendedor}} nem qualquer outro placeholder.
- CTA principal como botão destacado. CTAs secundários como links no rodapé.
- OBRIGATÓRIO: use a imagem do produto (\`<img src="…" alt="…" style="max-width:100%;height:auto">\`) no topo, logo após a saudação.
- OBRIGATÓRIO: cite pelo menos 1 indicação clínica concreta E 1 spec técnica real do dossiê fornecido. NÃO invente números.
- PROIBIDO incluir depoimentos, citações de clientes, blocos em itálico com nome de dentista, "Dra. Joyce", "Cliente Smart Dent" ou qualquer prova social. O e-mail vai direto do dossiê ao CTA.
- Estrutura sugerida: preheader (invisível) → saudação → hero image do produto → hook (1 parágrafo) → 2-3 benefícios com bullets (usando as specs/indicações) → CTA botão (landing page do produto) → rodapé com o CTA secundário (formulário do produto) + assinatura Smart Dent.

REGRAS DE LINKS (CRÍTICAS — QUEBRAM O E-MAIL SE VIOLADAS):
- Todo \`<a href="...">\` do HTML DEVE usar EXATAMENTE uma das URLs listadas abaixo em "CALLS-TO-ACTION". Não invente URLs, não use encurtadores, não use utm.
- PROIBIDO qualquer link para: WhatsApp, wa.me, api.whatsapp.com, mailto:, telefone (tel:), redes sociais (instagram/facebook/youtube/linkedin/tiktok), base de conhecimento (/base-conhecimento/...), blog, ou qualquer outro domínio/rota.
- PROIBIDO escrever "Falar no WhatsApp", "Fale pelo WhatsApp", "WhatsApp do vendedor" ou variações. Não existe CTA de WhatsApp neste e-mail.
- URLs permitidas neste e-mail:\n${allowedUrls.map(u => `  • ${u}`).join("\n") || "  (nenhuma — abortar)"}

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

    // ── Server-side link sanitizer: replace any href not in the allow-list ──
    const fallbackUrl = cta_principal?.url || allowedUrls[0] || "";
    const allowedSet = new Set(allowedUrls);
    const sanitizeHtml = (h: string): string => {
      if (!h || !fallbackUrl) return h;
      // Strip any {{link_wa_vendedor}} placeholder leftovers
      h = h.replaceAll("{{link_wa_vendedor}}", fallbackUrl);
      // Rewrite disallowed hrefs
      h = h.replace(/href\s*=\s*"([^"]*)"/gi, (_m, url) =>
        `href="${allowedSet.has(url) ? url : fallbackUrl}"`
      );
      h = h.replace(/href\s*=\s*'([^']*)'/gi, (_m, url) =>
        `href='${allowedSet.has(url) ? url : fallbackUrl}'`
      );
      // Neutralize any residual "Falar no WhatsApp"-style text
      h = h.replace(/Falar\s+(no|agora\s+pelo|via)\s+WhatsApp/gi, ctaLabel(cta_principal));
      return h;
    };
    const sanitizedHtml = sanitizeHtml(parsed.html_body || "");
    const sanitizedText = (parsed.plain_text || "")
      .replaceAll("{{link_wa_vendedor}}", fallbackUrl)
      .replace(/Falar\s+(no|agora\s+pelo|via)\s+WhatsApp/gi, ctaLabel(cta_principal) || "");

    return new Response(JSON.stringify({
      success: true,
      subject: parsed.subject || "",
      preheader: parsed.preheader || "",
      cta_button_label: parsed.cta_button_label || ctaLabel(cta_principal) || "Saiba mais",
      html_body: sanitizedHtml,
      plain_text: sanitizedText,
      produto_context: produtoCtx,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-email-ai] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});