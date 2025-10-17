import { FileText } from 'lucide-react';

interface Content {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  icon_color: string;
}

interface KnowledgeSidebarProps {
  contents: Content[];
  selectedSlug?: string;
  onContentSelect: (slug: string) => void;
}

export function KnowledgeSidebar({ contents, selectedSlug, onContentSelect }: KnowledgeSidebarProps) {
  if (contents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum artigo disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contents.map((content) => (
        <div 
          key={content.id}
          className={`bg-card border rounded-lg p-3 hover:bg-accent/5 transition-smooth cursor-pointer ${
            selectedSlug === content.slug ? 'border-primary bg-accent/10' : 'border-border'
          }`}
          onClick={() => onContentSelect(content.slug)}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">
                {content.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {content.excerpt}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
