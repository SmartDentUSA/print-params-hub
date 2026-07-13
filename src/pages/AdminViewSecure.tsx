import { useState, useEffect, lazy, Suspense } from "react";
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionError } from "@/components/ConnectionError";
import { AuthPage } from "@/components/AuthPage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Wrench, RefreshCw, Database, Zap, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Admin sections — lazy-loaded so the auth shell paints fast
const AdminStats = lazy(() => import("@/components/AdminStats").then(m => ({ default: m.AdminStats })));
const AdminUsers = lazy(() => import("@/components/AdminUsers").then(m => ({ default: m.AdminUsers })));
const AdminSettings = lazy(() => import("@/components/AdminSettings").then(m => ({ default: m.AdminSettings })));
const AdminPandaVideoTest = lazy(() => import("@/components/AdminPandaVideoTest").then(m => ({ default: m.AdminPandaVideoTest })));
const AdminPandaVideoSync = lazy(() => import("@/components/AdminPandaVideoSync").then(m => ({ default: m.AdminPandaVideoSync })));
const AdminVideoAnalyticsDashboard = lazy(() => import("@/components/AdminVideoAnalyticsDashboard").then(m => ({ default: m.AdminVideoAnalyticsDashboard })));
const AdminModels = lazy(() => import("@/components/AdminModels").then(m => ({ default: m.AdminModels })));
const AdminDocumentsList = lazy(() => import("@/components/AdminDocumentsList"));
const AdminKnowledge = lazy(() => import("@/components/AdminKnowledge").then(m => ({ default: m.AdminKnowledge })));
const AdminKnowledgeHub = lazy(() => import("@/components/AdminKnowledgeHub").then(m => ({ default: m.AdminKnowledgeHub })));
const AdminAuthors = lazy(() => import("@/components/AdminAuthors").then(m => ({ default: m.AdminAuthors })));
const AdminCatalog = lazy(() => import("@/components/AdminCatalog").then(m => ({ default: m.AdminCatalog })));
const AdminVideoProductLinks = lazy(() => import("@/components/AdminVideoProductLinks").then(m => ({ default: m.AdminVideoProductLinks })));
const AdminParameterPages = lazy(() => import("@/components/AdminParameterPages").then(m => ({ default: m.AdminParameterPages })));
const AdminArticleReformatter = lazy(() => import("@/components/AdminArticleReformatter").then(m => ({ default: m.AdminArticleReformatter })));
const AdminArticleEnricher = lazy(() => import("@/components/AdminArticleEnricher"));
const ApostilaExport = lazy(() => import("@/components/ApostilaExport").then(m => ({ default: m.ApostilaExport })));
const AdminDraLIAStats = lazy(() => import("@/components/AdminDraLIAStats").then(m => ({ default: m.AdminDraLIAStats })));

// Smart Ops components — lazy-loaded
const SmartOpsBowtie = lazy(() => import("@/components/SmartOpsBowtie").then(m => ({ default: m.SmartOpsBowtie })));
const SmartOpsLeadsList = lazy(() => import("@/components/SmartOpsLeadsList").then(m => ({ default: m.SmartOpsLeadsList })));
const SmartOpsTeam = lazy(() => import("@/components/SmartOpsTeam").then(m => ({ default: m.SmartOpsTeam })));
const SmartOpsCSRules = lazy(() => import("@/components/SmartOpsCSRules").then(m => ({ default: m.SmartOpsCSRules })));
const SmartOpsLogs = lazy(() => import("@/components/SmartOpsLogs").then(m => ({ default: m.SmartOpsLogs })));
const SmartOpsSystemHealth = lazy(() => import("@/components/SmartOpsSystemHealth").then(m => ({ default: m.SmartOpsSystemHealth })));
const SmartOpsContentProduction = lazy(() => import("@/components/SmartOpsContentProduction").then(m => ({ default: m.SmartOpsContentProduction })));
const SmartOpsWhatsAppInbox = lazy(() => import("@/components/SmartOpsWhatsAppInbox").then(m => ({ default: m.SmartOpsWhatsAppInbox })));
const SmartOpsFormBuilder = lazy(() => import("@/components/SmartOpsFormBuilder").then(m => ({ default: m.SmartOpsFormBuilder })));
const SmartOpsCourses = lazy(() => import("@/components/SmartOpsCourses").then(m => ({ default: m.SmartOpsCourses })));
const SmartOpsAIUsageDashboard = lazy(() => import("@/components/SmartOpsAIUsageDashboard").then(m => ({ default: m.SmartOpsAIUsageDashboard })));
const SmartOpsAIRouting = lazy(() => import("@/components/SmartOpsAIRouting").then(m => ({ default: m.SmartOpsAIRouting })));
const SmartOpsIntelligenceDashboard = lazy(() => import("@/components/smartops/sentinela/IntelligenceWithSentinela").then(m => ({ default: m.IntelligenceWithSentinela })));
const SmartOpsReports = lazy(() => import("@/components/SmartOpsReports").then(m => ({ default: m.SmartOpsReports })));
const SmartOpsSmartFlowAnalytics = lazy(() => import("@/components/SmartOpsSmartFlowAnalytics").then(m => ({ default: m.SmartOpsSmartFlowAnalytics })));
const SmartOpsCopilot = lazy(() => import("@/components/SmartOpsCopilot").then(m => ({ default: m.SmartOpsCopilot })));
const SmartOpsWorkflowMapper = lazy(() => import("@/components/smartops/SmartOpsWorkflowMapper").then(m => ({ default: m.SmartOpsWorkflowMapper })));
const SmartOpsCampaigns = lazy(() => import("@/components/SmartOpsCampaigns").then(m => ({ default: m.SmartOpsCampaigns })));
const SmartOpsDistributors = lazy(() => import("@/components/smartops/SmartOpsDistributors").then(m => ({ default: m.SmartOpsDistributors })));
const SmartOpsEvents = lazy(() => import("@/components/smartops/SmartOpsEvents").then(m => ({ default: m.SmartOpsEvents })));
const SmartOpsRayshape = lazy(() => import("@/components/SmartOpsRayshape").then(m => ({ default: m.SmartOpsRayshape })));
const SmartOpsStripePayments = lazy(() => import("@/components/SmartOpsStripePayments").then(m => ({ default: m.SmartOpsStripePayments })));

export default function AdminViewSecure() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'author' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('models');
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncingIncremental, setSyncingIncremental] = useState(false);
  const [syncingFull, setSyncingFull] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleSyncIncremental = async () => {
    setSyncingIncremental(true);
    try {
      const { error } = await supabase.functions.invoke("smart-ops-sync-piperun");
      if (error) throw error;
      toast({ title: "Sync incremental concluído", description: "Deals recentes sincronizados com sucesso." });
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      toast({ title: "Erro no sync incremental", description: e.message, variant: "destructive" });
    } finally {
      setSyncingIncremental(false);
    }
  };

  const handleFullSync = async () => {
    setSyncingFull(true);
    try {
      const { error } = await supabase.functions.invoke("piperun-full-sync");
      if (error) throw error;
      toast({ title: "Full Sync concluído", description: "Todos os pipelines sincronizados." });
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      toast({ title: "Erro no full sync", description: e.message, variant: "destructive" });
    } finally {
      setSyncingFull(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-leads-full`;
      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      };
      const startRes = await fetch(url, { method: "POST", headers });
      if (!startRes.ok) throw new Error(`HTTP ${startRes.status}: ${(await startRes.text()).slice(0, 200)}`);
      const { job_id } = await startRes.json();
      toast({ title: "Export iniciado", description: "Processando em segundo plano…" });

      // Poll job status
      let job: any = null;
      for (let i = 0; i < 240; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const r = await fetch(`${url}?job_id=${job_id}`, { headers });
        if (!r.ok) continue;
        job = await r.json();
        if (job.status === "completed" || job.status === "failed") break;
      }
      if (!job) throw new Error("Timeout aguardando o export");
      if (job.status === "failed") throw new Error(job.error || "Export falhou");

      // Download each signed CSV
      for (const f of job.signed || []) {
        if (!f.url) continue;
        const a = document.createElement("a");
        a.href = f.url;
        a.download = `${f.name}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 250));
      }
      toast({
        title: "Export concluído",
        description: `${job.lead_count} leads · ${job.deal_count} deals · ${(job.signed || []).length} arquivos`,
      });
    } catch (e: any) {
      toast({ title: "Erro no export", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const isSmartOps = activeSection.startsWith('so-');

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
      case 'knowledge-hub': return <AdminKnowledgeHub />;
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
      case 'so-ai-routing': return <SmartOpsAIRouting />;
      case 'so-intelligence': return <SmartOpsIntelligenceDashboard key={`intelligence-${refreshKey}`} />;
      case 'so-roi': return <SmartOpsSmartFlowAnalytics />;
      case 'so-copilot': return <SmartOpsCopilot />;
      case 'so-rayshape': return <SmartOpsRayshape key={`rayshape-${refreshKey}`} />;
      case 'so-stripe': return <SmartOpsStripePayments key={`stripe-${refreshKey}`} />;
      case 'so-mapeamento': return <SmartOpsWorkflowMapper />;
      case 'so-campanhas': return <SmartOpsCampaigns />;
      case 'so-distribuicao': return <SmartOpsDistributors key={`distribuicao-${refreshKey}`} />;
      case 'so-eventos': return <SmartOpsEvents key={`eventos-${refreshKey}`} />;
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
            {isSmartOps && (
              <div className="flex items-center justify-between mb-4 p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Smart Ops</span>
                  <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                    <Zap className="w-3 h-3 mr-1" /> Webhook ativo
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncIncremental}
                    disabled={syncingIncremental || syncingFull}
                  >
                    {syncingIncremental ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Database className="w-4 h-4 mr-1" />}
                    Sync Incremental
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFullSync}
                    disabled={syncingIncremental || syncingFull}
                  >
                    {syncingFull ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Database className="w-4 h-4 mr-1" />}
                    Full Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportAll}
                    disabled={syncingIncremental || syncingFull || exporting}
                  >
                    {exporting ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                    Exportar Tudo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRefreshKey(prev => prev + 1)}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </div>
            )}
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            }>
              {renderContent()}
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
