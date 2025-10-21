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

  return {
    keywords,
    loading,
    refresh: fetchApprovedKeywords
  };
}
