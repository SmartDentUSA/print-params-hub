import { installPublicMetadata } from "./utils/publicMetadata";
import { redirectAdminPublicPages } from "./utils/adminPublicRedirect";
import { preparePublicSnapshot } from "./utils/publicSnapshot";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { DataProvider } from "./contexts/DataContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { OrganizationSchema } from "./components/OrganizationSchema";

const queryClient = new QueryClient();

// A tab opened before a new deploy asks for files that no longer exist: reload once to get the new version
// instead of showing an error (in-app browsers like Instagram keep old pages open for a long time).
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "__preload_reload_at__";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 15_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* ignore */ }
  event.preventDefault();
  window.location.reload();
});

if (!redirectAdminPublicPages()) createRoot(preparePublicSnapshot()).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <OrganizationSchema />
        <BrowserRouter>
          <TooltipProvider>
            <LanguageProvider>
              <DataProvider>
                <App />
                <Toaster />
              </DataProvider>
            </LanguageProvider>
          </TooltipProvider>
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  </StrictMode>
);

installPublicMetadata();
