import { useEffect, useMemo, useRef } from "react";
import { landingMeta, prepareLandingDocument } from "@/lib/lp/customLanding";

type Tracking = { metaPixelId?: string | null };

declare global {
  interface Window { fbq?: (...args: unknown[]) => void; ttq?: { track?: (...args: unknown[]) => void }; gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }
}

function ensureMetaPixel(id: string) {
  if (!/^\d{6,20}$/.test(id) || window.fbq) return;
  const s = document.createElement("script");
  s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
  document.head.appendChild(s);
}

/**
 * Landing personalizada (HTML enviado) em tela cheia. O quadro não tem endereço próprio, então
 * rastreamento e botões de WhatsApp são repassados para esta página (pixels, UTMs e simulador).
 */
export function CustomLandingFrame({ html, tracking, onWhatsApp }: { html: string; tracking?: Tracking; onWhatsApp: (simulator: string) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(() => prepareLandingDocument(html, { search: window.location.search }), [html]);
  const onWhatsAppRef = useRef(onWhatsApp);
  onWhatsAppRef.current = onWhatsApp;

  useEffect(() => {
    const { title, description } = landingMeta(html);
    if (title) document.title = title;
    if (description) {
      let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!m) { m = document.createElement("meta"); m.name = "description"; document.head.appendChild(m); }
      m.content = description.slice(0, 158);
    }
  }, [html]);

  useEffect(() => {
    if (tracking?.metaPixelId) ensureMetaPixel(tracking.metaPixelId);
  }, [tracking?.metaPixelId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const d = e.data as { type?: string; kind?: string; args?: unknown[]; simulator?: unknown };
      if (d?.type === "sd-lp-whatsapp") { onWhatsAppRef.current(String(d.simulator ?? "")); return; }
      if (d?.type !== "sd-lp-track" || !Array.isArray(d.args)) return;
      try {
        if (d.kind === "dataLayer") (window.dataLayer = window.dataLayer || []).push(d.args[0]);
        else if (d.kind === "gtag") window.gtag?.(...d.args);
        else if (d.kind === "fbq") window.fbq?.(...d.args);
        else if (d.kind === "ttq") window.ttq?.track?.(...d.args);
      } catch { /* rastreamento nunca bloqueia a página */ }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      title={landingMeta(html).title || "Smart Dent"}
      srcDoc={srcDoc}
      className="fixed inset-0 block h-[100dvh] w-full border-0"
    />
  );
}
