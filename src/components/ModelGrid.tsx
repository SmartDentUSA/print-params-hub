import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  if (models.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Selecione uma marca para ver os modelos disponíveis</p>
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
            {model.imageUrl && (
              <div className="w-full h-32 bg-muted rounded-lg mb-3 overflow-hidden">
                <img 
                  src={model.imageUrl} 
                  alt={model.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
                />
              </div>
            )}
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">{model.name}</CardTitle>
              <Badge variant={model.isActive ? "default" : "secondary"}>
                {model.isActive ? "Disponível" : "Em breve"}
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
              Ver Parâmetros
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}