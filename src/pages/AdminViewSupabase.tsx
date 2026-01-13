import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Settings, ArrowLeft, Wrench, Zap, Sparkles } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Link } from "react-router-dom";
import { AdminSettings } from "@/components/AdminSettings";
import { AdminPandaVideoSync } from "@/components/AdminPandaVideoSync";
import { AdminVideoProductLinks } from "@/components/AdminVideoProductLinks";
import { AdminParameterPages } from "@/components/AdminParameterPages";
import { AdminVideoAnalyticsDashboard } from "@/components/AdminVideoAnalyticsDashboard";
import { AdminArticleReformatter } from "@/components/AdminArticleReformatter";
import AdminArticleEnricher from "@/components/AdminArticleEnricher";
import { ApostilaExport } from "@/components/ApostilaExport";
const AdminViewSupabase = () => {
  const dataContext = useData();

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header />
      
      {/* Admin Header */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Administração</h1>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Supabase Integrado
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/" className="block">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Voltar ao Site</span>
                  <span className="sm:hidden">Home</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Quick Stats */}
          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Dashboard Administrativo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Gerencie todas as configurações do sistema, incluindo marcas, modelos, resinas e parâmetros de impressão.
              </p>
              
              <div className="pt-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto"
                  onClick={() => {
                    const settingsCard = document.querySelector('[id="parametros-tecnicos"]');
                    if (settingsCard) {
                      settingsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ver Configurações Completas
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Management Tools */}
          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Ferramentas de Gerenciamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <h4 className="font-medium text-accent-foreground mb-2">Banco de Dados Supabase</h4>
                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                  <p>• Conectado ao Supabase</p>
                  <p>• RLS (Row Level Security) habilitado</p>
                  <p>• Políticas de acesso público configuradas para leitura</p>
                  <p>• Dados persistem permanentemente</p>
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
              </div>
            </CardContent>
          </Card>

          {/* Video Analytics Dashboard */}
          <AdminVideoAnalyticsDashboard />

          {/* SEO Article Enricher */}
          <AdminArticleEnricher />

          {/* Article HTML Reformatter */}
          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Reformatar HTML de Artigos com IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminArticleReformatter />
            </CardContent>
          </Card>

          {/* Parameter Pages Generator (Category F) */}
          <AdminParameterPages />

          {/* PandaVideo Sync */}
          <AdminPandaVideoSync />

          {/* Video Product Links Dashboard */}
          <AdminVideoProductLinks />

          {/* Apostila Export */}
          <ApostilaExport />

          {/* Admin Settings */}
          <AdminSettings />
        </div>
      </main>
    </div>
  );
};

export default AdminViewSupabase;