import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Flag, Loader2, MapPin, MessageCircle, Pencil, PlayCircle, ShieldCheck, Share2 } from "lucide-react";
import {
  categoryLabel, conditionLabel, formatPrice, imageList, isVideoUrl, parseDescription, whatsappLink,
  type PublicListing,
} from "@/lib/classifieds";

const REPORT_REASONS = [
  { value: "vendido", label: "Já foi vendido" },
  { value: "golpe", label: "Suspeita de golpe" },
  { value: "duplicado", label: "Anúncio duplicado" },
  { value: "conteudo", label: "Conteúdo inadequado" },
  { value: "outro", label: "Outro motivo" },
];

export default function UsadosDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [contacting, setContacting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("vendido");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slug);
      const { data } = await (supabase as any)
        .from("v_classifieds_public")
        .select("*")
        .eq(isUuid ? "id" : "slug", slug)
        .maybeSingle();
      setListing((data as PublicListing) ?? null);
      setLoading(false);
      if (data?.id) {
        await supabase.rpc("increment_listing_view" as never, { p_listing: data.id } as never);
        // Dono do anúncio: a RPC segura só devolve os anúncios do usuário autenticado.
        const { data: mine } = await (supabase as any).rpc("fn_my_classifieds");
        setIsOwner(Array.isArray(mine) && mine.some((m: { id: string }) => m.id === data.id));
      }
    })();
  }, [slug]);

  async function contact() {
    if (!listing) return;
    setContacting(true);
    const { data, error } = await supabase.functions.invoke("classifieds-contact", {
      body: { listing_id: listing.id },
    });
    setContacting(false);
    if (error) {
      toast({ title: "Não foi possível abrir a conversa", variant: "destructive" });
      return;
    }
    window.open(whatsappLink((data as { whatsapp?: string })?.whatsapp, listing.title), "_blank");
  }

  async function share() {
    const url = window.location.href;
    const text = `${listing?.title} — ${formatPrice(listing?.price ?? null)}\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: listing?.title, text, url }); return; } catch { /* cancelado */ }
    }
    await navigator.clipboard.writeText(text);
    toast({ title: "Link copiado" });
  }

  async function submitReport() {
    if (!listing) return;
    setReporting(true);
    const { error } = await (supabase as any).from("classified_reports").insert({
      listing_id: listing.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setReporting(false);
    if (error) {
      toast({ title: "Não foi possível enviar a denúncia", description: error.message, variant: "destructive" });
      return;
    }
    setReportOpen(false);
    setReportDetails("");
    toast({ title: "Obrigado", description: "Nossa equipe vai avaliar este anúncio." });
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl space-y-4 p-4"><Skeleton className="h-72 w-full rounded-xl" /><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /></div>;
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Anúncio não disponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ele pode ter sido vendido ou expirado.</p>
        <Button asChild className="mt-4"><Link to="/usados">Ver outros equipamentos</Link></Button>
      </div>
    );
  }

  const images = imageList(listing.images);
  const cover = images[active];
  const local = [listing.location_city, listing.location_state].filter(Boolean).join("/");
  const desc = parseDescription(listing.description);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>{`${listing.title} usado ${local ? `em ${local}` : ""} | Smart Dent`.slice(0, 60)}</title>
        <meta name="description" content={(listing.description || `${categoryLabel(listing.category)} usado à venda por ${formatPrice(listing.price)}.`).slice(0, 155)} />
        <link rel="canonical" href={`https://admin.smartdent.com.br/usados/${listing.slug || listing.id}`} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={listing.title} />
        <meta property="og:description" content={(listing.description || "").slice(0, 155)} />
        {cover && <meta property="og:image" content={cover} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: listing.description || undefined,
          image: images,
          category: categoryLabel(listing.category),
          itemCondition: "https://schema.org/UsedCondition",
          offers: listing.price != null ? {
            "@type": "Offer",
            price: listing.price,
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
          } : undefined,
        })}</script>
      </Helmet>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/usados"><ArrowLeft className="mr-1 h-4 w-4" /> Equipamentos usados</Link>
        </Button>

        <div className="overflow-hidden rounded-xl border bg-muted">
          {cover ? (
            <img src={cover} alt={listing.title} className="aspect-[4/3] w-full bg-white object-contain" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">Sem foto</div>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button key={img + i} onClick={() => setActive(i)}
                className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-primary" : "border-transparent"}`}>
                <img src={img} alt={`Foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{categoryLabel(listing.category)}</Badge>
          <Badge variant="outline">{conditionLabel(listing.condition)}</Badge>
          {listing.is_cliente && <Badge className="bg-primary text-primary-foreground">Cliente Smart Dent</Badge>}
          {isOwner && (
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to={`/usados/meus-anuncios?edit=${listing.id}`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar anúncio
              </Link>
            </Button>
          )}
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">{listing.title}</h1>
        <p className="mt-1 text-3xl font-bold text-primary">{formatPrice(listing.price)}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" /> {local || "Localização não informada"}
        </p>

        {desc.text && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Sobre o equipamento</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{desc.text}</p>
            </CardContent>
          </Card>
        )}

        {desc.specs.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-0">
              <h2 className="border-b px-4 py-3 text-sm font-semibold">Ficha técnica</h2>
              <dl className="divide-y sm:grid sm:grid-cols-2 sm:divide-y-0">
                {desc.specs.map((s, i) => (
                  <div key={s.label + i}
                    className="flex flex-col gap-0.5 px-4 py-2.5 sm:border-b sm:odd:border-r">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                    <dd className="text-sm font-medium leading-snug">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        <Card className="mt-4"><CardContent className="p-4 text-sm">
          <p className="font-medium">Anunciante</p>
          <p className="text-muted-foreground">{listing.seller_name || "Profissional da odontologia"}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            A Smart Dent apenas conecta comprador e vendedor. A negociação, o pagamento e o
            transporte são de responsabilidade das partes.
          </p>
        </CardContent></Card>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
          </Button>
          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Flag className="mr-2 h-4 w-4" /> Denunciar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Denunciar anúncio</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Motivo</Label>
                  <Select value={reportReason} onValueChange={setReportReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Detalhes (opcional)</Label>
                  <Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitReport} disabled={reporting}>
                  {reporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar denúncia
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]" size="lg"
            onClick={contact} disabled={contacting}>
            {contacting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageCircle className="mr-2 h-5 w-5" />}
            Falar com o anunciante
          </Button>
        </div>
      </div>
    </div>
  );
}
