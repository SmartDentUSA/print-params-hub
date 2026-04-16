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
    extra_sections: Record<string, string[]>;
  };
  system_a_product_id: string | null;
  system_a_product_url: string | null;
}

function parseInstructions(text: string | null): { pre: string[], post: string[], extra_sections: Record<string, string[]> } {
  if (!text) return { pre: [], post: [], extra_sections: {} };
  
  const lines = text.split('\n').filter(l => l.trim());
  const pre: string[] = [];
  const post: string[] = [];
  const extra_sections: Record<string, string[]> = {};
  let section: 'pre' | 'post' | null = null;
  let currentExtraSection: string | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect PRÉ-PROCESSAMENTO (plain text or Markdown headers)
    if (trimmed.match(/^#{1,3}\s*(?:PRÉ|PRE)[-\s]?PROCESSAMENTO/i) ||
        trimmed.match(/^(?:PRÉ|PRE)[-\s]?PROCESSAMENTO/i)) {
      section = 'pre';
      currentExtraSection = null;
      continue;
    }
    
    // Detect PÓS-PROCESSAMENTO
    if (trimmed.match(/^#{1,3}\s*(?:PÓS|POS)[-\s]?PROCESSAMENTO/i) ||
        trimmed.match(/^(?:PÓS|POS)[-\s]?PROCESSAMENTO/i)) {
      section = 'post';
      currentExtraSection = null;
      continue;
    }
    
    // Detect extra sections like ## CALCINAÇÃO, ## SINTERIZAÇÃO
    const extraMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (extraMatch && section !== null) {
      const sectionName = extraMatch[1].trim();
      // Sub-sections (### Lavagem, ### Remoção) stay in current section
      if (trimmed.startsWith('###')) {
        // It's a subsection, keep current section, add as a step header
        const target = section === 'pre' ? pre : post;
        target.push(`[${sectionName}]`);
        continue;
      }
      // ## level headers after post = extra sections
      if (section === 'post') {
        currentExtraSection = sectionName;
        extra_sections[sectionName] = [];
        continue;
      }
    }
    
    // Extract bullet content - support •, -, *, numbered lists, and indented bullets
    const bulletMatch = trimmed.match(/^(?:[•\-\*]|\d+[.)]\s*)\s*(.*)/);
    if (bulletMatch) {
      const step = bulletMatch[1].trim();
      if (!step) continue;
      
      if (currentExtraSection) {
        extra_sections[currentExtraSection].push(step);
      } else if (section === 'pre') {
        pre.push(step);
      } else if (section === 'post') {
        post.push(step);
      }
      continue;
    }
    
    // Also capture non-bullet content lines that are meaningful (not headers)
    if (section && !trimmed.startsWith('#') && trimmed.length > 3) {
      // Check if it looks like a step (contains action words or is a sentence)
      if (trimmed.match(/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/)) {
        if (currentExtraSection) {
          extra_sections[currentExtraSection].push(trimmed);
        } else if (section === 'pre') {
          pre.push(trimmed);
        } else if (section === 'post') {
          post.push(trimmed);
        }
      }
    }
  }
  
  return { pre, post, extra_sections };
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
      .select('id, name, manufacturer, slug, processing_instructions, system_a_product_id, system_a_product_url, ai_context')
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
      ai_context: resin.ai_context || null,
      system_a_product_id: resin.system_a_product_id,
      system_a_product_url: resin.system_a_product_url,
    }));

    const output = {
      metadata: {
        versao: '2.0',
        ultima_atualizacao: new Date().toISOString(),
        total_resinas: instructions.length,
        com_instrucoes_parseadas: instructions.filter(i => i.instructions_parsed.pre.length > 0 || i.instructions_parsed.post.length > 0).length,
        fonte: 'https://parametros.smartdent.com.br'
      },
      instrucoes_uso: [
        'Este endpoint exporta apenas resinas com instruções de processamento preenchidas',
        'Campo "instructions_parsed" contém arrays estruturados de PRÉ e PÓS processamento',
        'Campo "extra_sections" contém seções adicionais como CALCINAÇÃO, SINTERIZAÇÃO',
        'Use "instructions_raw" para exibição textual completa',
        'Correlacione com Sistema A usando "system_a_product_id" ou "system_a_product_url"'
      ],
      instructions: instructions
    };

    console.log(`✅ Exportadas ${instructions.length} resinas com instruções (${output.metadata.com_instrucoes_parseadas} parseadas)`);

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
