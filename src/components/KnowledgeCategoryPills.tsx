import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Category {
  id: string;
  name: string;
  letter: string;
  enabled: boolean;
}

interface KnowledgeCategoryPillsProps {
  categories: Category[];
  selectedCategory?: string;
  onCategorySelect: (letter: string) => void;
}

export function KnowledgeCategoryPills({ 
  categories, 
  selectedCategory, 
  onCategorySelect 
}: KnowledgeCategoryPillsProps) {
  const { t } = useLanguage();
  
  return (
    <div className="bg-card/80 rounded-lg p-3 md:p-4 border border-border">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        {/* Left: Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 flex-1">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.letter ? 'default' : 'outline'}
                size="sm"
                onClick={() => onCategorySelect(cat.letter)}
                className="transition-smooth hover:shadow-soft"
              >
                {cat.letter} • {cat.name}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Right: Back Link */}
        <Link 
          to="/" 
          className="flex items-center gap-2 text-sm text-primary hover:underline whitespace-nowrap self-end md:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('knowledge.back_to_parameters')}</span>
          <span className="sm:hidden">{t('common.back')}</span>
        </Link>
      </div>
    </div>
  );
}
