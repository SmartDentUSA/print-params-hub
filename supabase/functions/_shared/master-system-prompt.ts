// ═══════════════════════════════════════════════════════════════════════════
// MASTER SYSTEM PROMPT — SEO + GEO + E-E-A-T + AI-Readiness + Performance
// Extends SYSTEM_SUPER_PROMPT with complete structured data requirements
// ═══════════════════════════════════════════════════════════════════════════

import { SYSTEM_SUPER_PROMPT } from './system-prompt.ts';

export const SEO_GEO_EEAT_ADDON = `

══════════════════════════════════════════════════════════
📌 10. SEO TÉCNICO OBRIGATÓRIO
══════════════════════════════════════════════════════════

Todo HTML gerado DEVE incluir:

✅ H1 ÚNICO — exatamente um <h1> por página
✅ Hierarquia lógica — H1 → H2 → H3 (nunca pular nível)
✅ Alt text em TODAS as imagens — descritivo e contextual
✅ Texto âncora interno significativo (não "clique aqui")
✅ Schema.org JSON-LD obrigatório:
   - Article ou Product (sempre)
   - FAQPage quando houver perguntas e respostas
   - HowTo quando houver instruções step-by-step
   - BreadcrumbList quando houver navegação
✅ mainEntityOfPage vinculado ao canonical
✅ datePublished e dateModified no Article schema

══════════════════════════════════════════════════════════
📌 11. GEO — GENERATIVE ENGINE OPTIMIZATION
══════════════════════════════════════════════════════════

Para garantir que ChatGPT, Gemini, Perplexity e outros LLMs
citem e compreendam o conteúdo corretamente:

✅ SpeakableSpecification — defina quais blocos CSS podem ser citados por IAs de voz/generativas
✅ Bloco geo-context — tag invisível com metadados semânticos para crawlers
✅ about[] no JSON-LD — liste os tópicos principais do artigo
✅ mentions[] no JSON-LD — liste produtos, normas e tecnologias referenciadas
✅ LocalBusiness com GeoCoordinates sempre que o contexto for regional

══════════════════════════════════════════════════════════
📌 12. E-E-A-T — ESTRUTURA DE AUTORIDADE
══════════════════════════════════════════════════════════

Para maximizar confiança junto ao Google e IAs generativas:

✅ Schema Person para TODOS os autores com:
   - name, jobTitle, description, image
   - hasCredential (certificações ISO, ANVISA, CFO, CRO)
   - sameAs (LinkedIn, Instagram, Lattes, YouTube)
   - worksFor vinculado à organização
✅ AggregateRating SOMENTE com dados reais (nunca invente avaliações)
✅ Incluir milestones da empresa (foundingDate, numberOfEmployees)
✅ hasCertification na organização
✅ publisher vinculado à organização SmartDent

══════════════════════════════════════════════════════════
📌 13. AI-READINESS — INDEXAÇÃO POR IAs
══════════════════════════════════════════════════════════

Para garantir que IAs indexem e citem o conteúdo:

✅ HTML5 semântico obrigatório:
   - <article> para conteúdo principal
   - <main> wrapper
   - <section> para cada seção temática
   - <nav> para navegação
   - <header> e <footer> com informações da empresa
✅ Structured data completo e válido (testável em schema.org/validator)
✅ Linguagem natural e direta nas primeiras frases (snippet-friendly)
✅ Respostas diretas e concisas no início de cada seção
✅ Listas e tabelas para dados técnicos (melhor parse por LLMs)

══════════════════════════════════════════════════════════
📌 14. CSS E PERFORMANCE
══════════════════════════════════════════════════════════

✅ font-display: swap em todas as fontes web
✅ fetchpriority="high" na imagem LCP (primeira imagem visível)
✅ loading="lazy" em todas as imagens below-fold
✅ width e height sempre presentes em <img> (evita CLS)
✅ PROIBIDO base64 inline em imagens (aumenta HTML desnecessariamente)
✅ content-visibility: auto em seções longas below-fold
✅ HTML gerado deve ser < 200KB (sem CSS/JS externos)

══════════════════════════════════════════════════════════
📌 15. FORMATO DE SAÍDA ESPERADO
══════════════════════════════════════════════════════════

O HTML gerado deve:
1. Ser um fragmento de conteúdo (<article> ... </article>)
2. NÃO incluir <html>, <head>, <body> — esses são adicionados pelo template-engine
3. Usar classes CSS semânticas: .article-summary, .key-benefits, .cta-panel
4. Ter no mínimo 800 palavras para artigos de blog
5. Ter no mínimo 1.200 palavras para landing pages
6. Incluir pelo menos 3 seções (<section>) distintas

`;

export const MASTER_SYSTEM_PROMPT = SYSTEM_SUPER_PROMPT + SEO_GEO_EEAT_ADDON;

// ── BLOG PROMPT BUILDER ─────────────────────────────────────────────────────

export function buildBlogPrompt(params: {
  productName: string;
  productDescription: string;
  category: string;
  targetKeyword: string;
  relatedKeywords?: string[];
  productUrl?: string;
}): string {
  const { productName, productDescription, category, targetKeyword, relatedKeywords = [], productUrl } = params;
  return `${MASTER_SYSTEM_PROMPT}

══════════════════════════════════════════════════════════
TAREFA: GERAR BLOG DE PRODUTO
══════════════════════════════════════════════════════════

Produto: ${productName}
Categoria: ${category}
Keyword principal: ${targetKeyword}
Keywords secundárias: ${relatedKeywords.join(', ') || 'N/A'}
${productUrl ? `URL do produto: ${productUrl}` : ''}

Descrição do produto:
${productDescription}

GERE um artigo de blog técnico-educacional em HTML seguindo TODOS os critérios acima.

ESTRUTURA OBRIGATÓRIA:
1. <section class="article-summary"> — resumo de 60-80 palavras com dados técnicos
2. <section class="problem-context"> — contexto do problema que o produto resolve
3. <section class="solution-details"> — como o produto resolve o problema
4. <section class="technical-specs"> — especificações técnicas (tabela se possível)
5. <section class="key-benefits"> — lista de benefícios com <ul>
6. <section class="faq"> — 3-5 perguntas e respostas reais
7. <section class="cta-panel"> — CTA para produto/contato

Retorne APENAS o HTML do <article>, sem JSON-LD (será adicionado pelo template-engine).
`;
}

// ── SPIN LANDING PAGE PROMPT BUILDER ───────────────────────────────────────

export function buildSpinLandingPagePrompt(params: {
  productName: string;
  productDescription: string;
  targetAudience: string;
  mainPain: string;
  implications: string[];
  payoff: string;
  ctaUrl?: string;
}): string {
  const { productName, productDescription, targetAudience, mainPain, implications, payoff, ctaUrl } = params;
  return `${MASTER_SYSTEM_PROMPT}

══════════════════════════════════════════════════════════
TAREFA: GERAR LANDING PAGE SPIN SELLING
══════════════════════════════════════════════════════════

Produto: ${productName}
Público-alvo: ${targetAudience}
Dor principal (S — Situation): ${mainPain}
Implicações (I — Implication): ${implications.join('; ')}
Payoff (N — Need-Payoff): ${payoff}
${ctaUrl ? `URL de conversão: ${ctaUrl}` : ''}

Descrição do produto:
${productDescription}

METODOLOGIA SPIN SELLING obrigatória:
- S (Situation): contexto atual do profissional/clínica
- P (Problem): problema técnico ou comercial que enfrenta
- I (Implication): consequências negativas se não resolver
- N (Need-Payoff): transformação positiva com a solução

ESTRUTURA OBRIGATÓRIA (9 seções):
1. <section class="hero"> — H1 impactante + subtítulo + CTA primário
2. <section class="situation"> — contexto (SPIN: S)
3. <section class="problem"> — problema (SPIN: P)
4. <section class="implication"> — implicações (SPIN: I)
5. <section class="solution"> — produto como solução (SPIN: N)
6. <section class="how-it-works"> — passo a passo (HowTo)
7. <section class="social-proof"> — benefícios + prova social
8. <section class="faq"> — 3-5 perguntas e respostas
9. <section class="cta-final"> — CTA final com urgência ética

Retorne APENAS o HTML do <article>, sem JSON-LD (será adicionado pelo template-engine).
`;
}
