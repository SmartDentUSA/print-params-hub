import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { title, productName, documentType, category, extractedTextPreview } = await req.json();

    // 1. Detecção de Contexto Expandida (Regra de Ouro)
    const textContext = (extractedTextPreview || "").toLowerCase();
    const isPermanentTeeth = textContext.includes("permanente") || textContext.includes("definitivo");
    const isBiocompatible = textContext.includes("biocompat") || textContext.includes("iso 10993") || textContext.includes("mutagenicidade");
    
    // Detecção expandida de contexto técnico
    const isCytotoxicity = textContext.includes("citotox") || textContext.includes("iso 10993-5");
    const isSplint = textContext.includes("splint") || textContext.includes("miorrelaxante") || textContext.includes("bruxismo");
    const isClearMaterial = textContext.includes("clear") || textContext.includes("transparente") || textContext.includes("cristalino");
    const isSurgicalGuide = textContext.includes("guia cirúrgico") || textContext.includes("surgical guide") || textContext.includes("guia de implante");
    const isModel = textContext.includes("modelo") || textContext.includes("model") || textContext.includes("alinhador");
    const isCrown = textContext.includes("coroa") || textContext.includes("crown") || textContext.includes("prótese fixa");
    
    // 2. Mapeamento de estilo por tipo de documento
    const styleByType: Record<string, string> = {
      'perfil_tecnico': 'scientific laboratory, electron microscope, molecular structures',
      'fds': 'safety compliance, protective equipment, clean medical packaging',
      'ifu': 'step-by-step dental workflow, precision tools, clinical environment',
      'laudo': 'laboratory quality control, data visualization, certification seals',
      'catalogo': 'product showcase, studio lighting, neutral background',
      'guia': 'educational infographic, learning pathway',
      'certificado': 'official certification seal, quality badge'
    };
    
    const visualStyle = styleByType[documentType || ''] || 'professional dental technology, clean clinical environment';

    // 3. Mapeamento de estilo por categoria de produto
    const productCategoryStyle: Record<string, string> = {
      'splint': 'ultra-transparent 3D printed occlusal splint with crystalline clarity, night guard for bruxism, smooth biocompatible surface',
      'surgical_guide': 'precision 3D printed surgical guide with drill sleeves, dental implant planning tool, medical-grade accuracy',
      'model': 'highly detailed dental study model, orthodontic aligner mold, anatomically precise surfaces',
      'crown': 'premium dental crown with realistic ceramic/zirconia finish, lifelike translucency, permanent restoration',
      'default': 'professional dental technology, clean clinical environment'
    };

    // Determinar categoria baseado no contexto detectado
    let productCategory = 'default';
    if (isSplint) productCategory = 'splint';
    else if (isSurgicalGuide) productCategory = 'surgical_guide';
    else if (isModel) productCategory = 'model';
    else if (isCrown || isPermanentTeeth) productCategory = 'crown';

    // 4. Construir narrativa baseada no contexto detectado (Google Best Practices)
    let subjectDescription = '';
    let environmentDescription = '';
    let lightingDescription = '';
    let moodDescription = '';

    if (isSplint) {
      subjectDescription = `an ultra-transparent 3D printed occlusal splint for bruxism treatment. The splint has crystalline clarity with glass-like light refraction, showing perfect biocompatible smoothness`;
      environmentDescription = `a modern dental laboratory with a soft clinical blue surface (#1E40AF) as the backdrop`;
      lightingDescription = `soft directional studio lighting with ray-traced reflections that emphasize the material's transparency`;
      moodDescription = `medical safety, precision, and clinical purity`;
    } else if (isSurgicalGuide) {
      subjectDescription = `a precision 3D printed surgical guide for dental implant placement. The guide features visible metal drill sleeves and anatomically accurate positioning`;
      environmentDescription = `a sterile surgical preparation area with a soft blue drape`;
      lightingDescription = `bright, even clinical lighting that highlights the precision of the guide`;
      moodDescription = `surgical precision and medical-grade accuracy`;
    } else if (isCrown || isPermanentTeeth) {
      subjectDescription = `a premium dental crown with lifelike ceramic translucency and natural tooth coloring. The restoration shows realistic layered zirconia finish`;
      environmentDescription = `a high-end dental prosthetics laboratory with neutral gray tones`;
      lightingDescription = `soft diffused lighting that reveals the crown's natural translucency`;
      moodDescription = `premium craftsmanship and biocompatible permanence`;
    } else if (isModel) {
      subjectDescription = `a highly detailed 3D printed dental model with anatomically precise surfaces, showing individual teeth with perfect definition`;
      environmentDescription = `a modern orthodontic laboratory with clean white surfaces`;
      lightingDescription = `even studio lighting that reveals all surface details`;
      moodDescription = `precision and dental education`;
    } else {
      subjectDescription = `professional dental technology equipment showcasing modern 3D printed dental materials with high-quality PMMA finish`;
      environmentDescription = `a clean, professional dental technology laboratory`;
      lightingDescription = `soft, professional studio lighting`;
      moodDescription = `innovation and clinical excellence`;
    }

    // Adicionar contexto de certificação se detectado
    let certificationContext = '';
    if (isCytotoxicity || isBiocompatible) {
      certificationContext = ` In the background, subtle out-of-focus laboratory equipment suggests biocompatibility testing and ISO certification.`;
    }

    // Adicionar contexto de material transparente
    let materialContext = '';
    if (isClearMaterial) {
      materialContext = ` The material exhibits perfect crystalline transparency with visible light refraction.`;
    }

    // Prompt narrativo no formato recomendado pelo Google Gemini
    const imagePrompt = `A photorealistic macro photograph of ${subjectDescription}.${materialContext} The scene is set in ${environmentDescription}. The lighting is ${lightingDescription}, creating an atmosphere of ${moodDescription}.${certificationContext}

The composition places the main subject on the left two-thirds of the frame, with a subtle gradient fade on the right third for social media text overlay. Captured with a 100mm macro lens at f/2.8, with professional depth of field and slight vignette. The image dimensions are 1200x630 pixels in Open Graph format. The render quality matches Unreal Engine 5 standards with ray tracing and clinical cleanliness.

${productName ? `The featured product is "${productName}".` : ''}`;

    console.log('📸 Gerando OG Image:', { 
      title, 
      documentType, 
      productCategory,
      detections: {
        isPermanentTeeth, 
        isBiocompatible,
        isCytotoxicity,
        isSplint,
        isClearMaterial,
        isSurgicalGuide,
        isModel,
        isCrown
      }
    });

    // 5. Chamada à API de Imagem
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${LOVABLE_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', response.status, errorText);
      throw new Error(`Erro na API de imagem: ${response.status}`);
    }

    const data = await response.json();
    const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image) {
      throw new Error("Nenhuma imagem gerada pela IA");
    }

    // 6. Geração de Alt-Text contextualizado para SEO máximo
    let altTextProduct = '';
    if (isSplint) {
      altTextProduct = `placa miorrelaxante transparente para bruxismo`;
    } else if (isSurgicalGuide) {
      altTextProduct = `guia cirúrgico de precisão para implantes dentários`;
    } else if (isModel) {
      altTextProduct = `modelo dental de alta precisão para ortodontia`;
    } else if (isCrown || isPermanentTeeth) {
      altTextProduct = `restauração dental para dentes permanentes`;
    } else {
      altTextProduct = `tecnologia dental de precisão`;
    }

    let certificationText = '';
    if (isCytotoxicity) {
      certificationText = ` Certificação de não citotoxicidade ISO 10993-5.`;
    } else if (isBiocompatible) {
      certificationText = ` Alta biocompatibilidade certificada ISO 10993.`;
    }

    let materialText = '';
    if (isClearMaterial) {
      materialText = ` Material com transparência cristalina.`;
    }

    const og_image_alt = `Imagem técnica de ${productName || 'resina odontológica'} - ${altTextProduct}. ${title}.${certificationText}${materialText} Estilo: fotorrealismo clínico Unreal Engine 5.`;

    // 7. Conversão base64 para buffer
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const imageBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageBuffer[i] = binaryString.charCodeAt(i);
    }

    // 8. Upload para Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const fileName = `og-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

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

    console.log('✅ OG Image gerada:', { fileName, url: publicUrl.publicUrl, productCategory });

    return new Response(JSON.stringify({
      success: true,
      og_image_url: publicUrl.publicUrl,
      og_image_alt,
      productCategory,
      prompt_used: imagePrompt.substring(0, 300) + '...'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('❌ Erro ao gerar OG:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback_suggestion: 'Use imagem padrão do catálogo'
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
