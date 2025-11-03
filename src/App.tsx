import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AdminViewSecure from "./pages/AdminViewSecure";
import KnowledgeBase from "./pages/KnowledgeBase";
import ProductPage from "./pages/ProductPage";
import TestimonialPage from "./pages/TestimonialPage";
import CategoryPage from "./pages/CategoryPage";
import DocumentProxyRoute from "./pages/DocumentProxyRoute";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

const App = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/:brandSlug" element={<Index />} />
    <Route path="/:brandSlug/:modelSlug" element={<Index />} />
    <Route path="/:brandSlug/:modelSlug/:resinSlug" element={<Index />} />
    <Route path="/admin" element={<AdminViewSecure />} />
    <Route path="/base-conhecimento" element={<KnowledgeBase />} />
    <Route path="/base-conhecimento/:categoryLetter" element={<KnowledgeBase />} />
    <Route path="/base-conhecimento/:categoryLetter/:contentSlug" element={<KnowledgeBase />} />
    <Route path="/produtos/:slug" element={<ProductPage />} />
    <Route path="/depoimentos/:slug" element={<TestimonialPage />} />
    <Route path="/categorias/:slug" element={<CategoryPage />} />
    <Route path="/sobre" element={<About />} />
    <Route path="/docs/:filename" element={<DocumentProxyRoute />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default App;