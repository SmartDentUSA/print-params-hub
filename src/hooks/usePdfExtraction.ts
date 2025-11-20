import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const usePdfExtraction = () => {
  const extractPdfText = async (
    documentId: string,
    documentType: 'resin' | 'catalog',
    forceReExtract = false
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-and-cache-pdf', {
        body: { documentId, documentType, forceReExtract }
      });

      if (error) throw error;

      return {
        text: data?.text,
        cached: data?.cached,
        tokens: data?.tokens,
        extractedAt: data?.extractedAt,
        method: data?.method
      };
    } catch (error: any) {
      console.error('Erro ao extrair PDF:', error);
      toast({
        title: 'Erro na extração',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    }
  };

  const clearCache = async (documentId: string, documentType: 'resin' | 'catalog') => {
    try {
      const table = documentType === 'resin' ? 'resin_documents' : 'catalog_documents';
      const { error } = await supabase
        .from(table)
        .update({ 
          extracted_text: null, 
          extraction_status: 'pending',
          extraction_error: null,
          extracted_at: null,
          extraction_tokens: null
        })
        .eq('id', documentId);

      if (error) throw error;
      
      toast({
        title: '🗑️ Cache limpo',
        description: 'Na próxima vez o PDF será reprocessado'
      });
    } catch (error: any) {
      console.error('Erro ao limpar cache:', error);
      toast({
        title: 'Erro ao limpar cache',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return { extractPdfText, clearCache };
};
