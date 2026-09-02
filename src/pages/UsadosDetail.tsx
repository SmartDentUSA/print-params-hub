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
  CLASSIFIED_FIELD_LABELS, categoryLabel, conditionLabel, formatPrice, imageList, isVideoUrl,
  splitDescription, whatsappLink, type ClassifiedFieldKey, type PublicListing,
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
  const [fetchError, setFetchError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
...
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      setFetchError(false);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slug);
      const { data, error } = await (supabase as any)
        .from("v_classifieds_public")
        .select("*")
        .eq(isUuid ? "id" : "slug", slug)
        .maybeSingle();
      if (error) {
        setFetchError(true);
        setListing(null);
        setLoading(false);
        return;
      }
      setListing((data as PublicListing) ?? null);
      setLoading(false);
      if (data?.id) {
        await supabase.rpc("increment_listing_view" as never, { p_listing: data.id } as never);
        // Dono do anúncio: a RPC segura só devolve os anúncios do usuário autenticado.
        const { data: mine } = await (supabase as any).rpc("fn_my_classifieds");
        setIsOwner(Array.isArray(mine) && mine.some((m: { id: string }) => m.id === data.id));
      }
    })();
  }, [slug, retryNonce]);

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

  const media = imageList(listing.images);
  const images = media.filter((m) => !isVideoUrl(m));
  const current = media[Math.min(active, Math.max(media.length - 1, 0))];
  const cover = images[0];
  const local = [listing.location_city, listing.location_state].filter(Boolean).join("/");
  const desc = splitDescription(listing.description);
  const commercial = (Object.keys(CLASSIFIED_FIELD_LABELS) as ClassifiedFieldKey[])
    .filter((k) => desc.fields[k])
    .map((k) => ({ label: CLASSIFIED_FIELD_LABELS[k], value: desc.fields[k] }));

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

      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/usados"><ArrowLeft className="mr-1 h-4 w-4" /> Equipamentos usados</Link>
          </Button>
          {isOwner && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/usados/meus-anuncios?edit=${listing.id}`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar anúncio
              </Link>
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Galeria */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              {current ? (
                isVideoUrl(current) ? (
                  <video src={current} controls playsInline
                    className="aspect-[4/3] w-full bg-black object-contain" />
                ) : (
                  <img src={current} alt={listing.title}
                    className="aspect-[4/3] w-full bg-white object-contain" />
                )
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">
                  Sem foto
                </div>
              )}
            </div>

            {media.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {media.map((m, i) => (
                  <button key={m + i} onClick={() => setActive(i)} aria-label={`Mídia ${i + 1}`}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 bg-muted transition ${
                      i === active ? "border-primary" : "border-border hover:border-muted-foreground/40"
                    }`}>
                    {isVideoUrl(m) ? (
                      <>
                        <video src={m} muted preload="metadata" className="h-full w-full bg-black object-cover" />
                        <PlayCircle className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
                      </>
                    ) : (
                      <img src={m} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {desc.text && (
              <Card className="mt-6 rounded-2xl">
                <CardContent className="p-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Sobre o equipamento
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{desc.text}</p>
                </CardContent>
              </Card>
            )}

            {desc.specs.length > 0 && (
              <Card className="mt-4 overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                  <h2 className="border-b bg-muted/40 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Ficha técnica
                  </h2>
                  <dl className="divide-y sm:grid sm:grid-cols-2 sm:divide-y-0">
                    {desc.specs.map((s, i) => (
                      <div key={s.label + i}
                        className="flex flex-col gap-0.5 px-5 py-3 sm:border-b sm:odd:border-r">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                        <dd className="text-sm font-medium leading-snug">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna de negociação */}
          <div className="min-w-0">
            <div className="lg:sticky lg:top-6 space-y-4">
              <Card className="rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{categoryLabel(listing.category)}</Badge>
                    <Badge variant="outline">{conditionLabel(listing.condition)}</Badge>
                  </div>
                  <h1 className="mt-3 text-xl font-bold leading-snug tracking-tight">{listing.title}</h1>
                  <p className="mt-2 text-3xl font-bold text-primary">{formatPrice(listing.price)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {local || "Localização não informada"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" /> {listing.view_count ?? 0} visualizações
                    </span>
                  </div>

                  {commercial.length > 0 && (
                    <dl className="mt-4 space-y-2 rounded-xl border bg-muted/30 p-3">
                      {commercial.map((c) => (
                        <div key={c.label} className="flex items-baseline justify-between gap-3 text-sm">
                          <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {c.label}
                          </dt>
                          <dd className="text-right font-medium leading-snug">{c.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <Button className="mt-5 hidden w-full bg-[#25D366] text-white hover:bg-[#1ebe5b] lg:flex"
                    size="lg" onClick={contact} disabled={contacting}>
                    {contacting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageCircle className="mr-2 h-5 w-5" />}
                    Falar com o anunciante
                  </Button>

                  <div className="mt-4 flex items-center gap-2 border-t pt-4">
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
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {(listing.seller_name || "SD").trim().slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{listing.seller_name || "Profissional da odontologia"}</p>
                      {listing.is_cliente && (
                        <p className="flex items-center gap-1 text-xs text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" /> Cliente Smart Dent
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    A Smart Dent apenas conecta comprador e vendedor. A negociação, o pagamento e o
                    transporte são de responsabilidade das partes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* CTA fixo no mobile */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
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
