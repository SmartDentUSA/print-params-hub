/**
 * reformat-article-html
 *
 * Aplica o PADRÃO ÚNICO de formatação (`_shared/article-format.ts`) no HTML do
 * artigo em todos os idiomas disponíveis e — por padrão — reescreve as FAQs com
 * as premissas de SEO + AEO (Google/AI Overview, ChatGPT, Claude, Perplexity).
 *
 * Body: { contentId, previewOnly?, force?, withFaqs? }
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { applyStandardFormatting, generateAeoFaqs } from "../_shared/article-format.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentId, previewOnly = false, force = false, withFaqs = true } = await req.json();
    if (!contentId) throw new Error('contentId é obrigatório');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: article, error: fetchError } = await supabase
      .from('knowledge_contents')
      .select('id, title, content_html, content_html_en, content_html_es, title_en, title_es, faqs, faqs_en, faqs_es, content_html_reformatted_at')
      .eq('id', contentId)
      .single();

    if (fetchError || !article) throw new Error(`Artigo não encontrado: ${fetchError?.message}`);
    if (!article.content_html) throw new Error('Artigo não possui content_html');

    if (!previewOnly && !force && (article as any).content_html_reformatted_at) {
      return new Response(JSON.stringify({
        success: true, skipped: true, reformatted_at: (article as any).content_html_reformatted_at,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tasks: { lang: string; field: string; faqField: string; title: string; html: string; faqs: any }[] = [];
    if (article.content_html) {
      tasks.push({ lang: 'pt', field: 'content_html', faqField: 'faqs', title: article.title, html: article.content_html, faqs: article.faqs });
    }
    if (article.content_html_en) {
      tasks.push({ lang: 'en', field: 'content_html_en', faqField: 'faqs_en', title: article.title_en || article.title, html: article.content_html_en, faqs: (article as any).faqs_en });
    }
    if (article.content_html_es) {
      tasks.push({ lang: 'es', field: 'content_html_es', faqField: 'faqs_es', title: article.title_es || article.title, html: article.content_html_es, faqs: (article as any).faqs_es });
    }
    if (tasks.length === 0) throw new Error('Artigo não possui content_html em nenhum idioma');

    console.log(`[reformat-article-html] "${article.title}" → ${tasks.map(t => t.lang).join(', ')} (faqs=${withFaqs})`);

    const results: Record<string, { original: number; reformatted: number; faqs: number }> = {};
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };

    for (const task of tasks) {
      const reformatted = await applyStandardFormatting({
        title: task.title, html: task.html, lang: task.lang, functionName: 'reformat-article-html',
      });
      updatePayload[task.field] = reformatted;

      let faqCount = Array.isArray(task.faqs) ? task.faqs.length : 0;
      if (withFaqs) {
        const faqs = await generateAeoFaqs({
          title: task.title,
          html: reformatted,
          lang: task.lang,
          existingFaqs: Array.isArray(task.faqs) ? task.faqs : [],
          functionName: 'reformat-article-html',
        });
        if (faqs.length) {
          updatePayload[task.faqField] = faqs;
          faqCount = faqs.length;
        }
      }

      results[task.lang] = { original: task.html.length, reformatted: reformatted.length, faqs: faqCount };
      console.log(`[reformat-article-html] ✅ ${task.lang}: ${task.html.length} → ${reformatted.length} chars, ${faqCount} FAQs`);
    }

    if (previewOnly) {
      return new Response(JSON.stringify({
        success: true, preview: true,
        original: article.content_html,
        reformatted: updatePayload.content_html || article.content_html,
        originalSize: article.content_html?.length || 0,
        reformattedSize: (updatePayload.content_html || article.content_html)?.length || 0,
        faqs: updatePayload.faqs || article.faqs || [],
        languages: results,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    updatePayload.content_html_reformatted_at = new Date().toISOString();
    if (withFaqs) updatePayload.faqs_aeo_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('knowledge_contents')
      .update(updatePayload)
      .eq('id', contentId);
    if (updateError) throw new Error(`Erro ao salvar: ${updateError.message}`);

    return new Response(JSON.stringify({
      success: true, preview: false,
      message: `HTML reformatado e FAQs atualizadas (${tasks.length} idioma(s))`,
      languages: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[reformat-article-html] Erro:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido', success: false,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
