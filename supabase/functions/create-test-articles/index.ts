import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Creating test articles...');

    // Get available products and categories
    const { data: products } = await supabase
      .from('system_a_catalog')
      .select('id, name')
      .eq('active', true)
      .eq('approved', true)
      .limit(10);

    const { data: categories } = await supabase
      .from('knowledge_categories')
      .select('id, letter')
      .eq('enabled', true)
      .limit(3);

    if (!products || !categories || products.length === 0 || categories.length === 0) {
      throw new Error('No products or categories found');
    }

    console.log(`Found ${products.length} products and ${categories.length} categories`);

    // Create test articles
    const testArticles = [
      {
        title: 'Teste: Impressoras 3D para Odontologia',
        slug: 'teste-impressoras-3d-odontologia',
        excerpt: 'Artigo de teste para validação de link building com produtos de impressoras 3D',
        content_html: '<h2>Introdução às Impressoras 3D</h2><p>As impressoras 3D revolucionaram a odontologia moderna. Com a tecnologia de impressão tridimensional, é possível criar modelos precisos e biocompatíveis.</p><h2>Vantagens da Impressão 3D</h2><p>A impressão 3D oferece precisão, velocidade e qualidade incomparáveis. Os profissionais podem criar guias cirúrgicos, modelos de estudo e provisórios com extrema acurácia.</p><h2>Escolhendo sua Impressora</h2><p>Ao escolher uma impressora 3D para seu consultório, considere resolução, velocidade de impressão e compatibilidade com resinas. Uma boa impressora é fundamental para resultados consistentes.</p><h2>Conclusão</h2><p>Investir em tecnologia de impressão 3D é investir no futuro da odontologia.</p>',
        category_id: categories[0].id,
        order_index: 999,
        active: true,
        recommended_products: products.slice(0, 2).map(p => p.id),
        keywords: ['impressora 3d', 'odontologia digital', 'tecnologia']
      },
      {
        title: 'Teste: Resinas Compostas de Alta Performance',
        slug: 'teste-resinas-compostas-alta-performance',
        excerpt: 'Artigo de teste sobre resinas compostas para validar injeção automática de links',
        content_html: '<h2>O que são Resinas Compostas</h2><p>As resinas compostas são materiais restauradores modernos que combinam estética e funcionalidade. Elas permitem restaurações invisíveis e duradouras.</p><h2>Propriedades das Resinas</h2><p>Uma boa resina composta deve ter excelente polimento, resistência ao desgaste e estabilidade de cor. A escolha correta impacta diretamente no sucesso clínico.</p><h2>Técnicas de Aplicação</h2><p>A técnica incremental é essencial para evitar contração de polimerização. Cada camada deve ser fotopolimerizada adequadamente para garantir propriedades ótimas.</p><h2>Manutenção e Longevidade</h2><p>Com cuidados apropriados, as restaurações em resina composta podem durar muitos anos mantendo suas características estéticas.</p>',
        category_id: categories[1].id,
        order_index: 998,
        active: true,
        recommended_products: products.slice(2, 5).map(p => p.id),
        keywords: ['resina composta', 'restauração', 'estética dental']
      },
      {
        title: 'Teste: Software CAD para Laboratórios',
        slug: 'teste-software-cad-laboratorios',
        excerpt: 'Artigo de teste sobre software CAD/CAM para validação de link building',
        content_html: '<h2>Introdução ao CAD/CAM Odontológico</h2><p>O software CAD revolucionou o fluxo de trabalho em laboratórios de prótese. Com ferramentas digitais, o design de próteses se tornou mais preciso e eficiente.</p><h2>Benefícios do Workflow Digital</h2><p>O workflow digital elimina etapas manuais demoradas e reduz erros humanos. Os técnicos podem visualizar o resultado final antes da produção.</p><h2>Recursos Essenciais</h2><p>Um bom software CAD deve oferecer biblioteca de dentes, ferramentas de modelagem intuitivas e compatibilidade com scanners e impressoras. A curva de aprendizado também é importante.</p><h2>Integração com Hardware</h2><p>A integração perfeita entre software e hardware de produção garante resultados previsíveis e de alta qualidade.</p>',
        category_id: categories[2].id,
        order_index: 997,
        active: true,
        recommended_products: products.slice(5, 7).map(p => p.id),
        keywords: ['software cad', 'cadcam', 'laboratório digital']
      }
    ];

    const { data: insertedArticles, error } = await supabase
      .from('knowledge_contents')
      .insert(testArticles)
      .select('id, title, slug, recommended_products');

    if (error) {
      console.error('Error inserting articles:', error);
      throw error;
    }

    console.log(`Successfully created ${insertedArticles.length} test articles`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${insertedArticles.length} test articles`,
        articles: insertedArticles
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error:', error);
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
