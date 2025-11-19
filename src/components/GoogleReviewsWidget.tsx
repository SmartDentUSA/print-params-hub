import { useCompanyData } from '@/hooks/useCompanyData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleReview {
  author_name: string;
  author_url: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

export const GoogleReviewsWidget = () => {
  const { data: company, isLoading } = useCompanyData();
  
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">O que nossos clientes dizem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Carregando avaliações...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reviews: GoogleReview[] = (company?.reviews_reputation as any)?.google_reviews || [];
  const rating = company?.reviews_reputation?.google_rating || 0;
  const count = company?.reviews_reputation?.google_review_count || 0;

  if (reviews.length === 0) {
    return null;
  }

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-muted text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  // Extrair URL base para o perfil do Google
  const googlePlaceUrl = reviews[0]?.author_url?.split('/reviews')[0] || '#';

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-3xl font-bold">O que nossos clientes dizem</CardTitle>
        
        {/* Rating Médio */}
        <div className="flex items-center gap-4 mt-4 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
          <div className="text-center">
            <div className="text-5xl font-bold text-amber-600">{rating.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-1">de 5.0</div>
          </div>
          <div className="flex-1">
            {renderStars(rating, 'lg')}
            <p className="text-sm text-muted-foreground mt-2">
              Baseado em {count} avaliações no Google
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Grid de Reviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {reviews.slice(0, 6).map((review, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                {/* Header da Review */}
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={review.profile_photo_url} alt={review.author_name} />
                    <AvatarFallback>{review.author_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{review.author_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(review.rating)}
                      <span className="text-xs text-muted-foreground">
                        {review.relative_time_description}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Texto da Review */}
                <p className="text-sm text-muted-foreground line-clamp-4">
                  {review.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Link para Google */}
        <div className="text-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open(googlePlaceUrl, '_blank')}
          >
            Ver todas as avaliações no Google
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
