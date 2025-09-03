import { Routes, Route } from "react-router-dom";
import UserViewSupabase from "./pages/UserViewSupabase";
import AdminViewSecure from "./pages/AdminViewSecure";
import NotFound from "./pages/NotFound";

const App = () => (
  <Routes>
    <Route path="/" element={<UserViewSupabase />} />
    <Route path="/admin" element={<AdminViewSecure />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default App;