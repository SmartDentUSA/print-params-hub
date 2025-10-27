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
import { ptBR } from 'date-fns/locale';
import { useRef } from 'react';

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
          Últimas Publicações
        </h2>
        
        <Carousel opts={{ align: "start" }} className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CarouselItem key={i} className="pl-2 md:pl-4 basis-1/3 md:basis-1/6">
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
          Base de Conhecimento
        </h2>
        <p className="text-muted-foreground">{error}</p>
      </section>
    );
  }

  if (articles.length === 0 || articles.length < 3) {
    return (
      <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Base de Conhecimento
        </h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-lg mb-4">
            🚀 Em breve, novos artigos serão publicados!
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Estamos preparando conteúdo exclusivo sobre impressão 3D odontológica, 
            configurações de impressoras, guias de resinas e muito mais.
          </p>
          <Button variant="outline" asChild>
            <Link to="/base-conhecimento">
              Explorar Base de Conhecimento
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Últimas Publicações
      </h2>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[plugin.current]}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {articles.map((article) => {
            const imageUrl = article.og_image_url || article.content_image_url || '/placeholder.svg';
            const imageAlt = article.content_image_alt || article.title;
            const categoryLetter = article.knowledge_categories?.letter || 'A';
            const categoryName = article.knowledge_categories?.name || 'Geral';
            const articleUrl = `/base-conhecimento/${categoryLetter.toLowerCase()}/${article.slug}`;

            return (
              <CarouselItem 
                key={article.id} 
                className="pl-2 md:pl-4 basis-1/3 md:basis-1/6 max-w-[280px]"
              >
                <Link
                  to={articleUrl}
                  className="group bg-card hover:bg-accent/50 rounded-lg border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] block h-full"
                >
                  <div className="aspect-video overflow-hidden bg-muted">
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  
                  <div className="p-3 space-y-2">
                    <Badge 
                      className={`${getCategoryColor(categoryLetter)} text-white text-xs`}
                      variant="default"
                    >
                      {categoryName}
                    </Badge>
                    
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {article.excerpt}
                    </p>
                    
                    <p className="text-xs text-muted-foreground/70 pt-1">
                      {formatDistanceToNow(new Date(article.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
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
          <Link to="/base-conhecimento">
            Ver Todos os Artigos
          </Link>
        </Button>
      </div>
    </section>
  );
};
