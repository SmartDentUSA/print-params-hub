import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  content_id: string;
  content_type: string;
  title: string;
  excerpt: string;
  slug: string;
  category_letter: string;
  category_name: string;
  relevance: number;
  matched_field: string;
}

export const useKnowledgeSearch = (query: string, language: 'pt' | 'en' | 'es' = 'pt') => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }

    const searchDebounced = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: searchError } = await supabase.rpc(
          'search_knowledge_base',
          { search_query: query, language_code: language }
        );

        if (searchError) throw searchError;
        setResults(data || []);
      } catch (err) {
        console.error('Search error:', err);
        setError('Erro ao buscar conteúdo');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounced);
  }, [query, language]);

  return { results, loading, error };
};
