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
    const { htmlContent, faqs, targetLanguage } = await req.json();
    
    if (!htmlContent || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: htmlContent and targetLanguage' }), 
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

    let userPrompt = `Translate the following HTML content from Portuguese to ${targetLangName}:\n\n${htmlContent}`;
    
    if (faqs && Array.isArray(faqs) && faqs.length > 0) {
      userPrompt += `\n\n---\n\nAlso translate these FAQs to ${targetLangName}:\n${JSON.stringify(faqs, null, 2)}`;
    }

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

    // Split response to extract HTML and FAQs
    let translatedHTML = fullResponse;
    let translatedFAQs = null;

    if (faqs && Array.isArray(faqs) && faqs.length > 0) {
      // Try to extract JSON array from response
      const jsonMatch = fullResponse.match(/\[[\s\S]*?\{[\s\S]*?"question"[\s\S]*?\}[\s\S]*?\]/);
      
      if (jsonMatch) {
        try {
          translatedFAQs = JSON.parse(jsonMatch[0]);
          // Remove FAQs JSON from HTML
          translatedHTML = fullResponse.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.error('Failed to parse translated FAQs:', e);
          // Fallback: return original FAQs
          translatedFAQs = faqs;
        }
      } else {
        // Fallback: return original FAQs if not found in response
        translatedFAQs = faqs;
      }
    }

    return new Response(
      JSON.stringify({ 
        translatedHTML: translatedHTML.trim(),
        translatedFAQs 
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
