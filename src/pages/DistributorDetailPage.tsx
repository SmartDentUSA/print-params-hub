import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, MessageCircle, Mail, ArrowLeft, MapPinned } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";

const BASE_URL = "https://parametros.smartdent.com.br";

const COUNTRIES = [
  { slug: "brasil",                aliases: ["brazil","br"],                 name: "Brasil",                iso: "BR", prep: "no" },
  { slug: "chile",                 aliases: ["cl"],                          name: "Chile",                 iso: "CL", prep: "no" },
  { slug: "colombia",              aliases: ["colômbia","co"],               name: "Colômbia",              iso: "CO", prep: "na" },
  { slug: "costa-rica",            aliases: ["costarica","cr"],              name: "Costa Rica",            iso: "CR", prep: "na" },
  { slug: "republica-dominicana",  aliases: ["dominicana","do"],             name: "República Dominicana",  iso: "DO", prep: "na" },
  { slug: "estados-unidos",        aliases: ["eua","usa","united-states"],   name: "Estados Unidos",        iso: "US", prep: "nos" },
  { slug: "uruguai",               aliases: ["uruguay","uy"],                name: "Uruguai",               iso: "UY", prep: "no" },
  { slug: "venezuela",             aliases: ["ve"],                          name: "Venezuela",             iso: "VE", prep: "na" },
] as const;

function normalizeKey(s?: string | null) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
function findCountry(slugOrName?: string | null) {
  const k = normalizeKey(slugOrName);
  return COUNTRIES.find(c => c.slug === k || c.aliases.includes(k as any) || normalizeKey(c.name) === k);
}

interface D {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  endereco: string | null;
  cep: string | null;
  site_url: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp: string | null;
  owner_whatsapp_ddi: string | null;
  logo_url: string | null;
  authorized_scope: any;
  slug: string | null;
}

export default function DistributorDetailPage() {
  const { countrySlug, distSlug } = useParams<{ countrySlug: string; distSlug: string }>();
  const country = findCountry(countrySlug);
  const [d, setD] = useState<D | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!country || !distSlug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("distributors")
        .select("id,razao_social,nome_fantasia,pais,estado,cidade,endereco,cep,site_url,instagram,facebook,linkedin,youtube,owner_name,owner_email,owner_whatsapp,owner_whatsapp_ddi,logo_url,authorized_scope,slug")
        .eq("active", true);
      const list = ((data || []) as D[]).filter(x => findCountry(x.pais)?.slug === country.slug);
      const want = normalizeKey(distSlug);
      const found = list.find(x =>
        (x.slug || "").toLowerCase() === want ||
        normalizeKey(x.nome_fantasia || "") === want ||
        normalizeKey(x.razao_social || "") === want
      ) || null;
      setD(found);
      setLoading(false);
    })();
  }, [country, distSlug]);

  if (!countrySlug || !distSlug) return <Navigate to="/distribuidores" replace />;
  if (!country) return <Navigate to="/distribuidores" replace />;

  if (loading) {
    return (<><Header /><main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem", color: "#64748b" }}>Carregando…</main></>);
  }
  if (!d) {
    return (
      <>
        <Header />
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem", textAlign: "center" }}>
          <h1 style={{ color: "#0f172a" }}>Distribuidor não encontrado</h1>
          <p><Link to={`/distribuidores/${country.slug}`} style={{ color: "#2563eb" }}>Ver distribuidores em {country.name}</Link></p>
        </main>
      </>
    );
  }

  const slug = d.slug || normalizeKey(d.nome_fantasia || d.razao_social || "");
  const canonical = `${BASE_URL}/distribuidores/${country.slug}/${slug}`;
  const name = d.nome_fantasia || d.razao_social || "Distribuidor";
  const local = [d.cidade, d.estado].filter(Boolean).join(" / ");
  const scope = Array.isArray(d.authorized_scope) ? d.authorized_scope.join(", ") : Object.keys(d.authorized_scope || {}).filter(c => !/sku|produto|cobertura/i.test(c)).join(", ");
  const waDigits = d.owner_whatsapp ? `${(d.owner_whatsapp_ddi || "").replace(/\D/g,"")}${d.owner_whatsapp.replace(/\D/g,"")}` : "";
  const mapsQ = encodeURIComponent([d.endereco, d.cidade, d.estado, country.name].filter(Boolean).join(", "));

  const title = `${name} — Distribuidor Oficial Smart Dent ${country.prep} ${country.name}`;
  const description = `${name} é distribuidor autorizado Smart Dent ${country.prep} ${country.name}${local ? ` (${local})` : ""}. Endereço, telefone, WhatsApp, site e linhas representadas.`;

  const localBusinessLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Store"],
    "@id": canonical,
    "name": name,
    "url": canonical,
    "logo": d.logo_url || undefined,
    "image": d.logo_url || undefined,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": d.endereco || undefined,
      "addressLocality": d.cidade || undefined,
      "addressRegion": d.estado || undefined,
      "postalCode": d.cep || undefined,
      "addressCountry": country.iso,
    },
    "telephone": waDigits ? `+${waDigits}` : undefined,
    "email": d.owner_email || undefined,
    "sameAs": [d.site_url, d.instagram, d.facebook, d.linkedin, d.youtube].filter(Boolean),
    "areaServed": country.name,
    "brand": { "@type": "Brand", "name": "Smart Dent", "url": "https://www.smartdent.com.br" },
    "parentOrganization": { "@type": "Organization", "name": "Smart Dent", "url": "https://www.smartdent.com.br" },
    "description": scope ? `Distribuidor oficial Smart Dent em ${country.name} — linhas autorizadas: ${scope}.` : undefined,
  }), [d, country, canonical, name, scope, waDigits]);

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="business.business" />
        {d.logo_url && <meta property="og:image" content={d.logo_url} />}
        <script type="application/ld+json">{JSON.stringify(localBusinessLd)}</script>
      </Helmet>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <nav style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          <Link to="/" style={{ color: "#2563eb", textDecoration: "none" }}>Smart Dent</Link> ›{" "}
          <Link to="/distribuidores" style={{ color: "#2563eb", textDecoration: "none" }}>Distribuidores</Link> ›{" "}
          <Link to={`/distribuidores/${country.slug}`} style={{ color: "#2563eb", textDecoration: "none" }}>{country.name}</Link> ›{" "}
          <span>{name}</span>
        </nav>

        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          {d.logo_url ? (
            <img src={d.logo_url} alt={name} style={{ width: 88, height: 88, objectFit: "contain", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", padding: 6 }} />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: 10, background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 32 }}>{name.charAt(0)}</div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: "#0f172a" }}>{name}</h1>
            <p style={{ margin: ".25rem 0 0", color: "#475569" }}>Distribuidor Oficial Smart Dent {country.prep} {country.name}</p>
          </div>
        </header>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "1.1rem", background: "#fff", marginBottom: 14 }}>
          <h2 style={{ margin: "0 0 .6rem", fontSize: 16, color: "#0f172a" }}>Contato e endereço</h2>
          {d.razao_social && d.razao_social !== d.nome_fantasia && <p style={{ margin: ".2rem 0" }}><strong>Razão social:</strong> {d.razao_social}</p>}
          {d.endereco && <p style={{ margin: ".2rem 0", display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> {d.endereco}</p>}
          {local && <p style={{ margin: ".2rem 0" }}>{local} — {country.name}</p>}
          {d.cep && <p style={{ margin: ".2rem 0" }}><strong>CEP/ZIP:</strong> {d.cep}</p>}
          {waDigits && <p style={{ margin: ".2rem 0", display: "flex", alignItems: "center", gap: 6 }}><MessageCircle size={14} color="#16a34a" /> <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener nofollow" style={{ color: "#16a34a" }}>WhatsApp +{waDigits}</a></p>}
          {d.owner_email && <p style={{ margin: ".2rem 0", display: "flex", alignItems: "center", gap: 6 }}><Mail size={14} color="#2563eb" /> <a href={`mailto:${d.owner_email}`} style={{ color: "#2563eb" }}>{d.owner_email}</a></p>}
          {mapsQ && <p style={{ margin: ".4rem 0 0", display: "flex", alignItems: "center", gap: 6 }}><MapPinned size={14} color="#2563eb" /> <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQ}`} target="_blank" rel="noopener nofollow" style={{ color: "#2563eb" }}>Abrir no Google Maps</a></p>}
          <p style={{ margin: ".7rem 0 0", display: "flex", gap: 10, flexWrap: "wrap" }}>
            {d.site_url && <a href={d.site_url} target="_blank" rel="noopener nofollow" style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 4 }}><Globe size={14}/> Site oficial</a>}
            {d.instagram && <a href={d.instagram} target="_blank" rel="noopener nofollow" style={{ color: "#E1306C", display: "inline-flex", alignItems: "center", gap: 4 }}><Instagram size={14}/> Instagram</a>}
            {d.facebook && <a href={d.facebook} target="_blank" rel="noopener nofollow" style={{ color: "#1877F2", display: "inline-flex", alignItems: "center", gap: 4 }}><Facebook size={14}/> Facebook</a>}
            {d.linkedin && <a href={d.linkedin} target="_blank" rel="noopener nofollow" style={{ color: "#0A66C2", display: "inline-flex", alignItems: "center", gap: 4 }}><Linkedin size={14}/> LinkedIn</a>}
            {d.youtube && <a href={d.youtube} target="_blank" rel="noopener nofollow" style={{ color: "#FF0000", display: "inline-flex", alignItems: "center", gap: 4 }}><Youtube size={14}/> YouTube</a>}
          </p>
        </section>

        {scope && (
          <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "1.1rem", background: "#fff", marginBottom: 14 }}>
            <h2 style={{ margin: "0 0 .4rem", fontSize: 16, color: "#0f172a" }}>Linhas Smart Dent representadas</h2>
            <p style={{ margin: 0, color: "#334155" }}>{scope}</p>
          </section>
        )}

        <section style={{ background: "#eff6ff", border: "1px solid #2563eb33", borderRadius: 10, padding: "1rem" }}>
          <p style={{ margin: 0, color: "#0f172a", fontSize: 14 }}>
            <strong>Selo Distribuidor Oficial:</strong> esta página é a fonte oficial Smart Dent confirmando que <strong>{name}</strong> é distribuidor autorizado {country.prep} {country.name}.
          </p>
        </section>

        <p style={{ marginTop: 24 }}>
          <Link to={`/distribuidores/${country.slug}`} style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Outros distribuidores em {country.name}
          </Link>
        </p>
      </main>
    </>
  );
}