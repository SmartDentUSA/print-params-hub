// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para sanitizar nome de arquivo
function sanitizeFileName(productName: string): string {
  return productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// Função para fazer upload de imagem para Supabase Storage
async function uploadImageToStorage(
  imageUrl: string,
  productName: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    console.log(`📥 Baixando imagem de: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Erro ao baixar imagem: ${response.status}`);
    }
    
    const blob = await response.blob();
    const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const sanitizedName = sanitizeFileName(productName);
    let fileName = `${sanitizedName}.${fileExt}`;
    let filePath = `products/${fileName}`;
    
    // Verificar se arquivo já existe
    const { data: existingFile } = await supabaseAdmin.storage
      .from('catalog-images')
      .list('products', {
        search: sanitizedName
      });
    
    // Se existir, adicionar sufixo numérico
    if (existingFile && existingFile.length > 0) {
      let counter = 1;
      while (existingFile.some((f: any) => f.name === fileName)) {
        fileName = `${sanitizedName}-${counter}.${fileExt}`;
        counter++;
      }
      filePath = `products/${fileName}`;
    }
    
    console.log(`⬆️  Fazendo upload para: ${filePath}`);
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('catalog-images')
      .upload(filePath, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error(`❌ Erro no upload:`, uploadError);
      throw uploadError;
    }
    
    const { data } = supabaseAdmin.storage
      .from('catalog-images')
      .getPublicUrl(filePath);
    
    console.log(`✅ Upload concluído: ${data.publicUrl}`);
    return data.publicUrl;
    
  } catch (error) {
    console.error(`❌ Erro ao processar imagem ${imageUrl}:`, error);
    return imageUrl; // Retorna URL original em caso de erro
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('🚀 Iniciando migração de imagens do catálogo...');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar produtos com imagens externas
    console.log('🔍 Buscando produtos com imagens externas...');
    const { data: products, error: fetchError } = await supabaseAdmin
      .from('system_a_catalog')
      .select('id, name, image_url, slug')
      .eq('category', 'product')
      .or('image_url.like.%cdn.awsli.com.br%,image_url.like.%http%')
      .not('image_url', 'like', '%supabase.co%');

    if (fetchError) {
      throw new Error(`Erro ao buscar produtos: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      console.log('✅ Nenhuma imagem externa para migrar');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma imagem externa encontrada',
          total_products: 0,
          images_uploaded: 0,
          images_failed: 0,
          processing_time_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Encontrados ${products.length} produtos com imagens externas`);

    // 2. Processar em batches de 5
    const batchSize = 5;
    let uploadedCount = 0;
    let failedCount = 0;
    const failedProducts: Array<{ id: string; name: string; reason: string }> = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      console.log(`\n📦 Processando batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);

      const batchPromises = batch.map(async (product) => {
        try {
          if (!product.image_url) {
            console.log(`⚠️  Produto ${product.name} sem image_url, pulando...`);
            return { success: false, reason: 'No image_url' };
          }

          console.log(`\n📸 Processando: ${product.name}`);
          console.log(`   URL original: ${product.image_url}`);

          const newUrl = await uploadImageToStorage(
            product.image_url,
            product.name,
            supabaseAdmin
          );

          // Se a URL mudou, atualizar banco
          if (newUrl !== product.image_url && newUrl.includes('supabase.co')) {
            const { error: updateError } = await supabaseAdmin
              .from('system_a_catalog')
              .update({ 
                image_url: newUrl,
                og_image_url: newUrl 
              })
              .eq('id', product.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar produto ${product.name}:`, updateError);
              return { success: false, reason: updateError.message };
            }

            console.log(`✅ Produto ${product.name} atualizado com sucesso`);
            return { success: true };
          } else {
            console.log(`⚠️  URL não mudou para ${product.name}`);
            return { success: false, reason: 'URL unchanged' };
          }
        } catch (error) {
          console.error(`❌ Erro ao processar ${product.name}:`, error);
          return { success: false, reason: error.message };
        }
      });

      const results = await Promise.all(batchPromises);

      results.forEach((result, idx) => {
        if (result.success) {
          uploadedCount++;
        } else {
          failedCount++;
          failedProducts.push({
            id: batch[idx].id,
            name: batch[idx].name,
            reason: result.reason || 'Unknown error'
          });
        }
      });

      // Pequeno delay entre batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const processingTime = Date.now() - startTime;
    const response = {
      success: true,
      message: `Migração concluída: ${uploadedCount} sucesso, ${failedCount} falhas`,
      total_products: products.length,
      images_uploaded: uploadedCount,
      images_failed: failedCount,
      processing_time_ms: processingTime,
      failed_products: failedProducts.slice(0, 10), // Retornar apenas os primeiros 10 erros
    };

    console.log('\n📊 Resultado final:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro fatal na migração:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        error: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
