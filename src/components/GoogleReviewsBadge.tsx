import { useCompanyData } from '@/hooks/useCompanyData';
import { Star } from 'lucide-react';

interface GoogleReviewsBadgeProps {
  onClick?: () => void;
}

export const GoogleReviewsBadge = ({ onClick }: GoogleReviewsBadgeProps) => {
  const { data: company } = useCompanyData();
  const rating = company?.reviews_reputation?.google_rating;
  const count = company?.reviews_reputation?.google_review_count;
  
  if (!rating) return null;
  
  return (
    <button 
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur rounded-full border border-primary/20 hover:bg-primary/20 transition-all duration-300 group"
      aria-label={`${rating} de 5 estrelas baseado em ${count} avaliações`}
    >
      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
      <span className="font-semibold text-foreground">{rating}/5</span>
      <span className="text-sm text-muted-foreground">
        ({count} avaliações Google)
      </span>
      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        Ver todas →
      </span>
    </button>
  );
};
