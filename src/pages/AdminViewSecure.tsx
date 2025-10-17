import { useState, useEffect } from "react";
import { User } from '@supabase/supabase-js';
import { Link } from "react-router-dom";
import { supabase } from '@/integrations/supabase/client';
import { AuthPage } from "@/components/AuthPage";
import { DataImport } from "@/components/DataImport";
import { AdminStats } from "@/components/AdminStats";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminSettings } from "@/components/AdminSettings";
import { AdminModels } from "@/components/AdminModels";
import { DataProvider } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Database, Settings, LogOut, BarChart3, ArrowLeft, FileText, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminKnowledge } from "@/components/AdminKnowledge";
import { AdminAuthors } from "@/components/AdminAuthors";

export default function AdminViewSecure() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'author' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication and admin status
    const checkAuthAndRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          
          // Get user role from user_roles table
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
          
          if (roleData) {
            setUserRole(roleData.role);
            setIsAdmin(roleData.role === 'admin');
            setIsAuthor(roleData.role === 'author');
          }
        }
      } catch (error) {
        // Silent error handling for security
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAdmin(false);
          setIsAuthor(false);
          setUserRole(null);
        } else if (session?.user) {
          setUser(session.user);
          
          // Check user role for new session
          setTimeout(async () => {
            try {
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();
              
              if (roleData) {
                setUserRole(roleData.role);
                setIsAdmin(roleData.role === 'admin');
                setIsAuthor(roleData.role === 'author');
              }
            } catch (error) {
              // Silent error handling for security
            }
          }, 100);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  const handleAuthSuccess = (authUser: User) => {
    setUser(authUser);
    toast({
      title: "Login realizado com sucesso!",
      description: "Bem-vindo ao painel administrativo.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show authentication page if not logged in
  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Show access denied if not admin or author
  if (!isAdmin && !isAuthor) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Shield className="w-16 h-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta área.
              Entre em contato com um administrador para solicitar acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Fazer Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show admin panel if authenticated and admin
  return (
    <DataProvider>
    <div className="min-h-screen bg-gradient-surface">
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-white/80">Gerenciamento seguro do sistema</p>
        </div>
      </div>
      
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">
              Bem-vindo, {user.email}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button 
                variant="default" 
                size="sm" 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Voltar ao Site</span>
                <span className="sm:hidden">Home</span>
              </Button>
            </Link>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue={isAuthor ? "knowledge" : "models"} className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-2'}`}>
            {isAdmin && (
              <TabsTrigger value="models" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Modelos
              </TabsTrigger>
            )}
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="authors" className="flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Autores
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="stats" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Estatísticas
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configurações
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {isAdmin && (
            <TabsContent value="models" className="space-y-6">
              <AdminModels />
            </TabsContent>
          )}

          <TabsContent value="knowledge" className="space-y-6">
            <AdminKnowledge />
          </TabsContent>

          <TabsContent value="authors" className="space-y-6">
            <AdminAuthors />
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="stats" className="space-y-6">
                <AdminStats />
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <AdminUsers />
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <AdminSettings />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
    </DataProvider>
  );
}