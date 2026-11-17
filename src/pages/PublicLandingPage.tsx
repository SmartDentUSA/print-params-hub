import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { PremiumLandingTemplate, type LPContent } from "@/components/lp/PremiumLandingTemplate";
import { trackAttendanceEvent, buildLiaUrl } from "@/lib/attendanceChannel";
import { AttendanceDialog } from "@/components/lia/AttendanceDialog";
import { CustomLandingFrame } from "@/components/lp/CustomLandingFrame";
import { parseSimulators, pickSimulator } from "@/lib/lp/customLanding";
import { currentClickOrigin } from "@/lib/clickOrigin";

type LandingPage = {
  id: string;
  content: LPContent | null;
  hero_image_url: string | null;
  status: string;
  custom_html: string | null;
  custom_simulators: unknown;
  smartops_forms: {
    id: string;
    name: string;
    slug: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    tracking_meta_pixel_id: string | null;
  };
};

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lp, setLp] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChannel, setModalChannel] = useState<"form" | "specialist">("form");
  const [liaOpen, setLiaOpen] = useState(false);
  // Origem do clique (e-mail, SMS, WhatsApp...) que trouxe o visitante; segue para formulário e simulador.
  const origin = useMemo(() => currentClickOrigin(), []);
  const originQs = origin ? `&utm_term=${origin}` : "";

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("smartops_form_landing_pages")
        .select("id, content, hero_image_url, status, custom_html, custom_simulators, smartops_forms:form_id(id,name,slug,title,subtitle,description,tracking_meta_pixel_id)")
        .eq("status", "published");

      const row = Array.isArray(data) ? data.find((r: any) => r.smartops_forms?.slug === slug) : null;
      if (row && (row.custom_html || (row.content && row.content.hero))) setLp(row as LandingPage);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [slug]);

  // Load Inter + Manrope
  useEffect(() => {
    if (!lp || lp.custom_html) return;
    const id = "smartdent-lp-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@600;700;800;900&display=swap";
      document.head.appendChild(link);
    }
    const title = lp.smartops_forms.title || lp.smartops_forms.name;
    document.title = `${title} — Smart Dent`;
    const desc = lp.smartops_forms.description || lp.smartops_forms.subtitle || "";
    if (desc) {
      let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!m) {
        m = document.createElement("meta");
        m.name = "description";
        document.head.appendChild(m);
      }
      m.content = desc.slice(0, 158);
    }
  }, [lp]);

  const iframeUrl = useMemo(
    () => (lp ? `/f/${lp.smartops_forms.slug}?embed=1&utm_source=landing_page&channel=${modalChannel}${originQs}` : null),
    [lp, modalChannel, originQs],
  );

  // Visualização da landing (base do canal formulário)
  useEffect(() => {
    if (lp) trackAttendanceEvent({ channel: "form", event_type: "view", form_id: lp.smartops_forms.id });
  }, [lp]);

  const openLia = (source: string) => {
    if (!lp) return;
    trackAttendanceEvent({ channel: "whatsapp_lia", event_type: "click", form_id: lp.smartops_forms.id });
    void source;
    setLiaOpen(true);
  };
  const [simLiaUrl, setSimLiaUrl] = useState<string | null>(null);
  const liaUrl = simLiaUrl ?? (lp ? buildLiaUrl({ formId: lp.smartops_forms.id }) + "&utm_source=landing_page&utm_medium=whatsapp_lia" + originQs : "");
  const simulators = useMemo(() => parseSimulators(lp?.custom_simulators), [lp?.custom_simulators]);

  // Landing personalizada: cada item abre o simulador de WhatsApp com o produto dele já preenchido.
  const openSimulator = (id: string) => {
    if (!lp) return;
    const sim = pickSimulator(simulators, id);
    trackAttendanceEvent({ channel: "whatsapp_lia", event_type: "click", form_id: lp.smartops_forms.id, product_name: sim.label, simulator_id: sim.id });
    const url = new URL(buildLiaUrl({ formId: lp.smartops_forms.id, productId: sim.product_catalog_id, interest: sim.button, simulator: sim.id }));
    url.searchParams.set("utm_source", "landing_page");
    url.searchParams.set("utm_medium", "whatsapp_lia");
    url.searchParams.set("utm_content", sim.id);
    if (origin) url.searchParams.set("utm_term", origin);
    setSimLiaUrl(url.toString());
    setLiaOpen(true);
  };

  const inlineFormUrl = useMemo(
    () =>
      lp
        ? `/f/${lp.smartops_forms.slug}?embed=1&display=first_three&utm_source=landing_page&utm_medium=inline_form${originQs}`
        : null,
    [lp, originQs],
  );

  // Altura dinâmica do formulário embutido (postMessage vindo de /f/:slug?embed=1)
  const [inlineHeight, setInlineHeight] = useState(520);
  const syncInlineIframeHeight = (iframe: HTMLIFrameElement | null) => {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const root = doc.querySelector(".public-form-page") as HTMLElement | null;
      const height = root
        ? Math.ceil(Math.max(root.scrollHeight, root.getBoundingClientRect().height))
        : 0;
      if (height > 0) setInlineHeight(Math.max(320, Math.min(3200, height + 24)));
    } catch {
      // Same-origin esperado; se falhar, o postMessage/scroll interno continua como fallback.
    }
  };
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (d && d.type === "smartops-form-height" && typeof d.height === "number") {
        setInlineHeight(Math.max(320, Math.min(3200, Math.ceil(d.height) + 24)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#2A0F4C]" />
      </div>
    );
  }

  if (lp?.custom_html) {
    return (
      <>
        <CustomLandingFrame html={lp.custom_html} tracking={{ metaPixelId: lp.smartops_forms.tracking_meta_pixel_id }} onWhatsApp={openSimulator} />
        <AttendanceDialog open={liaOpen} onOpenChange={(o) => { setLiaOpen(o); if (!o) setSimLiaUrl(null); }} url={liaUrl} />
      </>
    );
  }

  if (notFound || !lp || !lp.content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#202331]">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Landing page não encontrada</h1>
          <p className="text-sm text-muted-foreground">O endereço /lp/{slug} não corresponde a nenhuma página publicada.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PremiumLandingTemplate
        content={lp.content}
        formId={lp.smartops_forms.id}
        heroImageUrl={lp.hero_image_url}
        onCta={(source) => {
          const ch = source === "hero-secondary" ? "specialist" : "form";
          if (ch === "specialist") trackAttendanceEvent({ channel: "specialist", event_type: "click", form_id: lp.smartops_forms.id });
          setModalChannel(ch);
          setModalOpen(true);
        }}
        onWhatsApp={openLia}
        formSlot={
          inlineFormUrl ? (
            <iframe
              title={`Formulário ${lp.smartops_forms.name}`}
              src={inlineFormUrl}
              className="w-full border-0 bg-transparent"
              style={{ height: inlineHeight, display: "block", overflow: "auto" }}
              scrolling="auto"
              onLoad={(event) => {
                const iframe = event.currentTarget;
                syncInlineIframeHeight(iframe);
                [120, 320, 720, 1200].forEach((delay) => {
                  window.setTimeout(() => syncInlineIframeHeight(iframe), delay);
                });
              }}
            />
          ) : null
        }
      />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Formulário — {lp.smartops_forms.name}</DialogTitle>
          <DialogDescription className="sr-only">Preencha para continuar</DialogDescription>
          {iframeUrl && (
            <iframe
              title={`Formulário ${lp.smartops_forms.name}`}
              src={iframeUrl}
              className="w-full h-[80vh] border-0 bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
      <AttendanceDialog open={liaOpen} onOpenChange={setLiaOpen} url={liaUrl} />
    </>
  );
}