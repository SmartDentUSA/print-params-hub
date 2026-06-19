import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, MessageCircle, ArrowLeft } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";

const BASE_URL = "https://parametros.smartdent.com.br";

type CountryDef = { slug: string; aliases: string[]; name: string; iso: string; prep: string };
const COUNTRIES: CountryDef[] = [
  { slug: "brasil",                aliases: ["brazil","br"],                 name: "Brasil",                iso: "BR", prep: "no" },
  { slug: "chile",                 aliases: ["cl"],                          name: "Chile",                 iso: "CL", prep: "no" },
  { slug: "colombia",              aliases: ["colômbia","co"],               name: "Colômbia",              iso: "CO", prep: "na" },
  { slug: "costa-rica",            aliases: ["costarica","cr"],              name: "Costa Rica",            iso: "CR", prep: "na" },
  { slug: "republica-dominicana",  aliases: ["dominicana","do"],             name: "República Dominicana",  iso: "DO", prep: "na" },
  { slug: "estados-unidos",        aliases: ["eua","usa","united-states"],   name: "Estados Unidos",        iso: "US", prep: "nos" },
  { slug: "uruguai",               aliases: ["uruguay","uy"],                name: "Uruguai",               iso: "UY", prep: "no" },
  { slug: "venezuela",             aliases: ["ve"],                          name: "Venezuela",             iso: "VE", prep: "na" },
];

function normalizeKey(s?: string | null) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
function findCountry(slugOrName?: string | null) {
  const k = normalizeKey(slugOrName);
  return COUNTRIES.find(c => c.slug === k || c.aliases.includes(k) || normalizeKey(c.name) === k);
}

interface Distributor {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  endereco: string | null;
  site_url: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  owner_whatsapp: string | null;
  owner_whatsapp_ddi: string | null;
  logo_url: string | null;
  authorized_scope: any;
  slug: string | null;
}

function waLink(ddi?: string | null, phone?: string | null) {
  if (!phone) return null;
  const digits = `${ddi || ""}${phone}`.replace(/\D+/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default function DistributorCountryPage() {
  const { countrySlug } = useParams<{ countrySlug: string }>();
  const country = findCountry(countrySlug);
  const [rows, setRows] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!country) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("distributors")
        .select("id,razao_social,nome_fantasia,pais,estado,cidade,endereco,site_url,instagram,facebook,linkedin,youtube,owner_whatsapp,owner_whatsapp_ddi,logo_url,authorized_scope,slug")
        .eq("active", true);
      setRows(((data || []) as Distributor[]).filter(d => normalizeKey(d.pais) === country.slug || findCountry(d.pais)?.slug === country.slug));
      setLoading(false);
    })();
  }, [country]);

  if (!countrySlug) return <Navigate to="/distribuidores" replace />;
  if (!country) {
    return (
      <>
        <Header />
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem", textAlign: "center" }}>
          <h1 style={{ color: "#0f172a" }}>País não encontrado</h1>
          <p><Link to="/distribuidores" style={{ color: "#2563eb" }}>Ver todos os distribuidores Smart Dent</Link></p>
        </main>
      </>
    );
  }

  const canonical = `${BASE_URL}/distribuidores/${country.slug}`;
  const title = `Distribuidores Oficiais Smart Dent ${country.prep} ${country.name} | Onde Comprar`;
  const description = `Lista oficial de distribuidores Smart Dent ${country.prep} ${country.name}: endereço, telefone, WhatsApp, site e linhas representadas. Onde comprar resina 3D Smart Print Bio Vitality, scanners, impressoras e kits SmartMake.`;

  const itemListLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Distribuidores Smart Dent em ${country.name}`,
    "itemListElement": rows.map((d, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${canonical}/${d.slug || normalizeKey(d.nome_fantasia || d.razao_social)}`,
      "item": {
        "@type": ["LocalBusiness", "Store"],
        "name": d.nome_fantasia || d.razao_social,
        "url": `${canonical}/${d.slug || normalizeKey(d.nome_fantasia || d.razao_social)}`,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": d.endereco || undefined,
          "addressLocality": d.cidade || undefined,
          "addressRegion": d.estado || undefined,
          "addressCountry": country.iso,
        },
        "brand": { "@type": "Brand", "name": "Smart Dent" },
      },
    })),
  }), [rows, canonical, country]);

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>
      <Header />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <nav style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          <Link to="/" style={{ color: "#2563eb", textDecoration: "none" }}>Smart Dent</Link> ›{" "}
          <Link to="/distribuidores" style={{ color: "#2563eb", textDecoration: "none" }}>Distribuidores</Link> ›{" "}
          <span>{country.name}</span>
        </nav>
        <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <span className={`fi fi-${country.iso.toLowerCase()}`} style={{ width: 56, height: 42, borderRadius: 4, boxShadow: "0 0 0 1px rgba(15,23,42,.12)" }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 26, color: "#0f172a" }}>Distribuidores Smart Dent {country.prep} {country.name}</h1>
            <p style={{ margin: ".25rem 0 0", color: "#475569", maxWidth: 760 }}>{description}</p>
          </div>
        </header>

        {loading ? (
          <p style={{ color: "#64748b" }}>Carregando…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#64748b" }}>Lista em atualização. <Link to="/distribuidores" style={{ color: "#2563eb" }}>Ver outros países</Link>.</p>
        ) : (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {rows.map(d => {
              const slug = d.slug || normalizeKey(d.nome_fantasia || d.razao_social || "");
              const name = d.nome_fantasia || d.razao_social || "Distribuidor";
              const wa = waLink(d.owner_whatsapp_ddi, d.owner_whatsapp);
              return (
                <article key={d.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "1rem", background: "#fff", display: "flex", gap: 12 }}>
                  {d.logo_url ? (
                    <img src={d.logo_url} alt={name} style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22 }}>{name.charAt(0)}</div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>
                      <Link to={`/distribuidores/${country.slug}/${slug}`} style={{ color: "#0f172a", textDecoration: "none" }}>{name}</Link>
                    </h2>
                    {(d.cidade || d.estado) && (
                      <p style={{ margin: ".2rem 0 0", fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={12} /> {[d.cidade, d.estado].filter(Boolean).join(" / ")}
                      </p>
                    )}
                    <p style={{ margin: ".5rem 0 0", fontSize: 13, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link to={`/distribuidores/${country.slug}/${slug}`} style={{ color: "#2563eb" }}>Ficha completa</Link>
                      {d.site_url && <a href={d.site_url} target="_blank" rel="noopener nofollow" style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 4 }}><Globe size={12}/> Site</a>}
                      {wa && <a href={wa} target="_blank" rel="noopener nofollow" style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 4 }}><MessageCircle size={12}/> WhatsApp</a>}
                      {d.instagram && <a href={d.instagram} target="_blank" rel="noopener nofollow" style={{ color: "#E1306C", display: "inline-flex", alignItems: "center", gap: 4 }}><Instagram size={12}/></a>}
                      {d.facebook && <a href={d.facebook} target="_blank" rel="noopener nofollow" style={{ color: "#1877F2" }}><Facebook size={12}/></a>}
                      {d.linkedin && <a href={d.linkedin} target="_blank" rel="noopener nofollow" style={{ color: "#0A66C2" }}><Linkedin size={12}/></a>}
                      {d.youtube && <a href={d.youtube} target="_blank" rel="noopener nofollow" style={{ color: "#FF0000" }}><Youtube size={12}/></a>}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <p style={{ marginTop: 28 }}>
          <Link to="/distribuidores" style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Ver todos os países
          </Link>
        </p>
      </main>
    </>
  );
}