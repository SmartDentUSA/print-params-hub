import { supabase } from '@/integrations/supabase/client';

export async function uploadExternalImage(
  imageUrl: string, 
  fileName: string
): Promise<string> {
  try {
    // 1. Baixar imagem da URL externa
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Erro ao baixar imagem');
    }
    
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });

    // 2. Preparar upload
    const fileExt = fileName.split('.').pop() || 'jpg';
    const uniqueName = `${fileName.replace(/\.[^/.]+$/, '')}-${Date.now()}.${fileExt}`;
    const filePath = `models/${uniqueName}`;

    // 3. Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('model-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 4. Obter URL pública
    const { data } = supabase.storage
      .from('model-images')
      .getPublicUrl(filePath);

    console.log('Imagem importada e salva:', data.publicUrl);

    return data.publicUrl;

  } catch (error) {
    console.error('Erro no upload de imagem externa:', error);
    throw error;
  }
}
