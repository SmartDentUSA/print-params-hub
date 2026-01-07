// ============================================================
// DICIONÁRIO VISUAL UNIVERSAL PARA IMAGENS OG
// ============================================================
// Este arquivo centraliza todas as configurações visuais para
// geração de imagens Open Graph, aplicando o Princípio-Mãe:
// "A foto real do produto é a fonte visual da verdade;
//  a imagem OG é a interpretação contextualizada dessa verdade."
// ============================================================

export interface OGVisualConfig {
  objeto_principal: string;
  ambiente: string;
  iluminacao: string;
  mood: string;
  elemento_autoridade: string;
  regra_anti_alucinacao: string;
  equipamentos_permitidos: string[];
  elementos_proibidos: string[];
}

export interface VeredictVisual {
  aprovado: string;
  reprovado: string;
  condicional: string;
}

export interface ExtendedOGConfig extends OGVisualConfig {
  veredito_visual?: VeredictVisual;
}

// ============================================================
// DICIONÁRIO EXPANDIDO POR TIPO DE DOCUMENTO
// ============================================================

export const documentVisualDictionary: Record<string, ExtendedOGConfig> = {
  // --------------------------------------------------------
  // 1. GUIA DE APLICAÇÃO (WORKFLOW)
  // --------------------------------------------------------
  'guia_workflow': {
    objeto_principal: 'Fluxograma visual de processo clínico com etapas numeradas ou impressora 3D com peça sendo impressa',
    ambiente: 'Consultório odontológico moderno com impressora 3D ao fundo desfocada',
    iluminacao: 'Luz ambiente natural combinada com spots de destaque LED',
    mood: 'Clareza processual, confiança no protocolo e eficiência clínica',
    elemento_autoridade: 'Equipamentos Smart Dent (câmara UV, impressora) sutilmente visíveis',
    regra_anti_alucinacao: 'Mostrar apenas equipamentos reais e peças impressas, NUNCA frascos fictícios ou embalagens',
    equipamentos_permitidos: ['impressora 3D', 'câmara UV', 'computador com software dental', 'scanner intraoral', 'peças impressas'],
    elementos_proibidos: ['frascos de resina', 'embalagens de produto', 'logos', 'texto legível', 'rostos humanos']
  },

  // --------------------------------------------------------
  // 2. LAUDO / ENSAIO TÉCNICO
  // --------------------------------------------------------
  'laudo': {
    objeto_principal: 'Equipamento de laboratório metrológico com peça dental sendo analisada',
    ambiente: 'Laboratório de metrologia certificado com tons neutros e superfícies limpas',
    iluminacao: 'Luz difusa científica sem sombras duras (iluminação de laboratório)',
    mood: 'Precisão absoluta, rigor científico e imparcialidade',
    elemento_autoridade: 'Equipamento analítico (microscópio, espectrofotômetro, durômetro) parcialmente visível',
    regra_anti_alucinacao: 'NUNCA gerar gráficos com dados fictícios - mostrar EQUIPAMENTOS de teste, não resultados inventados',
    equipamentos_permitidos: ['microscópio', 'espectrofotômetro', 'durômetro', 'balança analítica', 'câmara de envelhecimento', 'tensiômetro'],
    elementos_proibidos: ['gráficos com números', 'tabelas de dados', 'resultados numéricos', 'certificados escritos'],
    veredito_visual: {
      aprovado: 'Selo metálico verde com checkmark sutil ao canto',
      reprovado: 'Sem indicação visual (não chamar atenção negativa)',
      condicional: 'Selo amarelo com asterisco discreto'
    }
  },

  // --------------------------------------------------------
  // 3. CATÁLOGO COMERCIAL
  // --------------------------------------------------------
  'catalogo': {
    objeto_principal: 'Produto real com peças impressas demonstrando aplicações finais (coroas, próteses, modelos)',
    ambiente: 'Showcase premium com gradiente escuro para claro, superfície reflexiva elegante',
    iluminacao: 'Iluminação publicitária de alto padrão (3-point lighting com rim light)',
    mood: 'Desejo, inovação premium e qualidade excepcional',
    elemento_autoridade: 'Peças impressas finais demonstrando acabamento perfeito e precisão',
    regra_anti_alucinacao: 'OBRIGATÓRIO usar modo EDIT com imagem real do produto - NUNCA gerar embalagem fictícia',
    equipamentos_permitidos: ['peças impressas reais', 'modelos dentários', 'coroas', 'próteses', 'splints'],
    elementos_proibidos: ['embalagens fictícias', 'frascos inventados', 'logos criados', 'preços', 'texto promocional']
  },

  // --------------------------------------------------------
  // 4. IFU (INSTRUÇÕES DE USO)
  // --------------------------------------------------------
  'ifu': {
    objeto_principal: 'Mãos profissionais com luvas manipulando peça impressa em 3D ou ajustando equipamento',
    ambiente: 'Bancada de trabalho organizada com ferramentas e equipamentos profissionais visíveis',
    iluminacao: 'Luz de estúdio clara e direta com sombras suaves',
    mood: 'Didático, acessível, técnico e profissional',
    elemento_autoridade: 'Tablet ou manual impresso sutilmente visível mostrando instruções (sem texto legível)',
    regra_anti_alucinacao: 'Foco em AÇÃO e PROCESSO, NUNCA no produto embalado - mostrar USO, não venda',
    equipamentos_permitidos: ['mãos com luvas', 'ferramentas dentais', 'peças impressas', 'câmara UV', 'impressora 3D'],
    elementos_proibidos: ['embalagens', 'frascos', 'rostos', 'texto legível', 'logos']
  },

  // --------------------------------------------------------
  // 5. FDS (FICHA DE SEGURANÇA)
  // --------------------------------------------------------
  'fds': {
    objeto_principal: 'EPIs profissionais (luvas nitrílicas, óculos de proteção) em ambiente controlado',
    ambiente: 'Área de armazenamento médico com prateleiras organizadas e ventilação adequada',
    iluminacao: 'Luz branca limpa e estéril (iluminação hospitalar)',
    mood: 'Proteção, responsabilidade, conformidade e segurança ocupacional',
    elemento_autoridade: 'Símbolos de segurança química (GHS) sutilmente visíveis em contexto apropriado',
    regra_anti_alucinacao: 'NUNCA mostrar produto sendo derramado, vazado ou em situação de risco',
    equipamentos_permitidos: ['luvas', 'óculos de proteção', 'jaleco', 'capela de exaustão', 'prateleiras organizadas', 'símbolos GHS'],
    elementos_proibidos: ['acidentes', 'derramamentos', 'situações perigosas', 'frascos abertos', 'manuseio incorreto']
  },

  // --------------------------------------------------------
  // 6. PERFIL TÉCNICO / CIENTÍFICO
  // --------------------------------------------------------
  'perfil_tecnico': {
    objeto_principal: 'Representação visual de biocompatibilidade - células em cultura, placas de petri, ou microscópio',
    ambiente: 'Centro de biotecnologia moderno com equipamentos de ponta',
    iluminacao: 'Tons azulados científicos (#1E40AF) com iluminação fria de laboratório',
    mood: 'Segurança biológica comprovada, pureza e confiança científica',
    elemento_autoridade: 'Placas de petri, microscópio ou câmara de cultura celular em uso',
    regra_anti_alucinacao: 'Para testes ISO 10993, NUNCA inventar resultados visuais - mostrar EQUIPAMENTOS de teste',
    equipamentos_permitidos: ['microscópio', 'placas de petri', 'câmara de cultura', 'pipetas', 'centrífuga', 'incubadora'],
    elementos_proibidos: ['gráficos fictícios', 'números de certificação', 'resultados inventados', 'frascos de resina']
  },

  // --------------------------------------------------------
  // 7. MANUAL TÉCNICO
  // --------------------------------------------------------
  'manual_tecnico': {
    objeto_principal: 'Equipamento (impressora 3D ou câmara UV) em vista detalhada ou com destaque em componentes',
    ambiente: 'Oficina técnica profissional ou laboratório de manutenção',
    iluminacao: 'Luz técnica com destaques pontuais em componentes importantes',
    mood: 'Expertise técnica, suporte profissional e conhecimento aprofundado',
    elemento_autoridade: 'Ferramentas de manutenção e calibração sutilmente visíveis',
    regra_anti_alucinacao: 'Mostrar equipamentos reais Smart Dent ou genéricos profissionais, NUNCA inventar modelos',
    equipamentos_permitidos: ['impressora 3D', 'câmara UV', 'ferramentas de calibração', 'multímetro', 'chaves técnicas'],
    elementos_proibidos: ['modelos de equipamento inventados', 'marcas fictícias', 'texto técnico legível']
  },

  // --------------------------------------------------------
  // 8. CERTIFICADO
  // --------------------------------------------------------
  'certificado': {
    objeto_principal: 'Selo metálico 3D texturizado (ouro, prata ou bronze) com detalhes de qualidade',
    ambiente: 'Fundo gradient escuro para claro com vinheta elegante',
    iluminacao: 'Spotlight dramático focado no selo com reflexos suaves',
    mood: 'Autoridade absoluta, conformidade regulatória e credibilidade institucional',
    elemento_autoridade: 'Peça impressa certificada posicionada elegantemente ao lado do selo',
    regra_anti_alucinacao: 'NUNCA inventar números de certificado, datas ou órgãos certificadores fictícios',
    equipamentos_permitidos: ['selo metálico abstrato', 'peças impressas', 'ribbon elegante'],
    elementos_proibidos: ['números de certificado', 'datas específicas', 'logos ANVISA/INMETRO fictícios', 'texto legível']
  },

  // --------------------------------------------------------
  // 9. GUIA GENÉRICO (Fallback)
  // --------------------------------------------------------
  'guia': {
    objeto_principal: 'Modelo de arcada dentária completa com guias cirúrgicos ou coroas encaixadas',
    ambiente: 'Bancada de trabalho de um técnico de próteses dental',
    iluminacao: 'Luz lateral quente combinada com foco superior',
    mood: 'Sucesso clínico, artesanato digital e precisão',
    elemento_autoridade: 'A precisão do encaixe demonstra a estabilidade dimensional do material',
    regra_anti_alucinacao: 'Mostrar PEÇAS FINAIS em uso, não produtos embalados',
    equipamentos_permitidos: ['modelos dentários', 'articulador', 'guias cirúrgicos', 'coroas', 'facetas'],
    elementos_proibidos: ['embalagens', 'frascos', 'preços', 'texto promocional']
  },

  // --------------------------------------------------------
  // 10. OUTRO (Default conservador)
  // --------------------------------------------------------
  'outro': {
    objeto_principal: 'Impressora 3D dental profissional com peça sendo impressa ou recém-impressa',
    ambiente: 'Laboratório dental digital moderno e organizado',
    iluminacao: 'Iluminação profissional balanceada',
    mood: 'Inovação tecnológica e qualidade profissional',
    elemento_autoridade: 'Equipamentos de alta tecnologia sutilmente visíveis',
    regra_anti_alucinacao: 'Mostrar TECNOLOGIA e RESULTADOS, nunca produtos embalados',
    equipamentos_permitidos: ['impressora 3D', 'câmara UV', 'scanner', 'computador', 'peças impressas'],
    elementos_proibidos: ['embalagens', 'frascos', 'logos', 'texto', 'rostos']
  }
};

// ============================================================
// REGRAS DE OURO - CONTEXTOS CLÍNICOS ESPECIAIS
// ============================================================

export interface GoldenRuleOverride {
  keywords: string[];
  override: Partial<OGVisualConfig>;
  priority: number; // Maior = maior prioridade
}

export const goldenRules: GoldenRuleOverride[] = [
  // --------------------------------------------------------
  // REGRA 1: Splint/Bruxismo + Biocompatibilidade (COMBO)
  // --------------------------------------------------------
  {
    keywords: ['splint', 'bruxismo', 'miorrelaxante', 'bite', 'oclusão'],
    override: {
      objeto_principal: 'Placa miorrelaxante ultra-transparente impressa em 3D com clareza cristalina',
      ambiente: 'Laboratório dental com superfície azul clínica (#1E40AF) e iluminação LED',
      mood: 'Transparência cristalina, conforto do paciente e precisão de encaixe',
      elemento_autoridade: 'A transparência ótica perfeita demonstra a qualidade do material'
    },
    priority: 80
  },

  // --------------------------------------------------------
  // REGRA 2: Dentes Permanentes / Vitality System
  // --------------------------------------------------------
  {
    keywords: ['permanente', 'definitivo', 'vitality', 'longo prazo', 'restauração final'],
    override: {
      objeto_principal: 'Coroa dentária premium com translucidez natural de zircônia ou cerâmica',
      ambiente: 'Laboratório de estética dental com iluminação de alta fidelidade de cor',
      mood: 'Durabilidade definitiva, estética natural e biocompatibilidade',
      elemento_autoridade: 'Escala de cores VITA sutilmente visível ao fundo'
    },
    priority: 70
  },

  // --------------------------------------------------------
  // REGRA 3: Testes ISO 10993 (Biocompatibilidade)
  // --------------------------------------------------------
  {
    keywords: ['10993-5', 'citotox', 'citotoxicidade'],
    override: {
      ambiente: 'Laboratório de cultura celular com equipamentos de biotecnologia',
      elemento_autoridade: 'Placas de cultura celular e microscópio invertido sugerindo ensaios de citotoxicidade ISO 10993-5'
    },
    priority: 90
  },
  {
    keywords: ['10993-10', 'intracutânea', 'irritação'],
    override: {
      ambiente: 'Laboratório de testes in vivo com ambiente estéril',
      elemento_autoridade: 'Ambiente controlado de laboratório com indicadores de conformidade ISO 10993-10'
    },
    priority: 90
  },
  {
    keywords: ['10993-23', 'sensibilização'],
    override: {
      ambiente: 'Laboratório de imunologia e testes de sensibilização',
      elemento_autoridade: 'Equipamentos de teste imunológico sugerindo conformidade ISO 10993-23'
    },
    priority: 90
  },

  // --------------------------------------------------------
  // REGRA 4: Guias Cirúrgicos
  // --------------------------------------------------------
  {
    keywords: ['guia cirúrgico', 'surgical guide', 'implante', 'cirurgia guiada'],
    override: {
      objeto_principal: 'Guia cirúrgico transparente posicionado sobre modelo de arcada com implantes visíveis',
      ambiente: 'Centro cirúrgico odontológico ou sala de planejamento digital',
      mood: 'Precisão milimétrica, segurança cirúrgica e planejamento digital',
      elemento_autoridade: 'Tomografia ou planejamento 3D sutilmente visível em tela ao fundo'
    },
    priority: 75
  },

  // --------------------------------------------------------
  // REGRA 5: Ortodontia / Alinhadores
  // --------------------------------------------------------
  {
    keywords: ['alinhador', 'ortodontia', 'clear aligner', 'movimentação'],
    override: {
      objeto_principal: 'Alinhador transparente de precisão sobre modelo dental',
      ambiente: 'Clínica de ortodontia digital moderna',
      mood: 'Estética, precisão de movimento e inovação ortodôntica',
      elemento_autoridade: 'Sequência de alinhadores ou software de planejamento ao fundo'
    },
    priority: 75
  },

  // --------------------------------------------------------
  // REGRA 6: Prótese Removível
  // --------------------------------------------------------
  {
    keywords: ['prótese removível', 'dentadura', 'base de prótese', 'gengiva'],
    override: {
      objeto_principal: 'Base de prótese com dentes posicionados mostrando acabamento natural de gengiva',
      ambiente: 'Laboratório de prótese dental com articulador',
      mood: 'Naturalidade, funcionalidade e conforto do paciente',
      elemento_autoridade: 'Articulador ou modelos de estudo ao fundo'
    },
    priority: 70
  }
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Obtém a configuração visual base para um tipo de documento
 */
export function getBaseConfig(documentType: string): ExtendedOGConfig {
  return documentVisualDictionary[documentType] || documentVisualDictionary['outro'];
}

/**
 * Aplica as Regras de Ouro baseado no contexto textual
 */
export function applyGoldenRules(
  baseConfig: ExtendedOGConfig,
  textContext: string,
  productName?: string
): ExtendedOGConfig {
  const lowerContext = textContext.toLowerCase();
  const modified = { ...baseConfig };

  // Encontrar todas as regras que se aplicam
  const applicableRules = goldenRules
    .filter(rule => rule.keywords.some(k => lowerContext.includes(k.toLowerCase())))
    .sort((a, b) => b.priority - a.priority); // Ordenar por prioridade decrescente

  // Aplicar regras em ordem de prioridade (primeira = maior prioridade)
  for (const rule of applicableRules) {
    Object.assign(modified, rule.override);
  }

  // Adicionar nome do produto se disponível
  if (productName && modified.objeto_principal) {
    modified.objeto_principal = modified.objeto_principal.replace(
      /impressa em 3D|dental|premium/i,
      `$& (${productName})`
    );
  }

  return modified;
}

/**
 * Detecta o modo de geração baseado no contexto
 */
export type GenerationMode = 'EDIT' | 'COMPOSITE' | 'EQUIPMENT' | 'CONCEPTUAL' | 'GENERATE';

export function detectGenerationMode(
  productImageUrl?: string,
  textContext?: string,
  productName?: string
): GenerationMode {
  // Prioridade 1: Se tem imagem real do produto
  if (productImageUrl) return 'EDIT';

  const lowerContext = (textContext || '').toLowerCase();

  // Prioridade 2: Detectar foco em equipamentos
  const equipmentKeywords = ['impressora', 'printer', 'câmara uv', 'uv chamber', 'pós-cura', 'postcure', 'scanner'];
  if (equipmentKeywords.some(k => lowerContext.includes(k)) && !productName) {
    return 'EQUIPMENT';
  }

  // Prioridade 3: Detectar artigo conceitual/científico
  const conceptualKeywords = [
    'evidência científica', 'evidências', 'estudo', 'revisão', 'artigo científico',
    'pesquisa', 'análise comparativa', 'norma técnica', 'regulamentação',
    'tpo', 'fotoiniciador', 'biossegurança', 'pós-cura', 'polimerização',
    'propriedades mecânicas', 'monômero', 'conversão', 'grau de conversão'
  ];
  if (!productName && conceptualKeywords.some(k => lowerContext.includes(k))) {
    return 'CONCEPTUAL';
  }

  // Fallback: Geração padrão
  return 'GENERATE';
}

/**
 * Gera alt-text estruturado para SEO
 */
export interface SEOAltText {
  primary: string;
  context: string;
  authority: string;
  brand: string;
  iso?: string;
  full: string;
}

export function generateSEOAltText(
  config: ExtendedOGConfig,
  textContext: string,
  productName?: string
): SEOAltText {
  const lowerContext = textContext.toLowerCase();

  // Detectar norma ISO
  let iso: string | undefined;
  if (lowerContext.includes('10993-23')) iso = 'ISO 10993-23';
  else if (lowerContext.includes('10993-10')) iso = 'ISO 10993-10';
  else if (lowerContext.includes('10993-5')) iso = 'ISO 10993-5';
  else if (lowerContext.includes('10993')) iso = 'ISO 10993';
  else if (lowerContext.includes('4049')) iso = 'ISO 4049';
  else if (lowerContext.includes('10477')) iso = 'ISO 10477';

  // Detectar tipo de teste biológico
  let bioTestType = '';
  if (lowerContext.includes('citotox')) bioTestType = 'citotoxicidade';
  else if (lowerContext.includes('intracutânea')) bioTestType = 'reatividade intracutânea';
  else if (lowerContext.includes('sensibilização')) bioTestType = 'sensibilização';
  else if (lowerContext.includes('irritação')) bioTestType = 'irritação';
  else if (lowerContext.includes('biocompat')) bioTestType = 'biocompatibilidade';

  // Construir alt-text
  const primary = productName 
    ? `${productName} - ${config.objeto_principal}`
    : config.objeto_principal;

  const context = `em ${config.ambiente}`;
  const authority = config.elemento_autoridade;
  const brand = 'Smart Dent Odontologia Digital';

  // Full alt-text otimizado
  let full = primary;
  if (bioTestType && iso) {
    full = `Teste de ${bioTestType} ${iso} demonstrando a segurança de ${productName || 'resina Smart Dent'} para aplicações odontológicas.`;
  } else if (iso) {
    full = `${primary} em conformidade com ${iso}. ${brand}.`;
  } else {
    full = `${primary} ${context}. ${brand}.`;
  }

  return { primary, context, authority, brand, iso, full };
}

// ============================================================
// REGRAS ANTI-ALUCINAÇÃO GLOBAIS
// ============================================================

export const GLOBAL_ANTI_HALLUCINATION_RULES = `
CRITICAL ANTI-HALLUCINATION RULES - MANDATORY COMPLIANCE:

ABSOLUTELY PROHIBITED (NEVER generate these):
- Product bottles, jars, containers, or packaging of ANY kind
- Product labels, brand names, or fictional product designs  
- Chemical containers, reagent bottles, or material packaging
- Products that look "for sale" or retail-style items
- Fictional product representations or invented packaging
- Graphs with fake numerical data or invented statistics
- Certification numbers, dates, or regulatory codes
- Logos of real organizations (ANVISA, INMETRO, FDA)
- Human faces or identifiable people
- Readable text of any kind

ONLY SHOW THESE ELEMENTS:
- 3D printers and post-curing/UV equipment
- Dental prosthetics and models (crowns, dentures, splints, aligners)
- Laboratory equipment (UV chambers, workstations, microscopes)
- Dental tools and instruments
- Abstract metallic seals (no text or numbers)
- Professional hands with gloves (no faces)
- Computer screens with dental software (no readable text)

IF CONTEXT MENTIONS CHEMICALS (TPO, resins, photopolymers, monomers):
- Show the EQUIPMENT that uses them (3D printer, UV chamber)
- Show the PRINTED RESULTS (dental models, prosthetics)
- NEVER show the chemical containers or material packaging
`;

export const COMPOSITION_RULES = `
COMPOSITION RULES FOR 1200x630 OG IMAGE:
- Main subject occupies 35-40% of image height (ZOOM OUT effect)
- Subject positioned in CENTER-LEFT (left 2/3 of frame)
- Subtle gradient fade on right third for text overlay space
- Professional depth of field with slight background blur
- Clean, soft shadow beneath subject
- Slight vignette for focus on main subject
- No cropping of main subject

STYLE: Captured with 100mm macro lens at f/2.8, professional product photography, Unreal Engine 5 render quality with ray-traced reflections.
`;
