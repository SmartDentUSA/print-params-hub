import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getKnowledgeBasePath } from '@/utils/i18nPaths';

/**
 * Fallback route for /base-conhecimento/:slug (without category letter).
 * Looks up the article by slug, resolves the category letter, and redirects.
 */
export default function KnowledgeArticleRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    if (!slug) return;

    const resolve = async () => {
      const { data: article } = await supabase
        .from('knowledge_contents')
        .select('slug, category:knowledge_categories(letter)')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();

      const basePath = getKnowledgeBasePath(language);
      const letter = (article as any)?.category?.letter?.toLowerCase();

      if (letter) {
        navigate(`${basePath}/${letter}/${slug}`, { replace: true });
      } else {
        // Could not resolve — go to knowledge base home
        navigate(basePath, { replace: true });
      }
    };

    resolve();
  }, [slug, language, navigate]);

  return null;
}
