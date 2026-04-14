import { Routes, Route, useLocation } from "react-router-dom";
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
import PublicFormPage from "./pages/PublicFormPage";
import ROICalculatorPage from "./pages/ROICalculatorPage";
import KnowledgeArticleRedirect from "./pages/KnowledgeArticleRedirect";
import SupportResources from "./pages/SupportResources";
import DraLIA from "./components/DraLIA";
import { usePageTracking } from "./hooks/usePageTracking";

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
      
      {/* Public forms */}
      <Route path="/f/:slug" element={<PublicFormPage />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>

    {/* Page view tracking */}
    <PageTracker />

    {/* Dra. L.I.A. floating widget — shown on all pages except admin and embed */}
    <DraLIAGlobal />
  </>
);

// Only render the floating widget outside admin and embed routes
function DraLIAGlobal() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed')) return null;
  return <DraLIA />;
}

export default App;
