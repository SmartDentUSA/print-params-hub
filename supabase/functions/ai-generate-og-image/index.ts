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

    // 1. Detecção de Contexto (Regra de Ouro)
    const textContext = (extractedTextPreview || "").toLowerCase();
    const isPermanentTeeth = textContext.includes("permanente") || textContext.includes("definitivo");
    const isBiocompatible = textContext.includes("biocompat") || textContext.includes("iso 10993") || textContext.includes("mutagenicidade");
    
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

    // 3. Prompt State-of-the-Art
    const imagePrompt = `Create a professional Open Graph image (1200x630 pixels) for a Brazilian dental industry scientific article.

RENDER QUALITY (CRITICAL):
Unreal Engine 5 render style, ray tracing, macro photography, depth of field f/2.8, clinical cleanliness.
Dental restorations must look like high-quality PMMA or Zirconia, NOT plastic.

VISUAL THEME:
Main elements: ${visualStyle}
${productName ? `Product context: "${productName}"` : ''}
${isPermanentTeeth ? "Focus on premium biocompatible dental restorations for permanent teeth with realistic translucency (Vitality style)." : ""}
${isBiocompatible ? "Emphasize laboratory certification, biocompatibility testing, scientific precision." : ""}

COLOR PALETTE:
Primary: Deep professional blue (#1E40AF)
Secondary: Clean whites and light grays
Accents: Subtle metallic silver

COMPOSITION:
- Main subject focused on LEFT 2/3 of image
- Right 1/3: subtle gradient fade for social media text overlay
- Clean negative space, professional appearance
- Slight vignette for focus

STRICT PROHIBITIONS:
- NO text, watermarks, or logos
- NO cartoonish or clipart elements
- NO plastic-looking teeth
- NO busy backgrounds
- NO human faces`;

    console.log('📸 Gerando OG Image:', { title, documentType, isPermanentTeeth, isBiocompatible });

    // 4. Chamada à API de Imagem
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

    // 5. Geração do Alt-Text otimizado para SEO
    const og_image_alt = `Renderização técnica profissional de ${productName || 'material odontológico'} - ${title}. ${isPermanentTeeth ? 'Restauração para dentes permanentes com alta biocompatibilidade.' : 'Tecnologia dental de precisão.'} Estilo: fotorrealismo clínico.`;

    // 6. Conversão base64 para buffer
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const imageBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageBuffer[i] = binaryString.charCodeAt(i);
    }

    // 7. Upload para Supabase Storage
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

    console.log('✅ OG Image gerada:', { fileName, url: publicUrl.publicUrl });

    return new Response(JSON.stringify({
      success: true,
      og_image_url: publicUrl.publicUrl,
      og_image_alt,
      prompt_used: imagePrompt.substring(0, 200) + '...'
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
