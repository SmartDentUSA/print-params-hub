import { FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Content {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  icon_color: string;
  og_image_url?: string;
}

interface KnowledgeSidebarProps {
  contents: Content[];
  selectedSlug?: string;
  onContentSelect: (slug: string) => void;
}

export function KnowledgeSidebar({ contents, selectedSlug, onContentSelect }: KnowledgeSidebarProps) {
  const { t } = useLanguage();
  
  if (contents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('knowledge.no_content')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contents.map((content) => (
        <div 
          key={content.id}
          className={`bg-card border rounded-lg overflow-hidden hover:bg-accent/5 transition-smooth cursor-pointer ${
            selectedSlug === content.slug ? 'border-primary bg-accent/10' : 'border-border'
          }`}
          onClick={() => onContentSelect(content.slug)}
        >
          {/* Imagem de destaque */}
          {content.og_image_url && (
            <div className="w-full aspect-[1.91/1] overflow-hidden">
              <img 
                src={content.og_image_url} 
                alt={content.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          
          {/* Texto abaixo da imagem */}
          <div className="p-3">
            <h3 className="font-semibold text-foreground text-sm truncate">
              {content.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {content.excerpt}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
