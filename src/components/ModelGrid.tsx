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
    <div className="space-y-4">
      {models.map((model) => (
        <Card 
          key={model.id} 
          className="bg-card border-border hover:shadow-medium transition-smooth cursor-pointer group p-4"
          onClick={() => model.isActive && onModelSelect(model.slug)}
        >
          <div className="flex items-center gap-4">
            {/* Image Container - Fixed 200x300 but scaled down for list view */}
            <div className="w-20 h-24 bg-muted rounded-lg overflow-hidden relative flex-shrink-0">
              {model.imageUrl ? (
                <img 
                  src={model.imageUrl} 
                  alt={`${model.name} 3D Printer`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
                  loading="lazy"
                  onError={(e) => {
                    console.error('Image load error for:', model.imageUrl);
                    e.currentTarget.src = '/placeholder.svg';
                    e.currentTarget.alt = t('models.image_not_available');
                  }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                  <span className="text-lg">📷</span>
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-semibold text-foreground truncate">
                    {model.name}
                  </CardTitle>
                  {model.notes && (
                    <CardDescription className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {model.notes}
                    </CardDescription>
                  )}
                </div>
                
                {/* Status Badge */}
                <Badge variant={model.isActive ? "default" : "secondary"} className="text-xs ml-2 flex-shrink-0">
                  {model.isActive ? t('common.available') : t('common.coming_soon')}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}