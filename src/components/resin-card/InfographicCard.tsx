import React, { forwardRef } from 'react'
import './theme.css'
import { ProductHero } from './ProductHero'
import type { CardPlan, Block, Section, Subsection } from './types'
import { markNumeric } from './parseInstructionsMd'
import { SMART_DENT_LOGO_URL } from '@/utils/resolveProductImage'

function inline(text: string): { __html: string } {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const bolded = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return { __html: markNumeric(bolded) }
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === 'paragraph') {
    return <p className="paragraph" dangerouslySetInnerHTML={inline(block.text)} />
  }
  if (block.kind === 'callout') {
    return <div className="callout"><span dangerouslySetInnerHTML={inline(block.text)} /></div>
  }
  return (
    <ul className="card-list">
      {block.items.map((it, i) => (
        <li key={i}>
          <span dangerouslySetInnerHTML={inline(it.text)} />
          {it.sub && it.sub.length > 0 && (
            <ul>
              {it.sub.map((s, j) => (
                <li key={j}><span dangerouslySetInnerHTML={inline(s)} /></li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function SubsectionView({ sub, idx, parentIdx }: { sub: Subsection; idx: number; parentIdx: number }) {
  return (
    <div className="subsection">
      <div className="subsection-title">{parentIdx + 1}.{idx + 1} · {sub.title}</div>
      {sub.blocks.map((b, i) => <BlockView key={i} block={b} />)}
    </div>
  )
}

function SectionView({ section, idx }: { section: Section; idx: number }) {
  return (
    <div className={`section kind-${section.kind}`}>
      <div className="section-head">
        <div className="section-badge">{idx + 1}</div>
        <div className="section-title">{section.title}</div>
      </div>
      {section.blocks.map((b, i) => <BlockView key={i} block={b} />)}
      {section.subsections.map((s, i) => <SubsectionView key={i} sub={s} idx={i} parentIdx={idx} />)}
    </div>
  )
}

export type InfographicCardProps = {
  plan: CardPlan
  resinName: string
  productImageUrl: string | null
  importantLabel?: string
}

export const InfographicCard = forwardRef<HTMLDivElement, InfographicCardProps>(function InfographicCard(
  { plan, resinName, productImageUrl, importantLabel = 'Importante' },
  ref,
) {
  return (
    <div className="infographic-root" ref={ref}>
      <div className="head">
        <div>
          <img
            className="brand-logo"
            src={SMART_DENT_LOGO_URL}
            alt="Smart Dent"
            crossOrigin="anonymous"
            draggable={false}
          />
          <h1>{plan.title} — {resinName}</h1>
          <div className="rule" />
          <div className="subtitle">{plan.subtitle}</div>
        </div>
        <ProductHero productName={resinName} imageUrl={productImageUrl} />
      </div>

      {plan.sections.map((s, i) => <SectionView key={i} section={s} idx={i} />)}

      <div className="footer">
        <div className="shield">✓</div>
        <div className="foot-text">
          <span className="foot-title">{importantLabel}:</span>
          <span dangerouslySetInnerHTML={inline(plan.important)} />
        </div>
      </div>
    </div>
  )
})