import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * fix-category-e-cleanup
 * 
 * Audits category E (Depoimentos e Cursos) articles and reclassifies
 * off-topic articles to the correct category.
 * 
 * Heuristics:
 * - If title matches resins/materials → category D (Produtos)
 * - If title matches tutorial/how-to → category C (Tutoriais)
 * - Otherwise keeps in E
 * 
 * POST body: { dryRun?: boolean }
 */

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

    const { dryRun = true } = await req.json().catch(() => ({}));

    // Fetch all category E articles
    const { data: articles, error } = await supabase
      .from('knowledge_contents')
      .select('id, title, category, slug')
      .eq('category', 'E')
      .eq('active', true);

    if (error) throw error;

    const results: Array<{
      id: string;
      title: string;
      currentCategory: string;
      newCategory: string | null;
      reason: string;
    }> = [];

    let movedToC = 0;
    let movedToD = 0;
    let kept = 0;

    for (const article of articles || []) {
      const titleLower = (article.title || '').toLowerCase();

      // Check if it's a real depoimento/curso
      const isDepoimento = DEPOIMENTO_KEYWORDS.some(kw => titleLower.includes(kw));
      if (isDepoimento) {
        kept++;
        continue;
      }

      // Classify: product or tutorial?
      const isProduct = PRODUCT_KEYWORDS.some(kw => titleLower.includes(kw));
      const isTutorial = TUTORIAL_KEYWORDS.some(kw => titleLower.includes(kw));

      let newCategory: string | null = null;
      let reason = '';

      if (isProduct && !isTutorial) {
        newCategory = 'D';
        reason = 'Título contém palavras-chave de produto';
        movedToD++;
      } else if (isTutorial) {
        newCategory = 'C';
        reason = 'Título contém palavras-chave de tutorial';
        movedToC++;
      } else {
        // Default: move generic non-depoimento to D
        newCategory = 'D';
        reason = 'Sem palavras-chave de depoimento/curso — mover para Produtos';
        movedToD++;
      }

      results.push({
        id: article.id,
        title: article.title,
        currentCategory: 'E',
        newCategory,
        reason,
      });

      if (!dryRun && newCategory) {
        await supabase
          .from('knowledge_contents')
          .update({ category: newCategory, updated_at: new Date().toISOString() })
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
