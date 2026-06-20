import { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Analytics } from '@vercel/analytics/react';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Footer } from "./components/Footer";
import { usePageTracking } from "./hooks/usePageTracking";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";

// Lazy: heavy / admin / non-landing routes
const AdminViewSecure = lazy(() => import("./pages/AdminViewSecure"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const TestimonialPage = lazy(() => import("./pages/TestimonialPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const DocumentProxyRoute = lazy(() => import("./pages/DocumentProxyRoute"));
const About = lazy(() => import("./pages/About"));
const ParameterPageExample = lazy(() => import("./pages/ParameterPageExample"));
const ResinRedirect = lazy(() => import("./pages/ResinRedirect"));
const AgentEmbed = lazy(() => import("./pages/AgentEmbed"));
const AgendaPublica = lazy(() => import("./pages/AgendaPublica"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));
const ROICalculatorPage = lazy(() => import("./pages/ROICalculatorPage"));
const PublicDistributorRegister = lazy(() => import("./pages/PublicDistributorRegister"));
const DistributorCountryPage = lazy(() => import("./pages/DistributorCountryPage"));
const DistributorDetailPage = lazy(() => import("./pages/DistributorDetailPage"));
const KnowledgeArticleRedirect = lazy(() => import("./pages/KnowledgeArticleRedirect"));
const SupportResources = lazy(() => import("./pages/SupportResources"));
const SmartOpsFormFlowStandalone = lazy(() => import("./pages/SmartOpsFormFlowStandalone"));
const WaFlowVisualizerPage = lazy(() => import("./pages/WaFlowVisualizerPage"));
const DraLIA = lazy(() => import("./components/DraLIA"));

// Social Publisher (heavy admin sub-app)
const SocialLayout = lazy(() => import("./components/social/SocialLayout").then(m => ({ default: m.SocialLayout })));
const SocialDashboard = lazy(() => import("./components/social/SocialDashboard").then(m => ({ default: m.SocialDashboard })));
const SocialPostsBank = lazy(() => import("./components/social/SocialPostsBank").then(m => ({ default: m.SocialPostsBank })));
const SocialPostEditor = lazy(() => import("./components/social/editor/SocialPostEditor").then(m => ({ default: m.SocialPostEditor })));
const SocialCalendar = lazy(() => import("./components/social/calendar/SocialCalendar").then(m => ({ default: m.SocialCalendar })));
const SocialAnalytics = lazy(() => import("./components/social/SocialAnalytics").then(m => ({ default: m.SocialAnalytics })));
const SocialFlowsList = lazy(() => import("./components/social/flows/SocialFlowsList").then(m => ({ default: m.SocialFlowsList })));
const SocialFlowEditor = lazy(() => import("./components/social/flows/SocialFlowEditor").then(m => ({ default: m.SocialFlowEditor })));
const SocialFlowSessions = lazy(() => import("./components/social/flows/SocialFlowSessions").then(m => ({ default: m.SocialFlowSessions })));
const SocialBroadcasts = lazy(() => import("./components/social/broadcasts/SocialBroadcasts").then(m => ({ default: m.SocialBroadcasts })));
const SocialSequences = lazy(() => import("./components/social/broadcasts/SocialSequences").then(m => ({ default: m.SocialSequences })));
const SocialContacts = lazy(() => import("./components/social/broadcasts/SocialContacts").then(m => ({ default: m.SocialContacts })));
const SocialReviews = lazy(() => import("./components/social/reviews/SocialReviews").then(m => ({ default: m.SocialReviews })));

function PageTracker() {
  usePageTracking();
  return null;
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <>
    <Analytics />
    <ChunkErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<Navigate to="/base-conhecimento?tab=parametros" replace />} />
      <Route path="/:brandSlug" element={<Index />} />
      <Route path="/:brandSlug/:modelSlug" element={<Index />} />
      <Route path="/:brandSlug/:modelSlug/:resinSlug" element={<Index />} />
      <Route path="/admin" element={<AdminViewSecure />} />
      <Route path="/admin/form-flow/:formId" element={<SmartOpsFormFlowStandalone />} />
      <Route path="/smartops/wa-flow-visualizer" element={<WaFlowVisualizerPage />} />

      {/* Social Publisher */}
      <Route path="/social" element={<SocialLayout />}>
        <Route index element={<SocialDashboard />} />
        <Route path="banco" element={<SocialPostsBank />} />
        <Route path="novo" element={<SocialPostEditor />} />
        <Route path=":id/editar" element={<SocialPostEditor />} />
        <Route path="calendario" element={<SocialCalendar />} />
        <Route path="analytics" element={<SocialAnalytics />} />
        <Route path="flows" element={<SocialFlowsList />} />
        <Route path="flows/novo" element={<SocialFlowEditor />} />
        <Route path="flows/:id" element={<SocialFlowEditor />} />
        <Route path="flows/:id/sessoes" element={<SocialFlowSessions />} />
        <Route path="broadcasts" element={<SocialBroadcasts />} />
        <Route path="sequencias" element={<SocialSequences />} />
        <Route path="contatos" element={<SocialContacts />} />
        <Route path="avaliacoes" element={<SocialReviews />} />
      </Route>

      {/* Alias usado pelo gerador de carrosseis do Sistema A */}
      <Route path="/ferramentas/social-publisher/criar" element={<SocialPostEditor />} />

      {/* Portuguese routes (default) */}
      <Route path="/base-conhecimento" element={<KnowledgeBase lang="pt" />} />
      <Route path="/base-conhecimento/calculadora-roi" element={<ROICalculatorPage />} />
      <Route path="/base-conhecimento/calculadora-roi/:slug" element={<ROICalculatorPage />} />
      <Route path="/base-conhecimento/:categoryLetter" element={<KnowledgeBase lang="pt" />} />
      <Route path="/base-conhecimento/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="pt" />} />
      {/* Fallback: slug-only (resolves category and redirects) */}
      <Route path="/base-conhecimento/:slug" element={<KnowledgeArticleRedirect />} />

      {/* SEO-friendly aliases for distributors and events tabs */}
      <Route path="/distribuidores" element={<KnowledgeBase lang="pt" forcedTab="distribuidores" />} />
      <Route path="/distribuidores/:countrySlug" element={<DistributorCountryPage />} />
      <Route path="/distribuidores/:countrySlug/:distSlug" element={<DistributorDetailPage />} />
      <Route path="/eventos" element={<KnowledgeBase lang="pt" forcedTab="eventos" />} />

      {/* Public distributor registration (no auth) */}
      <Route path="/cadastro-distribuidor" element={<PublicDistributorRegister />} />
      
      {/* English routes */}
      <Route path="/en/knowledge-base" element={<KnowledgeBase lang="en" />} />
      <Route path="/en/knowledge-base/roi-calculator" element={<ROICalculatorPage />} />
      <Route path="/en/knowledge-base/roi-calculator/:slug" element={<ROICalculatorPage />} />
      <Route path="/en/knowledge-base/:categoryLetter" element={<KnowledgeBase lang="en" />} />
      <Route path="/en/knowledge-base/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="en" />} />
      <Route path="/en/knowledge-base/:slug" element={<KnowledgeArticleRedirect />} />
      
      {/* Spanish routes */}
      <Route path="/es/base-conocimiento" element={<KnowledgeBase lang="es" />} />
      <Route path="/es/base-conocimiento/calculadora-roi" element={<ROICalculatorPage />} />
      <Route path="/es/base-conocimiento/calculadora-roi/:slug" element={<ROICalculatorPage />} />
      <Route path="/es/base-conocimiento/:categoryLetter" element={<KnowledgeBase lang="es" />} />
      <Route path="/es/base-conocimiento/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="es" />} />
      <Route path="/es/base-conocimiento/:slug" element={<KnowledgeArticleRedirect />} />
      
      <Route path="/produtos/:slug" element={<ProductPage />} />
      <Route path="/depoimentos/:slug" element={<TestimonialPage />} />
      <Route path="/categorias/:slug" element={<CategoryPage />} />
      <Route path="/sobre" element={<About />} />
      <Route path="/docs/:filename" element={<DocumentProxyRoute />} />
      
      {/* Exemplo de página da Categoria F */}
      <Route path="/exemplo-parametros" element={<ParameterPageExample />} />
      
      {/* Redirect para resinas usando slug ou ID */}
      <Route path="/resinas/:slug" element={<ResinRedirect />} />
      
      {/* Dra. L.I.A. embed route (no header/footer for iframe) */}
      <Route path="/embed/dra-lia" element={<AgentEmbed />} />
      <Route path="/embed/treinamentos" element={<Navigate to="/agenda" replace />} />
      <Route path="/agenda" element={<AgendaPublica variant="presencial" />} />
      <Route path="/agenda/online" element={<AgendaPublica variant="online" />} />
      
      {/* Public forms */}
      <Route path="/f/:slug" element={<PublicFormPage />} />
      
      {/* Support Resources / Product Catalog (Category G) */}
      <Route path="/support-resources" element={<SupportResources />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </ChunkErrorBoundary>

    {/* Page view tracking */}
    <PageTracker />

    {/* Dra. L.I.A. floating widget — shown on all pages except admin and embed */}
    <DraLIAGlobal />

    {/* Global footer — hidden on admin and embed routes */}
    <FooterGlobal />
  </>
);

// Only render the floating widget outside admin and embed routes
function DraLIAGlobal() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed') || pathname.startsWith('/social') || pathname.startsWith('/agenda') || pathname.startsWith('/ferramentas')) return null;
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={null}>
        <DraLIA />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function FooterGlobal() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed') || pathname.startsWith('/social') || pathname.startsWith('/agenda') || pathname.startsWith('/ferramentas')) return null;
  return <Footer />;
}

export default App;
