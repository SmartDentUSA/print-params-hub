// ═══════════════════════════════════════════════════════════
// Master System Prompt — E-E-A-T + AI-Readiness (GEO) Rules
// Sections 12 and 13 define the new authority and GEO directives.
// ═══════════════════════════════════════════════════════════

import { ENTITY_KNOWLEDGE_GRAPH } from './authority-data-helper.ts';

// Build a compact entity reference string for injection into prompts
function buildEntityReference(): string {
  return Object.entries(ENTITY_KNOWLEDGE_GRAPH)
    .filter(([key]) => !key.includes(' ') || key.split(' ').length <= 2) // keep concise
    .slice(0, 12)
    .map(([term, entity]) => `• "${term}" → ${entity.wikidataUrl} (${entity.labelPt})`)
    .join('\n');
}

export const MASTER_EEAT_SECTION = `
══════════════════════════════════════════════════════════
📌 12. E-E-A-T AVANÇADO — AUTORIDADE MÉDICA VERIFICÁVEL
══════════════════════════════════════════════════════════

12.1 DADOS DE AUTOR OBRIGATÓRIOS
Toda página de autoridade médica deve incluir JSON-LD do tipo Person com:

  ✅ hasCredential preenchido com dados reais de:
     – credentialType (ex: "Registro CRO", "Doutoramento em Prótese")
     – issuedBy (ex: "Universidade de São Paulo")
     – recognizedBy.name (ex: "Conselho Federal de Odontologia")
     – recognizedBy.url (URL oficial do conselho)
  ✅ sameAs apontando para perfis verificáveis (ORCID, Lattes, LinkedIn)
  ✅ worksFor com organização verificável

NOTA CRÍTICA: Se o campo hasCredential estiver vazio ou ausente,
a nota de autoridade E-E-A-T NÃO pode ultrapassar 6/10.

12.2 JSON-LD DE PRODUTO COM ENTIDADE WIKIDATA
Para produtos e artigos, o campo "about" DEVE conter:

  {
    "@type": "Thing",
    "name": "<nome do tema>",
    "sameAs": "<URL Wikidata do tema>",
    "url": "<URL da referência global (Wikipedia, Wikidata)>"
  }

O campo sameAs deve apontar para as entidades do Entity Knowledge Graph
definidas em authority-data-helper.ts. Isso garante entity linking externo.

12.3 STRUCTURED DATA OBRIGATÓRIO
Para nota máxima E-E-A-T (10/10), o JSON-LD deve incluir:
  – Person ou Organization com hasCredential completo
  – Article ou Product com about + sameAs (Wikidata)
  – BreadcrumbList para navegação contextual
  – FAQPage quando houver perguntas frequentes
`;

export const MASTER_AI_READINESS_SECTION = `
══════════════════════════════════════════════════════════
📌 13. AI-READINESS (GEO) — VISIBILIDADE EM IA GENERATIVA
══════════════════════════════════════════════════════════

13.1 POLÍTICA DE CONTEÚDO PARA IA
Todo HTML gerado deve incluir no <head>:

  <meta name="ai-content-policy" content="allow-training:false, allow-crawling:true">
  <meta name="robots" content="all" data-agent="GPTBot">
  <meta name="robots" content="all" data-agent="CCBot">
  <meta name="robots" content="all" data-agent="Google-Extended">
  <meta name="robots" content="all" data-agent="PerplexityBot">
  <meta name="robots" content="all" data-agent="anthropic-ai">

13.2 ENTITY LINKING EXTERNO (OBRIGATÓRIO PARA 10/10)
O JSON-LD de cada produto, artigo ou serviço deve incluir sameAs
apontando para o Wikidata correspondente do ENTITY_KNOWLEDGE_GRAPH:

${buildEntityReference()}

Regra: sempre que um termo do ENTITY_KNOWLEDGE_GRAPH aparecer no conteúdo,
o JSON-LD do artigo/produto deve incluir um sameAs para o Wikidata desse termo.

13.3 BLOCO GEO PARA EMBEDDINGS
Todo artigo deve conter um elemento semântico com:

  <section data-geo-context="true"
           data-ai-summary="<resumo executivo de 2 parágrafos otimizado para embeddings>">

O data-ai-summary deve:
  – Responder "O que é?" + "Para que serve?" em linguagem natural
  – Incluir os termos-chave sem keyword stuffing
  – Ter entre 100 e 200 palavras
  – Ser escrito para vetores de busca semântica (dense retrieval)
  – Mencionar o contexto geográfico (Portugal/Brasil) quando relevante

13.4 SINAL DE AUTORIDADE GEOGRÁFICA
Para máxima visibilidade em Gemini, ChatGPT e Perplexity:
  ✅ Citar cidade/país onde a clínica ou laboratório opera
  ✅ Usar linguagem pt-BR ou pt-PT de forma consistente
  ✅ Incluir speakable schema para conteúdo falado por assistentes de voz
  ✅ Referenciar entidades Wikidata no about de produtos e artigos

13.5 CHECKLIST FINAL AI-READINESS
  □ meta ai-content-policy presente no <head>
  □ Robots meta com GPTBot e CCBot explícitos
  □ JSON-LD com sameAs apontando para Wikidata
  □ Campo "about" com URL de referência global
  □ Bloco data-ai-summary com resumo para embeddings
  □ hasCredential do autor preenchido (se página de autoridade médica)
`;

/**
 * Full master system prompt combining the base rules from system-prompt.ts
 * with the new E-E-A-T and AI-Readiness sections (12 and 13).
 *
 * Import this alongside SYSTEM_SUPER_PROMPT for functions that generate
 * full HTML pages requiring GEO/E-E-A-T compliance.
 */
export const MASTER_AUTHORITY_ADDENDUM = `
${MASTER_EEAT_SECTION}
${MASTER_AI_READINESS_SECTION}

══════════════════════════════════════════════════════════
⚠️ PRIORIDADE DESTAS REGRAS
══════════════════════════════════════════════════════════
As regras das secções 12 e 13 têm PRIORIDADE sobre quaisquer instruções
genéricas de formatação. Se houver conflito, aplique sempre:
  1. hasCredential obrigatório para autoridade médica
  2. sameAs com Wikidata para entity linking
  3. data-ai-summary para GEO/embeddings
  4. meta ai-content-policy no <head>
`;
