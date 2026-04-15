import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Category UUIDs
const CAT_E = 'ff524477-c553-4518-868e-8435e16a5c57'; // Depoimentos e Cursos
const CAT_C = 'fc493982-ad8c-417f-9579-82786a97925a'; // Ciência e tecnologia
const CAT_D = '6b724172-f7c8-4a4c-bfb1-8c2ee4fc608e'; // Catálogo de Produtos

const DEPOIMENTO_KEYWORDS = [
  'depoimento', 'testimonial', 'testimonio', 'case', 'caso clínico',
  'relato', 'experiência', 'review', 'avaliação', 'curso', 'treinamento',
  'workshop', 'training', 'webinar', 'capacitação', 'certificação',
  'aula', 'palestra'
];

const PRODUCT_KEYWORDS = [
  'resina', 'cimento', 'cerâmica', 'polímero', 'monômero', 'fotopolimerizador',
  'escâner', 'scanner', 'impressora', 'printer', 'forno', 'oven', 'fresadora',
  'guia cirúrgica', 'surgical guide', 'provisório', 'coroa', 'veneer',
  'inlay', 'onlay', 'splint', 'placa', 'modelo', 'biocompatível',
  'nanohíbrida', 'flowable', 'composite', 'acrílico', 'pmma', 'peek',
  'zircônia', 'dissilicato', 'e.max', 'pós-cura', 'lavagem', 'post-cure',
  'biomaterial', 'dente', 'gengiva', 'ortodont', 'alinhador'
];

const TUTORIAL_KEYWORDS = [
  'como', 'how to', 'cómo', 'tutorial', 'passo a passo', 'step by step',
  'guia', 'guide', 'configurar', 'configure', 'calibrar', 'calibration',
  'manutenção', 'maintenance', 'dica', 'tip', 'troubleshoot', 'resolver',
  'otimizar', 'optimize', 'workflow', 'fluxo de trabalho', 'protocolo'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { dryRun = true, limit = 500 } = await req.json().catch(() => ({}));

    const { data: articles, error } = await supabase
      .from('knowledge_contents')
      .select('id, title, category_id, slug')
      .eq('category_id', CAT_E)
      .eq('active', true);

    if (error) throw error;

    const results: Array<{
      id: string;
      title: string;
      newCategory: string;
      reason: string;
    }> = [];

    let movedToC = 0;
    let movedToD = 0;
    let kept = 0;

    for (const article of articles || []) {
      const titleLower = (article.title || '').toLowerCase();

      const isDepoimento = DEPOIMENTO_KEYWORDS.some(kw => titleLower.includes(kw));
      if (isDepoimento) {
        kept++;
        continue;
      }

      const isProduct = PRODUCT_KEYWORDS.some(kw => titleLower.includes(kw));
      const isTutorial = TUTORIAL_KEYWORDS.some(kw => titleLower.includes(kw));

      let newCategoryId: string;
      let reason = '';

      if (isProduct && !isTutorial) {
        newCategoryId = CAT_D;
        reason = 'Título contém palavras-chave de produto';
        movedToD++;
      } else if (isTutorial) {
        newCategoryId = CAT_C;
        reason = 'Título contém palavras-chave de tutorial';
        movedToC++;
      } else {
        newCategoryId = CAT_D;
        reason = 'Sem palavras-chave de depoimento/curso — mover para Produtos';
        movedToD++;
      }

      results.push({
        id: article.id,
        title: article.title,
        newCategory: newCategoryId === CAT_D ? 'Catálogo de Produtos' : 'Ciência e tecnologia',
        reason,
      });

      if (!dryRun) {
        await supabase
          .from('knowledge_contents')
          .update({ category_id: newCategoryId, updated_at: new Date().toISOString() })
          .eq('id', article.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      totalInCategoryE: articles?.length || 0,
      kept,
      movedToC,
      movedToD,
      changes: results.slice(0, 200),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('fix-category-e-cleanup error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
