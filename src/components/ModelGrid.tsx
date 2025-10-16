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
            <div className="w-16 h-20 bg-muted rounded overflow-hidden relative flex-shrink-0">
              {model.imageUrl ? (
                <img 
                  src={model.imageUrl} 
                  alt={`${model.name} 3D Printer`}
                  width="64"
                  height="80"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Image load error for:', model.imageUrl);
                    // Fallback to a placeholder
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-full h-full bg-muted flex items-center justify-center">
                          <span class="text-sm text-muted-foreground">📷</span>
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">📷</span>
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