import { useState } from "react";
import { Header } from "@/components/Header";
import { DataImport } from "@/components/DataImport";
import { DataStats } from "@/components/DataStats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, BarChart3, Upload, Trash2, RefreshCw, Users, Settings, ArrowLeft } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const AdminViewSupabase = () => {
  const [importedData, setImportedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  const { toast } = useToast();
  const { insertParameterSets } = useData();

  const handleDataLoaded = (newData: any[]) => {
    setImportedData(newData);
  };

  const handleClearData = () => {
    setImportedData([]);
    toast({
      title: "Dados locais limpos",
      description: "Os dados temporários foram removidos da memória.",
    });
  };

  const stats = {
    totalRecords: importedData.length,
    brands: new Set(importedData.map(item => item.brand)).size,
    models: new Set(importedData.map(item => `${item.brand}-${item.model}`)).size,
    resins: new Set(importedData.map(item => item.resin)).size
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header />
      
      {/* Admin Header */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Administração</h1>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Supabase Integrado
              </Badge>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao App
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-card border-border shadow-medium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Registros</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRecords}</div>
                <p className="text-xs text-muted-foreground">parâmetros importados</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-medium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Marcas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.brands}</div>
                <p className="text-xs text-muted-foreground">fabricantes únicos</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-medium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Modelos</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.models}</div>
                <p className="text-xs text-muted-foreground">impressoras cadastradas</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-medium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resinas</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.resins}</div>
                <p className="text-xs text-muted-foreground">tipos diferentes</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Admin Tabs */}
          <Tabs defaultValue="import" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Importar Dados
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Estatísticas
              </TabsTrigger>
              <TabsTrigger value="management" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Gerenciamento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Importação de Dados CSV</CardTitle>
                  <CardDescription>
                    Importe dados CSV processados diretamente para o banco de dados Supabase.
                    Os dados serão persistidos permanentemente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataImport onDataLoaded={handleDataLoaded} />
                </CardContent>
              </Card>

              {importedData.length > 0 && (
                <Card className="bg-gradient-card border-border shadow-medium">
                  <CardHeader>
                    <CardTitle>Dados Importados Recentemente</CardTitle>
                    <CardDescription>
                      Visualização dos últimos dados importados para o Supabase
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {importedData.length} registros importados
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleClearData}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Limpar Visualização
                        </Button>
                      </div>
                      
                      <div className="bg-muted/50 border rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="text-xs">
                          {JSON.stringify(importedData.slice(0, 5), null, 2)}
                        </pre>
                        {importedData.length > 5 && (
                          <div className="text-xs text-muted-foreground mt-2">
                            ... e mais {importedData.length - 5} registros
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="stats" className="space-y-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Estatísticas Detalhadas</CardTitle>
                  <CardDescription>
                    Análise detalhada dos dados importados no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataStats data={importedData} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="management" className="space-y-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Gerenciamento do Banco de Dados</CardTitle>
                  <CardDescription>
                    Ferramentas para administração dos dados no Supabase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                    <h4 className="font-medium text-accent-foreground mb-2">Status do Banco</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>• Conectado ao Supabase</p>
                      <p>• RLS (Row Level Security) habilitado</p>
                      <p>• Políticas de acesso público configuradas para leitura</p>
                      <p>• Dados persistem permanentemente</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto p-4"
                      onClick={() => window.open("https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz", "_blank")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Dashboard Supabase</div>
                        <div className="text-sm text-muted-foreground">Acessar painel administrativo</div>
                      </div>
                    </Button>

                    <Button 
                      variant="outline" 
                      className="justify-start h-auto p-4"
                      onClick={() => window.open("https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz/editor", "_blank")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Editor SQL</div>
                        <div className="text-sm text-muted-foreground">Executar consultas diretas</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AdminViewSupabase;