import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingInstruction {
  resin_id: string;
  resin_name: string;
  resin_manufacturer: string;
  resin_slug: string | null;
  resin_url: string | null;
  instructions_raw: string | null;
  instructions_parsed: {
    pre: string[];
    post: string[];
  };
  system_a_product_id: string | null;
  system_a_product_url: string | null;
}

function parseInstructions(text: string | null): { pre: string[], post: string[] } {
  if (!text) return { pre: [], post: [] };
  
  const lines = text.split('\n').filter(l => l.trim());
  const pre: string[] = [];
  const post: string[] = [];
  let section: 'pre' | 'post' | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^PRÉ[-\s]?PROCESSAMENTO/i)) {
      section = 'pre';
      continue;
    }
    if (trimmed.match(/^PÓS[-\s]?PROCESSAMENTO/i)) {
      section = 'post';
      continue;
    }
    
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      const step = trimmed.replace(/^[•\-]\s*/, '');
      if (section === 'pre') pre.push(step);
      if (section === 'post') post.push(step);
    }
  }
  
  return { pre, post };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📦 Exportando instruções de processamento...');

    const { data: resins, error } = await supabase
      .from('resins')
      .select('id, name, manufacturer, slug, processing_instructions, system_a_product_id, system_a_product_url')
      .eq('active', true)
      .not('processing_instructions', 'is', null)
      .order('name');

    if (error) throw error;

    const instructions: ProcessingInstruction[] = (resins || []).map((resin: any) => ({
      resin_id: resin.id,
      resin_name: resin.name,
      resin_manufacturer: resin.manufacturer,
      resin_slug: resin.slug,
      resin_url: resin.slug 
        ? `https://parametros.smartdent.com.br/resina/${resin.slug}` 
        : null,
      instructions_raw: resin.processing_instructions,
      instructions_parsed: parseInstructions(resin.processing_instructions),
      system_a_product_id: resin.system_a_product_id,
      system_a_product_url: resin.system_a_product_url,
    }));

    const output = {
      metadata: {
        versao: '1.0',
        ultima_atualizacao: new Date().toISOString(),
        total_resinas: instructions.length,
        fonte: 'https://parametros.smartdent.com.br'
      },
      instrucoes_uso: [
        'Este endpoint exporta apenas resinas com instruções de processamento preenchidas',
        'Campo "instructions_parsed" contém arrays estruturados de PRÉ e PÓS processamento',
        'Use "instructions_raw" para exibição textual completa',
        'Correlacione com Sistema A usando "system_a_product_id" ou "system_a_product_url"'
      ],
      instructions: instructions
    };

    console.log(`✅ Exportadas ${instructions.length} resinas com instruções`);

    return new Response(JSON.stringify(output, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
