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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {models.map((model) => (
        <Card 
          key={model.id} 
          className="bg-card border-border hover:shadow-medium transition-smooth cursor-pointer group w-full max-w-[280px] mx-auto"
          onClick={() => model.isActive && onModelSelect(model.slug)}
        >
          <CardHeader className="p-4 pb-2">
            {/* Image Container - Fixed 200x300 */}
            <div className="w-[200px] h-[300px] bg-muted rounded-lg overflow-hidden relative mx-auto">
              {model.imageUrl ? (
                <img 
                  src={model.imageUrl} 
                  alt={`${model.name} 3D Printer`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
                  style={{ width: '200px', height: '300px', objectFit: 'cover' }}
                  loading="lazy"
                  onError={(e) => {
                    console.error('Image load error for:', model.imageUrl);
                    e.currentTarget.src = '/placeholder.svg';
                    e.currentTarget.alt = t('models.image_not_available');
                  }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                  <div className="text-center p-4">
                    <div className="w-16 h-16 bg-muted-foreground/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-2xl">📷</span>
                    </div>
                    <span className="text-xs">{t('models.image_not_available')}</span>
                  </div>
                </div>
              )}
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <Badge variant={model.isActive ? "default" : "secondary"} className="text-xs">
                  {model.isActive ? t('common.available') : t('common.coming_soon')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-2 space-y-2">
            {/* Model Name */}
            <div>
              <CardTitle className="text-base font-semibold text-foreground line-clamp-2 text-center">
                {model.name}
              </CardTitle>
              {model.notes && (
                <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2 text-center">
                  {model.notes}
                </CardDescription>
              )}
            </div>
            
            {/* Action Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-3"
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