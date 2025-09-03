import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { DataImport } from "@/components/DataImport";
import { DataStats } from "@/components/DataStats";
import { AdminModal } from "@/components/AdminModal";
import { LoginForm } from "@/components/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Database, 
  BarChart3, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Users, 
  Settings, 
  ArrowLeft,
  Shield,
  Globe,
  Palette,
  Bell,
  Mail,
  FileText,
  Image,
  Download,
  LogOut
} from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const AdminViewComplete = () => {
  const [importedData, setImportedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  
  // Configuration states
  const [siteConfig, setSiteConfig] = useState({
    siteName: "Parâmetros de Impressão 3D",
    siteDescription: "Base de dados profissional com parâmetros testados",
    allowPublicAccess: true,
    requireEmailVerification: false,
    maintenanceMode: false,
    maxFileSize: 10,
    allowedFileTypes: ".csv,.xlsx",
    adminEmail: "admin@smartdent.com.br",
    whatsappNumber: "551634194735",
    enableNotifications: true,
    enableAnalytics: true
  });
  
  const { toast } = useToast();
  const { insertParameterSets, getUniqueBrands } = useData();

  useEffect(() => {
    const authStatus = localStorage.getItem("adminAuth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    } else {
      setShowLoginForm(true);
    }
  }, []);

  const handleDataLoaded = (newData: any[]) => {
    console.log("Admin: Dados carregados:", newData.length);
    setImportedData(newData);
  };

  const handleClearData = () => {
    setImportedData([]);
    toast({
      title: "Dados locais limpos",
      description: "Os dados temporários foram removidos da memória.",
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    setShowLoginForm(true);
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado do painel administrativo.",
    });
  };

  const handleConfigUpdate = (key: string, value: any) => {
    setSiteConfig(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Salvar no localStorage
    localStorage.setItem("siteConfig", JSON.stringify({
      ...siteConfig,
      [key]: value
    }));
    
    toast({
      title: "Configuração atualizada",
      description: `${key} foi atualizado com sucesso.`,
    });
  };

  const stats = {
    totalRecords: importedData.length,
    brands: new Set(importedData.map(item => item.brand)).size,
    models: new Set(importedData.map(item => `${item.brand}-${item.model}`)).size,
    resins: new Set(importedData.map(item => item.resin)).size
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-surface">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <LoginForm onLogin={() => {
              setIsAuthenticated(true);
              setShowLoginForm(false);
              toast({
                title: "Login realizado com sucesso",
                description: "Bem-vindo ao painel administrativo.",
              });
            }} />
          </div>
        </div>
      </div>
    );
  }

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
                <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Shield className="w-3 h-3 mr-1" />
                Supabase Integrado
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Site
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
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
                <p className="text-xs text-muted-foreground">parâmetros no sistema</p>
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Importar
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Estatísticas
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Banco
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Sistema
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

            <TabsContent value="database" className="space-y-6">
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
                      <p>• Políticas de acesso público configuradas</p>
                      <p>• Backup automático ativo</p>
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
                        <div className="text-sm text-muted-foreground">Painel administrativo completo</div>
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

            <TabsContent value="settings" className="space-y-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Configurações do Site</CardTitle>
                  <CardDescription>
                    Configure as informações básicas e comportamento do site
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="siteName">Nome do Site</Label>
                      <Input
                        id="siteName"
                        value={siteConfig.siteName}
                        onChange={(e) => handleConfigUpdate('siteName', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Email do Administrador</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={siteConfig.adminEmail}
                        onChange={(e) => handleConfigUpdate('adminEmail', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siteDescription">Descrição do Site</Label>
                    <Textarea
                      id="siteDescription"
                      value={siteConfig.siteDescription}
                      onChange={(e) => handleConfigUpdate('siteDescription', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="whatsappNumber">Número WhatsApp</Label>
                      <Input
                        id="whatsappNumber"
                        value={siteConfig.whatsappNumber}
                        onChange={(e) => handleConfigUpdate('whatsappNumber', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="maxFileSize">Tamanho Máximo de Arquivo (MB)</Label>
                      <Input
                        id="maxFileSize"
                        type="number"
                        value={siteConfig.maxFileSize}
                        onChange={(e) => handleConfigUpdate('maxFileSize', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Configurações de Acesso</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allowPublicAccess">Permitir Acesso Público</Label>
                        <Switch
                          id="allowPublicAccess"
                          checked={siteConfig.allowPublicAccess}
                          onCheckedChange={(checked) => handleConfigUpdate('allowPublicAccess', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="maintenanceMode">Modo Manutenção</Label>
                        <Switch
                          id="maintenanceMode"
                          checked={siteConfig.maintenanceMode}
                          onCheckedChange={(checked) => handleConfigUpdate('maintenanceMode', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enableNotifications">Notificações Ativas</Label>
                        <Switch
                          id="enableNotifications"
                          checked={siteConfig.enableNotifications}
                          onCheckedChange={(checked) => handleConfigUpdate('enableNotifications', checked)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>
                    Administre usuários e permissões do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sistema Público</h3>
                    <p className="text-muted-foreground mb-4">
                      Atualmente o sistema está configurado para acesso público.
                      Para gerenciar usuários específicos, configure autenticação no Supabase.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => window.open("https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz/auth/users", "_blank")}
                    >
                      Configurar Autenticação
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-card border-border shadow-medium">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Informações do Sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Versão:</span>
                      <span className="font-medium">1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última Atualização:</span>
                      <span className="font-medium">Hoje</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Framework:</span>
                      <span className="font-medium">React + Supabase</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        Operacional
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-border shadow-medium">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Ações do Sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Configurações
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Limpar Cache
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Database className="w-4 h-4 mr-2" />
                      Backup Manual
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AdminViewComplete;