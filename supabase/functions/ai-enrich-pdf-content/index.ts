import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  console.log("🚀 Starting PDF enrichment process");

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      throw new Error("pdfBase64 is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ETAPA 1: Extração bruta do texto
    console.log("📄 Step 1: Extracting raw text from PDF");
    const extractionPrompt = `${SYSTEM_SUPER_PROMPT}

TAREFA ESPECÍFICA: EXTRAÇÃO PURA DE TEXTO DE PDF

REGRAS ABSOLUTAS:
1. Extraia EXATAMENTE o texto visível no PDF
2. NÃO adicione informações que não existam no documento
3. NÃO complete frases ou dados faltantes
4. NÃO invente especificações técnicas
5. Mantenha formatação e estrutura original
6. Se houver tabelas, preserve-as em formato texto simples

Retorne apenas o texto extraído, limpo e organizado.`;

    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: extractionPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia o texto deste PDF:" },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("❌ AI extraction error:", extractionResponse.status, errorText);
      throw new Error(`AI extraction failed: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();
    const rawText = extractionData.choices[0].message.content;
    console.log(`✅ Raw text extracted: ${rawText.length} characters`);

    // ETAPA 2: Identificação inteligente do produto
    console.log("🔍 Step 2: Identifying product from text");
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
        temperature: 0.1,
      }),
    });

    if (!identificationResponse.ok) {
      console.error("❌ Product identification failed");
      throw new Error("Product identification failed");
    }

    const identificationData = await identificationResponse.json();
    const toolCall = identificationData.choices[0].message.tool_calls?.[0];
    const detectedProduct = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    console.log("🎯 Detected product:", detectedProduct);

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
        .select("id, name, slug, description, price, category, product_category")
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
    const enrichmentPrompt = `${SYSTEM_SUPER_PROMPT}

TAREFA ESPECÍFICA: ENRIQUECIMENTO DE CONTEÚDO COM DADOS REAIS

⚠️ REGRA ABSOLUTA DE NÃO-ALUCINAÇÃO:
- Você SÓ pode usar dados fornecidos no objeto JSON abaixo
- NÃO invente especificações técnicas
- NÃO adicione produtos que não existem no banco
- NÃO crie parâmetros de impressão inexistentes
- NÃO mencione artigos que não foram fornecidos
- Se não houver dados disponíveis para uma seção, escreva "Informação não disponível no banco de dados"
- NUNCA adicione dados que não estejam explicitamente no JSON abaixo

DADOS REAIS DO BANCO DE DADOS:
${JSON.stringify(databaseData, null, 2)}

TEXTO EXTRAÍDO DO PDF:
${rawText}

TAREFA:
1. Mescle o texto do PDF com os dados do banco de dados
2. Organize em seções úteis:
   ${databaseData.products.length > 0 ? "- 🛒 Produtos Relacionados (com links e preços)" : ""}
   ${databaseData.resins.length > 0 ? "- 🧪 Resinas Compatíveis (com fabricantes)" : ""}
   ${databaseData.parameters.length > 0 ? "- ⚙️ Parâmetros de Impressão (com valores técnicos)" : ""}
   ${databaseData.articles.length > 0 ? "- 📚 Artigos Recomendados (com resumos)" : ""}
3. Adicione emojis para organização visual
4. Mantenha tom técnico, objetivo e profissional
5. Use APENAS dados fornecidos no JSON acima
6. Se uma seção não tiver dados, não a crie

IMPORTANTE: Se um dado não estiver no JSON, NÃO invente. É melhor ter menos informação verdadeira do que informação inventada.

Retorne o texto enriquecido e organizado.`;

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
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!enrichmentResponse.ok) {
      console.error("❌ Content enrichment failed");
      throw new Error("Content enrichment failed");
    }

    const enrichmentData = await enrichmentResponse.json();
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
