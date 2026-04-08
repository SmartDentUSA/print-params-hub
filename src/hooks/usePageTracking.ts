import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "sd_page_session";
const DEBOUNCE_MS = 2000;

function getOrCreateSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function getUtmParams(): Record<string, string | null> {
  const sp = new URLSearchParams(window.location.search);
  return {
    utm_source: sp.get("utm_source"),
    utm_medium: sp.get("utm_medium"),
    utm_campaign: sp.get("utm_campaign"),
    utm_content: sp.get("utm_content"),
    utm_term: sp.get("utm_term"),
  };
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  return "Other";
}

function detectPageType(path: string): string {
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/conhecimento") || path.startsWith("/knowledge")) return "article";
  if (path.startsWith("/produto") || path.startsWith("/product")) return "product";
  if (path.startsWith("/depoimento") || path.startsWith("/testimonial")) return "testimonial";
  if (path.startsWith("/sobre") || path.startsWith("/about")) return "about";
  if (path.startsWith("/roi")) return "roi_calculator";
  if (path.startsWith("/doc")) return "document";
  // Brand/model pages (e.g. /formlabs/form-3)
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1) return "brand";
  if (segments.length === 2) return "model";
  return "other";
}

/**
 * Tracks page views across all public pages.
 * Registers in `lead_page_views` with session, UTM, device info.
 * Call once at the app root level.
 */
export function usePageTracking() {
  const location = useLocation();
  const lastTracked = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const path = location.pathname;

    // Skip admin/auth pages
    if (path.startsWith("/admin") || path.startsWith("/auth") || path.startsWith("/login")) {
      return;
    }

    // Debounce same path
    const key = path + location.search;
    if (key === lastTracked.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      lastTracked.current = key;
      const sessionId = getOrCreateSessionId();
      const utms = getUtmParams();

      // Push virtual pageview to GTM/GA
      if (typeof window !== 'undefined' && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: 'page_view',
          page_path: path,
          page_title: document.title,
          page_type: detectPageType(path),
          page_location: window.location.href,
          session_id: sessionId,
          ...utms,
        });
      }

      supabase
        .from("lead_page_views" as any)
        .insert({
          session_id: sessionId,
          page_path: path,
          page_title: document.title,
          page_type: detectPageType(path),
          referrer: document.referrer || null,
          utm_source: utms.utm_source,
          utm_medium: utms.utm_medium,
          utm_campaign: utms.utm_campaign,
          utm_content: utms.utm_content,
          utm_term: utms.utm_term,
          device_type: getDeviceType(),
          browser: getBrowser(),
        } as any)
        .then(({ error }) => {
          if (error) {
            console.warn("[PageTracking] insert error:", error.message);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname, location.search]);
}

/** Get the current session ID (useful for linking to lead later) */
export function getPageTrackingSessionId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}
