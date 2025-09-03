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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {models.map((model) => (
        <Card 
          key={model.id} 
          className="bg-gradient-card border-border hover:shadow-medium transition-smooth cursor-pointer group"
          onClick={() => model.isActive && onModelSelect(model.slug)}
        >
          <CardHeader className="pb-3">
            <div className="w-full aspect-[7/10] bg-muted rounded-lg mb-3 overflow-hidden">
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
                <div className="w-full h-full bg-gradient-surface flex items-center justify-center text-muted-foreground">
                  <span className="text-xs text-center px-2">{t('models.image_not_available')}</span>
                </div>
              )}
            </div>
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">{model.name}</CardTitle>
              <Badge variant={model.isActive ? "default" : "secondary"}>
                {model.isActive ? t('common.available') : t('common.coming_soon')}
              </Badge>
            </div>
            {model.notes && (
              <CardDescription className="text-sm">{model.notes}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              disabled={!model.isActive}
            >
              {t('models.view_parameters')}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}