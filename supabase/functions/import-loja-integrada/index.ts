import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Função para sanitizar nome do produto para usar como nome de arquivo
function sanitizeFileName(productName: string): string {
  return productName
    .normalize('NFD')                    // Remove acentos
    .replace(/[\u0300-\u036f]/g, '')    
    .replace(/[^\w\s-]/g, '')           // Remove especiais (®, ©, etc)
    .replace(/\s+/g, '-')               // Espaços → hífens
    .replace(/-+/g, '-')                // Remove hífens duplicados
    .replace(/^-+|-+$/g, '')            // Remove hífens nas pontas
    .substring(0, 100)                  // Limita a 100 caracteres
    .trim();
}

// Função para gerar slug limpo (ordem corrigida para evitar perda de caracteres)
function generateCleanSlug(text: string): string {
  return text
    .normalize('NFD')                     // 1. Normalizar primeiro
    .replace(/[\u0300-\u036f]/g, '')     // 2. Remover acentos
    .toLowerCase()                        // 3. Lowercase
    .replace(/\s+/g, '-')                // 4. Substituir espaços por hífens
    .replace(/[^a-z0-9-]/g, '')          // 5. Remover caracteres especiais (exceto hífens)
    .replace(/-+/g, '-')                 // 6. Limpar hífens duplicados
    .replace(/^-|-$/g, '')               // 7. Remover hífens nas pontas
    .trim();
}

// Função para upload automático de imagem externa para Supabase Storage
async function uploadImageToStorage(
  imageUrl: string,
  productName: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    console.log(`🖼️ Baixando imagem: ${productName}`);
    
    // 1. Baixar imagem
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem: ${response.status}`);
    }
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    // 2. Preparar nome baseado no produto
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const baseName = sanitizeFileName(productName);
    let fileName = `${baseName}.${ext}`;
    let filePath = `products/${fileName}`;
    
    // 3. Verificar se arquivo já existe e adicionar sufixo se necessário
    let counter = 1;
    while (counter < 100) { // Limite de segurança
      const { data: existingFiles } = await supabaseAdmin.storage
        .from('catalog-images')
        .list('products', {
          search: fileName
        });
      
      if (!existingFiles || existingFiles.length === 0) break;
      
      fileName = `${baseName}-${counter}.${ext}`;
      filePath = `products/${fileName}`;
      counter++;
    }
    
    // 4. Upload
    const { error: uploadError } = await supabaseAdmin.storage
      .from('catalog-images')
      .upload(filePath, arrayBuffer, {
        contentType: blob.type,
        cacheControl: '31536000', // 1 ano
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    
    // 5. Retornar URL pública
    const { data } = supabaseAdmin.storage
      .from('catalog-images')
      .getPublicUrl(filePath);
    
    console.log(`✅ Imagem salva: ${fileName} (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`);
    
    return data.publicUrl;
  } catch (error) {
    console.error(`❌ Erro ao fazer upload da imagem "${productName}":`, error);
    return imageUrl; // Fallback para URL original
  }
}

// Função para extrair keywords da descrição
function extractKeywordsFromDescription(description: string, productName: string): string[] {
  const keywords = new Set<string>();
  
  // Adicionar keywords padrão
  keywords.add('resina 3d');
  keywords.add('impressão 3d odontológica');
  
  // Adicionar nome do produto como keyword
  const nameParts = productName.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  nameParts.forEach(part => keywords.add(part));
  
  // Extrair palavras-chave do texto (palavras com 5+ caracteres)
  const words = description
    .toLowerCase()
    .replace(/[^\wáàâãéèêíïóôõöúçñ\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 5);
  
  words.slice(0, 5).forEach(w => keywords.add(w));
  
  return Array.from(keywords).slice(0, 10); // Máximo 10 keywords
}

// Função para extrair identificador do produto
function extractProductIdentifier(input: string): { type: 'id' | 'slug', value: string } {
  const trimmed = input.trim();
  
  // Validar input
  if (!trimmed || trimmed.includes('\n') || trimmed.length > 500) {
    throw new Error('Cole apenas a URL do produto ou o ID numérico');
  }
  
  // Se é número puro, tratar como ID
  if (/^\d+$/.test(trimmed)) {
    return { type: 'id', value: trimmed };
  }
  
  // Tentar extrair slug da URL
  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split('/').filter(p => p.length > 0);
    let slug = pathParts[pathParts.length - 1];
    
    // Remover .html se existir
    slug = slug.replace(/\.html$/, '');
    slug = decodeURIComponent(slug);
    
    if (!slug) {
      throw new Error('URL inválida - não foi possível extrair o slug');
    }
    
    return { type: 'slug', value: slug };
  } catch {
    throw new Error('Cole uma URL válida ou ID numérico do produto');
  }
}

// Função para tentar autenticação com múltiplas estratégias
async function fetchWithAuth(endpoint: string, apiKey: string, appKey: string | null) {
  const baseUrl = 'https://api.awsli.com.br/v1';
  const fullUrl = `${baseUrl}${endpoint}`;
  
  const strategies = [
    {
      name: 'header-combined',
      config: {
        headers: {
          'Authorization': appKey 
            ? `chave_api ${apiKey.trim()} aplicacao ${appKey.trim()}`
            : `chave_api ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
    },
    {
      name: 'querystring',
      config: {
        url: appKey 
          ? `${fullUrl}?chave_api=${encodeURIComponent(apiKey.trim())}&chave_aplicacao=${encodeURIComponent(appKey.trim())}`
          : `${fullUrl}?chave_api=${encodeURIComponent(apiKey.trim())}`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
    }
  ];
  
  // Tentar cada estratégia até conseguir 2xx
  for (const strategy of strategies) {
    const fetchUrl = strategy.config.url || fullUrl;
    console.log(`🔄 Tentando estratégia: ${strategy.name}`);
    
    const response = await fetch(fetchUrl, {
      headers: strategy.config.headers
    });
    
    console.log(`📡 Status: ${response.status} (${strategy.name})`);
    
    if (response.ok) {
      console.log(`✅ Autenticação bem-sucedida com: ${strategy.name}`);
      return response;
    }
    
    if (response.status === 401) {
      console.warn(`⚠️  401 com estratégia ${strategy.name}`);
      continue;
    }
    
    // Se não é 401, retornar o erro
    return response;
  }
  
  // Se todas falharam com 401
  throw new Error('401 não autorizado — verifique API Key e App Key nas configurações de Secrets');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const body = await req.json();
    const input = body.productId || body.productUrl;
    
    if (!input) {
      throw new Error('productId ou productUrl é obrigatório');
    }
    
    const apiKey = Deno.env.get('LOJA_INTEGRADA_API_KEY');
    const appKey = Deno.env.get('LOJA_INTEGRADA_APP_KEY');
    
    if (!apiKey) {
      throw new Error('LOJA_INTEGRADA_API_KEY não configurada');
    }
    
    console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
    console.log('🔑 App Key:', appKey ? appKey.substring(0, 10) + '...' : '(ausente)');
    
    // Extrair identificador
    const { type, value } = extractProductIdentifier(input);
    console.log(`🔗 ${type === 'id' ? 'ID' : 'Slug'} extraído:`, value);
    
    // Construir endpoint com barra final
    const endpoint = `/produto/${value}/`;
    console.log('🌐 Endpoint:', endpoint);

    // Fazer requisição com estratégias de autenticação
    const response = await fetchWithAuth(endpoint, apiKey, appKey || null);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500)
      });
      
      if (response.status === 401) {
        throw new Error('401 não autorizado — verifique API Key e App Key');
      }
      
      throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const apiProduct = await response.json();

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mapear para estrutura Resin
    const productName = apiProduct.nome || 'produto';
    const originalImageUrl = apiProduct.imagens?.[0]?.url || '';
    
    // Upload automático da imagem (se existir)
    const finalImageUrl = originalImageUrl 
      ? await uploadImageToStorage(originalImageUrl, productName, supabase)
      : '';
    
    const resinData = {
      name: productName,
      manufacturer: apiProduct.marca?.nome || apiProduct.fornecedor || '',
      color: '', // Sempre vazio - admin preenche manualmente
      type: 'standard', // Padrão
      description: (apiProduct.descricao_completa || apiProduct.descricao || '').trim(),
      price: parseFloat(apiProduct.preco_promocional || apiProduct.preco_cheio || apiProduct.preco || 0) || 0,
      image_url: finalImageUrl,
      images_gallery: (apiProduct.imagens || []).map((img: any, index: number) => ({
        url: img.url || img.grande || img.media || '',
        alt: apiProduct.nome || 'Resina',
        order: index,
        is_main: index === 0
      }))
    };

    console.log('✅ Produto importado:', {
      name: apiProduct.nome,
      description_length: resinData.description.length,
      price: resinData.price,
      has_image: !!resinData.image_url,
      gallery_count: resinData.images_gallery.length
    });

    // Inserir em system_a_catalog para sincronização automática
    const cleanSlug = generateCleanSlug(resinData.name);
    const keywords = extractKeywordsFromDescription(resinData.description, resinData.name);
    const metaDescription = resinData.description.substring(0, 160);

    const { data: catalogItem, error: catalogError } = await supabase
      .from('system_a_catalog')
      .upsert({
        source: 'loja_smartdent',
        category: 'product',
        external_id: apiProduct.id?.toString() || cleanSlug,
        name: resinData.name,
        slug: cleanSlug,
        description: resinData.description,
        meta_description: metaDescription,
        og_image_url: finalImageUrl,
        keywords: keywords,
        image_url: finalImageUrl,
        price: resinData.price,
        currency: 'BRL',
        active: true,
        approved: true,
        visible_in_ui: true,
        cta_1_label: 'Ver na Loja',
        cta_1_url: input.trim().startsWith('http') ? input.trim() : `https://loja.smartdent.com.br/${cleanSlug}`,
        cta_1_description: 'Confira este produto na loja oficial Smart Dent',
        extra_data: {
          images_gallery: resinData.images_gallery,
          imported_at: new Date().toISOString()
        }
      }, { 
        onConflict: 'source,external_id' 
      });

    if (catalogError) {
      console.error('⚠️ Erro ao inserir em system_a_catalog:', catalogError);
      // Não falhar a importação, apenas logar
    } else {
      console.log('✅ Produto sincronizado com catálogo público:', {
        slug: cleanSlug,
        keywords_count: keywords.length,
        has_seo: !!metaDescription && !!resinData.image_url
      });
    }

    // 🆕 TAMBÉM fazer upsert na tabela resins para correlação
    const { data: resinRecord, error: resinError } = await supabase
      .from('resins')
      .upsert({
        name: resinData.name,
        manufacturer: resinData.manufacturer,
        external_id: apiProduct.id?.toString(),
        system_a_product_url: apiProduct.url,
        description: resinData.description,
        price: resinData.price,
        image_url: finalImageUrl,
        keywords: keywords,
        active: true,
        type: 'standard',
        slug: cleanSlug,
        meta_description: metaDescription,
        og_image_url: finalImageUrl
      }, {
        onConflict: 'external_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (resinError) {
      console.warn('⚠️ Erro ao upsert em resins:', resinError);
    } else {
      console.log('✅ Resina sincronizada com ID correlação:', {
        name: resinData.name,
        external_id: apiProduct.id?.toString()
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          ...resinData,
          // 🆕 Adicionar campos de correlação da tabela resins
          external_id: apiProduct.id?.toString(),
          system_a_product_url: apiProduct.url,
          system_a_product_id: resinRecord?.system_a_product_id || null
        },
        resin: resinRecord
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na importação:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
