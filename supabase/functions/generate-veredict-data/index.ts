import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keywords que indicam artigos candidatos a VeredictBox
const VEREDICT_KEYWORDS = [
  'iso', 'laudo', 'teste', 'citotoxicidade', 'biocompatibilidade',
  'toxicidade', 'certificado', 'segurança', 'mutagenicidade',
  'sorção', 'solubilidade', 'reatividade', 'bpl', 'anvisa', 'fda',
  'subcrônica', 'implante', 'intracutânea'
];

function isVeredictCandidate(title: string): boolean {
  const normalizedTitle = title.toLowerCase();
  return VEREDICT_KEYWORDS.some(keyword => normalizedTitle.includes(keyword));
}

interface VeredictData {
  productName: string;
  veredict: 'approved' | 'approved_conditionally' | 'pending';
  summary: string;
  quickFacts: Array<{ label: string; value: string }>;
  testNorms: string[];
}

async function generateVeredictWithAI(
  title: string,
  contentHtml: string,
  lovableApiKey: string
): Promise<VeredictData | null> {
  const prompt = `Analise este artigo sobre laudo/teste técnico odontológico e extraia dados estruturados.

TÍTULO: ${title}

CONTEÚDO (HTML):
${contentHtml.substring(0, 8000)}

---

EXTRAIA (em JSON):
1. productName: Nome EXATO do produto testado (ex: "Smart Print Bio Bite Splint")
2. veredict: Status do resultado:
   - "approved" = Passou em todos os testes, aprovado sem restrições
   - "approved_conditionally" = Aprovado com observações ou condições
   - "pending" = Análise em andamento ou dados inconclusivos
3. summary: Resumo de 1-2 frases do resultado técnico (máx 200 caracteres)
4. quickFacts: Array de 3-5 fatos rápidos com { label, value }:
   - Exemplos: { "label": "Norma", "value": "ISO 10993-5" }
   - Incluir: Teste realizado, Resultado, Laboratório (se mencionado), Data (se mencionada), Norma aplicada
5. testNorms: Array de normas citadas (ex: ["ISO 10993-5", "ISO 10993-10"])

REGRAS CRÍTICAS:
- Extraia APENAS dados EXPLÍCITOS no texto
- NÃO invente normas, laboratórios ou resultados
- Se não encontrar dados suficientes para um campo, use null
- Se não encontrar evidência clara de aprovação/reprovação, use "pending"
- Responda APENAS com JSON válido, sem markdown

FORMATO DE RESPOSTA:
{
  "productName": "...",
  "veredict": "approved|approved_conditionally|pending",
  "summary": "...",
  "quickFacts": [{ "label": "...", "value": "..." }],
  "testNorms": ["..."]
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um especialista em análise de laudos técnicos odontológicos. Extraia dados estruturados com precisão. Responda APENAS com JSON válido.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] Error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Clean and parse JSON
    let jsonStr = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!parsed.productName || !parsed.veredict || !parsed.summary) {
      console.warn('[AI] Incomplete veredict data:', parsed);
      return null;
    }
    
    // Ensure veredict is valid
    if (!['approved', 'approved_conditionally', 'pending'].includes(parsed.veredict)) {
      parsed.veredict = 'pending';
    }
    
    return {
      productName: parsed.productName,
      veredict: parsed.veredict,
      summary: parsed.summary.substring(0, 250),
      quickFacts: Array.isArray(parsed.quickFacts) ? parsed.quickFacts.slice(0, 6) : [],
      testNorms: Array.isArray(parsed.testNorms) ? parsed.testNorms : [],
    };
  } catch (error) {
    console.error('[AI] Parse error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId, batchProcess = false, dryRun = false } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Fetch articles to process
    let query = supabase
      .from('knowledge_contents')
      .select('id, title, content_html, veredict_data')
      .eq('active', true);
    
    if (articleId) {
      query = query.eq('id', articleId);
    } else if (batchProcess) {
      // Only fetch articles without veredict_data
      query = query.is('veredict_data', null);
    } else {
      throw new Error('Provide articleId or batchProcess: true');
    }
    
    const { data: articles, error: fetchError } = await query;
    
    if (fetchError) throw fetchError;
    
    if (!articles || articles.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No articles to process',
        processed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Filter candidates
    const candidates = articles.filter(article => isVeredictCandidate(article.title));
    
    console.log(`[VeredictGen] Found ${candidates.length} candidates out of ${articles.length} articles`);
    
    const results: Array<{
      id: string;
      title: string;
      status: 'generated' | 'skipped' | 'error';
      veredictData?: VeredictData | null;
      error?: string;
    }> = [];
    
    for (const article of candidates) {
      console.log(`[VeredictGen] Processing: ${article.title}`);
      
      if (!article.content_html) {
        results.push({
          id: article.id,
          title: article.title,
          status: 'skipped',
          error: 'No content_html',
        });
        continue;
      }
      
      try {
        const veredictData = await generateVeredictWithAI(
          article.title,
          article.content_html,
          LOVABLE_API_KEY
        );
        
        if (!veredictData) {
          results.push({
            id: article.id,
            title: article.title,
            status: 'skipped',
            error: 'AI could not extract structured data',
          });
          continue;
        }
        
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('knowledge_contents')
            .update({ veredict_data: veredictData })
            .eq('id', article.id);
          
          if (updateError) {
            results.push({
              id: article.id,
              title: article.title,
              status: 'error',
              error: updateError.message,
            });
            continue;
          }
        }
        
        results.push({
          id: article.id,
          title: article.title,
          status: 'generated',
          veredictData,
        });
        
        console.log(`[VeredictGen] ✅ ${dryRun ? '[DRY-RUN]' : ''} Generated for: ${article.title}`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`[VeredictGen] Error for ${article.title}:`, error);
        results.push({
          id: article.id,
          title: article.title,
          status: 'error',
          error: error.message,
        });
      }
    }
    
    const generated = results.filter(r => r.status === 'generated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    return new Response(JSON.stringify({
      success: true,
      dryRun,
      summary: {
        total: candidates.length,
        generated,
        skipped,
        errors,
      },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('[VeredictGen] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
