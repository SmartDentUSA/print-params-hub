import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLatestKnowledgeArticles } from '@/hooks/useLatestKnowledgeArticles';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem 
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { useRef } from 'react';
import { LanguageFlags } from '@/components/LanguageFlags';
import { useLanguage } from '@/contexts/LanguageContext';
import { getKnowledgeBasePath, getLocalizedTitle, getLocalizedExcerpt } from '@/utils/i18nPaths';

const getCategoryColor = (letter: string) => {
  const colors: Record<string, string> = {
    'A': 'bg-blue-500',
    'B': 'bg-green-500',
    'C': 'bg-purple-500',
    'D': 'bg-orange-500',
    'E': 'bg-pink-500',
    'F': 'bg-yellow-500',
    'G': 'bg-red-500',
  };
  return colors[letter.toUpperCase()] || 'bg-gray-500';
};

export const KnowledgeFeed = () => {
  const { articles, loading, error } = useLatestKnowledgeArticles(12);
  const { t, language } = useLanguage();
  
  const getCategoryName = (letter: string) => {
    const key = `knowledge.category_${letter.toLowerCase()}`;
    return t(key);
  };
  
  const localeMap = {
    pt: ptBR,
    en: enUS,
    es: es
  };
  const dateLocale = localeMap[language];
  
  const plugin = useRef(
    Autoplay({ 
      delay: 5000,
      stopOnInteraction: true,
      stopOnMouseEnter: true,
    })
  );

  if (loading) {
    return (
      <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {t('knowledge.latest_articles')}
        </h2>
        
        <Carousel opts={{ align: "start" }} className="w-full">
          <CarouselContent className="-ml-1 md:-ml-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CarouselItem key={i} className="pl-1 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/6">
                <div className="space-y-3">
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {t('knowledge.knowledge_base')}
        </h2>
        <p className="text-muted-foreground">{error}</p>
      </section>
    );
  }

  if (articles.length === 0 || articles.length < 3) {
    return (
      <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {t('knowledge.knowledge_base')}
        </h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-lg mb-4">
            🚀 Em breve, novos artigos serão publicados!
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {t('knowledge.coming_soon_description')}
          </p>
          <Button variant="outline" asChild>
            <Link to={getKnowledgeBasePath(language)}>
              {t('knowledge.explore_knowledge_base')}
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 bg-gradient-card rounded-xl p-4 sm:p-8 border border-border shadow-medium">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t('knowledge.latest_articles')}
      </h2>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[plugin.current]}
        className="w-full"
      >
        <CarouselContent className="-ml-1 md:-ml-4">
          {articles.map((article) => {
            const imageUrl = article.og_image_url || article.content_image_url || '/placeholder.svg';
            const imageAlt = article.content_image_alt || article.title;
            const categoryLetter = article.knowledge_categories?.letter || 'A';
            const categoryName = article.knowledge_categories?.name || 'Geral';
            const articleUrl = `${getKnowledgeBasePath(language)}/${categoryLetter.toLowerCase()}/${article.slug}`;

            return (
              <CarouselItem 
                key={article.id} 
                className="pl-1 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/6"
              >
                <Link
                  to={articleUrl}
                  className="group bg-card hover:bg-accent/50 rounded-lg border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] block h-full min-h-[420px] sm:min-h-0"
                >
                  <div className="aspect-video overflow-hidden bg-muted">
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  
                  <div className="p-6 sm:p-4 space-y-4">
                    <Badge 
                      className={`${getCategoryColor(categoryLetter)} text-white text-xs`}
                      variant="default"
                    >
                      {getCategoryName(categoryLetter)}
                    </Badge>
                    
                    <h3 className="text-base sm:text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {language === 'es' && article.title_es 
                        ? article.title_es 
                        : language === 'en' && article.title_en 
                        ? article.title_en 
                        : article.title}
                    </h3>
                    
                    <p className="text-sm sm:text-xs text-muted-foreground line-clamp-2">
                      {language === 'es' && article.excerpt_es 
                        ? article.excerpt_es 
                        : language === 'en' && article.excerpt_en 
                        ? article.excerpt_en 
                        : article.excerpt}
                    </p>
                    
                    <LanguageFlags size="xs" className="pt-1" />
                    
                    <p className="text-xs text-muted-foreground/70">
                      {formatDistanceToNow(new Date(article.created_at), { 
                        addSuffix: true, 
                        locale: dateLocale 
                      })}
                    </p>
                  </div>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      <div className="mt-8 text-center">
        <Button variant="outline" asChild>
          <Link to={getKnowledgeBasePath(language)}>
            {t('knowledge.view_all_articles')}
          </Link>
        </Button>
      </div>
    </section>
  );
};
