import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParameterData {
  id: string;
  brand_slug: string;
  model_slug: string;
  brand_name: string;
  model_name: string;
  resin_name: string;
  resin_manufacturer: string;
  layer_height: number | null;
  cure_time: number | null;
  wait_time_before_cure: number | null;
  wait_time_after_cure: number | null;
  light_intensity: number | null;
  xy_adjustment_x_pct: number | null;
  xy_adjustment_y_pct: number | null;
  bottom_cure_time: number | null;
  bottom_layers: number | null;
  wait_time_after_lift: number | null;
  notes: string | null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatNumber(value: number | null, defaultValue: number = 0): string {
  return (value ?? defaultValue).toString().replace('.', ',');
}

function formatInteger(value: number | null, defaultValue: number = 0): string {
  return (value ?? defaultValue).toString();
}

function formatarResposta(param: ParameterData): string {
  const observacoes = param.notes ? `\n\n**Observações:** ${param.notes}` : '';
  
  return `Os parâmetros da Resina ${param.resin_name} para a impressora ${param.brand_name} ${param.model_name} são:

**CAMADAS NORMAIS**
Altura da camada (mm): ${formatNumber(param.layer_height, 0.05)}
Tempo de cura (seg): ${formatNumber(param.cure_time, 0)}
Espera antes da cura (s): ${formatInteger(param.wait_time_before_cure, 0)}
Espera após a cura (s): ${formatInteger(param.wait_time_after_cure, 0)}
Intensidade da luz (%): ${formatInteger(param.light_intensity, 100)}
Ajuste X (%): ${formatInteger(param.xy_adjustment_x_pct, 100)}
Ajuste Y (%): ${formatInteger(param.xy_adjustment_y_pct, 100)}

**CAMADAS INFERIORES**
Tempo de adesão (seg): ${formatNumber(param.bottom_cure_time, 0)}
Camadas base: ${formatInteger(param.bottom_layers, 5)}
Espera após elevação (s): ${formatInteger(param.wait_time_after_lift, 0)}${observacoes}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching parameters from database...');

    // Buscar parâmetros, brands e models separadamente
    const [paramsResult, brandsResult, modelsResult] = await Promise.all([
      supabase
        .from('parameter_sets')
        .select('*')
        .eq('active', true),
      supabase
        .from('brands')
        .select('slug, name')
        .eq('active', true),
      supabase
        .from('models')
        .select('slug, name')
        .eq('active', true)
    ]);

    if (paramsResult.error) {
      console.error('Database error (parameters):', paramsResult.error);
      throw paramsResult.error;
    }

    if (brandsResult.error) {
      console.error('Database error (brands):', brandsResult.error);
      throw brandsResult.error;
    }

    if (modelsResult.error) {
      console.error('Database error (models):', modelsResult.error);
      throw modelsResult.error;
    }

    const parameters = paramsResult.data;
    const brands = brandsResult.data;
    const models = modelsResult.data;

    // Criar maps para lookup rápido
    const brandMap = new Map(brands.map(b => [b.slug, b.name]));
    const modelMap = new Map(models.map(m => [m.slug, m.name]));

    console.log(`Found ${parameters?.length || 0} parameters`);

    // Coletar índices únicos
    const marcasSet = new Set<string>();
    const resinasSet = new Set<string>();
    const fabricantesSet = new Set<string>();

    // Estruturar dados
    const parametrosFormatados = parameters?.map((param: any) => {
      const brandName = brandMap.get(param.brand_slug) || 'Marca Desconhecida';
      const modelName = modelMap.get(param.model_slug) || 'Modelo Desconhecido';

      marcasSet.add(brandName);
      resinasSet.add(param.resin_name);
      fabricantesSet.add(param.resin_manufacturer);

      const paramData: ParameterData = {
        id: param.id,
        brand_slug: param.brand_slug,
        model_slug: param.model_slug,
        brand_name: brandName,
        model_name: modelName,
        resin_name: param.resin_name,
        resin_manufacturer: param.resin_manufacturer,
        layer_height: param.layer_height,
        cure_time: param.cure_time,
        wait_time_before_cure: param.wait_time_before_cure,
        wait_time_after_cure: param.wait_time_after_cure,
        light_intensity: param.light_intensity,
        xy_adjustment_x_pct: param.xy_adjustment_x_pct,
        xy_adjustment_y_pct: param.xy_adjustment_y_pct,
        bottom_cure_time: param.bottom_cure_time,
        bottom_layers: param.bottom_layers,
        wait_time_after_lift: param.wait_time_after_lift,
        notes: param.notes
      };

      return {
        id: param.id,
        marca: brandName,
        marca_normalizada: normalizeText(brandName),
        modelo: modelName,
        modelo_normalizado: normalizeText(modelName),
        resina: param.resin_name,
        resina_normalizada: normalizeText(param.resin_name),
        fabricante_resina: param.resin_manufacturer,
        
        camadas_normais: {
          altura_camada_mm: formatNumber(param.layer_height, 0.05),
          tempo_cura_seg: formatNumber(param.cure_time, 0),
          espera_antes_cura_seg: formatInteger(param.wait_time_before_cure, 0),
          espera_apos_cura_seg: formatInteger(param.wait_time_after_cure, 0),
          intensidade_luz_pct: formatInteger(param.light_intensity, 100),
          ajuste_x_pct: formatInteger(param.xy_adjustment_x_pct, 100),
          ajuste_y_pct: formatInteger(param.xy_adjustment_y_pct, 100)
        },
        
        camadas_inferiores: {
          tempo_adesao_seg: formatNumber(param.bottom_cure_time, 0),
          camadas_base: formatInteger(param.bottom_layers, 5),
          espera_apos_elevacao_seg: formatInteger(param.wait_time_after_lift, 0)
        },
        
        observacoes: param.notes,
        resposta_formatada: formatarResposta(paramData)
      };
    }) || [];

    // Montar JSON final
    const jsonOutput = {
      metadata: {
        versao: '1.0',
        ultima_atualizacao: new Date().toISOString(),
        total_parametros: parametrosFormatados.length,
        fonte: 'https://parametros.smartdent.com.br'
      },
      instrucoes_ia: {
        fluxo_conversacional: [
          '1. Identificar qual resina o cliente quer usar (ex: Vitality, Clear Guide, etc)',
          '2. Perguntar qual marca da impressora (ex: Anycubic, Elegoo, Creality)',
          '3. Perguntar qual modelo da impressora (ex: Mono X, Mars 3, etc)',
          '4. Buscar no array parametros usando campos normalizados (marca_normalizada, modelo_normalizado, resina_normalizada)',
          '5. Retornar o campo resposta_formatada do resultado encontrado'
        ],
        formato_resposta: 'Use sempre o campo resposta_formatada para apresentar ao usuário. Ele já está completamente formatado.',
        dica_busca: 'Use sempre os campos *_normalizada para busca case-insensitive e sem acentos. Exemplo: buscar por marca_normalizada === "elegoo" encontrará "Elegoo"'
      },
      parametros: parametrosFormatados,
      indices_busca: {
        marcas: Array.from(marcasSet).sort(),
        resinas: Array.from(resinasSet).sort(),
        fabricantes: Array.from(fabricantesSet).sort()
      }
    };

    console.log('JSON generated successfully');
    console.log(`Total brands: ${marcasSet.size}`);
    console.log(`Total resins: ${resinasSet.size}`);

    return new Response(JSON.stringify(jsonOutput, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error in export-parametros-ia:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Erro ao exportar parâmetros para IA'
      }), 
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
