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
  if (path === '/' || path === '') return 'home';
  if (path === '/base-conhecimento') return 'knowledge_hub';
  if (/^\/base-conhecimento\/[a-z]$/.test(path)) return 'knowledge_category';
  if (/^\/(en|es)\//.test(path)) return 'knowledge_article';
  if (/^\/base-conhecimento\/.+\/.+/.test(path)) return 'knowledge_article';
  if (/^\/produtos?\/.+/.test(path)) return 'product';
  if (/^\/depoimentos?\/.+/.test(path)) return 'testimonial';
  if (/^\/sobre$/.test(path) || /^\/about$/.test(path)) return 'about';
  if (/^\/roi/.test(path)) return 'roi_calculator';
  if (/^\/doc/.test(path)) return 'document';
  if (/^\/[^/]+\/[^/]+\/[^/]+$/.test(path)) return 'resin_params';
  if (/^\/[^/]+\/[^/]+$/.test(path)) return 'model';
  if (/^\/[^/]+$/.test(path)) return 'brand';
  return 'other';
}

function extractParamSlugs(path: string): { brand: string; model: string; resin: string } | null {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 3) {
    return { brand: segments[0], model: segments[1], resin: segments[2] };
  }
  return null;
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

      const pageType = detectPageType(path);
      const paramSlugs = pageType === 'resin_params' ? extractParamSlugs(path) : null;

      // GTM event for parameter card views
      if (paramSlugs && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: 'parameter_card_view',
          brand: paramSlugs.brand,
          model: paramSlugs.model,
          resin: paramSlugs.resin,
        });
      }

      // Check for pending tracking context from Dra. LIA media card clicks
      let pendingContext: Record<string, any> | null = null;
      try {
        const raw = sessionStorage.getItem('sd_pending_page_view_context');
        if (raw) {
          pendingContext = JSON.parse(raw);
          sessionStorage.removeItem('sd_pending_page_view_context');
        }
      } catch {}

      const insertPayload: Record<string, any> = {
        session_id: sessionId,
        page_path: path,
        page_title: document.title,
        page_type: pageType,
        referrer: document.referrer || null,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        device_type: getDeviceType(),
        browser: getBrowser(),
      };

      const extraData: Record<string, any> = {};
      if (paramSlugs) {
        Object.assign(extraData, paramSlugs, { action: 'view' });
      }
      if (pendingContext) {
        Object.assign(extraData, pendingContext);
      }
      if (Object.keys(extraData).length > 0) {
        insertPayload.extra_data = extraData;
      }

      supabase
        .from("lead_page_views" as any)
        .insert(insertPayload as any)
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
