// Shared helper: generates a WhatsApp-group-style message for the
// "IA + Conteúdo" node (Articles | Products | Videos) and appends the
// canonical public link of the content. Used by both wa-dispatcher
// (real send) and wa-ai-preview (builder preview).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY')
const GEMINI_KEY   = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY')
const SITE_URL     = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://parametros.smartdent.com.br').replace(/\/+$/, '')

export type AiContentCfg = {
  ai_source_type?: string
  ai_source_id?: string
  ai_source_title?: string
  ai_prompt_override?: string | null
}

export type AiContentResult = {
  text: string
  url: string | null
  title: string
  provider: string
}

const SYSTEM_PROMPT = `Você escreve mensagens curtas para um grupo de WhatsApp da Smart Dent
(dentistas e laboratórios de prótese odontológica no Brasil).

Estilo OBRIGATÓRIO — conversa de grupo:
- Tom caloroso, direto, 1ª pessoa do plural ("a gente", "olha isso", "saiu novidade").
- 1 a 3 linhas curtas. Máximo 280 caracteres no total.
- Máximo 2 emojis no corpo. Sem hashtags. Sem títulos formais. Sem assinatura.
- Termine com uma chamada curta para o link (ex.: "dá uma olhada aqui 👇", "confere aí 👇", "tá tudo aqui 👇").
- Sem preços, sem valores, sem promessas comerciais (política content-generation-policy-no-prices-v2).

IMPORTANTE: o link será anexado automaticamente na linha seguinte — NÃO inclua URL no corpo da mensagem.`

function buildUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function resolveSource(sb: SupabaseClient, cfg: AiContentCfg): Promise<{ ctx: string; title: string; url: string | null }> {
  const type  = cfg?.ai_source_type ?? ''
  const id    = cfg?.ai_source_id ?? ''
  let title   = cfg?.ai_source_title ?? ''
  let ctx     = ''
  let url: string | null = null

  if (!id) return { ctx, title, url }

  if (type === 'article') {
    const { data } = await sb.from('knowledge_contents')
      .select('title, meta_description, excerpt, content_html, slug, knowledge_categories!inner(letter)')
      .eq('id', id).maybeSingle()
    if (data) {
      title = data.title ?? title
      const body = (data.content_html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      ctx = `Título: ${data.title}\nResumo: ${data.excerpt ?? data.meta_description ?? ''}\n\n${body.substring(0, 1500)}`
      const letter = (data as any).knowledge_categories?.letter
      if (letter && data.slug) {
        url = buildUrl(`/base-conhecimento/${String(letter).toLowerCase()}/${data.slug}`)
      }
    }
  } else if (type === 'product') {
    const { data } = await sb.from('system_a_catalog')
      .select('name, description, category, slug')
      .eq('id', id).maybeSingle()
    if (data) {
      title = data.name ?? title
      ctx = `Produto: ${data.name}\nCategoria: ${data.category ?? ''}\n${(data.description ?? '').substring(0, 1000)}`
      if (data.slug) url = buildUrl(`/produtos/${data.slug}`)
    }
  } else if (type === 'video') {
    const { data } = await sb.from('knowledge_videos')
      .select('title, description, url, embed_url')
      .eq('id', id).maybeSingle()
    if (data) {
      title = data.title ?? title
      ctx = `Vídeo: ${data.title}\n${(data.description ?? '').substring(0, 800)}`
      const raw = (data as any).url || (data as any).embed_url
      if (raw && typeof raw === 'string' && /^https?:\/\//i.test(raw)) url = raw
    }
  }

  return { ctx, title, url }
}

async function callDeepseek(prompt: string): Promise<string | null> {
  if (!DEEPSEEK_KEY) return null
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        max_tokens: 220, temperature: 0.8,
      }),
    })
    if (!r.ok) return null
    const d = await r.json()
    const text = d.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch { return null }
}

async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_KEY) return null
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
          generationConfig: { maxOutputTokens: 220, temperature: 0.8 },
        }),
      },
    )
    if (!r.ok) return null
    const d = await r.json()
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return text || null
  } catch { return null }
}

function stripUrls(text: string): string {
  // Remove URLs the model may have inserted despite instructions, so the
  // canonical link is the only one appended.
  return text.replace(/https?:\/\/\S+/gi, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export async function resolveAiContent(sb: SupabaseClient, cfg: AiContentCfg): Promise<AiContentResult> {
  const { ctx, title, url } = await resolveSource(sb, cfg)

  const userPrompt = (cfg?.ai_prompt_override as string)
    || `Com base no conteúdo abaixo, escreva a mensagem para o grupo:\n\n${ctx || `Conteúdo: ${title || 'SmartDent'}`}`

  let body = await callDeepseek(userPrompt)
  let provider = 'deepseek'
  if (!body) { body = await callGemini(userPrompt); provider = body ? 'gemini' : 'fallback' }

  if (!body) {
    body = url
      ? `${title || 'Smart Dent'} — confere aí 👇`
      : `${title || 'Smart Dent'} — confira o conteúdo completo em nosso portal! 📲`
  }

  body = stripUrls(body)
  const text = url ? `${body}\n${url}` : body

  return { text, url, title, provider }
}