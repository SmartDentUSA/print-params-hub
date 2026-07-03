import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { PremiumLandingTemplate, type LPContent } from "@/components/lp/PremiumLandingTemplate";

type LandingPage = {
  id: string;
  content: LPContent | null;
  hero_image_url: string | null;
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

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("smartops_form_landing_pages")
        .select("id, content, hero_image_url, status, smartops_forms:form_id(id,name,slug,title,subtitle,description)")
        .eq("status", "published");

      const row = Array.isArray(data) ? data.find((r: any) => r.smartops_forms?.slug === slug) : null;
      if (row && row.content && row.content.hero) setLp(row as LandingPage);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [slug]);

  // Load Inter + Manrope
  useEffect(() => {
    if (!lp) return;
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
        heroImageUrl={lp.hero_image_url}
        onCta={() => setModalOpen(true)}
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
    </>
  );
}