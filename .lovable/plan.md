

# Plan: Entity Index + Citation-Ready Blocks + LLM Knowledge Layer

## Overview

Three interconnected changes to make the HTML output AI-citation-ready with semantic entity linking:

1. **New shared file**: `supabase/functions/_shared/entity-dictionary.ts` — Internal Entity Index mapping dental terms to Wikidata IDs
2. **New shared file**: `supabase/functions/_shared/citation-builder.ts` — `buildCitationBlock()` function for LLM-readable summary blocks
3. **Update**: `supabase/functions/_shared/system-prompt.ts` — Add LLM Knowledge Layer rules to the master prompt
4. **Update**: `supabase/functions/ai-orchestrate-content/index.ts` — Import entity dictionary and inject citation block + entity annotations into the AI output pipeline

---

## File 1: `supabase/functions/_shared/entity-dictionary.ts` (NEW)

Contains `INTERNAL_ENTITY_INDEX` with ~25 dental/3D printing entities mapped to Wikidata IDs:

- Odontologia Digital → Q1023932
- Impressao 3D → Q229367
- CAD/CAM → Q207696
- Scanner Intraoral → Q1023932 (subset)
- Zirconia → Q81727
- Implante Dentario → Q223809
- Resina Composta → Q1144215
- ISO 4049, ISO 10993, ANVISA RDC-185
- Protese Dentaria, Ceramica Odontologica, Fotopolimerizacao, DLP/LCD/SLA technologies
- ANP Technology (SmartDent proprietary)
- Fluxo Chairside

Also exports a helper function `matchEntities(text: string)` that scans text and returns matched entities with their Wikidata links.

## File 2: `supabase/functions/_shared/citation-builder.ts` (NEW)

Exports `buildCitationBlock(data)` that generates:

```html
<section class="llm-knowledge-layer" aria-label="Resumo para Extracao de IA" data-section="summary">
  <div class="ai-citation-box" itemProp="abstract">
    <h2 class="sr-only">Resumo Tecnico para Citacao</h2>
    <p class="article-summary">
      <strong>{title}:</strong> {summary}
      <span class="citation-signal" data-source="Smart Dent Official Manual">
        Fato tecnico: {technicalFact}
      </span>
    </p>
  </div>
</section>
```

Also exports `buildEntityAnnotation(entityId)` that returns a `<span data-entity-id="..." data-wikidata="...">` wrapper for inline use.

## File 3: `supabase/functions/_shared/system-prompt.ts` (UPDATE)

Add a new section after the existing rules (~line 215):

```
REGRA DE CAMADA DE CONHECIMENTO (LLM Layer):

1. Todo artigo DEVE conter um bloco ai-citation-box logo apos o H1
2. O resumo deve ser em terceira pessoa neutra, ideal para citacao por IA
3. Use data-entity-id em termos tecnicos chave (ex: data-entity-id="RESINA_COMPOSTA")
4. Inclua pelo menos uma citacao normativa (ISO 4049, RDC-185 ANVISA)
5. Adicione geo-context div com data-ai-summary para contexto da empresa
```

## File 4: `supabase/functions/ai-orchestrate-content/index.ts` (UPDATE)

**Import** the new modules:
```typescript
import { INTERNAL_ENTITY_INDEX, matchEntities } from "../_shared/entity-dictionary.ts";
import { buildCitationBlock } from "../_shared/citation-builder.ts";
```

**Post-processing** (~after line 1050, where the AI response HTML is received):
- Call `matchEntities(html)` to identify entity mentions
- Inject a `geo-context` div with `data-ai-summary` before the article
- Inject the citation block after the first `<h1>` in the generated HTML
- Append entity annotations as a hidden `<script type="application/ld+json">` with `about` and `mentions` arrays linking to Wikidata

**In the prompt** (~line 424): Add entity annotation instructions so the AI itself marks key terms with `data-entity-id` attributes during generation.

---

## What changes for the user

Nothing visible changes in the UI. The HTML output gains invisible semantic layers that AI crawlers and LLMs can parse for better citation and entity recognition. The `ai-citation-box` uses `sr-only` heading so it is invisible to regular readers but fully accessible to screen readers and crawlers.

