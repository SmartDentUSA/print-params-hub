import { useCompanyData } from '@/hooks/useCompanyData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import React from 'react';

const GoogleLogo = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
  </svg>
);

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
  const { language } = useLanguage();
  
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xs font-bold">O que nossos clientes dizem</CardTitle>
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

  // Selecionar reviews baseado no idioma atual
  const reviews: GoogleReview[] = React.useMemo(() => {
    const reviewsData = company?.reviews_reputation as any;
    
    if (!reviewsData) return [];
    
    // Selecionar o idioma apropriado, com fallback para português
    switch (language) {
      case 'en':
        return reviewsData.google_reviews_en || reviewsData.google_reviews_pt || [];
      case 'es':
        return reviewsData.google_reviews_es || reviewsData.google_reviews_pt || [];
      default:
        return reviewsData.google_reviews_pt || [];
    }
  }, [company, language]);
  
  const rating = company?.reviews_reputation?.google_rating || 0;
  const count = company?.reviews_reputation?.google_review_count || 0;

  if (reviews.length === 0) {
    return null;
  }

  // Duplicar reviews para criar loop infinito sem "salto"
  const duplicatedReviews = [...reviews, ...reviews];

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
        <CardTitle className="text-xs font-bold">O que nossos clientes dizem</CardTitle>
        
        {/* Rating Médio */}
        <div className="flex items-center gap-2 mt-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{rating.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-1">de 5.0</div>
          </div>
          <div className="flex-1">
            {renderStars(rating, 'sm')}
            <p className="text-xs text-muted-foreground mt-2">
              Baseado em {count} avaliações no Google
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Marquee infinito com CSS */}
        <div className="overflow-hidden mb-6">
          <div className="flex gap-4 animate-marquee hover:pause-marquee">
            {duplicatedReviews.map((review, index) => (
              <div key={index} className="flex-shrink-0 w-80 md:w-96">
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                  <CardContent className="p-4">
                    {/* Header da Review */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={review.profile_photo_url} alt={review.author_name} />
                        <AvatarFallback>{review.author_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm truncate">{review.author_name}</p>
                          <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <GoogleLogo />
                        </div>
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
              </div>
            ))}
          </div>
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
