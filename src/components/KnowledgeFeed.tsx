import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLatestKnowledgeArticles } from '@/hooks/useLatestKnowledgeArticles';
import { BookOpen } from 'lucide-react';

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
  const { articles, loading, error } = useLatestKnowledgeArticles(6);

  if (loading) {
    return (
      <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            📚 Últimas Publicações da Base de Conhecimento
          </h2>
        </div>
        <p className="text-muted-foreground mb-6">
          Artigos recentes sobre impressão 3D odontológica
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-6 h-6 text-destructive" />
          <h2 className="text-2xl font-bold text-foreground">
            📚 Base de Conhecimento
          </h2>
        </div>
        <p className="text-muted-foreground">{error}</p>
      </section>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 bg-gradient-card rounded-xl p-8 border border-border shadow-medium">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">
          📚 Últimas Publicações da Base de Conhecimento
        </h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Artigos recentes sobre impressão 3D odontológica, resinas, configurações e dicas práticas
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => {
          const imageUrl = article.og_image_url || article.content_image_url || '/placeholder.svg';
          const imageAlt = article.content_image_alt || article.title;
          const categoryLetter = article.knowledge_categories?.letter || 'A';
          const categoryName = article.knowledge_categories?.name || 'Geral';
          const articleUrl = `/base-conhecimento/${categoryLetter.toLowerCase()}/${article.slug}`;

          return (
            <Link
              key={article.id}
              to={articleUrl}
              className="group bg-card hover:bg-accent/50 rounded-lg border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
            >
              <div className="aspect-video overflow-hidden bg-muted">
                <img
                  src={imageUrl}
                  alt={imageAlt}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              
              <div className="p-4 space-y-2">
                <Badge 
                  className={`${getCategoryColor(categoryLetter)} text-white text-xs`}
                  variant="default"
                >
                  {categoryName}
                </Badge>
                
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h3>
                
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {article.excerpt}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

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
