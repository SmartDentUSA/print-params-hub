import { Helmet } from "react-helmet-async";

interface AboutSEOHeadProps {
  company: {
    name: string;
    description: string;
    logo_url?: string;
    website_url?: string;
    social_media?: {
      instagram?: string;
      youtube?: string;
      facebook?: string;
      linkedin?: string;
      twitter?: string;
      tiktok?: string;
    };
    corporate: {
      mission?: string;
      vision?: string;
      values?: string[];
      founded_year?: number;
      team_size?: string;
    };
  };
}

export const AboutSEOHead = ({ company }: AboutSEOHeadProps) => {
  const baseUrl = "https://parametros.smartdent.com.br";
  const canonicalUrl = `${baseUrl}/sobre`;
  
  const seoTitle = `Sobre Nós - ${company.name} | Impressão 3D Odontológica`;
  const metaDescription = company.description?.substring(0, 155) || 
    `Conheça a ${company.name}, especialista em impressão 3D odontológica. Nossa missão, visão e valores.`;
  const ogImage = company.logo_url || `${baseUrl}/og-image.jpg`;
  
  const keywords = [
    company.name,
    "sobre nós",
    "impressão 3D odontológica",
    "odontologia digital",
    "Smart Dent",
    "missão",
    "visão",
    "valores"
  ].join(", ");
  
  // Organization Schema
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    "name": company.name,
    "url": baseUrl,
    "logo": ogImage,
    "description": company.description,
    ...(company.corporate.founded_year && { "foundingDate": company.corporate.founded_year.toString() }),
    "sameAs": [
      company.social_media?.instagram,
      company.social_media?.youtube,
      company.social_media?.facebook,
      company.social_media?.linkedin,
      company.social_media?.twitter,
      company.social_media?.tiktok
    ].filter(Boolean),
    "knowsAbout": [
      "Impressão 3D Odontológica",
      "Resinas Dentais 3D",
      "Parâmetros de Impressão",
      "Odontologia Digital"
    ]
  };
  
  // BreadcrumbList Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Sobre Nós",
        "item": canonicalUrl
      }
    ]
  };
  
  // AboutPage Schema
  const aboutPageSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": seoTitle,
    "description": metaDescription,
    "url": canonicalUrl,
    "mainEntity": organizationSchema
  };
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{seoTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Smart Dent" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* AI Meta Tags */}
      <meta name="ai-content-type" content="aboutpage" />
      <meta name="ai-topic" content="empresa, impressão 3D odontológica, Smart Dent, odontologia digital" />
      
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="PrinterParams Smart Dent" />
      <meta property="og:locale" content="pt_BR" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(aboutPageSchema)}
      </script>
    </Helmet>
  );
};
