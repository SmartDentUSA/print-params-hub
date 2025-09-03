import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface Model {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  notes?: string;
}

interface ModelGridProps {
  models: Model[];
  onModelSelect: (modelSlug: string) => void;
}

export function ModelGrid({ models, onModelSelect }: ModelGridProps) {
  const { t } = useLanguage();
  
  if (models.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('models.no_models')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {models.map((model) => (
        <div 
          key={model.id} 
          className="bg-card border border-border rounded-lg p-3 hover:bg-accent/5 transition-smooth cursor-pointer"
          onClick={() => model.isActive && onModelSelect(model.slug)}
        >
          <div className="flex items-center gap-3">
            {/* Image Container */}
            <div className="w-16 h-20 bg-blue-600 rounded overflow-hidden relative flex-shrink-0">
              {model.imageUrl ? (
                <img 
                  src={model.imageUrl} 
                  alt={`${model.name} 3D Printer`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    console.error('Image load error for:', model.imageUrl);
                    e.currentTarget.src = '/placeholder.svg';
                    e.currentTarget.alt = t('models.image_not_available');
                  }}
                />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white">
                  <span className="text-sm">📷</span>
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">
                {model.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {model.notes || `Parâmetros otimizados para ${model.name}`}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}