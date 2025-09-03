import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Printer, Beaker, Settings } from "lucide-react";
import { getUniqueBrands, getUniqueModels, getUniqueResins, realBrandsData } from "@/data/realData";

export function DataStats() {
  const brands = getUniqueBrands();
  const models = getUniqueModels();
  const resins = getUniqueResins();
  const totalParameterSets = realBrandsData.length;

  const brandStats = brands.map(brand => {
    const brandModels = models.filter(m => m.brandId === brand.id);
    const brandData = realBrandsData.filter(item => item.brand === brand.name);
    return {
      ...brand,
      modelCount: brandModels.length,
      parameterSetCount: brandData.length
    };
  });

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">{brands.length}</div>
                <div className="text-sm text-muted-foreground">Marcas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Printer className="w-8 h-8 text-accent" />
              <div>
                <div className="text-2xl font-bold text-foreground">{models.length}</div>
                <div className="text-sm text-muted-foreground">Modelos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Beaker className="w-8 h-8 text-success" />
              <div>
                <div className="text-2xl font-bold text-foreground">{resins.length}</div>
                <div className="text-sm text-muted-foreground">Resinas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-warning" />
              <div>
                <div className="text-2xl font-bold text-foreground">{totalParameterSets}</div>
                <div className="text-sm text-muted-foreground">Parâmetros</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Details */}
      <Card className="bg-gradient-card border-border shadow-medium">
        <CardHeader>
          <CardTitle>Detalhes por Marca</CardTitle>
          <CardDescription>
            Distribuição de modelos e conjuntos de parâmetros por marca
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {brandStats.map(brand => (
              <div key={brand.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium text-foreground">{brand.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {brand.modelCount} modelo{brand.modelCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {brand.parameterSetCount} parâmetros
                  </Badge>
                  <Badge variant={brand.isActive ? "default" : "secondary"}>
                    {brand.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}