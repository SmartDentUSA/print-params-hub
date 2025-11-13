import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParameterSet {
  id: string;
  brand_slug: string;
  model_slug: string;
  resin_name: string;
  resin_manufacturer: string;
  layer_height: number;
  cure_time: number;
  light_intensity: number;
  bottom_layers: number;
  bottom_cure_time: number;
  lift_distance: number;
  lift_speed: number;
  retract_speed: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching Category F...');
    const { data: categoryF, error: catError } = await supabase
      .from('knowledge_categories')
      .select('id')
      .eq('letter', 'F')
      .single();

    if (catError || !categoryF) {
      throw new Error('Category F not found');
    }

    console.log('Fetching active parameter sets...');
    const { data: parameterSets, error: paramsError } = await supabase
      .from('parameter_sets')
      .select('*')
      .eq('active', true)
      .order('brand_slug', { ascending: true })
      .order('model_slug', { ascending: true });

    if (paramsError) throw paramsError;

    console.log(`Found ${parameterSets?.length || 0} parameter sets`);

    const contentsToInsert = [];
    const slugMap = new Map(); // Track unique slugs
    
    for (const params of parameterSets || []) {
      // Normalize slug generation
      const normalizeSlug = (text: string) => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
          .replace(/\s+/g, '-') // Substitui espaços por hífens
          .replace(/-+/g, '-') // Remove hífens duplicados
          .trim();
      };
      
      const baseSlug = `parametros-${normalizeSlug(params.brand_slug)}-${normalizeSlug(params.model_slug)}-${normalizeSlug(params.resin_manufacturer)}-${normalizeSlug(params.resin_name)}`;
      
      // Handle duplicate slugs by appending parameter ID
      let slug = baseSlug;
      if (slugMap.has(slug)) {
        slug = `${baseSlug}-${params.id.substring(0, 8)}`;
      }
      slugMap.set(slug, true);
      
      const title = `Parâmetros ${params.brand_slug} ${params.model_slug} - ${params.resin_manufacturer} ${params.resin_name}`;
      
      const excerpt = `Configuração técnica validada: Layer ${params.layer_height}mm, Tempo ${params.cure_time}s, Intensidade ${params.light_intensity}%`;
      
      // AI Context para mecanismos de busca generativa
      const aiContext = `This technical article provides validated 3D printing parameters for ${params.brand_slug} ${params.model_slug} printer using ${params.resin_manufacturer} ${params.resin_name} resin. Key specifications: Layer height ${params.layer_height}mm, Cure time ${params.cure_time}s, Light intensity ${params.light_intensity}%, Bottom layers ${params.bottom_layers}, Bottom cure time ${params.bottom_cure_time}s, Lift distance ${params.lift_distance}mm, Lift speed ${params.lift_speed}mm/min, Retract speed ${params.retract_speed}mm/min. Intended for dental professionals and advanced 3D printing users. Parameters tested in controlled environment.`;
      
      const faqs = [
        {
          question: `Qual o tempo de exposição inicial ideal para ${params.brand_slug} ${params.model_slug} com ${params.resin_manufacturer} ${params.resin_name}?`,
          answer: `O tempo de exposição inicial recomendado é ${params.bottom_cure_time}s para as primeiras ${params.bottom_layers} camadas, garantindo aderência adequada à plataforma.`
        },
        {
          question: `Quantas camadas de queima são recomendadas?`,
          answer: `São recomendadas ${params.bottom_layers} camadas de queima inicial com tempo de ${params.bottom_cure_time}s cada.`
        },
        {
          question: `Qual o lift speed ideal para impressões de ${params.layer_height}mm?`,
          answer: `A velocidade de lift recomendada é ${params.lift_speed}mm/min, com velocidade de retração de ${params.retract_speed}mm/min.`
        },
        {
          question: `Qual a intensidade de luz recomendada?`,
          answer: `A intensidade de luz ideal é ${params.light_intensity}%, com tempo de exposição normal de ${params.cure_time}s por camada de ${params.layer_height}mm.`
        }
      ];

      const contentHtml = `
        <div class="technical-parameters" itemscope itemtype="https://schema.org/TechArticle">
          <div class="warning-banner">
            <p><strong>⚙️ Conteúdo Técnico Avançado</strong></p>
            <p>Este conteúdo é destinado a usuários experientes em impressão 3D odontológica. Os parâmetros aqui apresentados foram validados em ambiente controlado.</p>
          </div>

          <h2>Especificações Técnicas</h2>
          <table class="parameters-table">
            <tr>
              <td><strong>Impressora:</strong></td>
              <td>
                <span itemprop="mentions" itemscope itemtype="https://schema.org/Product">
                  <span itemprop="name">${params.brand_slug} ${params.model_slug}</span>
                </span>
              </td>
            </tr>
            <tr>
              <td><strong>Resina:</strong></td>
              <td>
                <span itemprop="mentions" itemscope itemtype="https://schema.org/Product">
                  <span itemprop="manufacturer">${params.resin_manufacturer}</span>
                  <span itemprop="name">${params.resin_name}</span>
                </span>
              </td>
            </tr>
            <tr><td><strong>Altura da Camada:</strong></td><td>${params.layer_height}mm</td></tr>
            <tr><td><strong>Tempo de Cura Normal:</strong></td><td>${params.cure_time}s</td></tr>
            <tr><td><strong>Intensidade de Luz:</strong></td><td>${params.light_intensity}%</td></tr>
          </table>

          <h3>Configurações de Camadas Iniciais</h3>
          <table class="parameters-table">
            <tr><td><strong>Número de Camadas:</strong></td><td>${params.bottom_layers}</td></tr>
            <tr><td><strong>Tempo de Cura Inicial:</strong></td><td>${params.bottom_cure_time}s</td></tr>
          </table>

          <h3>Configurações de Movimento</h3>
          <table class="parameters-table">
            <tr><td><strong>Distância de Lift:</strong></td><td>${params.lift_distance}mm</td></tr>
            <tr><td><strong>Velocidade de Lift:</strong></td><td>${params.lift_speed}mm/min</td></tr>
            <tr><td><strong>Velocidade de Retração:</strong></td><td>${params.retract_speed}mm/min</td></tr>
          </table>

          ${params.notes ? `
            <h3>Observações</h3>
            <p>${params.notes}</p>
          ` : ''}

          <div class="disclaimer">
            <p><strong>Disclaimer:</strong> Estes parâmetros são sugestões baseadas em testes. Ajustes podem ser necessários conforme seu ambiente e material específico.</p>
          </div>
        </div>
      `;

      const keywords = [
        params.brand_slug,
        params.model_slug,
        params.resin_manufacturer,
        params.resin_name,
        `${params.layer_height}mm`,
        'parâmetros técnicos',
        'impressão 3D',
        'odontologia',
        'configuração de impressora'
      ];

      contentsToInsert.push({
        category_id: categoryF.id,
        title,
        slug,
        excerpt,
        content_html: contentHtml,
        faqs,
        keywords,
        meta_description: excerpt,
        active: true,
        order_index: contentsToInsert.length,
        ai_context: aiContext,
        og_image_url: null, // Pode ser adicionado posteriormente com imagem da impressora/resina
        content_image_url: null // Pode ser adicionado posteriormente
      });
    }

    console.log(`Inserting ${contentsToInsert.length} technical parameter pages...`);

    // Deletar conteúdos antigos da categoria F
    await supabase
      .from('knowledge_contents')
      .delete()
      .eq('category_id', categoryF.id);

    // Inserir novos conteúdos
    const { data: inserted, error: insertError } = await supabase
      .from('knowledge_contents')
      .insert(contentsToInsert)
      .select();

    if (insertError) throw insertError;

    console.log(`Successfully created ${inserted?.length || 0} technical parameter pages`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully generated ${inserted?.length || 0} technical parameter pages`,
        pages: inserted?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating parameter pages:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
