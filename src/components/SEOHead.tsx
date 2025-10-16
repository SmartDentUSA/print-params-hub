import { Helmet } from 'react-helmet-async';

interface Brand {
  name: string;
  slug: string;
  logo_url?: string;
}

interface Model {
  name: string;
  slug: string;
  image_url?: string;
  notes?: string;
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  description?: string;
  image_url?: string;
  price?: number;
  color?: string;
  type?: string;
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
}

interface SEOHeadProps {
  pageType: 'home' | 'brand' | 'model';
  brand?: Brand | null;
  model?: Model | null;
  resins?: Resin[];
}

export const SEOHead = ({ pageType, brand, model, resins = [] }: SEOHeadProps) => {
  const baseUrl = 'https://parametros.smartdent.com.br';
  
  // Generate dynamic title and description
  let title = 'PrinterParams - Parâmetros de Impressão 3D Odontológica | Smart Dent';
  let description = 'Encontre parâmetros otimizados de impressão 3D para sua impressora e resina Smart Dent. Configurações testadas para modelos odontológicos com melhor qualidade e precisão.';
  let canonical = baseUrl;
  let ogImage = 'https://smartdent.com.br/logo-og.png';

  if (pageType === 'brand' && brand) {
    title = `Impressoras ${brand.name} - Parâmetros de Resina 3D | Smart Dent`;
    description = `Configurações testadas para impressoras ${brand.name}. Parâmetros otimizados para resinas odontológicas Smart Dent.`;
    canonical = `${baseUrl}?brand=${brand.slug}`;
    if (brand.logo_url) ogImage = brand.logo_url;
  } else if (pageType === 'model' && brand && model) {
    const resinCount = resins.length;
    title = `${model.name} ${brand.name} - Configurações de Resina para Impressão 3D | Smart Dent`;
    description = `Parâmetros completos para ${model.name} ${brand.name}. ${resinCount} ${resinCount === 1 ? 'resina testada' : 'resinas testadas'} com tempo de cura, altura de camada e intensidade de luz otimizadas.`;
    canonical = `${baseUrl}?brand=${brand.slug}&model=${model.slug}`;
    if (model.image_url) ogImage = model.image_url;
  }

  // Organization Schema
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Smart Dent",
    "url": "https://smartdent.com.br",
    "telephone": "+55-16-993831794",
    "logo": "https://smartdent.com.br/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+55-16-993831794",
      "contactType": "customer service",
      "availableLanguage": ["pt-BR"]
    }
  };

  // BreadcrumbList Schema (for internal pages)
  let breadcrumbSchema = null;
  if (pageType !== 'home') {
    const itemList = [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": baseUrl
      }
    ];

    if (brand) {
      itemList.push({
        "@type": "ListItem",
        "position": 2,
        "name": brand.name,
        "item": `${baseUrl}?brand=${brand.slug}`
      });
    }

    if (model && brand) {
      itemList.push({
        "@type": "ListItem",
        "position": 3,
        "name": model.name,
        "item": `${baseUrl}?brand=${brand.slug}&model=${model.slug}`
      });
    }

    breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": itemList
    };
  }

  // Product/ItemList Schema (for model pages with resins)
  let productSchema = null;
  if (pageType === 'model' && resins.length > 0) {
    if (resins.length === 1) {
      // Single Product Schema with Multiple Offers
      const resin = resins[0];
      
      // Build offers array dynamically
      const offers = [];
      if (resin.cta_1_url && resin.price) {
        offers.push({
          "@type": "Offer",
          "url": resin.cta_1_url,
          "priceCurrency": "BRL",
          "price": resin.price.toString(),
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "Organization",
            "name": resin.cta_1_label || "Vendedor 1"
          }
        });
      }
      if (resin.cta_2_url) {
        offers.push({
          "@type": "Offer",
          "url": resin.cta_2_url,
          "priceCurrency": "BRL",
          "price": resin.price?.toString() || "0",
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "Organization",
            "name": resin.cta_2_label || "Vendedor 2"
          }
        });
      }
      if (resin.cta_3_url) {
        offers.push({
          "@type": "Offer",
          "url": resin.cta_3_url,
          "priceCurrency": "BRL",
          "price": resin.price?.toString() || "0",
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "Organization",
            "name": resin.cta_3_label || "Vendedor 3"
          }
        });
      }
      
      productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": resin.name,
        "brand": {
          "@type": "Brand",
          "name": resin.manufacturer
        },
        "description": resin.description || `Resina ${resin.name} para impressão 3D odontológica`,
        ...(resin.image_url && { "image": resin.image_url }),
        ...(resin.color && { "color": resin.color }),
        ...(resin.type && { "category": resin.type }),
        ...(offers.length > 0 && { 
          "offers": offers.length === 1 ? offers[0] : offers 
        })
      };
    } else {
      // ItemList Schema for multiple resins (each with multiple offers)
      const items = resins
        .filter(resin => resin.cta_1_url || resin.cta_2_url || resin.cta_3_url)
        .map((resin, index) => {
          // Build offers array for each resin
          const offers = [];
          if (resin.cta_1_url && resin.price) {
            offers.push({
              "@type": "Offer",
              "url": resin.cta_1_url,
              "priceCurrency": "BRL",
              "price": resin.price.toString(),
              "availability": "https://schema.org/InStock",
              "seller": {
                "@type": "Organization",
                "name": resin.cta_1_label || "Vendedor 1"
              }
            });
          }
          if (resin.cta_2_url) {
            offers.push({
              "@type": "Offer",
              "url": resin.cta_2_url,
              "priceCurrency": "BRL",
              "price": resin.price?.toString() || "0",
              "availability": "https://schema.org/InStock",
              "seller": {
                "@type": "Organization",
                "name": resin.cta_2_label || "Vendedor 2"
              }
            });
          }
          if (resin.cta_3_url) {
            offers.push({
              "@type": "Offer",
              "url": resin.cta_3_url,
              "priceCurrency": "BRL",
              "price": resin.price?.toString() || "0",
              "availability": "https://schema.org/InStock",
              "seller": {
                "@type": "Organization",
                "name": resin.cta_3_label || "Vendedor 3"
              }
            });
          }
          
          return {
            "@type": "Product",
            "position": index + 1,
            "name": resin.name,
            "brand": {
              "@type": "Brand",
              "name": resin.manufacturer
            },
            "description": resin.description || `Resina ${resin.name} para impressão 3D odontológica`,
            ...(resin.image_url && { "image": resin.image_url }),
            ...(resin.color && { "color": resin.color }),
            ...(resin.type && { "category": resin.type }),
            ...(offers.length > 0 && { 
              "offers": offers.length === 1 ? offers[0] : offers 
            })
          };
        });

      if (items.length > 0) {
        productSchema = {
          "@context": "https://schema.org",
          "@type": "ItemList",
          "numberOfItems": items.length,
          "itemListElement": items
        };
      }
    }
  }

  // WebSite Schema with search capability
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": baseUrl,
    "name": "PrinterParams Smart Dent",
    "description": "Parâmetros de Impressão 3D Odontológica",
    "publisher": {
      "@type": "Organization",
      "name": "Smart Dent"
    }
  };

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={pageType === 'model' && resins.length > 0 ? 'product' : 'website'} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="PrinterParams Smart Dent" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}

      {productSchema && (
        <script type="application/ld+json">
          {JSON.stringify(productSchema)}
        </script>
      )}

      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
    </Helmet>
  );
};
