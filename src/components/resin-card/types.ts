export type Lang = 'pt' | 'en' | 'es'

export type CalloutBlock = { kind: 'callout'; text: string }
export type ParagraphBlock = { kind: 'paragraph'; text: string }
export type ListBlock = {
  kind: 'list'
  items: Array<{ text: string; sub?: string[] }>
}
export type Block = CalloutBlock | ParagraphBlock | ListBlock

export type Subsection = {
  title: string
  blocks: Block[]
}

export type SectionKind = 'pre' | 'post' | 'postcure' | 'generic'

export type Section = {
  kind: SectionKind
  title: string
  blocks: Block[]
  subsections: Subsection[]
}

export type CardPlan = {
  title: string
  subtitle: string
  important: string
  sections: Section[]
}