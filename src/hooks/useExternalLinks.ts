import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExternalLink {
  id: string;
  name: string;
  url: string;
  related_keywords: string[];
  relevance_score?: number;
  monthly_searches?: number;
}

export function useExternalLinks() {
  const [keywords, setKeywords] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchApprovedKeywords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('external_links')
        .select('id, name, url, related_keywords, relevance_score, monthly_searches')
        .eq('approved', true)
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .order('monthly_searches', { ascending: false, nullsFirst: false });

      if (error) throw error;

      setKeywords(data || []);
    } catch (error: any) {
      console.error('Error fetching keywords:', error);
      toast({
        title: 'Erro ao carregar keywords',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedKeywords();
  }, []);

  const updateKeywordUrl = async (id: string, newUrl: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('external_links')
        .update({ url: newUrl, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '✅ URL atualizada',
        description: 'A URL foi atualizada com sucesso',
      });

      // Atualizar estado local
      setKeywords(prev => 
        prev.map(kw => kw.id === id ? { ...kw, url: newUrl } : kw)
      );

      return true;
    } catch (error: any) {
      console.error('Error updating keyword URL:', error);
      toast({
        title: '❌ Erro ao atualizar URL',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
      return false;
    }
  };

  return {
    keywords,
    loading,
    refresh: fetchApprovedKeywords,
    updateKeywordUrl
  };
}
