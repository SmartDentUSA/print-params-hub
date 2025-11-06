import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface KnowledgeArticle {
  id: string;
  title: string;
  title_es?: string | null;
  title_en?: string | null;
  slug: string;
  excerpt: string;
  excerpt_es?: string | null;
  excerpt_en?: string | null;
  og_image_url: string | null;
  content_image_url: string | null;
  content_image_alt: string | null;
  created_at: string;
  knowledge_categories: {
    name: string;
    letter: string;
  } | null;
}

interface UseLatestKnowledgeArticlesReturn {
  articles: KnowledgeArticle[];
  loading: boolean;
  error: string | null;
}

export const useLatestKnowledgeArticles = (limit: number = 12): UseLatestKnowledgeArticlesReturn => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('knowledge_contents')
          .select(`
            id,
            title,
            title_es,
            title_en,
            slug,
            excerpt,
            excerpt_es,
            excerpt_en,
            og_image_url,
            content_image_url,
            content_image_alt,
            created_at,
            knowledge_categories(name, letter)
          `)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) throw fetchError;

        setArticles(data || []);
      } catch (err) {
        console.error('Erro ao carregar artigos:', err);
        setError('Não foi possível carregar os artigos.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [limit]);

  return { articles, loading, error };
};
