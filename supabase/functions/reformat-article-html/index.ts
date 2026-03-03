import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentId, previewOnly = false } = await req.json();

    if (!contentId) {
      throw new Error('contentId é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar artigo
    console.log(`[reformat-article-html] Buscando artigo ${contentId}...`);
    const { data: article, error: fetchError } = await supabase
      .from('knowledge_contents')
      .select('id, title, content_html, content_html_en, content_html_es, title_en, title_es')
      .eq('id', contentId)
      .single();

    if (fetchError || !article) {
      throw new Error(`Artigo não encontrado: ${fetchError?.message}`);
    }

    if (!article.content_html) {
      throw new Error('Artigo não possui content_html');
    }

    console.log(`[reformat-article-html] Artigo encontrado: "${article.title}"`);

    // Prompt para IA reformatar HTML
    const systemPrompt = `Você é um especialista em reformatar HTML mal estruturado de artigos técnicos sobre odontologia digital.

SEU TRABALHO:
1. **Detectar tabelas em texto corrido** → Converter para HTML <table> semântico
2. **Melhorar estrutura de headings** → Garantir hierarquia H2/H3/H4 lógica
3. **Preservar TODO o conteúdo original** → Não remover nada, apenas reestruturar

═══════════════════════════════════════════════════════════
🚫 REGRAS ANTI-ALUCINAÇÃO (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════════════════════

❌ NÃO adicione links que não existam no HTML original
❌ NÃO crie links internos para produtos, resinas ou equipamentos
❌ NÃO invente dados que não existam no texto original
❌ NÃO adicione conteúdo novo, apenas reorganize o existente
❌ NÃO adicione CTAs ou chamadas para ação não presentes no original

✅ Preserve TODOS os links existentes no HTML original
✅ Apenas reestruture tabelas, headings e formatação
✅ Mantenha TODO o texto original intacto

REGRAS DE FORMATAÇÃO:
- Use SEMPRE classes Tailwind para estilização
- Tabelas devem usar: <table class="w-full border-collapse my-6"><thead><tr><th class="border border-border p-3 bg-muted text-left font-semibold">...
- Headings: <h2 class="text-2xl font-bold mt-8 mb-4">...</h2>
- Se houver listas (bullets, numeradas), use <ul class="list-disc pl-6 my-4"> ou <ol>
- Preserve TODOS os parágrafos <p class="mb-4">
- Se houver URLs em texto plano (ex: https://... ou http://...) que NAO estejam dentro de uma tag <a>, converta-as em hyperlinks: <a href="URL" target="_blank" rel="noopener noreferrer" class="text-primary underline">URL</a>
- Isso NAO é "adicionar links novos" — é transformar URLs existentes no texto em HTML semântico clicável

FORMATO DE SAÍDA:
Retorne APENAS o HTML reformatado, sem explicações ou meta-comentários.`;

    // Remover code fences do Markdown que a IA pode retornar
    function stripMarkdownCodeFences(text: string): string {
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```(?:html|HTML)?\s*\n?/, '');
      cleaned = cleaned.replace(/\n?```\s*$/, '');
      return cleaned.trim();
    }

    // Pós-processamento: converter URLs em texto plano para hyperlinks
    // Negative lookbehind prevents converting URLs already inside HTML attributes (href=", src=", itemtype=", etc.)
    function convertPlainUrlsToLinks(html: string): string {
      return html.replace(
        /(?<!href="|src="|itemtype="|content="|action="|">)(https?:\/\/[^\s<>"]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>'
      );
    }

    // Helper to reformat a single HTML content
    async function reformatHtml(title: string, html: string, lang: string): Promise<string> {
      const langLabel = lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : 'Español';
      console.log(`[reformat-article-html] Reformatando ${lang} (${html.length} chars)...`);

      const userPrompt = `Reformate este HTML de artigo técnico (idioma: ${langLabel}):

TÍTULO: ${title}

HTML ORIGINAL:
${html}

Retorne o HTML reformatado seguindo todas as regras. Mantenha o idioma original do texto (${langLabel}).`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 8000,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`[reformat-article-html] Erro da IA (${lang}):`, aiResponse.status, errorText);
        if (aiResponse.status === 429) throw new Error('Rate limit excedido. Aguarde alguns minutos.');
        if (aiResponse.status === 402) throw new Error('Créditos Lovable AI esgotados.');
        throw new Error(`Erro da IA (${lang}): ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const usage = extractUsage(aiData);
      await logAIUsage({
        functionName: "reformat-article-html",
        actionLabel: `reformat-html-${lang}`,
        model: "google/gemini-2.5-flash",
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
      });
      const raw = aiData.choices?.[0]?.message?.content;
      if (!raw) throw new Error(`IA não retornou HTML (${lang})`);

      const cleaned = stripMarkdownCodeFences(raw);
      return convertPlainUrlsToLinks(cleaned);
    }

    // Build list of languages to reformat
    const tasks: { lang: string; field: string; title: string; html: string }[] = [];

    if (article.content_html) {
      tasks.push({ lang: 'pt', field: 'content_html', title: article.title, html: article.content_html });
    }
    if (article.content_html_en) {
      tasks.push({ lang: 'en', field: 'content_html_en', title: article.title_en || article.title, html: article.content_html_en });
    }
    if (article.content_html_es) {
      tasks.push({ lang: 'es', field: 'content_html_es', title: article.title_es || article.title, html: article.content_html_es });
    }

    if (tasks.length === 0) {
      throw new Error('Artigo não possui content_html em nenhum idioma');
    }

    console.log(`[reformat-article-html] Reformatando ${tasks.length} idioma(s): ${tasks.map(t => t.lang).join(', ')}`);

    // Process all languages (sequentially to avoid rate limits)
    const results: Record<string, { original: number; reformatted: number }> = {};
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };

    for (const task of tasks) {
      const reformatted = await reformatHtml(task.title, task.html, task.lang);
      updatePayload[task.field] = reformatted;
      results[task.lang] = { original: task.html.length, reformatted: reformatted.length };
      console.log(`[reformat-article-html] ✅ ${task.lang}: ${task.html.length} → ${reformatted.length} chars`);
    }

    // Preview ou salvar
    if (previewOnly) {
      console.log(`[reformat-article-html] Modo preview - não salvando`);
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        original: article.content_html,
        reformatted: updatePayload.content_html || article.content_html,
        originalSize: article.content_html?.length || 0,
        reformattedSize: (updatePayload.content_html || article.content_html)?.length || 0,
        languages: results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Salvar no banco
    console.log(`[reformat-article-html] Salvando HTML reformatado (${tasks.length} idiomas)...`);
    const { error: updateError } = await supabase
      .from('knowledge_contents')
      .update(updatePayload)
      .eq('id', contentId);

    if (updateError) {
      throw new Error(`Erro ao salvar: ${updateError.message}`);
    }

    console.log(`[reformat-article-html] ✅ Artigo atualizado com sucesso (${tasks.length} idiomas)`);

    return new Response(JSON.stringify({
      success: true,
      preview: false,
      message: `HTML reformatado e salvo com sucesso (${tasks.length} idioma(s))`,
      languages: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[reformat-article-html] Erro:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
