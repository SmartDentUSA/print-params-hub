import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// DICIONÁRIO VISUAL EXPANDIDO POR TIPO DE DOCUMENTO
// ============================================================

interface OGVisualConfig {
  objeto_principal: string;
  ambiente: string;
  iluminacao: string;
  mood: string;
  elemento_autoridade: string;
  regra_anti_alucinacao: string;
  equipamentos_permitidos: string[];
  elementos_proibidos: string[];
}

const documentVisualDictionary: Record<string, OGVisualConfig> = {
  'guia_workflow': {
    objeto_principal: 'Fluxograma visual de processo clínico com etapas numeradas ou impressora 3D com peça sendo impressa',
    ambiente: 'Consultório odontológico moderno com impressora 3D ao fundo desfocada',
    iluminacao: 'Luz ambiente natural combinada com spots de destaque LED',
    mood: 'Clareza processual, confiança no protocolo e eficiência clínica',
    elemento_autoridade: 'Equipamentos Smart Dent (câmara UV, impressora) sutilmente visíveis',
    regra_anti_alucinacao: 'Mostrar apenas equipamentos reais e peças impressas, NUNCA frascos fictícios',
    equipamentos_permitidos: ['impressora 3D', 'câmara UV', 'computador com software dental', 'scanner intraoral'],
    elementos_proibidos: ['frascos de resina', 'embalagens de produto', 'logos', 'texto legível']
  },
  'laudo': {
    objeto_principal: 'Equipamento de laboratório metrológico com peça dental sendo analisada',
    ambiente: 'Laboratório de metrologia certificado com tons neutros e superfícies limpas',
    iluminacao: 'Luz difusa científica sem sombras duras',
    mood: 'Precisão absoluta, rigor científico e imparcialidade',
    elemento_autoridade: 'Equipamento analítico (microscópio, espectrofotômetro, durômetro) parcialmente visível',
    regra_anti_alucinacao: 'NUNCA gerar gráficos com dados fictícios - mostrar EQUIPAMENTOS de teste',
    equipamentos_permitidos: ['microscópio', 'espectrofotômetro', 'durômetro', 'balança analítica'],
    elementos_proibidos: ['gráficos com números', 'tabelas de dados', 'resultados numéricos']
  },
  'catalogo': {
    objeto_principal: 'Produto real com peças impressas demonstrando aplicações finais',
    ambiente: 'Showcase premium com gradiente escuro para claro, superfície reflexiva',
    iluminacao: 'Iluminação publicitária de alto padrão (3-point lighting)',
    mood: 'Desejo, inovação premium e qualidade excepcional',
    elemento_autoridade: 'Peças impressas finais demonstrando acabamento perfeito',
    regra_anti_alucinacao: 'OBRIGATÓRIO usar modo EDIT com imagem real do produto',
    equipamentos_permitidos: ['peças impressas reais', 'modelos dentários', 'coroas', 'próteses'],
    elementos_proibidos: ['embalagens fictícias', 'frascos inventados', 'logos criados']
  },
  'ifu': {
    objeto_principal: 'Mãos profissionais com luvas manipulando peça impressa em 3D',
    ambiente: 'Bancada de trabalho organizada com ferramentas e equipamentos profissionais',
    iluminacao: 'Luz de estúdio clara e direta com sombras suaves',
    mood: 'Didático, acessível, técnico e profissional',
    elemento_autoridade: 'Tablet ou manual impresso sutilmente visível',
    regra_anti_alucinacao: 'Foco em AÇÃO e PROCESSO, NUNCA no produto embalado',
    equipamentos_permitidos: ['mãos com luvas', 'ferramentas dentais', 'peças impressas', 'câmara UV'],
    elementos_proibidos: ['embalagens', 'frascos', 'rostos', 'texto legível']
  },
  'fds': {
    objeto_principal: 'EPIs profissionais (luvas nitrílicas, óculos de proteção) em ambiente controlado',
    ambiente: 'Área de armazenamento médico com prateleiras organizadas',
    iluminacao: 'Luz branca limpa e estéril',
    mood: 'Proteção, responsabilidade, conformidade e segurança ocupacional',
    elemento_autoridade: 'Símbolos de segurança química (GHS) sutilmente visíveis',
    regra_anti_alucinacao: 'NUNCA mostrar produto sendo derramado ou em situação de risco',
    equipamentos_permitidos: ['luvas', 'óculos de proteção', 'jaleco', 'capela de exaustão'],
    elementos_proibidos: ['acidentes', 'derramamentos', 'situações perigosas', 'frascos abertos']
  },
  'perfil_tecnico': {
    objeto_principal: 'Representação visual de biocompatibilidade - células em cultura ou microscópio',
    ambiente: 'Centro de biotecnologia moderno com equipamentos de ponta',
    iluminacao: 'Tons azulados científicos (#1E40AF) com iluminação fria',
    mood: 'Segurança biológica comprovada, pureza e confiança científica',
    elemento_autoridade: 'Placas de petri, microscópio ou câmara de cultura celular',
    regra_anti_alucinacao: 'Para testes ISO 10993, NUNCA inventar resultados visuais',
    equipamentos_permitidos: ['microscópio', 'placas de petri', 'câmara de cultura', 'pipetas'],
    elementos_proibidos: ['gráficos fictícios', 'números de certificação', 'frascos de resina']
  },
  'manual_tecnico': {
    objeto_principal: 'Equipamento (impressora 3D ou câmara UV) em vista detalhada',
    ambiente: 'Oficina técnica profissional ou laboratório de manutenção',
    iluminacao: 'Luz técnica com destaques pontuais em componentes',
    mood: 'Expertise técnica, suporte profissional e conhecimento',
    elemento_autoridade: 'Ferramentas de manutenção e calibração sutilmente visíveis',
    regra_anti_alucinacao: 'Mostrar equipamentos reais, NUNCA inventar modelos',
    equipamentos_permitidos: ['impressora 3D', 'câmara UV', 'ferramentas de calibração', 'multímetro'],
    elementos_proibidos: ['modelos inventados', 'marcas fictícias', 'texto técnico legível']
  },
  'certificado': {
    objeto_principal: 'Selo metálico 3D texturizado (ouro/prata) com detalhes de qualidade',
    ambiente: 'Fundo gradient escuro para claro com vinheta elegante',
    iluminacao: 'Spotlight dramático focado no selo com reflexos suaves',
    mood: 'Autoridade absoluta, conformidade regulatória e credibilidade',
    elemento_autoridade: 'Peça impressa certificada ao lado do selo',
    regra_anti_alucinacao: 'NUNCA inventar números de certificado ou datas',
    equipamentos_permitidos: ['selo metálico abstrato', 'peças impressas', 'ribbon elegante'],
    elementos_proibidos: ['números de certificado', 'datas específicas', 'logos fictícios', 'texto']
  },
  'guia': {
    objeto_principal: 'Modelo de arcada dentária com guias cirúrgicos ou coroas encaixadas',
    ambiente: 'Bancada de trabalho de técnico de próteses dental',
    iluminacao: 'Luz lateral quente combinada com foco superior',
    mood: 'Sucesso clínico, artesanato digital e precisão',
    elemento_autoridade: 'Precisão do encaixe demonstra estabilidade dimensional',
    regra_anti_alucinacao: 'Mostrar PEÇAS FINAIS em uso, não produtos embalados',
    equipamentos_permitidos: ['modelos dentários', 'articulador', 'guias cirúrgicos', 'coroas'],
    elementos_proibidos: ['embalagens', 'frascos', 'preços', 'texto promocional']
  },
  'outro': {
    objeto_principal: 'Impressora 3D dental profissional com peça sendo impressa',
    ambiente: 'Laboratório dental digital moderno e organizado',
    iluminacao: 'Iluminação profissional balanceada',
    mood: 'Inovação tecnológica e qualidade profissional',
    elemento_autoridade: 'Equipamentos de alta tecnologia sutilmente visíveis',
    regra_anti_alucinacao: 'Mostrar TECNOLOGIA e RESULTADOS, nunca produtos embalados',
    equipamentos_permitidos: ['impressora 3D', 'câmara UV', 'scanner', 'computador', 'peças'],
    elementos_proibidos: ['embalagens', 'frascos', 'logos', 'texto', 'rostos']
  }
};

// ============================================================
// REGRAS DE OURO - CONTEXTOS CLÍNICOS ESPECIAIS
// ============================================================

interface GoldenRule {
  keywords: string[];
  override: Partial<OGVisualConfig>;
  priority: number;
}

const goldenRules: GoldenRule[] = [
  {
    keywords: ['splint', 'bruxismo', 'miorrelaxante', 'bite', 'oclusão'],
    override: {
      objeto_principal: 'Placa miorrelaxante ultra-transparente impressa em 3D com clareza cristalina',
      ambiente: 'Laboratório dental com superfície azul clínica (#1E40AF)',
      mood: 'Transparência cristalina, conforto e precisão de encaixe'
    },
    priority: 80
  },
  {
    keywords: ['permanente', 'definitivo', 'vitality', 'longo prazo'],
    override: {
      objeto_principal: 'Coroa dentária premium com translucidez natural de zircônia',
      ambiente: 'Laboratório de estética dental com iluminação de alta fidelidade',
      mood: 'Durabilidade definitiva, estética natural e biocompatibilidade'
    },
    priority: 70
  },
  {
    keywords: ['10993-5', 'citotox', 'citotoxicidade'],
    override: {
      ambiente: 'Laboratório de cultura celular com equipamentos de biotecnologia',
      elemento_autoridade: 'Placas de cultura celular e microscópio invertido sugerindo ensaios ISO 10993-5'
    },
    priority: 90
  },
  {
    keywords: ['10993-10', 'intracutânea', 'irritação'],
    override: {
      ambiente: 'Laboratório de testes in vivo com ambiente estéril',
      elemento_autoridade: 'Ambiente controlado com indicadores de conformidade ISO 10993-10'
    },
    priority: 90
  },
  {
    keywords: ['10993-23', 'sensibilização'],
    override: {
      ambiente: 'Laboratório de imunologia e testes de sensibilização',
      elemento_autoridade: 'Equipamentos de teste imunológico ISO 10993-23'
    },
    priority: 90
  },
  {
    keywords: ['guia cirúrgico', 'surgical guide', 'implante', 'cirurgia guiada'],
    override: {
      objeto_principal: 'Guia cirúrgico transparente sobre modelo de arcada com implantes',
      ambiente: 'Centro cirúrgico odontológico ou sala de planejamento digital',
      mood: 'Precisão milimétrica, segurança cirúrgica e planejamento digital'
    },
    priority: 75
  },
  {
    keywords: ['alinhador', 'ortodontia', 'clear aligner', 'movimentação'],
    override: {
      objeto_principal: 'Alinhador transparente de precisão sobre modelo dental',
      ambiente: 'Clínica de ortodontia digital moderna',
      mood: 'Estética, precisão de movimento e inovação ortodôntica'
    },
    priority: 75
  }
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function getBaseConfig(documentType: string): OGVisualConfig {
  return documentVisualDictionary[documentType] || documentVisualDictionary['outro'];
}

function applyGoldenRules(
  baseConfig: OGVisualConfig,
  textContext: string,
  productName?: string
): OGVisualConfig {
  const lowerContext = textContext.toLowerCase();
  const modified = { ...baseConfig };

  const applicableRules = goldenRules
    .filter(rule => rule.keywords.some(k => lowerContext.includes(k.toLowerCase())))
    .sort((a, b) => b.priority - a.priority);

  for (const rule of applicableRules) {
    Object.assign(modified, rule.override);
  }

  if (productName && modified.objeto_principal) {
    modified.objeto_principal = `${modified.objeto_principal} (${productName})`;
  }

  return modified;
}

type GenerationMode = 'EDIT' | 'EQUIPMENT' | 'CONCEPTUAL' | 'GENERATE';

function detectGenerationMode(
  productImageUrl?: string,
  textContext?: string,
  productName?: string
): GenerationMode {
  if (productImageUrl) return 'EDIT';

  const lowerContext = (textContext || '').toLowerCase();

  const equipmentKeywords = ['impressora', 'printer', 'câmara uv', 'uv chamber', 'pós-cura', 'postcure', 'scanner'];
  if (equipmentKeywords.some(k => lowerContext.includes(k)) && !productName) {
    return 'EQUIPMENT';
  }

  const conceptualKeywords = [
    'evidência científica', 'evidências', 'estudo', 'revisão', 'artigo científico',
    'pesquisa', 'análise comparativa', 'norma técnica', 'regulamentação',
    'tpo', 'fotoiniciador', 'biossegurança', 'pós-cura', 'polimerização',
    'propriedades mecânicas', 'monômero', 'conversão', 'grau de conversão'
  ];
  if (!productName && conceptualKeywords.some(k => lowerContext.includes(k))) {
    return 'CONCEPTUAL';
  }

  return 'GENERATE';
}

function extractNormaISO(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('10993-23')) return 'ISO 10993-23';
  if (lowerText.includes('10993-10')) return 'ISO 10993-10';
  if (lowerText.includes('10993-5')) return 'ISO 10993-5';
  if (lowerText.includes('10993')) return 'ISO 10993';
  if (lowerText.includes('4049')) return 'ISO 4049';
  if (lowerText.includes('10477')) return 'ISO 10477';
  return '';
}

function detectBioTestType(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('citotox')) return 'citotoxicidade';
  if (lowerText.includes('intracutânea')) return 'reatividade intracutânea';
  if (lowerText.includes('sensibilização')) return 'sensibilização';
  if (lowerText.includes('irritação')) return 'irritação';
  if (lowerText.includes('genotox')) return 'genotoxicidade';
  if (lowerText.includes('biocompat')) return 'biocompatibilidade';
  return '';
}

function generateSEOAltText(
  config: OGVisualConfig,
  textContext: string,
  productName?: string,
  mode?: GenerationMode
): string {
  const iso = extractNormaISO(textContext);
  const bioTestType = detectBioTestType(textContext);
  const brand = 'Smart Dent Odontologia Digital';

  if (bioTestType && iso) {
    return `Teste de ${bioTestType} ${iso} demonstrando a segurança de ${productName || 'resina Smart Dent'} para aplicações odontológicas.`;
  }
  
  if (iso) {
    return `${config.objeto_principal} em conformidade com ${iso}. ${brand}.`;
  }

  if (mode === 'EDIT' && productName) {
    return `${productName} em ambiente profissional de ${config.ambiente}. ${brand}.`;
  }

  return `${config.objeto_principal} em ${config.ambiente}. ${brand}.`;
}

// ============================================================
// REGRAS ANTI-ALUCINAÇÃO GLOBAIS
// ============================================================

const GLOBAL_ANTI_HALLUCINATION = `
CRITICAL ANTI-HALLUCINATION RULES - MANDATORY COMPLIANCE:

ABSOLUTELY PROHIBITED (NEVER generate these):
- Product bottles, jars, containers, or packaging of ANY kind
- Product labels, brand names, or fictional product designs  
- Chemical containers, reagent bottles, or material packaging
- Products that look "for sale" or retail-style items
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

IF CONTEXT MENTIONS CHEMICALS (TPO, resins, photopolymers, monomers):
- Show the EQUIPMENT that uses them (3D printer, UV chamber)
- Show the PRINTED RESULTS (dental models, prosthetics)
- NEVER show the chemical containers or material packaging
`;

const COMPOSITION_RULES = `
COMPOSITION FOR 1200x630 OG IMAGE:
┌─────────────────────────────────────────────┐
│  20% TOP MARGIN (empty/gradient background) │
├─────────────────────────────────────────────┤
│                                             │
│   [PRODUCT]           [EMPTY RIGHT 1/3]     │
│   MAX 40% height      for text overlays     │
│   LEFT 2/3                                  │
│                                             │
├─────────────────────────────────────────────┤
│  20% BOTTOM MARGIN (surface/shadow)         │
└─────────────────────────────────────────────┘

- Subject at MAX 35-40% of frame HEIGHT (ZOOM OUT effect)
- MANDATORY: 20% empty space ABOVE and BELOW the subject
- Subject in CENTER-LEFT (left 2/3 of frame)
- Subtle gradient fade on right third for text overlay
- Professional depth of field with slight background blur
- Clean, soft shadow beneath subject

STYLE: 100mm macro lens at f/2.8, Unreal Engine 5 render quality.
`;

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { title, productName, documentType, extractedTextPreview, productImageUrl } = await req.json();

    const textContext = `${title || ''} ${extractedTextPreview || ''}`.toLowerCase();
    const docType = documentType || 'outro';
    
    // Obter configuração base e aplicar regras de ouro
    const baseConfig = getBaseConfig(docType);
    const finalConfig = applyGoldenRules(baseConfig, textContext, productName);
    
    // Detectar modo de geração
    const mode = detectGenerationMode(productImageUrl, textContext, productName);

    console.log('📸 Gerando OG Image:', { 
      title: title?.substring(0, 50),
      documentType: docType,
      productName,
      modo: mode,
      hasProductImage: !!productImageUrl
    });

    let response: Response;

    if (mode === 'EDIT') {
      // ========================================
      // MODO EDIÇÃO: Transforma imagem real com ZOOM OUT
      // ========================================
      console.log('🖼️ Modo EDIT: Usando imagem real do produto');
      
      const editPrompt = `=== HIGHEST PRIORITY - PRODUCT INTEGRITY ===
THE PRODUCT BOTTLE MUST BE 100% VISIBLE - ABSOLUTELY NO CROPPING.

CRITICAL SIZE REQUIREMENTS:
- Product MUST occupy MAXIMUM 40% of frame HEIGHT
- Leave 20% EMPTY SPACE above the product (top margin)
- Leave 20% EMPTY SPACE below the product (bottom margin)
- Product positioned in LEFT HALF of the frame, centered vertically
- The product should look like a SMALL item on a LARGE professional surface

CANVAS LAYOUT (1200x630 pixels):
┌─────────────────────────────────────────────┐
│  20% TOP MARGIN (blurred/gradient bg)       │
├─────────────────────────────────────────────┤
│                                             │
│   [PRODUCT]           [EMPTY RIGHT 1/3]     │
│   40% height MAX      for social overlays   │
│   Left-center                               │
│                                             │
├─────────────────────────────────────────────┤
│  20% BOTTOM MARGIN (surface/shadow)         │
└─────────────────────────────────────────────┘

ENVIRONMENT:
- Surface: ${finalConfig.ambiente}
- Lighting: ${finalConfig.iluminacao}
- Mood: ${finalConfig.mood}
- Background: Subtle gradient fade, professional blur

DOCUMENT CONTEXT: "${title || 'Technical Document'}"

STYLE: 100mm macro lens, f/2.8, photorealistic, Unreal Engine 5 render quality.

=== ABSOLUTE RESTRICTIONS ===
- NEVER crop the product - show it 100% COMPLETE from bottom to top cap
- NEVER distort product proportions
- NEVER add text, logos, or watermarks
- NEVER show human faces
- Keep product EXACT as original but rendered SMALLER in frame
${finalConfig.regra_anti_alucinacao}`;

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: productImageUrl } }
            ]
          }],
          modalities: ["image", "text"]
        })
      });
    } else {
      // ========================================
      // MODO GERAÇÃO: Criar imagem do zero
      // ========================================
      console.log(`🎨 Modo ${mode}: Gerando imagem do zero`);

      const modeInstruction = mode === 'CONCEPTUAL' 
        ? '\nCONCEPTUAL MODE: This is a scientific/educational article. Focus on dental TECHNOLOGY and EQUIPMENT, not specific products.'
        : mode === 'EQUIPMENT'
        ? '\nEQUIPMENT MODE: Focus on 3D printing and post-curing equipment. No product containers.'
        : '';

      const generatePrompt = `Professional Open Graph image for dental industry (1200x630 pixels).
${modeInstruction}

SUBJECT: ${finalConfig.objeto_principal}
TITLE: "${title || 'Technical Document'}"

SCENE:
- Environment: ${finalConfig.ambiente}
- Lighting: ${finalConfig.iluminacao}
- Mood: ${finalConfig.mood}
- Authority: ${finalConfig.elemento_autoridade}

ALLOWED ELEMENTS: ${finalConfig.equipamentos_permitidos.join(', ')}
PROHIBITED: ${finalConfig.elementos_proibidos.join(', ')}

${COMPOSITION_RULES}

${GLOBAL_ANTI_HALLUCINATION}

${finalConfig.regra_anti_alucinacao}`;

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [{ role: "user", content: generatePrompt }],
          modalities: ["image", "text"]
        })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da API:', response.status, errorText);
      throw new Error(`Erro na API de imagem: ${response.status}`);
    }

    const data = await response.json();
    const usage = extractUsage(data);
    await logAIUsage({
      functionName: "ai-generate-og-image",
      actionLabel: mode === 'EDIT' ? "edit-og-image" : "generate-og-image",
      model: "google/gemini-2.5-flash-image-preview",
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    });
    const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image) throw new Error("Nenhuma imagem gerada pela IA");

    // Gerar alt-text otimizado para SEO
    const og_image_alt = generateSEOAltText(finalConfig, textContext, productName, mode);

    // Upload para Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const imageBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageBuffer[i] = binaryString.charCodeAt(i);
    }

    const fileName = `og-${mode.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    const { error: uploadError } = await supabase.storage
      .from('knowledge-images')
      .upload(`og-images/${fileName}`, imageBuffer, { 
        contentType: 'image/png',
        cacheControl: '31536000'
      });

    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage
      .from('knowledge-images')
      .getPublicUrl(`og-images/${fileName}`);

    console.log('✅ OG Image gerada:', { 
      fileName, 
      documentType: docType, 
      modo: mode,
      altText: og_image_alt.substring(0, 50) + '...'
    });

    return new Response(JSON.stringify({
      success: true,
      og_image_url: publicUrl.publicUrl,
      og_image_alt,
      mode,
      config_used: {
        documento: docType,
        objeto: finalConfig.objeto_principal.substring(0, 50),
        ambiente: finalConfig.ambiente.substring(0, 50)
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('❌ Erro ao gerar OG:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback_suggestion: 'Use imagem padrão do catálogo'
    }), { status: 500, headers: corsHeaders });
  }
});
