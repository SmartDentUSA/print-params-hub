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

        // Query 1: artigos ativos
        const { data: articlesData, error: articlesError } = await supabase
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
          .eq('active', true);

        if (articlesError) throw articlesError;

        // Query 2: views agregadas por content_id
        const { data: viewsData } = await supabase
          .from('knowledge_videos')
          .select('content_id, analytics_views')
          .not('content_id', 'is', null);

        // Agregar views por content_id
        const viewsMap = new Map<string, number>();
        viewsData?.forEach(v => {
          const current = viewsMap.get(v.content_id!) || 0;
          viewsMap.set(v.content_id!, current + (v.analytics_views || 0));
        });

        // Filtrar artigos da categoria F (Parâmetros Técnicos)
        const filteredArticles = (articlesData || []).filter(
          article => article.knowledge_categories?.letter?.toUpperCase() !== 'F'
        );

        // Ordenar por views DESC, fallback created_at DESC
        const sorted = filteredArticles
          .sort((a, b) => {
            const viewsA = viewsMap.get(a.id) || 0;
            const viewsB = viewsMap.get(b.id) || 0;
            if (viewsB !== viewsA) return viewsB - viewsA;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
          .slice(0, limit);

        setArticles(sorted);
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
