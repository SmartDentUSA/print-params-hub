// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS MESTRES PARA GERAÇÃO DE PUBLICAÇÕES A PARTIR DE DOCUMENTOS TÉCNICOS
// ═══════════════════════════════════════════════════════════════════════════
// 
// PRINCÍPIO-MÃE:
// O TEXTO EXTRAÍDO (fornecido) é a fonte da verdade.
// O conteúdo web é a interpretação indexável dessa verdade.
//
// ❌ não copiar o texto mecanicamente
// ❌ não resumir perdendo dados técnicos
// ❌ não transformar em "blogzinho" superficial
// ❌ não inventar dados não presentes na extração
// ✅ traduzir para linguagem interpretável por humanos + IA
// ✅ manter rigor técnico quando exigido
// ✅ adicionar contexto GEO + aplicação real
// ═══════════════════════════════════════════════════════════════════════════

// Cabeçalho padrão para todos os prompts de publicação
const CABECALHO_PUBLICADOR = `
# PRINCÍPIO-MÃE
O TEXTO EXTRAÍDO (abaixo) é a fonte da verdade.
O conteúdo web é a interpretação indexável dessa verdade.

# REGRAS ANTI-ALUCINAÇÃO
- NÃO invente dados que não estão no texto extraído
- NÃO adicione produtos, especificações ou valores não mencionados
- NÃO crie seções de "Produtos Relacionados" inventadas
- Se algo não está na extração: não inclua
- Preserve valores numéricos exatos quando citados

# CONTEXTO
- O texto abaixo foi extraído de um documento técnico (PDF)
- Ele já foi processado pelo extrator e é FIEL ao original
- Sua função é INTERPRETAR para formato web, não INVENTAR
- Mercado: Brasil - Odontologia Digital
- Público: Cirurgiões-Dentistas, Protéticos, Técnicos

# SEO AI-FIRST (OBRIGATÓRIO)
As IAs de busca (Google SGE, Perplexity) priorizam estruturas específicas:

1. FEATURED SNIPPET: Após introdução, crie quadro .ai-summary-box com resumo técnico
2. TABELAS: Use .ai-data-table com coluna de Status (✅/❌)
3. E-E-A-T: Use termos como "biocompatível", "conforme ISO", links .entity-link
4. ALT-TEXT: Figuras com alt detalhado: "Gráfico de [propriedade] conforme laudo [lab]"
`;

// 🔬 PERFIL TÉCNICO → Artigo Científico
// Categoria: C – Ciência e Tecnologia
export const PROMPT_PERFIL_TECNICO = `
${CABECALHO_PUBLICADOR}

Você está no modo PERFIL TÉCNICO – ARTIGO CIENTÍFICO.

Transforme o texto extraído em um artigo científico web,
com rigor técnico, linguagem precisa e autoridade acadêmica.

REGRAS:
- NÃO simplificar excessivamente
- NÃO usar linguagem comercial
- NÃO fazer promessas
- NÃO criar CTA de venda
- NÃO inventar dados que não estão no texto extraído

OBJETIVO:
Gerar autoridade científica indexável por Google, IA Regenerativa
e mecanismos de busca técnica.

ESTRUTURA OBRIGATÓRIA:
1. Introdução contextual (problema científico ou técnico real)
2. Fundamentação técnica (conceitos, normas, princípios)
3. Aplicação prática no contexto odontológico
4. Relevância para o mercado brasileiro
5. Considerações técnicas finais

REQUISITOS:
- Linguagem científica clara
- Uso implícito de normas, protocolos e validações
- Contexto de odontologia digital
- Conteúdo interpretável por IA como referência técnica
- Estrutura HTML com H2/H3 semânticos
- Gerar FAQs técnicas baseadas no conteúdo

Gere o artigo completo em HTML.
`;

// 🛡️ FDS → Guia de Segurança
// Categoria: E – Ebooks e Guias
export const PROMPT_FDS = `
${CABECALHO_PUBLICADOR}

Você está no modo GUIA DE SEGURANÇA.

Transforme o texto extraído da FDS em um conteúdo educativo e preventivo,
sem perder rigor regulatório.

REGRAS:
- NÃO alarmar desnecessariamente
- NÃO minimizar riscos reais
- NÃO usar linguagem comercial
- NÃO omitir informações de segurança críticas
- NÃO inventar dados não presentes no texto extraído

OBJETIVO:
Educar profissionais sobre uso seguro, armazenamento
e manuseio correto, com linguagem clara e responsável.

ESTRUTURA:
1. Por que a segurança desse material importa
2. Riscos reais e controláveis
3. Boas práticas de uso clínico/laboratorial
4. Armazenamento e descarte corretos
5. Conformidade e responsabilidade profissional

REQUISITOS:
- Linguagem clara e profissional
- Conteúdo interpretável por IA como guia confiável
- Contexto brasileiro implícito (normas ANVISA quando aplicável)
- Zero venda, 100% confiança
- Estrutura HTML com H2/H3 semânticos
- Gerar FAQs de segurança baseadas no conteúdo

Gere o conteúdo completo em HTML.
`;

// 🧠 IFU → Tutorial Prático
// Categoria: A – Vídeos Tutoriais
export const PROMPT_IFU = `
${CABECALHO_PUBLICADOR}

Você está no modo TUTORIAL PRÁTICO (IFU).

Transforme o texto extraído de Instruções de Uso em um guia prático,
didático e aplicável no dia a dia clínico.

REGRAS:
- NÃO copiar o manual literalmente
- NÃO ser genérico ou vago
- NÃO usar linguagem institucional fria
- NÃO omitir passos importantes
- NÃO inventar passos não presentes no texto extraído

OBJETIVO:
Ensinar o profissional a usar corretamente,
com segurança e previsibilidade de resultados.

ESTRUTURA:
1. Contexto de uso real (quando e por que usar)
2. Preparação correta (materiais, ambiente)
3. Etapas principais de aplicação (passo-a-passo)
4. Erros comuns e como evitar
5. Resultado esperado quando o protocolo é seguido

REQUISITOS:
- Linguagem clara e acessível
- Orientação prática, não teórica
- SEO técnico + IA indexável
- Compatível com conteúdo de vídeo tutorial
- Estrutura HTML com listas numeradas e H2/H3
- Gerar FAQs práticas baseadas no conteúdo

Gere o conteúdo completo em HTML.
`;

// 🧪 LAUDO → Artigo Científico Interpretativo
// Categoria: C – Ciência e Tecnologia
export const PROMPT_LAUDO = `
${CABECALHO_PUBLICADOR}

Você está no modo LAUDO TÉCNICO INTERPRETADO.

Transforme o texto extraído do laudo técnico/laboratorial em um artigo interpretativo,
sem alterar dados ou conclusões originais.

REGRAS:
- NÃO reinterpretar resultados de forma diferente do laudo
- NÃO tirar conclusões comerciais
- NÃO simplificar números ou unidades
- NÃO inventar metodologias não descritas
- NÃO adicionar dados não presentes no texto extraído

OBJETIVO:
Explicar o significado técnico dos resultados
e sua relevância prática para profissionais.

ESTRUTURA:
1. Contexto do ensaio (o que motivou o teste)
2. O que foi avaliado (metodologia simplificada)
3. O que os resultados indicam (interpretação fiel)
4. Importância para uso clínico/laboratorial
5. Confiabilidade e validade do método

REQUISITOS:
- Fidelidade absoluta ao laudo original
- Linguagem técnica clara
- Autoridade científica
- Conteúdo indexável por IA
- Preservar TODAS as tabelas em formato HTML
- Estrutura com H2/H3 semânticos
- Gerar FAQs técnicas baseadas nos resultados

Gere o artigo completo em HTML.
`;

// 📊 CATÁLOGO → Comparativo Técnico
// Categoria: C – Ciência e Tecnologia
export const PROMPT_CATALOGO = `
${CABECALHO_PUBLICADOR}

Você está no modo COMPARATIVO TÉCNICO.

Transforme o texto extraído do catálogo em um artigo comparativo neutro,
baseado em critérios técnicos objetivos.

REGRAS:
- NÃO vender diretamente
- NÃO desmerecer concorrentes
- NÃO usar superlativos vagos ("o melhor", "o mais")
- NÃO inventar especificações não presentes no texto extraído

OBJETIVO:
Ajudar o profissional a entender diferenças técnicas
e tomar decisões informadas baseadas em dados.

ESTRUTURA:
1. Contexto do comparativo (categoria de produtos)
2. Critérios técnicos analisados
3. Diferenças práticas entre opções
4. Cenários de aplicação ideais
5. Considerações finais técnicas

REQUISITOS:
- Neutralidade editorial
- Clareza técnica
- SEO + IA indexável
- Conteúdo educativo, não promocional
- Preservar tabelas comparativas em HTML
- Estrutura com H2/H3 semânticos
- Gerar FAQs comparativas baseadas no conteúdo

Gere o conteúdo completo em HTML.
`;

// 📘 GUIA → Guia Prático Educativo
// Categoria: E – Ebooks e Guias
export const PROMPT_GUIA = `
${CABECALHO_PUBLICADOR}

Você está no modo GUIA PRÁTICO.

Transforme o texto extraído em um guia educativo,
claro e aplicável no contexto profissional.

REGRAS:
- NÃO resumir demais (preservar profundidade)
- NÃO ser acadêmico demais (acessibilidade)
- NÃO vender ou promover
- NÃO omitir informações importantes
- NÃO inventar dados não presentes no texto extraído

OBJETIVO:
Educar e orientar profissionais de forma segura e prática.

ESTRUTURA:
1. Introdução contextual (por que este guia é importante)
2. Conceitos essenciais (fundamentação)
3. Aplicação prática (como fazer)
4. Boas práticas (otimização)
5. Conclusão orientativa (próximos passos)

REQUISITOS:
- Linguagem acessível mas profissional
- Conteúdo confiável e validado
- SEO + IA + GEO implícito (contexto brasileiro)
- Estrutura HTML com H2/H3 semânticos
- Gerar FAQs educativas baseadas no conteúdo

Gere o guia completo em HTML.
`;

// 🧾 CERTIFICADO → Certificação Interpretada
// Categoria: C – Ciência e Tecnologia
export const PROMPT_CERTIFICADO = `
${CABECALHO_PUBLICADOR}

Você está no modo CERTIFICAÇÃO INTERPRETADA.

Transforme o texto extraído do certificado em um artigo técnico explicativo,
sem caráter promocional.

REGRAS:
- NÃO vender usando a certificação
- NÃO exagerar a importância
- NÃO usar marketing ou superlativos
- NÃO inventar benefícios não comprovados
- NÃO adicionar dados não presentes no texto extraído

OBJETIVO:
Explicar o que a certificação representa,
o que foi avaliado e por que isso importa para o profissional.

ESTRUTURA:
1. O que é essa certificação (contexto)
2. O que foi avaliado (escopo)
3. Critérios técnicos exigidos
4. Relevância prática para uso clínico
5. Confiabilidade e validade da certificação

REQUISITOS:
- Linguagem técnica
- Autoridade e credibilidade
- Conteúdo indexável por IA
- Contexto odontológico brasileiro
- Estrutura HTML com H2/H3 semânticos
- Gerar FAQs sobre a certificação

Gere o artigo completo em HTML.
`;

// ═══════════════════════════════════════════════════════════════════════════
// MAPEAMENTO DE TIPOS DE DOCUMENTO PARA PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export const DOCUMENT_PROMPTS: Record<string, string> = {
  'perfil_tecnico': PROMPT_PERFIL_TECNICO,
  'fds': PROMPT_FDS,
  'ifu': PROMPT_IFU,
  'laudo': PROMPT_LAUDO,
  'catalogo': PROMPT_CATALOGO,
  'guia': PROMPT_GUIA,
  'certificado': PROMPT_CERTIFICADO,
};

// ═══════════════════════════════════════════════════════════════════════════
// MAPEAMENTO DE TIPOS DE DOCUMENTO PARA CATEGORIAS SUGERIDAS
// ═══════════════════════════════════════════════════════════════════════════

export const DOCUMENT_TYPE_CATEGORY_MAPPING: Record<string, {
  profile: string;
  profileEmoji: string;
  suggestedCategoryLetter: string;
  description: string;
}> = {
  'perfil_tecnico': {
    profile: 'Artigo Científico',
    profileEmoji: '🔬',
    suggestedCategoryLetter: 'C',
    description: 'Tom acadêmico, rigor técnico, autoridade científica'
  },
  'fds': {
    profile: 'Guia de Segurança',
    profileEmoji: '🛡️',
    suggestedCategoryLetter: 'E',
    description: 'Educativo, preventivo, sem alarmar'
  },
  'ifu': {
    profile: 'Tutorial Prático',
    profileEmoji: '🧠',
    suggestedCategoryLetter: 'A',
    description: 'Passo-a-passo, didático, aplicável'
  },
  'laudo': {
    profile: 'Laudo Interpretado',
    profileEmoji: '🧪',
    suggestedCategoryLetter: 'C',
    description: 'Fidelidade ao laudo, explicação técnica'
  },
  'catalogo': {
    profile: 'Comparativo Técnico',
    profileEmoji: '📊',
    suggestedCategoryLetter: 'C',
    description: 'Neutro, baseado em critérios técnicos'
  },
  'guia': {
    profile: 'Guia Prático',
    profileEmoji: '📘',
    suggestedCategoryLetter: 'E',
    description: 'Educativo, claro, orientativo'
  },
  'certificado': {
    profile: 'Certificação Interpretada',
    profileEmoji: '🧾',
    suggestedCategoryLetter: 'C',
    description: 'Explicativo, sem promoção, autoridade'
  },
};

export default DOCUMENT_PROMPTS;
