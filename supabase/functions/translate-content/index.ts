import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, excerpt, htmlContent, faqs, targetLanguage } = await req.json();
    
    if (!targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: targetLanguage' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const languageNames: Record<string, string> = {
      'es': 'Spanish (Español)',
      'en': 'English (United States)'
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    // Prepare system prompt
    const systemPrompt = `You are a professional translator specialized in HTML content translation.

**CRITICAL RULES:**
1. Preserve ALL HTML structure exactly (tags, attributes, classes, IDs)
2. Preserve ALL links (href, src attributes) - DO NOT translate URLs
3. Preserve ALL image URLs - DO NOT change src attributes
4. Translate ONLY text content inside HTML tags
5. Maintain formatting (bold, italic, lists, etc.)
6. Return ONLY the translated HTML, no explanations

**FOR FAQs (if provided):**
- Translate both "question" and "answer" fields
- Maintain exact JSON structure: [{"question": "...", "answer": "..."}]
- Return as valid JSON array`;

    let userPrompt = `Translate the following content from Portuguese to ${targetLangName}:\n\n`;
    
    if (title) {
      userPrompt += `**TITLE:**\n${title}\n\n`;
    }
    
    if (excerpt) {
      userPrompt += `**EXCERPT (max 160 chars):**\n${excerpt}\n\n`;
    }
    
    if (htmlContent) {
      userPrompt += `**HTML CONTENT:**\n${htmlContent}\n\n`;
    }
    
    if (faqs && Array.isArray(faqs) && faqs.length > 0) {
      userPrompt += `**FAQs:**\n${JSON.stringify(faqs, null, 2)}\n\n`;
    }
    
    userPrompt += `\nReturn ONLY a JSON object in this exact format:\n{\n  "title": "translated title here",\n  "excerpt": "translated excerpt (max 160 chars)",\n  "html": "translated HTML content",\n  "faqs": [{"question": "...", "answer": "..."}]\n}`;

    console.log(`Translating to ${targetLanguage}...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent translations
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI translation failed: ${errorText}`);
    }

    const data = await response.json();
    const fullResponse = data.choices?.[0]?.message?.content || '';

    console.log('Translation completed successfully');

    // Try to parse as JSON
    let parsedResponse: any = {};
    
    // Remove markdown code fences if present
    let cleanResponse = fullResponse.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    try {
      parsedResponse = JSON.parse(cleanResponse);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      console.log('Raw response:', fullResponse);
      
      // Fallback: extract parts manually
      parsedResponse = {
        title: title || '',
        excerpt: excerpt || '',
        html: htmlContent || '',
        faqs: faqs || null
      };
    }

    return new Response(
      JSON.stringify({ 
        translatedTitle: parsedResponse.title || title || '',
        translatedExcerpt: parsedResponse.excerpt || excerpt || '',
        translatedHTML: parsedResponse.html || htmlContent || '',
        translatedFAQs: parsedResponse.faqs || faqs || null
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in translate-content function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Translation failed' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
