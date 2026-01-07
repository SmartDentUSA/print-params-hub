import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DICIONÁRIO UNIVERSAL - Mapeamento por Tipo de Documento
const documentPromptConfig: Record<string, {
  objeto_principal: string;
  ambiente: string;
  iluminacao: string;
  mood: string;
  elemento_autoridade: string;
}> = {
  'laudo': {
    objeto_principal: 'Uma coroa dentária premium com translucidez natural de zircónia',
    ambiente: 'Laboratório de metrologia odontológica com tons de cinza',
    iluminacao: 'Luz difusa',
    mood: 'Precisão científica e rigor',
    elemento_autoridade: 'Equipamento analítico desfocado ao fundo sugere testes de sorção e solubilidade'
  },
  'certificado': {
    objeto_principal: 'Um selo de certificação metálico texturizado ao lado de uma peça impressa',
    ambiente: 'Escritório de regulação clínica minimalista',
    iluminacao: 'Luz pontual (spotlight)',
    mood: 'Autoridade e conformidade',
    elemento_autoridade: 'A peça exibe um acabamento impecável validado por normas ISO'
  },
  'perfil_tecnico': {
    objeto_principal: 'Uma estrutura de dupla hélice de DNA estilizada próxima a uma restauração',
    ambiente: 'Centro de biotecnologia moderno',
    iluminacao: 'Tons azulados (#1E40AF)',
    mood: 'Segurança biológica e pureza',
    elemento_autoridade: 'O foco na suavidade da superfície destaca a biocompatibilidade do material'
  },
  'ifu': {
    objeto_principal: 'Mãos com luvas profissionais manipulando uma peça impressa em 3D',
    ambiente: 'Consultório odontológico digital',
    iluminacao: 'Luz de estúdio clara',
    mood: 'Clareza pedagógica e técnica',
    elemento_autoridade: 'A demonstração do fluxo de trabalho enfatiza a facilidade de aplicação clínica'
  },
  'fds': {
    objeto_principal: 'Elementos de segurança e frascos de resina organizados esteticamente',
    ambiente: 'Ambiente de armazenamento médico controlado',
    iluminacao: 'Luz branca limpa',
    mood: 'Proteção e responsabilidade',
    elemento_autoridade: 'Ícones de segurança e pureza do polímero são sugeridos pelo ambiente estéril'
  },
  'guia': {
    objeto_principal: 'Um modelo de arcada dentária completa com guias ou coroas encaixadas',
    ambiente: 'Bancada de trabalho de um técnico de próteses',
    iluminacao: 'Luz lateral quente',
    mood: 'Sucesso clínico e artesanato digital',
    elemento_autoridade: 'A precisão do encaixe demonstra a estabilidade dimensional do material'
  },
  'catalogo': {
    objeto_principal: 'A embalagem da resina Smart Print ao lado de peças impressas finais',
    ambiente: 'Showcase de produtos premium',
    iluminacao: 'Iluminação publicitária de alto padrão',
    mood: 'Inovação e desejo',
    elemento_autoridade: 'A estética destaca a cor Shade A2 e o acabamento de alta qualidade'
  }
};

// REGRA DE OURO - Personalização por Contexto Clínico com Lógica Combinada
function applyGoldenRule(
  config: typeof documentPromptConfig[string], 
  textContext: string, 
  productName?: string
): typeof documentPromptConfig[string] {
  const modified = { ...config };
  
  // Arrays de detecção de contexto
  const bioTestKeywords = [
    'reatividade intracutânea', 'intracutaneous', 'irritação', 'irritation',
    'sensibilização', 'sensitization', 'citotoxicidade', 'citotox',
    'biocompatibilidade', 'genotox', 'mutagênico', 'iso 10993'
  ];
  
  // Detectar contextos
  const isSplint = textContext.includes("splint") || textContext.includes("bruxismo");
  const hasBioTest = bioTestKeywords.some(k => textContext.includes(k));
  const isPermanent = textContext.includes("permanente") || textContext.includes("definitivo");
  
  // Detectar normas ISO específicas
  const hasISO10993_10 = textContext.includes('10993-10') || textContext.includes('intracutânea');
  const hasISO10993_5 = textContext.includes('10993-5') || textContext.includes('citotox');
  const hasISO10993_23 = textContext.includes('10993-23');
  
  // REGRA COMBINADA 1: Splint + Teste Biológico
  if (isSplint && hasBioTest) {
    modified.objeto_principal = `Uma placa miorrelaxante ultra-transparente impressa em 3D com clareza cristalina${productName ? ` (${productName})` : ''}`;
    modified.ambiente = 'Laboratório de biocompatibilidade com superfície azul clínica e equipamentos de teste ao fundo';
    modified.mood = 'Segurança biológica comprovada e transparência cristalina';
    
    // Elemento de autoridade específico por norma ISO
    if (hasISO10993_10 || hasISO10993_23) {
      modified.elemento_autoridade = 'Ambiente estéril de laboratório com indicadores sutis de conformidade ISO 10993-10 para testes de irritação intracutânea';
    } else if (hasISO10993_5) {
      modified.elemento_autoridade = 'Placas de cultura celular e microscópio desfocados sugerindo ensaios de citotoxicidade ISO 10993-5';
    } else {
      modified.elemento_autoridade = 'Equipamentos de laboratório de biocompatibilidade ISO 10993 sutilmente visíveis ao fundo';
    }
    return modified; // Early return para evitar sobrescrever
  }
  
  // REGRA COMBINADA 2: Dentes Permanentes + Teste Biológico
  if (isPermanent && hasBioTest) {
    modified.objeto_principal = `Uma coroa dentária premium com translucidez natural, indicada para dentes permanentes (Sistema Vitality Smart Dent)`;
    modified.ambiente = 'Laboratório de biocompatibilidade com elementos de alta estética dental';
    modified.mood = 'Durabilidade, biocompatibilidade definitiva e segurança comprovada';
    
    if (hasISO10993_5) {
      modified.elemento_autoridade = 'Células em cultura e equipamentos de citotoxicidade ao fundo demonstram a biocompatibilidade ISO 10993-5';
    } else {
      modified.elemento_autoridade = 'Equipamentos de laboratório de biocompatibilidade ISO 10993 sutilmente visíveis ao fundo';
    }
    return modified;
  }
  
  // REGRAS INDIVIDUAIS (Fallback)
  
  // Dentes Permanentes → Estética Vitality
  if (isPermanent) {
    modified.objeto_principal = `Uma coroa dentária premium com translucidez natural, indicada para dentes permanentes (Sistema Vitality Smart Dent)`;
    modified.mood = 'Durabilidade e biocompatibilidade definitiva';
  }
  
  // Splint/Bruxismo → Material transparente (sem biotest)
  if (isSplint) {
    modified.objeto_principal = `Uma placa miorrelaxante ultra-transparente impressa em 3D com clareza cristalina${productName ? ` (${productName})` : ''}`;
    modified.ambiente = 'Laboratório dental moderno com superfície azul clínica (#1E40AF)';
    modified.elemento_autoridade = 'A transparência cristalina demonstra a qualidade ótica e biocompatibilidade';
  }

  // Citotoxicidade/ISO 10993 → Laboratório científico (sem splint/permanente)
  if (hasBioTest && !isSplint && !isPermanent) {
    if (hasISO10993_10 || hasISO10993_23) {
      modified.elemento_autoridade = 'Ambiente estéril de laboratório com indicadores sutis de conformidade ISO 10993-10 para testes de irritação';
    } else if (hasISO10993_5) {
      modified.elemento_autoridade = 'Placas de cultura celular e microscópio desfocados sugerindo ensaios de citotoxicidade ISO 10993-5';
    } else {
      modified.elemento_autoridade = 'Células e equipamentos de laboratório desfocados ao fundo sugerem ensaios rigorosos de biocompatibilidade ISO 10993';
    }
  }

  return modified;
}

// Funções auxiliares para alt-text contextualizado
function extractBioTestType(text: string): string {
  if (text.includes('intracutânea') || text.includes('10993-10')) return 'reatividade intracutânea';
  if (text.includes('citotox') || text.includes('10993-5')) return 'citotoxicidade';
  if (text.includes('sensibilização')) return 'sensibilização';
  if (text.includes('irritação')) return 'irritação';
  if (text.includes('genotox')) return 'genotoxicidade';
  return 'biocompatibilidade';
}

function extractNormaISO(text: string): string {
  if (text.includes('10993-23')) return 'ISO 10993-23';
  if (text.includes('10993-10')) return 'ISO 10993-10';
  if (text.includes('10993-5')) return 'ISO 10993-5';
  if (text.includes('10993')) return 'ISO 10993';
  return '';
}

function detectBioTestContext(text: string): boolean {
  const bioTestKeywords = [
    'reatividade intracutânea', 'intracutaneous', 'irritação', 'irritation',
    'sensibilização', 'sensitization', 'citotoxicidade', 'citotox',
    'biocompatibilidade', 'genotox', 'mutagênico', 'iso 10993'
  ];
  return bioTestKeywords.some(k => text.includes(k));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { title, productName, documentType, extractedTextPreview, productImageUrl } = await req.json();

    const textContext = (extractedTextPreview || "").toLowerCase();
    const docType = documentType || 'catalogo';
    const baseConfig = documentPromptConfig[docType] || documentPromptConfig['catalogo'];
    const finalConfig = applyGoldenRule(baseConfig, textContext, productName);

    // Decidir modo de operação: EDIT (com imagem real) ou GENERATE (do zero)
    const isEditMode = !!productImageUrl;

    console.log('📸 Gerando OG Image:', { 
      title, 
      documentType: docType,
      configUsada: Object.keys(finalConfig),
      productName,
      modo: isEditMode ? 'EDIÇÃO (produto real)' : 'GERAÇÃO (do zero)',
      productImageUrl: isEditMode ? productImageUrl.substring(0, 50) + '...' : null
    });

    let response: Response;

    if (isEditMode) {
      // MODO EDIÇÃO: Transforma a imagem real do produto com ZOOM OUT
      console.log('🖼️ Modo EDIÇÃO: Usando imagem real do produto (zoom out)');
      
      const editPrompt = `ZOOM OUT COMPOSITION: Create a professional Open Graph image (1200x630 pixels) by placing this product in a wider scene.

CRITICAL INSTRUCTION - PRODUCT SIZE:
- The product from this image MUST appear at only 35-40% of the total frame HEIGHT
- Imagine stepping back 2 meters from this product to capture it in a wider shot
- The product must be REPRODUCED FAITHFULLY but SMALLER - never distorted or cropped
- If the current image shows the product filling the entire frame, SHRINK IT DOWN

DOCUMENT CONTEXT:
- Title: "${title}"
- Document type: ${documentType || 'technical document'}

SCENE SETUP:
- Place the product on ${finalConfig.ambiente}
- Lighting: ${finalConfig.iluminacao}
- Mood: ${finalConfig.mood}
- ${finalConfig.elemento_autoridade}

COMPOSITION RULES:
- Product positioned in CENTER-LEFT of the frame (left 2/3)
- Right third should have subtle gradient fade for text overlay space
- Clean shadow beneath product
- Professional depth of field with slight background blur
- Slight vignette for focus

ABSOLUTE RESTRICTIONS:
- Do NOT crop any part of the product
- Do NOT stretch or distort the product
- Do NOT add text, logos, or watermarks
- Do NOT show human faces`;

      console.log('🎨 Prompt de edição (zoom out):', editPrompt.substring(0, 250) + '...');

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
      // MODO GERAÇÃO: Detectar se é artigo conceitual/científico vs produto específico
      const textContext = `${title || ''} ${extractedTextPreview || ''}`.toLowerCase();
      
      // Lista expandida de termos científicos/conceituais
      const conceptualKeywords = [
        'evidência científica', 'evidências científicas', 'evidências', 'estudo', 'revisão',
        'artigo científico', 'pesquisa', 'análise', 'comparativo', 'norma', 'regulamentação',
        // Termos técnicos de biossegurança e química
        'tpo', 'fotoiniciador', 'biossegurança', 'pós-cura', 'pós cura', 'postcure',
        'citotoxicidade', 'biocompatibilidade', 'iso 10993', 'toxicidade', 'polimerização',
        'propriedades', 'segurança', 'monômero', 'conversão', 'grau de conversão'
      ];

      const isConceptualArticle = !productName || 
        conceptualKeywords.some(keyword => textContext.includes(keyword));

      // Se é artigo conceitual, usar imagem de conceito (sem produto fictício)
      const textBasedSubject = isConceptualArticle
        ? finalConfig.objeto_principal  // Usar dicionário genérico
        : (productName ? `${productName} dental product/material` : finalConfig.objeto_principal);

      const conceptualMode = isConceptualArticle 
        ? `\nCONCEPTUAL MODE ACTIVE: This is a scientific/educational article. Focus on dental TECHNOLOGY and EQUIPMENT, not specific products.`
        : '';

      const contextualDetails = extractedTextPreview 
        ? `Context from document: "${extractedTextPreview.substring(0, 200)}"`
        : '';

      const imagePrompt = `Professional Open Graph image for dental industry (1200x630 pixels).
${conceptualMode}

SUBJECT: ${textBasedSubject}
${title ? `DOCUMENT TITLE: "${title}"` : ''}
${contextualDetails}

Create a photorealistic scene featuring dental/medical equipment or technology relevant to the context above.

SCENE SETUP:
- Environment: ${finalConfig.ambiente}
- Lighting: ${finalConfig.iluminacao}
- Mood: ${finalConfig.mood}
- Authority element: ${finalConfig.elemento_autoridade}

COMPOSITION RULES:
- Main subject occupies 35-40% of image height
- Subject positioned in center-left (left 2/3 of frame)
- Subtle gradient fade on right third for text overlay space
- Professional depth of field with slight background blur
- Clean shadow beneath subject
- Slight vignette for focus

STYLE: Captured with 100mm macro lens at f/2.8, professional depth of field, Unreal Engine 5 render quality with ray-traced reflections.

CRITICAL ANTI-HALLUCINATION RULES - MANDATORY COMPLIANCE:
- ABSOLUTELY NO product bottles, jars, containers, or packaging of ANY kind
- ABSOLUTELY NO product labels, brand names, or fictional product designs
- ABSOLUTELY NO chemical containers, reagent bottles, or material packaging
- NEVER show products that look "for sale" - no retail-style items
- NEVER create fictional product representations

ONLY SHOW THESE ELEMENTS:
- 3D printers and post-curing/UV equipment (câmara de pós-cura)
- Dental prosthetics and models (crowns, dentures, splints, aligners)
- Laboratory equipment (UV chambers, workstations, microscopes)
- Dental tools and instruments
- Computer screens with dental software (no readable text)

IF CONTEXT MENTIONS CHEMICALS (TPO, resins, photopolymers, monomers):
- Show the EQUIPMENT that uses them (3D printer, UV chamber)
- Show the PRINTED RESULTS (dental models, prosthetics)
- NEVER show the chemical containers or material packaging

RESTRICTIONS: No text, logos, watermarks, human faces, bottles, packaging, or fictional products.`;

      console.log('🎨 Modo geração:', isConceptualArticle ? 'CONCEITUAL' : 'PRODUTO');
      console.log('🎨 Prompt de geração:', imagePrompt.substring(0, 400) + '...');

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [{ role: "user", content: imagePrompt }],
          modalities: ["image", "text"]
        })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', response.status, errorText);
      throw new Error(`Erro na API de imagem: ${response.status}`);
    }

    const data = await response.json();
    const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image) throw new Error("Nenhuma imagem gerada pela IA");

    // ALT-TEXT contextualizado baseado no conteúdo
    const fullTextContext = `${title || ''} ${extractedTextPreview || ''}`.toLowerCase();
    const hasBioTestContext = detectBioTestContext(fullTextContext);
    const isSplintContext = fullTextContext.includes("splint") || fullTextContext.includes("bruxismo");
    
    let og_image_alt: string;
    if (hasBioTestContext) {
      const bioTestType = extractBioTestType(fullTextContext);
      const normaISO = extractNormaISO(fullTextContext);
      const productType = isSplintContext ? 'placas de bruxismo' : 'aplicações odontológicas';
      og_image_alt = `Teste de ${bioTestType}${normaISO ? ` ${normaISO}` : ''} comprovando a segurança da resina ${productName || 'Smart Dent'} para ${productType}.`;
    } else if (isEditMode) {
      og_image_alt = `${productName || 'Produto'} em ambiente profissional de ${finalConfig.ambiente}. Certificação e autoridade clínica Smart Dent.`;
    } else {
      og_image_alt = `${finalConfig.objeto_principal} em ambiente de ${finalConfig.ambiente}. Certificação e autoridade clínica Smart Dent.`;
    }

    // Upload para Supabase Storage
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const imageBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageBuffer[i] = binaryString.charCodeAt(i);
    }

    const fileName = `og-${isEditMode ? 'edit' : 'gen'}-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

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

    console.log('✅ OG Image gerada:', { fileName, documentType: docType, modo: isEditMode ? 'EDIT' : 'GENERATE' });

    return new Response(JSON.stringify({
      success: true,
      og_image_url: publicUrl.publicUrl,
      og_image_alt,
      mode: isEditMode ? 'edit' : 'generate',
      prompt_used: isEditMode ? 'EDIT_MODE' : 'GENERATE_MODE'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('❌ Erro ao gerar OG:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback_suggestion: 'Use imagem padrão do catálogo'
    }), { status: 500, headers: corsHeaders });
  }
});
