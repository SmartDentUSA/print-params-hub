import type { CardPlan, Section, Subsection, Block, SectionKind } from './types'

const SECTION_KIND_HINTS: Array<{ kind: SectionKind; re: RegExp }> = [
  { kind: 'pre', re: /pr[eé][- ]?process|pre[- ]?process/i },
  { kind: 'postcure', re: /p[oó]s[- ]?cura|post[- ]?cur|post[- ]?curado/i },
  { kind: 'post', re: /p[oó]s[- ]?process|post[- ]?process/i },
]

function detectKind(title: string): SectionKind {
  for (const h of SECTION_KIND_HINTS) if (h.re.test(title)) return h.kind
  return 'generic'
}

type Line = { raw: string; type: 'h2' | 'h3' | 'quote' | 'bullet' | 'sub' | 'text' | 'blank' }

function classify(raw: string): Line {
  const trimmed = raw.trim()
  if (!trimmed) return { raw, type: 'blank' }
  if (/^##\s+/.test(trimmed)) return { raw: trimmed.replace(/^##\s+/, ''), type: 'h2' }
  if (/^###\s+/.test(trimmed)) return { raw: trimmed.replace(/^###\s+/, ''), type: 'h3' }
  if (/^>\s?/.test(trimmed)) return { raw: trimmed.replace(/^>\s?/, ''), type: 'quote' }
  // sub-bullet: line starts with 2+ spaces then bullet
  if (/^(?: {2,}|\t)(?:[•\-*]|\d+\.)\s+/.test(raw)) {
    return { raw: raw.replace(/^(?: {2,}|\t)(?:[•\-*]|\d+\.)\s+/, ''), type: 'sub' }
  }
  if (/^(?:[•\-*]|\d+\.)\s+/.test(trimmed)) {
    return { raw: trimmed.replace(/^(?:[•\-*]|\d+\.)\s+/, ''), type: 'bullet' }
  }
  return { raw: trimmed, type: 'text' }
}

function pushBullet(blocks: Block[], text: string) {
  const last = blocks[blocks.length - 1]
  if (last && last.kind === 'list') {
    last.items.push({ text })
  } else {
    blocks.push({ kind: 'list', items: [{ text }] })
  }
}

function pushSub(blocks: Block[], text: string) {
  const last = blocks[blocks.length - 1]
  if (last && last.kind === 'list' && last.items.length) {
    const li = last.items[last.items.length - 1]
    li.sub = li.sub ?? []
    li.sub.push(text)
  } else {
    pushBullet(blocks, text)
  }
}

export function parseInstructionsMd(md: string, opts?: { title?: string; subtitle?: string; important?: string }): CardPlan {
  const lines = (md || '').split(/\r?\n/)
  const sections: Section[] = []
  let currentSection: Section | null = null
  let currentSub: Subsection | null = null

  const activeBlocks = (): Block[] => {
    if (currentSub) return currentSub.blocks
    if (currentSection) return currentSection.blocks
    // orphan pre-content → create implicit generic section
    if (!currentSection) {
      currentSection = { kind: 'generic', title: '', blocks: [], subsections: [] }
      sections.push(currentSection)
    }
    return currentSection.blocks
  }

  for (const raw of lines) {
    const l = classify(raw)
    if (l.type === 'blank') continue
    if (l.type === 'h2') {
      currentSection = { kind: detectKind(l.raw), title: l.raw, blocks: [], subsections: [] }
      currentSub = null
      sections.push(currentSection)
      continue
    }
    if (l.type === 'h3') {
      if (!currentSection) {
        currentSection = { kind: 'generic', title: '', blocks: [], subsections: [] }
        sections.push(currentSection)
      }
      currentSub = { title: l.raw, blocks: [] }
      currentSection.subsections.push(currentSub)
      continue
    }
    if (l.type === 'quote') {
      activeBlocks().push({ kind: 'callout', text: l.raw })
      continue
    }
    if (l.type === 'bullet') {
      pushBullet(activeBlocks(), l.raw)
      continue
    }
    if (l.type === 'sub') {
      pushSub(activeBlocks(), l.raw)
      continue
    }
    // plain text
    activeBlocks().push({ kind: 'paragraph', text: l.raw })
  }

  return {
    title: opts?.title ?? 'Processo de Uso e Pós-Processamento',
    subtitle: opts?.subtitle ?? 'Guia visual para manual de instruções',
    important:
      opts?.important ??
      'O cumprimento rigoroso dos tempos e etapas descritos neste guia garante melhor acabamento, estabilidade dimensional e desempenho clínico da peça.',
    sections,
  }
}

/** Envolve valores numéricos técnicos em <span class="numeric-value">. */
export function markNumeric(text: string): string {
  const re = /(\b\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?\s?(?:°C|°F|s|seg|segundos?|min|minutos?|h|horas?|mm|µm|um|mL|ml|W|nm|kV|%)\b)/gi
  return text.replace(re, '<span class="numeric-value">$1</span>')
}