import { useState, useEffect } from "react";
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionError } from "@/components/ConnectionError";
import { AuthPage } from "@/components/AuthPage";
import { AdminStats } from "@/components/AdminStats";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminSettings } from "@/components/AdminSettings";
import { AdminPandaVideoTest } from "@/components/AdminPandaVideoTest";
import { AdminPandaVideoSync } from "@/components/AdminPandaVideoSync";
import { AdminVideoAnalyticsDashboard } from "@/components/AdminVideoAnalyticsDashboard";
import { AdminModels } from "@/components/AdminModels";
import AdminDocumentsList from "@/components/AdminDocumentsList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminKnowledge } from "@/components/AdminKnowledge";
import { AdminAuthors } from "@/components/AdminAuthors";
import { AdminCatalog } from "@/components/AdminCatalog";
import { AdminVideoProductLinks } from "@/components/AdminVideoProductLinks";
import { AdminParameterPages } from "@/components/AdminParameterPages";
import { AdminArticleReformatter } from "@/components/AdminArticleReformatter";
import AdminArticleEnricher from "@/components/AdminArticleEnricher";
import { ApostilaExport } from "@/components/ApostilaExport";
import { AdminDraLIAStats } from "@/components/AdminDraLIAStats";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Wrench } from "lucide-react";

// Smart Ops components (flattened from SmartOpsTab)
import { SmartOpsBowtie } from "@/components/SmartOpsBowtie";
import { SmartOpsLeadsList } from "@/components/SmartOpsLeadsList";
import { SmartOpsTeam } from "@/components/SmartOpsTeam";
import { SmartOpsCSRules } from "@/components/SmartOpsCSRules";
import { SmartOpsLogs } from "@/components/SmartOpsLogs";
import { SmartOpsSystemHealth } from "@/components/SmartOpsSystemHealth";
import { SmartOpsContentProduction } from "@/components/SmartOpsContentProduction";
import { SmartOpsWhatsAppInbox } from "@/components/SmartOpsWhatsAppInbox";
import { SmartOpsFormBuilder } from "@/components/SmartOpsFormBuilder";
import { SmartOpsCourses } from "@/components/SmartOpsCourses";
import { SmartOpsAIUsageDashboard } from "@/components/SmartOpsAIUsageDashboard";
import { SmartOpsIntelligenceDashboard } from "@/components/SmartOpsIntelligenceDashboard";
import { SmartOpsReports } from "@/components/SmartOpsReports";
import { SmartOpsSmartFlowAnalytics } from "@/components/SmartOpsSmartFlowAnalytics";
import { SmartOpsCopilot } from "@/components/SmartOpsCopilot";

export default function AdminViewSecure() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'author' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('models');
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        );
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        if (session?.user) {
          setUser(session.user);
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
          if (roleData) {
            setUserRole(roleData.role);
            setIsAdmin(roleData.role === 'admin');
            setIsAuthor(roleData.role === 'author');
            if (roleData.role === 'author') setActiveSection('knowledge');
          }
        }
      } catch (error) {
        setConnectionError(true);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAdmin(false);
          setIsAuthor(false);
          setUserRole(null);
        } else if (session?.user) {
          setUser(session.user);
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
            } catch (error) {}
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

  if (connectionError) {
    return <ConnectionError onRetry={() => window.location.reload()} />;
  }

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

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

  const renderContent = () => {
    switch (activeSection) {
      // Catálogo
      case 'models': return <AdminModels />;
      case 'catalog': return <AdminCatalog />;
      case 'documents': return <AdminDocumentsList />;
      // Conteúdo
      case 'knowledge': return <AdminKnowledge />;
      case 'authors': return <AdminAuthors />;
      // Ferramentas
      case 'tools': return (
        <div className="space-y-6">
          <ApostilaExport />
          <AdminArticleEnricher />
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Reformatar HTML de Artigos com IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminArticleReformatter />
            </CardContent>
          </Card>
          <AdminParameterPages />
          <AdminVideoProductLinks />
        </div>
      );
      case 'pandavideo-test': return (
        <div className="space-y-6">
          <AdminPandaVideoSync />
          <AdminPandaVideoTest />
          <AdminVideoAnalyticsDashboard />
        </div>
      );
      // Sistema
      case 'stats': return (
        <div className="space-y-6">
          <AdminStats />
          <AdminDraLIAStats />
        </div>
      );
      case 'users': return <AdminUsers />;
      case 'settings': return <AdminSettings />;
      // Smart Ops (flattened)
      case 'so-bowtie': return <SmartOpsBowtie key={`bowtie-${refreshKey}`} />;
      case 'so-kanban': return <SmartOpsLeadsList key={`leads-${refreshKey}`} />;
      case 'so-equipe': return <SmartOpsTeam key={`equipe-${refreshKey}`} />;
      case 'so-reguas': return <SmartOpsCSRules key={`reguas-${refreshKey}`} />;
      case 'so-logs': return <SmartOpsLogs key={`logs-${refreshKey}`} />;
      case 'so-reports': return <SmartOpsReports key={`reports-${refreshKey}`} />;
      case 'so-conteudo': return <SmartOpsContentProduction key={`conteudo-${refreshKey}`} />;
      case 'so-saude': return <SmartOpsSystemHealth key={`saude-${refreshKey}`} />;
      case 'so-whatsapp': return <SmartOpsWhatsAppInbox key={`whatsapp-${refreshKey}`} refreshKey={refreshKey} />;
      case 'so-formularios': return <SmartOpsFormBuilder key={`forms-${refreshKey}`} />;
      case 'so-treinamentos': return <SmartOpsCourses key={`training-${refreshKey}`} />;
      case 'so-tokens-ia': return <SmartOpsAIUsageDashboard />;
      case 'so-intelligence': return <SmartOpsIntelligenceDashboard key={`intelligence-${refreshKey}`} />;
      case 'so-roi': return <SmartOpsSmartFlowAnalytics />;
      case 'so-copilot': return <SmartOpsCopilot />;
      default: return <AdminModels />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isAdmin={isAdmin}
          isAuthor={isAuthor}
          userEmail={user.email || ''}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card px-4 gap-3 shrink-0">
            <SidebarTrigger />
            <h1 className="text-sm font-semibold text-foreground truncate">
              Painel Administrativo
            </h1>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
