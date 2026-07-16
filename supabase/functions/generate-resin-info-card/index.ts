// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { callPoe } from '../_shared/providers/poe.ts'
import { logAIUsage } from '../_shared/log-ai-usage.ts'

const RENDER_ENDPOINT =
  Deno.env.get('RENDER_TEMPLATE_URL') ||
  'https://admin.smartdent.com.br/api/render-template'
const SD_LOGO_URL =
  'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png'

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

// Cores por bloco
const BLOCK_COLORS: Record<BlockColor, { border: string; bg: string; badge: string }> = {
  blue:   { border: '#1D4ED8', bg: '#F0F5FF', badge: '#1D4ED8' },
  green:  { border: '#16A34A', bg: '#F0FBF3', badge: '#16A34A' },
  purple: { border: '#7C3AED', bg: '#F6F1FE', badge: '#7C3AED' },
}

// Renderiza HTML fiel à referência Smart Dent com o plano + logo real + foto real do produto.
function renderCardHtml(opts: {
  plan: CardPlan
  lang: Lang
  resinName: string
  productImageUrl: string | null
}): string {
  const { plan, lang, resinName, productImageUrl } = opts
  const c = plan.content[lang]

  const productImgHtml = productImageUrl
    ? `<img src="${escapeHtml(productImageUrl)}" alt="${escapeHtml(resinName)}" class="bottle" crossorigin="anonymous" />`
    : `<div class="bottle-fallback"><span>${escapeHtml(resinName)}</span></div>`

  const sections = plan.structure.blocks.map((b) => {
    const blk = c.blocks[b.id]
    if (!blk) return ''
    const col = BLOCK_COLORS[b.color] || BLOCK_COLORS.blue
    const nCols = blk.columns.length
    const colClass = nCols >= 4 ? 'cols-4' : nCols === 3 ? 'cols-3' : nCols === 2 ? 'cols-2' : 'cols-1'

    const columnsHtml = blk.columns
      .map((column, i) => {
        const num = `${b.num.replace(')', '')}.${i + 1}`
        const itemsHtml = column.items
          .map((it) => `<li>${inlineFormat(it.text, it.bold)}</li>`)
          .join('')
        const noteHtml = column.note
          ? `<div class="warn"><span class="warn-icon">⚠️</span><span>${inlineFormat(column.note)}</span></div>`
          : ''
        return `
          <div class="col">
            <div class="col-head">
              <div class="col-icon" style="border-color:${col.border};color:${col.border}">${escapeHtml(column.icon || b.icon || '•')}</div>
              <div class="col-title"><span class="col-num">${num}</span> ${escapeHtml(column.title)}</div>
            </div>
            <ul class="col-list">${itemsHtml}</ul>
            ${noteHtml}
          </div>`
      })
      .join('')

    return `
      <section class="block" style="border-color:${col.border};background:${col.bg}">
        <div class="badge" style="background:${col.badge}">${escapeHtml(b.icon)}</div>
        <h2 class="block-heading" style="color:${col.border}">${escapeHtml(b.num)} ${escapeHtml(blk.heading)}</h2>
        <div class="cols ${colClass}">${columnsHtml}</div>
      </section>`
  }).join('')

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #FFFFFF; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #0F172A;
    padding: 40px 48px 32px;
    width: 1080px;
  }
  .top-bar { position: fixed; top: 0; left: 0; right: 0; height: 8px; background: #1D4ED8; }
  header { display: flex; gap: 24px; align-items: flex-start; margin-top: 8px; margin-bottom: 28px; }
  header .head-left { flex: 1; min-width: 0; }
  header .logo { height: 48px; margin-bottom: 20px; }
  header h1 { margin: 0 0 12px; font-size: 42px; line-height: 1.1; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; }
  header .rule { width: 90px; height: 3px; background: #1D4ED8; margin: 4px 0 8px; }
  header .subtitle { color: #64748B; font-size: 18px; font-weight: 500; }
  header .head-right { width: 240px; flex-shrink: 0; display: flex; justify-content: flex-end; }
  header .bottle { width: 240px; height: auto; max-height: 340px; object-fit: contain; }
  header .bottle-fallback {
    width: 200px; height: 300px; border-radius: 20px;
    background: linear-gradient(180deg,#0F172A,#0F172A 65%,#1D4ED8 65%,#1D4ED8);
    color:white; display:flex; align-items:center; justify-content:center; padding:16px; text-align:center;
    font-weight:700; font-size:14px;
  }

  .block {
    position: relative;
    border: 2px solid #1D4ED8;
    border-radius: 18px;
    padding: 22px 24px 22px 84px;
    margin: 44px 0 0;
  }
  .badge {
    position: absolute; left: -18px; top: -18px;
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 26px;
    box-shadow: 0 4px 10px rgba(15,23,42,0.15);
  }
  .block-heading {
    margin: 0 0 16px; font-size: 22px; font-weight: 800; letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .cols { display: grid; gap: 18px; }
  .cols.cols-1 { grid-template-columns: 1fr; }
  .cols.cols-2 { grid-template-columns: 1fr 1fr; }
  .cols.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
  .cols.cols-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

  .col-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .col-icon {
    width: 36px; height: 36px; border-radius: 50%;
    border: 2px solid #1D4ED8; background: #FFFFFF;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .col-title { font-size: 15px; font-weight: 700; color: #0F172A; }
  .col-num { color: inherit; margin-right: 4px; }

  .col-list {
    margin: 0; padding-left: 20px;
    font-size: 14px; line-height: 1.5; color: #334155;
  }
  .col-list li { margin-bottom: 5px; }
  .col-list strong { color: #0F172A; font-weight: 700; }

  .warn {
    margin-top: 10px; padding: 10px 12px;
    background: #FEF2F2; border-left: 4px solid #EF4444;
    border-radius: 6px;
    color: #7F1D1D; font-size: 13px; line-height: 1.45;
    display: flex; gap: 8px; align-items: flex-start;
  }
  .warn-icon { font-size: 15px; }
  .warn strong { color: #7F1D1D; }

  footer {
    margin-top: 32px;
    background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 16px;
    padding: 20px 24px; display: flex; gap: 18px; align-items: flex-start;
  }
  .shield {
    width: 52px; height: 52px; border-radius: 50%;
    background: #1D4ED8; color: white; font-size: 26px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  footer .foot-text {
    font-size: 16px; line-height: 1.5; color: #0F172A; font-weight: 600;
  }
</style>
</head>
<body>
  <div class="top-bar"></div>
  <header>
    <div class="head-left">
      <img class="logo" src="${SD_LOGO_URL}" alt="Smart Dent" crossorigin="anonymous" />
      <h1>${escapeHtml(c.title)} — ${escapeHtml(resinName)}</h1>
      <div class="rule"></div>
      <div class="subtitle">${escapeHtml(c.subtitle)}</div>
    </div>
    <div class="head-right">${productImgHtml}</div>
  </header>

  ${sections}

  <footer>
    <div class="shield">🛡</div>
    <div class="foot-text">${inlineFormat(c.important)}</div>
  </footer>
</body>
</html>`
}

interface RenderResult { bytes: Uint8Array }

async function renderPNG(html: string): Promise<RenderResult> {
  const res = await fetch(RENDER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width: 1080, height: 'auto' }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`render-template ${res.status}: ${t.slice(0, 300)}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    const t = await res.text().catch(() => '')
    throw new Error(`render-template retornou ${contentType || 'MIME vazio'}: ${t.slice(0, 200)}`)
  }
  const buf = await res.arrayBuffer()
  return { bytes: new Uint8Array(buf) }
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

    // Marca como "processing" e responde imediatamente. Job real roda em background
    // via EdgeRuntime.waitUntil (evita o timeout de 150s da edge function).
    await supabase
      .from('resins')
      .update({
        info_card_status: 'processing',
        info_card_error: null,
        info_card_started_at: new Date().toISOString(),
      })
      .eq('id', resin_id)

    const job = runJob({
      supabase,
      resin,
      langs,
      nameFor,
      instrPt,
      instrEn,
      instrEs,
    })

    // @ts-ignore — EdgeRuntime é global no runtime Deno do Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(job)
    } else {
      // Fallback local: não bloqueia a resposta.
      job.catch((e) => console.error('[generate-resin-info-card] job error:', e))
    }

    return new Response(JSON.stringify({ ok: true, status: 'processing' }), {
      status: 202,
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

// ────────────────────────────────────────────────────────────────────────────
// Job em background: planeja com LLM, gera 3 PNGs em paralelo, faz upload
// e persiste status em `resins`.
// ────────────────────────────────────────────────────────────────────────────
async function runJob(ctx: {
  supabase: ReturnType<typeof createClient>
  resin: any
  langs: Lang[]
  nameFor: (l: Lang) => string
  instrPt: string
  instrEn: string
  instrEs: string
}): Promise<void> {
  const { supabase, resin, langs, nameFor, instrPt, instrEn, instrEs } = ctx
  const resin_id = resin.id
  try {
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

    const timestamp = Date.now()
    const safeSlug = (resin.slug || resin.id).toString().replace(/[^a-z0-9-]/gi, '-').toLowerCase()

    // 3 gerações em paralelo — corta o tempo total de ~3× para ~1×.
    const settled = await Promise.allSettled(
      langs.map(async (lang) => {
        const prompt = buildImagePrompt({ plan, lang, resinName: nameFor(lang) })
        console.log(`[generate-resin-info-card] imagegen lang=${lang} prompt_chars=${prompt.length}`)
        const img = await generateInfographicPNG(prompt)
        const path = `resin-info-cards/${safeSlug}-${lang}-${timestamp}.png`
        const { error: upErr } = await supabase.storage
          .from('model-images')
          .upload(path, img.bytes, { contentType: 'image/png', upsert: true, cacheControl: '3600' })
        if (upErr) throw new Error(`Upload ${lang}: ${upErr.message}`)
        const { data: pub } = supabase.storage.from('model-images').getPublicUrl(path)
        return { lang, url: pub.publicUrl, usage: img.usage }
      }),
    )

    const results: Record<string, string> = {}
    const imgUsages: any[] = []
    const errors: string[] = []
    settled.forEach((r, i) => {
      const lang = langs[i]
      if (r.status === 'fulfilled') {
        results[lang] = r.value.url
        if (r.value.usage) imgUsages.push({ lang, ...r.value.usage })
      } else {
        errors.push(`${lang}: ${r.reason?.message || String(r.reason)}`)
      }
    })

    if (Object.keys(results).length === 0) {
      throw new Error(`Todas as gerações falharam — ${errors.join(' | ')}`)
    }

    const update: Record<string, unknown> = {
      info_card_generated_at: new Date().toISOString(),
      info_card_status: errors.length ? 'error' : 'ready',
      info_card_error: errors.length ? errors.join(' | ') : null,
    }
    if (results.pt) update.info_card_url_pt = results.pt
    if (results.en) update.info_card_url_en = results.en
    if (results.es) update.info_card_url_es = results.es

    const { error: uErr } = await supabase.from('resins').update(update).eq('id', resin_id)
    if (uErr) throw uErr

    if (llm.usage) {
      logAIUsage({
        functionName: 'generate-resin-info-card',
        actionLabel: 'resin_info_card_plan',
        model: `poe/${modelUsed}`,
        promptTokens: llm.usage.prompt_tokens || 0,
        completionTokens: llm.usage.completion_tokens || 0,
        metadata: { resin_id, languages: langs },
      }).catch(() => {})
    }
    for (const u of imgUsages) {
      logAIUsage({
        functionName: 'generate-resin-info-card',
        actionLabel: 'resin_info_card_image',
        model: IMAGE_MODEL,
        promptTokens: u.input_tokens || 0,
        completionTokens: u.output_tokens || 0,
        metadata: { resin_id, lang: u.lang },
      }).catch(() => {})
    }
    console.log(`[generate-resin-info-card] job done resin=${resin_id} langs=${Object.keys(results).join(',')} errors=${errors.length}`)
  } catch (err: any) {
    console.error('[generate-resin-info-card] job failure:', err)
    await supabase
      .from('resins')
      .update({
        info_card_status: 'error',
        info_card_error: (err?.message || String(err)).slice(0, 1000),
      })
      .eq('id', resin_id)
      .then(() => {})
  }
}