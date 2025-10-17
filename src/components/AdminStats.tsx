import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Database, Users, Cpu } from "lucide-react";
import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/hooks/use-toast";
import type { StatsData, BrandDistribution } from "@/hooks/useSupabaseData";

export function AdminStats() {
  const [stats, setStats] = useState<StatsData>({
    totalParameters: 0,
    totalBrands: 0,
    totalModels: 0,
    totalResins: 0,
    totalUsers: 0
  });
  const [brandDistribution, setBrandDistribution] = useState<BrandDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchStats, fetchBrandDistribution } = useData();

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        
        // Fetch real stats from Supabase
        const [statsData, distribution] = await Promise.all([
          fetchStats(),
          fetchBrandDistribution()
        ]);
        
        setStats(statsData);
        setBrandDistribution(distribution);
      } catch (error) {
        console.error('Error loading admin stats:', error);
        toast({
          title: "Erro ao carregar estatísticas",
          description: "Não foi possível carregar os dados. Tente novamente.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [fetchStats, fetchBrandDistribution]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Parâmetros Totais",
      value: stats.totalParameters,
      icon: Database,
      description: "Configurações de impressão",
      color: "text-blue-600"
    },
    {
      title: "Modelos",
      value: stats.totalModels,
      icon: Cpu,
      description: "Modelos de impressoras",
      color: "text-green-600"
    },
    {
      title: "Modelos",
      value: stats.totalModels,
      icon: BarChart3,
      description: "Modelos de impressoras",
      color: "text-purple-600"
    },
    {
      title: "Usuários",
      value: stats.totalUsers,
      icon: Users,
      description: "Usuários cadastrados",
      color: "text-orange-600"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="bg-gradient-card border-border shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border shadow-medium">
          <CardHeader>
            <CardTitle>Distribuição por Marca</CardTitle>
            <CardDescription>
              Principais marcas com mais parâmetros cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {brandDistribution.length > 0 ? (
                brandDistribution.map((brand, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-sm font-medium">{brand.brand_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">{brand.parameter_count}</span>
                      <span className="text-xs text-muted-foreground">({brand.percentage}%)</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-medium">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>
              Últimas ações realizadas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Importação de dados CSV", time: "2 horas atrás", user: "Admin" },
                { action: "Novo usuário registrado", time: "5 horas atrás", user: "Sistema" },
                { action: "Parâmetros atualizados", time: "1 dia atrás", user: "Admin" },
                { action: "Backup automático", time: "2 dias atrás", user: "Sistema" },
                { action: "Nova marca adicionada", time: "3 dias atrás", user: "Admin" }
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">por {activity.user}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}