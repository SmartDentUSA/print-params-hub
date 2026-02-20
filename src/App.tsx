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
import DraLIA from "./components/DraLIA";

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
      <Route path="/base-conhecimento/:categoryLetter" element={<KnowledgeBase lang="pt" />} />
      <Route path="/base-conhecimento/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="pt" />} />
      
      {/* English routes */}
      <Route path="/en/knowledge-base" element={<KnowledgeBase lang="en" />} />
      <Route path="/en/knowledge-base/:categoryLetter" element={<KnowledgeBase lang="en" />} />
      <Route path="/en/knowledge-base/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="en" />} />
      
      {/* Spanish routes */}
      <Route path="/es/base-conocimiento" element={<KnowledgeBase lang="es" />} />
      <Route path="/es/base-conocimiento/:categoryLetter" element={<KnowledgeBase lang="es" />} />
      <Route path="/es/base-conocimiento/:categoryLetter/:contentSlug" element={<KnowledgeBase lang="es" />} />
      
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
      
      <Route path="*" element={<NotFound />} />
    </Routes>

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
