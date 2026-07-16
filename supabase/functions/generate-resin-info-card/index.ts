// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { callPoe } from '../_shared/providers/poe.ts'
import { logAIUsage } from '../_shared/log-ai-usage.ts'

const SD_LOGO = 'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png'

// Vercel-hosted puppeteer renderer (existing endpoint).
const RENDER_ENDPOINT = Deno.env.get('RENDER_TEMPLATE_URL') || 'https://admin.smartdent.com.br/api/render-template'

type Lang = 'pt' | 'en' | 'es'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// Inline emphasis: **x** => <strong>. Additionally, any tokens listed in `bold`
// get wrapped in <strong> (case-insensitive, whole-word-ish).
function inlineFormat(text: string, bold?: string[]): string {
  let s = escapeHtml(text)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  if (bold && bold.length) {
    for (const raw of bold) {
      const token = escapeHtml(raw).trim()
      if (!token) continue
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(${escaped})`, 'gi')
      s = s.replace(re, '<strong>$1</strong>')
    }
  }
  return s
}

const L = {
  pt: {
    title: 'Processo de Uso e Pós-Processamento',
    subtitle: 'Guia visual para manual de instruções',
    important: 'Importante',
    importantText:
      'O cumprimento rigoroso dos tempos e etapas descritos neste guia garante melhor acabamento, estabilidade dimensional e desempenho clínico da peça.',
    pre: 'PRÉ-PROCESSAMENTO',
    post: 'PÓS-PROCESSAMENTO',
  },
  en: {
    title: 'Usage and Post-Processing Guide',
    subtitle: 'Visual guide for the instructions manual',
    important: 'Important',
    importantText:
      'Strict adherence to the times and steps described in this guide ensures better finishing, dimensional stability and clinical performance of the part.',
    pre: 'PRE-PROCESSING',
    post: 'POST-PROCESSING',
  },
  es: {
    title: 'Proceso de Uso y Post-Procesamiento',
    subtitle: 'Guía visual para el manual de instrucciones',
    important: 'Importante',
    importantText:
      'El estricto cumplimiento de los tiempos y pasos descritos en esta guía garantiza mejor acabado, estabilidad dimensional y desempeño clínico de la pieza.',
    pre: 'PRE-PROCESAMIENTO',
    post: 'POST-PROCESAMIENTO',
  },
} as const

// ────────────────────────────────────────────────────────────────────────────
// LLM-planned trilingual card (GPT-5.6 Sol via Poe)
// ────────────────────────────────────────────────────────────────────────────

type BlockColor = 'blue' | 'green' | 'purple'

interface StructureBlock { id: string; color: BlockColor; icon: string; num: string }
interface Structure {
  blocks: StructureBlock[]
  columns_per_block: Record<string, number>
}
interface ColumnItem { text: string; bold?: string[] }
interface ContentColumn { title: string; icon: string; items: ColumnItem[]; note?: string }
interface ContentBlock { heading: string; columns: ContentColumn[] }
interface LangContent {
  title: string
  subtitle: string
  important: string
  blocks: Record<string, ContentBlock>
}
interface CardPlan {
  structure: Structure
  content: Record<Lang, LangContent>
}

function fallbackPlan(opts: {
  instructionsPt: string; instructionsEn: string; instructionsEs: string
}): CardPlan {
  const split = (text: string): [string, string] => {
    const clean = text.replace(/[#>*_`]/g, ' ').replace(/\s+/g, ' ').trim()
    const sentences = clean.split(/(?<=[.!?;])\s+/).filter(Boolean)
    const middle = Math.max(1, Math.ceil(sentences.length / 2))
    const first = sentences.slice(0, middle).join(' ').slice(0, 430) || clean.slice(0, 430)
    const second = sentences.slice(middle).join(' ').slice(0, 430) || clean.slice(430, 860) || first
    return [first, second]
  }
  const makeContent = (lang: Lang, text: string): LangContent => {
    const [preText, postText] = split(text)
    return {
      title: L[lang].title,
      subtitle: L[lang].subtitle,
      important: L[lang].importantText,
      blocks: {
        pre: {
          heading: L[lang].pre,
          columns: [{ title: L[lang].pre, icon: '🌡️', items: [{ text: preText }] }],
        },
        post: {
          heading: L[lang].post,
          columns: [{ title: L[lang].post, icon: '⚙️', items: [{ text: postText }] }],
        },
      },
    }
  }
  return {
    structure: {
      blocks: [
        { id: 'pre', color: 'blue', icon: '🌡️', num: '1)' },
        { id: 'post', color: 'green', icon: '⚙️', num: '2)' },
      ],
      columns_per_block: { pre: 1, post: 1 },
    },
    content: {
      pt: makeContent('pt', opts.instructionsPt),
      en: makeContent('en', opts.instructionsEn),
      es: makeContent('es', opts.instructionsEs),
    },
  }
}

function buildSystemPrompt(): string {
  return [
    'Você é um designer sênior de infográficos técnicos odontológicos.',
    'Sua tarefa é gerar UM plano estruturado (em JSON) para um card educativo de resina 3D odontológica.',
    'REGRA CRÍTICA: PT / EN / ES devem ter EXATAMENTE a mesma estrutura — mesmo número de blocks, mesmas colunas por block, mesmo número de items por coluna, mesmos icons e cores. Só muda o TEXTO.',
    'Cada block deve ter cor coerente: pré-processamento = blue, pós-processamento = green, pós-cura/cura/finalização = purple.',
    'Ícones (emoji unicode): 🌡️ preparo/temperatura, 🧼 limpeza, 🧴 filtragem, 🧲 remoção, 💨 secagem, ☀️ cura UV, 🖊️ refinamento, 🖌️ glaze, ✨ polimento/final, ⚙️ processo mecânico.',
    'Nunca inclua preços, valores comerciais ou marcas concorrentes.',
    'A resposta DEVE ser um único JSON válido no schema informado, sem texto fora do JSON.',
  ].join(' ')
}

function buildUserPrompt(opts: {
  resinNamePt: string; resinNameEn: string; resinNameEs: string
  instructionsPt: string; instructionsEn: string; instructionsEs: string
}): string {
  return `RESINA:
- Nome (PT): ${opts.resinNamePt}
- Nome (EN): ${opts.resinNameEn}
- Nome (ES): ${opts.resinNameEs}

INSTRUÇÕES ORIGINAIS (PT):
${opts.instructionsPt}

INSTRUÇÕES ORIGINAIS (EN):
${opts.instructionsEn}

INSTRUÇÕES ORIGINAIS (ES):
${opts.instructionsEs}

Produza JSON EXATAMENTE neste formato (sem comentários, sem markdown fences):

{
  "structure": {
    "blocks": [
      { "id": "pre",  "color": "blue",   "icon": "🌡️", "num": "1)" },
      { "id": "post", "color": "green",  "icon": "⚙️",  "num": "2)" }
    ],
    "columns_per_block": { "pre": 3, "post": 3 }
  },
  "content": {
    "pt": {
      "title": "Processo de Uso e Pós-Processamento",
      "subtitle": "Guia visual para manual de instruções",
      "important": "O cumprimento rigoroso dos tempos e etapas descritos neste guia garante melhor acabamento, estabilidade dimensional e desempenho clínico da peça.",
      "blocks": {
        "pre": {
          "heading": "PRÉ-PROCESSAMENTO",
          "columns": [
            {
              "title": "Limpeza",
              "icon": "🧼",
              "items": [ { "text": "Limpar a peça por 5 minutos", "bold": ["5 minutos"] } ],
              "note": "Nunca ultrapasse 10 minutos"
            }
          ]
        }
      }
    },
    "en": { /* mesma estrutura, textos em inglês */ },
    "es": { /* mesma estrutura, textos em espanhol */ }
  }
}

REGRAS FINAIS:
- Adicione um terceiro block "cure" (color=purple, icon=☀️, num="3)") APENAS se as instruções originais mencionarem uma etapa de cura UV / pós-cura distinta.
- Máx. 4 colunas por block, máx. 5 items por coluna, cada item.text ≤ 90 chars.
- Use "note" para alertas/⚠️ (opcional por coluna).
- Use "bold" para destacar tempos/temperaturas/rpm mencionados no item (ex: "5 min", "60°C", "7000 rpm").
- As três línguas DEVEM refletir os textos originais fornecidos.`
}

function assertStructuralParity(plan: CardPlan): { ok: true } | { ok: false; reason: string } {
  try {
    const langs: Lang[] = ['pt', 'en', 'es']
    const structBlocks = plan.structure?.blocks || []
    if (!Array.isArray(structBlocks) || structBlocks.length === 0) {
      return { ok: false, reason: 'structure.blocks vazio' }
    }
    for (const lang of langs) {
      const c = plan.content?.[lang]
      if (!c) return { ok: false, reason: `content.${lang} ausente` }
      if (!c.blocks) return { ok: false, reason: `content.${lang}.blocks ausente` }
    }
    // Igualdade de contagens/ícones/cores entre idiomas.
    for (const b of structBlocks) {
      const ptBlock = plan.content.pt.blocks[b.id]
      if (!ptBlock) return { ok: false, reason: `pt.blocks.${b.id} ausente` }
      const ptCols = ptBlock.columns?.length || 0
      for (const lang of langs) {
        const blk = plan.content[lang].blocks[b.id]
        if (!blk) return { ok: false, reason: `${lang}.blocks.${b.id} ausente` }
        if ((blk.columns?.length || 0) !== ptCols) {
          return { ok: false, reason: `colunas divergem em block=${b.id} lang=${lang}` }
        }
        for (let i = 0; i < ptCols; i++) {
          const ptCol = ptBlock.columns[i]
          const col = blk.columns[i]
          if ((ptCol.items?.length || 0) !== (col.items?.length || 0)) {
            return { ok: false, reason: `items divergem em ${b.id}.col[${i}] lang=${lang}` }
          }
          if ((ptCol.icon || '') !== (col.icon || '')) {
            return { ok: false, reason: `icon divergente em ${b.id}.col[${i}] lang=${lang}` }
          }
        }
      }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'erro parity' }
  }
}

function renderBlockHtml(block: StructureBlock, content: ContentBlock): string {
  const badgeClass =
    block.color === 'blue' ? 'blue' : block.color === 'green' ? 'green' : 'purple'
  const blockClass =
    block.color === 'blue' ? 'block-blue' : block.color === 'green' ? 'block-green' : 'block-extra'
  const cols = (content.columns || []).map((c) => `
    <div class="col">
      <div class="col-head"><span class="col-icon">${c.icon || '🔹'}</span><h3>${escapeHtml(c.title || '')}</h3></div>
      <ul>
        ${(c.items || []).map((it) => `<li><span class="dot">•</span><span>${inlineFormat(it.text, it.bold)}</span></li>`).join('')}
      </ul>
      ${c.note ? `<div class="callout"><span class="callout-ico">⚠️</span><span>${inlineFormat(c.note)}</span></div>` : ''}
    </div>`).join('')
  const colsClass = (content.columns?.length || 0) >= 4 ? 'cols four' : 'cols'
  return `
    <section class="block ${blockClass}">
      <div class="block-head">
        <span class="block-badge ${badgeClass}">${block.icon}</span>
        <h2><span class="num">${escapeHtml(block.num)}</span> ${escapeHtml(content.heading || '')}</h2>
      </div>
      <div class="${colsClass}">${cols}</div>
    </section>`
}

function renderCardHtml(opts: {
  plan: CardPlan
  lang: Lang
  resinName: string
  productImage: string | null
}): string {
  const l = L[opts.lang]
  const langContent = opts.plan.content[opts.lang]
  const blocksHtml = opts.plan.structure.blocks
    .map((b) => {
      const c = langContent.blocks[b.id]
      return c ? renderBlockHtml(b, c) : ''
    })
    .join('')

  return `<!doctype html>
<html lang="${opts.lang}"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;background:#F8FAFC;font-family:'Inter',system-ui,sans-serif;color:#1E293B}
  .page{position:relative;padding:52px 56px 48px;background:#F8FAFC;overflow:hidden}
  .topbar{position:absolute;top:0;left:0;right:0;height:8px;background:#1D4ED8}
  .bg-pattern{position:absolute;top:120px;right:-30px;width:340px;height:340px;opacity:.35;
    background-image:linear-gradient(#CBD5E1 1px,transparent 1px),linear-gradient(90deg,#CBD5E1 1px,transparent 1px);
    background-size:22px 22px;-webkit-mask:radial-gradient(circle at 30% 30%,#000 40%,transparent 70%);
                    mask:radial-gradient(circle at 30% 30%,#000 40%,transparent 70%)}
  .header{display:flex;gap:24px;align-items:flex-start;justify-content:space-between;margin-bottom:28px}
  .header-left{flex:1}
  .logo{height:56px;margin-bottom:20px;object-fit:contain;object-position:left}
  h1{font-size:44px;font-weight:800;line-height:1.05;letter-spacing:-.02em;color:#0F172A}
  h1 .prod{color:#0F172A}
  h1 .plus{color:#2563EB}
  .subtitle{margin-top:10px;color:#475569;font-size:16px;display:flex;align-items:center;gap:10px}
  .subtitle::before{content:'';display:inline-block;width:34px;height:3px;background:#1D4ED8;border-radius:2px}
  .product-img-wrap{flex:0 0 210px;height:260px;display:flex;align-items:center;justify-content:center}
  .product-img{max-width:100%;max-height:100%;object-fit:contain}
  .block{border:2px solid;border-radius:22px;padding:22px 24px 20px;margin-bottom:22px;background:#fff;position:relative}
  .block-blue{border-color:#1D4ED8;background:#F0F5FF}
  .block-green{border-color:#16A34A;background:#F0FBF3}
  .block-extra{border-color:#7C3AED;background:#F6F1FE}
  .block-head{display:flex;align-items:center;gap:14px;margin:-38px 0 14px 0}
  .block-badge{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;box-shadow:0 6px 16px rgba(15,23,42,.15)}
  .block-badge.blue{background:#1D4ED8}
  .block-badge.green{background:#16A34A}
  .block-badge.purple{background:#7C3AED}
  .block-head h2{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:.02em}
  .block-head .num{color:#1D4ED8;margin-right:4px}
  .block-green .block-head .num{color:#16A34A}
  .block-extra .block-head .num{color:#7C3AED}
  .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
  .cols.four{grid-template-columns:repeat(4,minmax(0,1fr))}
  .col{min-width:0}
  .col-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .col-icon{width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:18px;color:#1D4ED8;flex:0 0 36px}
  .block-green .col-icon{color:#16A34A}
  .block-extra .col-icon{color:#7C3AED}
  .col h3{font-size:14px;font-weight:700;color:#0F172A;line-height:1.25}
  .col ul{list-style:none;padding:0;margin:0}
  .col li{display:flex;gap:8px;font-size:13px;line-height:1.45;color:#334155;margin-bottom:6px}
  .col li strong{color:#0F172A;font-weight:700}
  .col li .dot{color:#1D4ED8;font-weight:800;flex:0 0 10px}
  .block-green .col li .dot{color:#16A34A}
  .block-extra .col li .dot{color:#7C3AED}
  .col li.sub{margin-left:16px;font-size:12px;color:#64748B}
  .col li.sub .sub-dot{color:#94A3B8}
  .callout{margin-top:8px;padding:10px 12px;background:#FEF2F2;border-left:3px solid #EF4444;border-radius:6px;display:flex;gap:8px;font-size:12.5px;color:#7F1D1D;line-height:1.4}
  .callout .callout-ico{flex:0 0 auto}
  .footer{margin-top:18px;padding:18px 22px;background:#FEF2F2;border-radius:14px;display:flex;gap:14px;align-items:flex-start;border:1px solid #FECACA}
  .footer .shield{width:44px;height:44px;border-radius:50%;background:#1D4ED8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 44px}
  .footer .imp{font-size:20px;font-weight:800;color:#1D4ED8;margin-bottom:4px}
  .footer p{font-size:13px;color:#334155;line-height:1.5}
</style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>
    <div class="bg-pattern"></div>
    <header class="header">
      <div class="header-left">
        <img class="logo" src="${SD_LOGO}" alt="Smart Dent"/>
        <h1><span class="prod">${escapeHtml(langContent.title || l.title)} —</span><br/><span class="plus">${escapeHtml(opts.resinName)}</span></h1>
        <div class="subtitle">${escapeHtml(langContent.subtitle || l.subtitle)}</div>
      </div>
      ${opts.productImage ? `<div class="product-img-wrap"><img class="product-img" src="${opts.productImage}" alt="${escapeHtml(opts.resinName)}"/></div>` : ''}
    </header>

    ${blocksHtml}

    <div class="footer">
      <div class="shield">🛡</div>
      <div>
        <div class="imp">${escapeHtml(l.important)}</div>
        <p>${escapeHtml(langContent.important || l.importantText)}</p>
      </div>
    </div>
  </div>
</body></html>`
}

function extractJson(raw: string): any | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(trimmed) } catch {}
  const first = trimmed.indexOf('{'); const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)) } catch {}
  }
  return null
}

async function planCardWithLLM(opts: {
  resinNamePt: string; resinNameEn: string; resinNameEs: string
  instructionsPt: string; instructionsEn: string; instructionsEs: string
}): Promise<{ plan: CardPlan | null; error?: string; usage?: any; model?: string }> {
  const system = buildSystemPrompt()
  const user = buildUserPrompt(opts)

  const attempt = async (model: string, extraCorrection?: string) => {
    const messages: any[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]
    if (extraCorrection) messages.push({ role: 'user', content: extraCorrection })
    const r = await callPoe({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 5000,
      response_format: { type: 'json_object' },
      timeout_ms: 18_000,
    })
    return r
  }

  // A API Poe é case-sensitive e os IDs liberados variam por conta. Consulta o
  // catálogo da própria conta para resolver o handle real antes da chamada.
  const configured = ['GPT-5.6-Sol', 'gpt-5.6-sol', 'GPT-5.5', 'gpt-5.5', 'Claude-Sonnet-4.6', 'claude-sonnet-4.6']
  let available: string[] = []
  const poeKey = Deno.env.get('POE_API_KEY')
  if (poeKey) {
    try {
      const modelResp = await fetch('https://api.poe.com/v1/models', {
        headers: { Authorization: `Bearer ${poeKey}` },
      })
      if (modelResp.ok) {
        const modelData = await modelResp.json()
        available = (modelData?.data || []).map((m: any) => String(m?.id || '')).filter(Boolean)
        console.log(`[generate-resin-info-card] Poe models disponíveis: ${available.length}`)
      } else {
        await modelResp.text()
      }
    } catch (e) {
      console.warn('[generate-resin-info-card] não foi possível consultar /v1/models:', e)
    }
  }
  const normalizeModel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const desired = ['gpt56sol', 'gpt55', 'claudesonnet46', 'claudeopus']
  const discovered = desired
    .map((target) => available.find((id) => normalizeModel(id).includes(target)))
    .filter((id): id is string => Boolean(id))
  const MODELS = Array.from(new Set([...discovered, ...configured]))
  let modelUsed: string = MODELS[0]
  console.log(`[generate-resin-info-card] modelo selecionado: ${modelUsed}`)
  let first = await attempt(modelUsed)
  for (const fallback of MODELS.slice(1)) {
    if (first.ok) break
    const unavailable = first.status === 404 || /not found|unknown model/i.test(first.error || '')
    if (!unavailable) break
    console.warn(`[generate-resin-info-card] ${modelUsed} indisponível, tentando ${fallback}`)
    modelUsed = fallback
    first = await attempt(modelUsed)
  }
  if (!first.ok) {
    console.warn(`[generate-resin-info-card] Poe falhou (${first.error || first.status}); usando estrutura determinística`)
    return { plan: fallbackPlan(opts), model: modelUsed }
  }
  let parsed = extractJson(first.text || '')
  if (parsed) {
    const parity = assertStructuralParity(parsed as CardPlan)
    if (parity.ok) return { plan: parsed as CardPlan, usage: first.usage, model: modelUsed }
    console.warn('[generate-resin-info-card] parity fail:', parity.reason)
  }
  console.warn('[generate-resin-info-card] resposta LLM sem paridade; aplicando estrutura determinística trilíngue')
  return { plan: fallbackPlan(opts), usage: first.usage, model: modelUsed }
}

function htmlToStandaloneSvg(html: string): Uint8Array {
  const body = html
    .replace(/^.*?<body[^>]*>/is, '')
    .replace(/<\/body>.*$/is, '')
  const css = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1500" viewBox="0 0 1080 1500">
    <foreignObject width="1080" height="1500">
      <div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${body}</div>
    </foreignObject>
  </svg>`
  return new TextEncoder().encode(svg)
}

async function renderImage(html: string): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
  const res = await fetch(RENDER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width: 1080, height: 1500 }),
  })
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`render-template ${res.status}: ${t.slice(0, 300)}`)
  }
  if (!contentType.startsWith('image/')) {
    await res.arrayBuffer()
    console.warn(`[generate-resin-info-card] renderer retornou ${contentType || 'MIME vazio'}; usando SVG autônomo`)
    return { bytes: htmlToStandaloneSvg(html), contentType: 'image/svg+xml', extension: 'svg' }
  }
  const buf = await res.arrayBuffer()
  const extension = contentType.includes('svg') ? 'svg' : contentType.includes('jpeg') ? 'jpg' : 'png'
  return { bytes: new Uint8Array(buf), contentType, extension }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { resin_id, languages } = await req.json()
    if (!resin_id) {
      return new Response(JSON.stringify({ error: 'resin_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const langs: Lang[] = Array.isArray(languages) && languages.length
      ? (languages.filter((l: string) => ['pt', 'en', 'es'].includes(l)) as Lang[])
      : ['pt', 'en', 'es']

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: resin, error: rErr } = await supabase
      .from('resins')
      .select(
        'id, slug, name, name_en, name_es, image_url, processing_instructions, processing_instructions_en, processing_instructions_es',
      )
      .eq('id', resin_id)
      .maybeSingle()
    if (rErr) throw rErr
    if (!resin) throw new Error('Resin not found')

    const nameFor = (lang: Lang): string => {
      if (lang === 'en') return resin.name_en || resin.name
      if (lang === 'es') return resin.name_es || resin.name
      return resin.name
    }
    const instrPt = (resin.processing_instructions || '').trim()
    const instrEn = (resin.processing_instructions_en || instrPt).trim()
    const instrEs = (resin.processing_instructions_es || instrPt).trim()
    if (!instrPt) throw new Error('processing_instructions vazio: adicione o texto antes de gerar')

    // ── 1) Chama GPT-5.6 Sol UMA vez, obtém plano trilíngue com paridade estrutural.
    const llm = await planCardWithLLM({
      resinNamePt: nameFor('pt'),
      resinNameEn: nameFor('en'),
      resinNameEs: nameFor('es'),
      instructionsPt: instrPt,
      instructionsEn: instrEn,
      instructionsEs: instrEs,
    })
    if (!llm.plan) throw new Error(llm.error || 'Falha ao planejar card com o LLM')
    const plan = llm.plan
    const modelUsed = llm.model || 'gpt-5.6-sol'

    const results: Record<string, string> = {}
    const timestamp = Date.now()
    const safeSlug = (resin.slug || resin.id).toString().replace(/[^a-z0-9-]/gi, '-').toLowerCase()

    // ── 2) Renderiza cada idioma com o MESMO template determinístico.
    for (const lang of langs) {
      const html = renderCardHtml({
        plan,
        lang,
        resinName: nameFor(lang),
        productImage: resin.image_url,
      })
      const rendered = await renderImage(html)
      const path = `resin-info-cards/${safeSlug}-${lang}-${timestamp}.${rendered.extension}`
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(path, rendered.bytes, { contentType: rendered.contentType, upsert: true, cacheControl: '3600' })
      if (upErr) throw new Error(`Upload ${lang}: ${upErr.message}`)
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
      results[lang] = pub.publicUrl
    }

    const update: Record<string, unknown> = { info_card_generated_at: new Date().toISOString() }
    if (results.pt) update.info_card_url_pt = results.pt
    if (results.en) update.info_card_url_en = results.en
    if (results.es) update.info_card_url_es = results.es

    const { error: uErr } = await supabase.from('resins').update(update).eq('id', resin_id)
    if (uErr) throw uErr

    // Log de uso (fire-and-forget).
    if (llm.usage) {
      logAIUsage({
        functionName: 'generate-resin-info-card',
        actionLabel: 'resin_info_card',
        model: `poe/${modelUsed}`,
        promptTokens: llm.usage.prompt_tokens || 0,
        completionTokens: llm.usage.completion_tokens || 0,
        metadata: { resin_id, languages: langs },
      }).catch(() => {})
    }

    return new Response(JSON.stringify({ ok: true, urls: results, model_used: `poe/${modelUsed}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[generate-resin-info-card] error:', err)
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})