import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Settings, ArrowLeft, Wrench, Zap } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Link } from "react-router-dom";
import { AdminSettings } from "@/components/AdminSettings";
import { AdminPandaVideoSync } from "@/components/AdminPandaVideoSync";
import { AdminVideoProductLinks } from "@/components/AdminVideoProductLinks";
import { AdminParameterPages } from "@/components/AdminParameterPages";

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
                  size="default"
                  className="w-full md:w-auto flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary"
                >
                  <a
                    href="#parametros-tecnicos"
                    onClick={(e) => {
                      const el = document.getElementById('parametros-tecnicos');
                      if (el) {
                        e.preventDefault();
                        const yOffset = -80;
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    Parâmetros Técnicos (260 páginas)
                  </a>
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

          {/* Parameter Pages Generator (Category F) */}
          <AdminParameterPages />

          {/* PandaVideo Sync */}
          <AdminPandaVideoSync />

          {/* Video Product Links Dashboard */}
          <AdminVideoProductLinks />

          {/* Admin Settings */}
          <AdminSettings />
        </div>
      </main>
    </div>
  );
};

export default AdminViewSupabase;