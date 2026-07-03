import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type LandingPage = {
  id: string;
  generated_html: string;
  status: string;
  smartops_forms: {
    id: string;
    name: string;
    slug: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
  };
};

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lp, setLp] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("smartops_form_landing_pages")
        .select("id, generated_html, status, smartops_forms:form_id(id,name,slug,title,subtitle,description)")
        .eq("status", "published")
        .eq("smartops_forms.slug", slug);

      const row = Array.isArray(data)
        ? data.find((r: any) => r.smartops_forms?.slug === slug)
        : null;

      if (row) setLp(row as LandingPage);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!lp) return;
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

  // Load Inter + Manrope for the public LP so the AI-generated markup matches design system
  useEffect(() => {
    if (!lp) return;
    const id = "smartdent-lp-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800;900&display=swap";
    document.head.appendChild(link);
  }, [lp]);

  // Bind [data-form-cta] buttons to open the form modal
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !lp) return;
    const handler = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      const btn = target?.closest("[data-form-cta]") as HTMLElement | null;
      if (!btn) return;
      ev.preventDefault();
      setModalOpen(true);
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [lp]);

  const iframeUrl = useMemo(
    () => (lp ? `/f/${lp.smartops_forms.slug}?embed=1&utm_source=landing_page` : null),
    [lp],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#2A0F4C]" />
      </div>
    );
  }

  if (notFound || !lp) {
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
    <div
      className="min-h-screen bg-white text-[#202331] [&_h1]:font-[Manrope,Inter,sans-serif] [&_h2]:font-[Manrope,Inter,sans-serif] [&_h3]:font-[Manrope,Inter,sans-serif]"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <div
        ref={contentRef}
        dangerouslySetInnerHTML={{ __html: lp.generated_html }}
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
    </div>
  );
}