import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SYSTEM_SUPER_PROMPT } from "../_shared/system-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      throw new Error("pdfBase64 is required");
    }

    const pdfSizeKB = Math.round(pdfBase64.length / 1024);
    const pdfHash = pdfBase64.substring(0, 30);
    const requestId = Date.now();
    console.log(`[${requestId}] 🔑 PDF Hash: ${pdfHash}... (${pdfSizeKB}KB)`);
    console.log(`[${requestId}] 🚀 Starting PDF enrichment process`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ETAPA 1: Extração bruta do texto usando extract-pdf-text
    console.log("📄 Step 1: Extracting raw text from PDF via extract-pdf-text");

    const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/extract-pdf-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ pdfBase64 }),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("❌ PDF text extraction failed:", extractionResponse.status, errorText);
      throw new Error(`PDF extraction failed: ${extractionResponse.status}`);
    }

    const { extractedText } = await extractionResponse.json();
    const rawText = extractedText;
    
    const textPreview = rawText.substring(0, 250).replace(/\n/g, ' ');
    console.log(`[${requestId}] ✅ Raw text extracted: ${rawText.length} characters`);
    console.log(`[${requestId}] 📝 Raw text preview: "${textPreview}..."`);

    // ETAPA 2: Identificação inteligente do produto
    console.log(`[${requestId}] 🔍 Step 2: Identifying product from text`);
    const identificationPrompt = `Analise este texto e identifique o produto principal mencionado.

TEXTO:
${rawText}

Retorne APENAS as informações que você conseguir identificar COM CERTEZA no texto.
Se não tiver certeza, deixe o campo vazio.`;

    const identificationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um analisador de produtos de odontologia digital. Identifique produtos, fabricantes e categorias.",
          },
          { role: "user", content: identificationPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_product",
              description: "Identifica produto, fabricante e categoria de um texto",
              parameters: {
                type: "object",
                properties: {
                  productName: { type: "string", description: "Nome do produto" },
                  manufacturer: { type: "string", description: "Fabricante" },
                  category: {
                    type: "string",
                    enum: ["resina", "impressora", "scanner", "material", "software", "outro"],
                    description: "Categoria do produto",
                  },
                  keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Palavras-chave relevantes",
                  },
                },
                required: ["productName", "category", "keywords"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "identify_product" } },
      }),
    });

    if (!identificationResponse.ok) {
      console.error("❌ Product identification failed");
      throw new Error("Product identification failed");
    }

    const identificationData = await identificationResponse.json();
    const usageId = extractUsage(identificationData);
    await logAIUsage({
      functionName: "ai-enrich-pdf-content",
      actionLabel: "identify-product",
      model: "google/gemini-2.5-flash",
      promptTokens: usageId.prompt_tokens,
      completionTokens: usageId.completion_tokens,
    });
    const toolCall = identificationData.choices[0].message.tool_calls?.[0];
    const detectedProduct = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    console.log("🎯 Detected product:", detectedProduct);

    // ETAPA 2.5: Buscar autor correspondente ao manufacturer
    let authorData = null;
    if (detectedProduct?.manufacturer) {
      console.log(`🔍 Buscando autor para manufacturer: ${detectedProduct.manufacturer}`);
      
      const { data: authorMatch } = await supabase
        .from('authors')
        .select('id, name, lattes_url, linkedin_url, specialty, mini_bio')
        .ilike('name', `%${detectedProduct.manufacturer}%`)
        .eq('active', true)
        .single();
      
      if (authorMatch) {
        authorData = authorMatch;
        console.log(`✅ Autor identificado: ${authorData.name} (${authorData.specialty})`);
      } else {
        console.log(`⚠️ Nenhum autor encontrado para "${detectedProduct.manufacturer}"`);
      }
    }

    // ETAPA 3: Busca de dados reais no banco
    console.log("💾 Step 3: Fetching real data from database");
    const databaseData: any = {
      products: [],
      resins: [],
      parameters: [],
      articles: [],
    };

    if (detectedProduct && detectedProduct.keywords?.length > 0) {
      const searchKeywords = detectedProduct.keywords.map((k: string) => k.toLowerCase());
      
      // Buscar produtos no catálogo
      const { data: catalogProducts } = await supabase
        .from("system_a_catalog")
        .select("id, name, slug, description, category, product_category")
        .eq("approved", true)
        .eq("active", true)
        .limit(5);
      
      if (catalogProducts) {
        databaseData.products = catalogProducts.filter((p: any) => 
          searchKeywords.some((kw: string) => 
            p.name?.toLowerCase().includes(kw) || 
            p.description?.toLowerCase().includes(kw)
          )
        );
      }

      // Buscar resinas
      const { data: resinsData } = await supabase
        .from("resins")
        .select("id, name, slug, manufacturer, type, description, color")
        .eq("active", true)
        .limit(5);
      
      if (resinsData) {
        databaseData.resins = resinsData.filter((r: any) => 
          searchKeywords.some((kw: string) => 
            r.name?.toLowerCase().includes(kw) || 
            r.manufacturer?.toLowerCase().includes(kw)
          )
        );
      }

      // Buscar parâmetros
      const { data: parametersData } = await supabase
        .from("parameter_sets")
        .select("id, brand_slug, model_slug, resin_name, resin_manufacturer, layer_height, cure_time, notes")
        .eq("active", true)
        .limit(10);
      
      if (parametersData) {
        databaseData.parameters = parametersData.filter((p: any) => 
          searchKeywords.some((kw: string) => 
            p.resin_name?.toLowerCase().includes(kw) || 
            p.resin_manufacturer?.toLowerCase().includes(kw) ||
            p.brand_slug?.toLowerCase().includes(kw)
          )
        );
      }

      // Buscar artigos
      const { data: articlesData } = await supabase
        .from("knowledge_contents")
        .select("id, title, slug, excerpt")
        .eq("active", true)
        .limit(5);
      
      if (articlesData) {
        databaseData.articles = articlesData.filter((a: any) => 
          searchKeywords.some((kw: string) => 
            a.title?.toLowerCase().includes(kw) || 
            a.excerpt?.toLowerCase().includes(kw)
          )
        );
      }
    }

    const usedDataStats = {
      productsCount: databaseData.products.length,
      resinsCount: databaseData.resins.length,
      parametersCount: databaseData.parameters.length,
      articlesCount: databaseData.articles.length,
    };
    console.log("📊 Database data fetched:", usedDataStats);

    // ETAPA 4: Enriquecimento anti-alucinação
    console.log("✨ Step 4: Enriching content with real data");
    const enrichmentPrompt = `Você é um extrator técnico de conteúdo. Sua função é enriquecer um texto extraído de PDF técnico com dados reais do banco de dados.

REGRAS ABSOLUTAS DE FIDELIDADE:
- NUNCA invente dados que não estejam no JSON do banco de dados
- NUNCA adicione especificações técnicas inexistentes
- Se não houver dados disponíveis, escreva: "Informação não disponível no banco de dados"
- Preserve títulos, hierarquia de seções, listas e tabelas do texto original
- Use Markdown limpo e estruturado

DADOS REAIS DO BANCO DE DADOS:
${JSON.stringify(databaseData, null, 2)}

${authorData ? `
═══════════════════════════════════════════════════════════
🎓 DADOS DO ESPECIALISTA/FABRICANTE IDENTIFICADO (E-E-A-T):
═══════════════════════════════════════════════════════════

**Autor/Especialista:** ${authorData.name}
**Especialidade:** ${authorData.specialty || 'N/A'}
**Currículo Lattes:** ${authorData.lattes_url || 'N/A'}
**LinkedIn:** ${authorData.linkedin_url || 'N/A'}
**Mini Bio:** ${authorData.mini_bio || 'N/A'}
**ID do Autor (referência interna):** ${authorData.id}

IMPORTANTE: Este especialista está relacionado ao fabricante "${detectedProduct.manufacturer}".
Use essas informações para adicionar credibilidade E-E-A-T ao conteúdo enriquecido.

` : ''}

TEXTO EXTRAÍDO DO PDF (ORIGINAL):
${rawText}

TAREFA:
1. Mescle o texto original do PDF com os dados reais do banco
2. Organize em seções:
   ${databaseData.products.length > 0 ? "- 🛒 Produtos Relacionados (nome, descrição)" : ""}
   ${databaseData.resins.length > 0 ? "- 🧪 Resinas Compatíveis (fabricante, tipo, cor)" : ""}
   ${databaseData.parameters.length > 0 ? "- ⚙️ Parâmetros de Impressão (modelo, altura de camada, tempo de cura)" : ""}
   ${databaseData.articles.length > 0 ? "- 📚 Artigos Relacionados (título, resumo)" : ""}
3. Mantenha a estrutura Markdown original
4. Não sumarize o texto original
5. Apenas adicione seções com dados do banco se existirem

FORMATO DE SAÍDA:
# Título Original do PDF
[conteúdo original preservado]

---

## Dados Relacionados do Banco
[apenas se houver dados reais]

IMPORTANTE: É melhor ter menos informação verdadeira do que inventar dados.`;

    const enrichmentResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: enrichmentPrompt },
          { role: "user", content: "Enriqueça o conteúdo usando APENAS os dados fornecidos." },
        ],
        max_completion_tokens: 8000,
      }),
    });

    if (!enrichmentResponse.ok) {
      console.error("❌ Content enrichment failed");
      throw new Error("Content enrichment failed");
    }

    const enrichmentData = await enrichmentResponse.json();
    const usageEnrich = extractUsage(enrichmentData);
    await logAIUsage({
      functionName: "ai-enrich-pdf-content",
      actionLabel: "enrich-content",
      model: "google/gemini-2.5-flash",
      promptTokens: usageEnrich.prompt_tokens,
      completionTokens: usageEnrich.completion_tokens,
    });
    const enrichedText = enrichmentData.choices[0].message.content;
    console.log(`✅ Content enriched: ${enrichedText.length} characters`);

    // ETAPA 5: Validação anti-expansão
    const expansionRate = enrichedText.length / rawText.length;
    let warning = null;
    
    if (expansionRate > 2.5) {
      warning = "⚠️ AVISO: Texto enriquecido é muito maior que o original. Pode conter alucinações.";
      console.warn(`⚠️ High expansion rate: ${expansionRate.toFixed(2)}x`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ PDF enrichment completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        rawText,
        enrichedText,
        detectedProduct,
        usedData: usedDataStats,
        authorData: authorData ? {
          id: authorData.id,
          name: authorData.name,
          specialty: authorData.specialty,
          lattes_url: authorData.lattes_url,
          linkedin_url: authorData.linkedin_url
        } : null,
        stats: {
          rawLength: rawText.length,
          enrichedLength: enrichedText.length,
          expansionRate: parseFloat(expansionRate.toFixed(2)),
          processingTimeMs: processingTime,
          warning,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in ai-enrich-pdf-content:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: "Falha ao processar PDF. Verifique o formato do arquivo.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
