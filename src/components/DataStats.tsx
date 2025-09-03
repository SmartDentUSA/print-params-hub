import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Printer, Beaker, Settings, TrendingUp, Database } from "lucide-react";
import { getUniqueBrands, getUniqueModels, getUniqueResins, realBrandsData } from "@/data/realData";

// Real brand statistics based on your actual CSV data
const realBrandStats = [
  { name: "AnyCubic", records: 76, color: "bg-blue-500" },
  { name: "Miicraft", records: 56, color: "bg-green-500" },
  { name: "ELEGOO", records: 50, color: "bg-purple-500" },
  { name: "Phrozen", records: 21, color: "bg-orange-500" },
  { name: "Creality", records: 20, color: "bg-red-500" },
  { name: "Pionext", records: 10, color: "bg-cyan-500" },
  { name: "Flashforge", records: 10, color: "bg-yellow-500" },
  { name: "Straumann", records: 7, color: "bg-indigo-500" },
  { name: "UNIZ", records: 5, color: "bg-pink-500" },
  { name: "SprintRay", records: 4, color: "bg-teal-500" },
  { name: "EZY3D", records: 4, color: "bg-lime-500" },
  { name: "Wanhao", records: 2, color: "bg-amber-500" },
  { name: "DentalFactory", records: 1, color: "bg-gray-500" },
];

export function DataStats() {
  const brands = getUniqueBrands();
  const models = getUniqueModels();
  const resins = getUniqueResins();
  const totalParameterSets = realBrandStats.reduce((sum, brand) => sum + brand.records, 0);

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
                <div className="text-2xl font-bold text-foreground">{models.length}+</div>
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
                <div className="text-2xl font-bold text-foreground">{resins.length}+</div>
                <div className="text-sm text-muted-foreground">Resinas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-warning" />
              <div>
                <div className="text-2xl font-bold text-foreground">{totalParameterSets}</div>
                <div className="text-sm text-muted-foreground">Parâmetros</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart */}
      <Card className="bg-gradient-card border-border shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Distribuição por Marca
          </CardTitle>
          <CardDescription>
            Quantidade de conjuntos de parâmetros por marca (dados reais da planilha)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {realBrandStats.map((brand, index) => {
              const percentage = (brand.records / totalParameterSets) * 100;
              return (
                <div key={brand.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${brand.color}`}></div>
                      <span className="font-medium text-foreground">{brand.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {brand.records} registros ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${brand.color}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Brands */}
      <Card className="bg-gradient-card border-border shadow-medium">
        <CardHeader>
          <CardTitle>Principais Marcas</CardTitle>
          <CardDescription>
            Marcas com maior quantidade de parâmetros cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {realBrandStats.slice(0, 6).map((brand, index) => (
              <div key={brand.name} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    <span className="text-sm font-bold text-primary">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{brand.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {((brand.records / totalParameterSets) * 100).toFixed(1)}% do total
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={index < 3 ? "default" : "outline"}>
                    {brand.records} parâmetros
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Database Health */}
      <Card className="bg-gradient-card border-border shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Saúde da Base de Dados
          </CardTitle>
          <CardDescription>
            Informações sobre a qualidade e cobertura dos dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-success/10 rounded-lg border border-success/20">
              <div className="text-2xl font-bold text-success">100%</div>
              <div className="text-sm text-muted-foreground">Cobertura</div>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="text-2xl font-bold text-primary">13</div>
              <div className="text-sm text-muted-foreground">Marcas Ativas</div>
            </div>
            <div className="text-center p-4 bg-accent/10 rounded-lg border border-accent/20">
              <div className="text-2xl font-bold text-accent">266+</div>
              <div className="text-sm text-muted-foreground">Registros Únicos</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}