import { Routes, Route } from "react-router-dom";
import UserViewSupabase from "./pages/UserViewSupabase";
import AdminViewSecure from "./pages/AdminViewSecure";
import KnowledgeBase from "./pages/KnowledgeBase";
import NotFound from "./pages/NotFound";

const App = () => (
  <Routes>
    <Route path="/" element={<UserViewSupabase />} />
    <Route path="/admin" element={<AdminViewSecure />} />
    <Route path="/base-conhecimento" element={<KnowledgeBase />} />
    <Route path="/base-conhecimento/:categoryLetter" element={<KnowledgeBase />} />
    <Route path="/base-conhecimento/:categoryLetter/:contentSlug" element={<KnowledgeBase />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default App;