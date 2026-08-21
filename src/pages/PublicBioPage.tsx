import { useParams } from "react-router-dom";
import { getPublicOrigin } from "@/utils/publicOrigin";
import { Helmet } from "react-helmet-async";
import { Instagram, Youtube, Facebook, Linkedin, Globe, MessageCircle, Share2, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBioPage, DEFAULT_LOGO_URL, type BioItem, type BioSocialLinks } from "@/hooks/useBioPages";
import { useEffect, useState } from "react";

const SOCIAL_ICONS: Array<{ key: keyof BioSocialLinks; Icon: typeof Instagram; label: string }> = [
  { key: "instagram", Icon: Instagram, label: "Instagram" },
  { key: "youtube", Icon: Youtube, label: "YouTube" },
  { key: "facebook", Icon: Facebook, label: "Facebook" },
  { key: "linkedin", Icon: Linkedin, label: "LinkedIn" },
  { key: "whatsapp", Icon: MessageCircle, label: "WhatsApp" },
  { key: "website", Icon: Globe, label: "Site" },
];

function BioCard({ item }: { item: BioItem }) {
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setImageAspectRatio(null);
  }, [item.image_url]);

  return (
    <a
      href={item.url}
      target={item.url.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="group flex h-fit w-full max-w-xs flex-col self-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className="relative w-full overflow-hidden bg-muted"
        style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : undefined}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.label}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setImageAspectRatio(naturalWidth / naturalHeight);
              }
            }}
            className="block h-auto w-full transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
            <ArrowRight className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h2 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{item.label}</h2>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90">
          {item.button_text || "Acessar"}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </a>
  );
}

export default function PublicBioPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading } = useBioPage(slug);

  const share = async () => {
    const url = `${getPublicOrigin()}/bio/${page?.slug ?? ""}`;
    const title = page?.title ?? "Smart Dent";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Página não encontrada ou desativada.</p>
      </div>
    );
  }

  const socials = SOCIAL_ICONS.filter(({ key }) => !!page.social_links?.[key]);
  const canonicalUrl = `${getPublicOrigin()}/bio/${page.slug}`;
  const description = page.subtitle || `Links oficiais de ${page.title}.`;
  const image = page.logo_url || DEFAULT_LOGO_URL;
  const sameAs = socials.map(({ key }) => page.social_links?.[key]).filter(Boolean);

  const profileSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": canonicalUrl,
    "name": page.title,
    "description": description,
    "url": canonicalUrl,
    "mainEntity": {
      "@type": "Person",
      "name": page.title,
      "description": page.subtitle || undefined,
      "image": image,
      "url": canonicalUrl,
      "sameAs": sameAs,
    },
  };

  const linksSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": page.items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.label,
      "url": item.url,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${page.title} | Smart Dent | Fluxo Digital`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={image} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(profileSchema)}</script>
        {page.items.length > 0 && (
          <script type="application/ld+json">{JSON.stringify(linksSchema)}</script>
        )}
      </Helmet>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <header className="flex flex-col items-center text-center">
          <img
            src={page.logo_url || DEFAULT_LOGO_URL}
            alt={`Logo ${page.title}`}
            className="h-20 w-20 rounded-2xl object-contain shadow-sm"
          />
          <h1 className="mt-4 text-2xl font-bold text-foreground">{page.title}</h1>
          {page.subtitle && <p className="mt-1 text-sm text-muted-foreground">{page.subtitle}</p>}
        </header>

        <section
          className={
            page.items.length === 1
              ? "mt-8 flex justify-center"
              : "mt-8 grid grid-cols-2 items-start justify-items-center gap-3 sm:gap-4"
          }
        >
          {page.items.map((item) => (
            <BioCard key={item.id} item={item} />
          ))}
        </section>

        {page.items.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">Nenhum link publicado ainda.</p>
        )}

        <div className="mt-12 flex flex-col items-center gap-4">
          {socials.length > 0 && (
            <nav aria-label="Redes sociais" className="flex items-center gap-2">
              {socials.map(({ key, Icon, label }) => (
                <a
                  key={key}
                  href={page.social_links[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </nav>
          )}

          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartilhar
          </button>
        </div>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Smart Dent | Fluxo Digital
        </footer>
      </main>
    </div>
  );
}