import { Button } from '@/components/ui/button';

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
  return (
    <div className="bg-gradient-card rounded-xl p-6 shadow-medium border border-border">
      <h2 className="text-lg font-semibold text-foreground mb-4">Categorias</h2>
      <div className="flex flex-wrap gap-3">
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
  );
}
