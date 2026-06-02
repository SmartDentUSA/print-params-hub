import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import AdminViewSecure from "./pages/AdminViewSecure";
import KnowledgeBase from "./pages/KnowledgeBase";
import ProductPage from "./pages/ProductPage";
import TestimonialPage from "./pages/TestimonialPage";
import CategoryPage from "./pages/CategoryPage";
import DocumentProxyRoute from "./pages/DocumentProxyRoute";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import ParameterPageExample from "./pages/ParameterPageExample";
import ResinRedirect from "./pages/ResinRedirect";
import AgentEmbed from "./pages/AgentEmbed";
import AgendaPublica from "./pages/AgendaPublica";
import PublicFormPage from "./pages/PublicFormPage";
import ROICalculatorPage from "./pages/ROICalculatorPage";
import KnowledgeArticleRedirect from "./pages/KnowledgeArticleRedirect";
import SupportResources from "./pages/SupportResources";
import SmartOpsFormFlowStandalone from "./pages/SmartOpsFormFlowStandalone";
import WaFlowVisualizerPage from "./pages/WaFlowVisualizerPage";
import DraLIA from "./components/DraLIA";
import { Footer } from "./components/Footer";
import { usePageTracking } from "./hooks/usePageTracking";
import { SocialLayout } from "./components/social/SocialLayout";
import { SocialDashboard } from "./components/social/SocialDashboard";
import { SocialPostsBank } from "./components/social/SocialPostsBank";
import { ComingSoon } from "./components/social/ComingSoon";
import { SocialPostEditor } from "./components/social/editor/SocialPostEditor";
import { SocialCalendar } from "./components/social/calendar/SocialCalendar";

function PageTracker() {
  usePageTracking();
  return null;
}

const App = () => (
  <>
    <Routes>
      <Route path="/" element={<Index />} />
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
        <Route path="analytics" element={<ComingSoon title="Analytics" />} />
      </Route>
      
      {/* Portuguese routes (default) */}
      <Route path="/base-conhecimento" element={<KnowledgeBase lang="pt" />} />
      <Route path="/base-conhecimento/calculadora-roi" element={<ROICalculatorPage />} />
      <Route path="/base-conhecimento/calculadora-roi/:slug" element={<ROICalculatorPage />} />
      <Route path="/base-conhecimento/:categoryLetter" element={<KnowledgeBase lang="pt" />} />
      <Route path="/base-conhecimento/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="pt" />} />
      {/* Fallback: slug-only (resolves category and redirects) */}
      <Route path="/base-conhecimento/:slug" element={<KnowledgeArticleRedirect />} />
      
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
      <Route path="/agenda" element={<AgendaPublica />} />
      
      {/* Public forms */}
      <Route path="/f/:slug" element={<PublicFormPage />} />
      
      {/* Support Resources / Product Catalog (Category G) */}
      <Route path="/support-resources" element={<SupportResources />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>

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
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed') || pathname.startsWith('/social') || pathname === '/agenda') return null;
  return <DraLIA />;
}

function FooterGlobal() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed') || pathname.startsWith('/social') || pathname === '/agenda') return null;
  return <Footer />;
}

export default App;
