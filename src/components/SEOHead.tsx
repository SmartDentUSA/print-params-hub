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

// Helper function to generate SEO keywords
const generateKeywords = (
  pageType: 'home' | 'brand' | 'model',
  brand?: Brand | null,
  model?: Model | null,
  resins: Resin[] = []
): string => {
  const baseKeywords = [
    'impressão 3D odontológica',
    'resina 3D dental',
    'parâmetros impressão 3D',
    '405nm',
    'Smart Dent'
  ];

  if (pageType === 'home') {
    return [...baseKeywords, 'configurações impressora 3D', 'tempo de cura'].join(', ');
  }

  if (pageType === 'brand' && brand) {
    return [
      ...baseKeywords,
      `impressora ${brand.name}`,
      `parâmetros ${brand.name}`,
      `configurações ${brand.name}`,
      'altura de camada',
      'intensidade de luz'
    ].join(', ').substring(0, 255);
  }

  if (pageType === 'model' && brand && model) {
    const keywords = [
      ...baseKeywords,
      `${model.name} ${brand.name}`,
      `impressora ${brand.name}`,
      `parâmetros ${model.name}`,
      ...resins.slice(0, 5).map(r => r.name),
      ...resins.slice(0, 3).map(r => r.manufacturer),
      'tempo de cura',
      'altura de camada',
      'intensidade de luz',
      'lift distance',
      'lift speed'
    ].filter(Boolean);

    return keywords.join(', ').substring(0, 255);
  }

  return baseKeywords.join(', ');
};

export const SEOHead = ({ pageType, brand, model, resins = [] }: SEOHeadProps) => {
  const baseUrl = 'https://parametros.smartdent.com.br';
  
  // Generate dynamic title and description
  let title = 'PrinterParams - Parâmetros de Impressão 3D Odontológica | Smart Dent';
  let description = 'Encontre parâmetros otimizados de impressão 3D para sua impressora e resina Smart Dent. Configurações testadas para modelos odontológicos com melhor qualidade e precisão.';
  let canonical = baseUrl;
  let ogImage = 'https://smartdent.com.br/logo-og.png';
  
  // Generate keywords for this page
  const keywords = generateKeywords(pageType, brand, model, resins);

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
      
      // Build offers array dynamically with enriched data
      const offers = [];
      const priceValidUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (resin.cta_1_url && resin.price) {
        offers.push({
          "@type": "Offer",
          "url": resin.cta_1_url,
          "priceCurrency": "BRL",
          "price": resin.price.toString(),
          "priceValidUntil": priceValidUntil,
          "availability": "https://schema.org/InStock",
          "itemCondition": "https://schema.org/NewCondition",
          "description": resin.cta_1_description || `Compre ${resin.name} na loja oficial`,
          "seller": {
            "@type": "Organization",
            "name": resin.cta_1_label || "Vendedor",
            "url": resin.cta_1_url ? new URL(resin.cta_1_url).origin : undefined
          }
        });
      }
      if (resin.cta_2_url && resin.price) {
        offers.push({
          "@type": "Offer",
          "url": resin.cta_2_url,
          "priceCurrency": "BRL",
          "price": resin.price.toString(),
          "priceValidUntil": priceValidUntil,
          "availability": "https://schema.org/InStock",
          "itemCondition": "https://schema.org/NewCondition",
          "description": resin.cta_2_description || `Compre ${resin.name} na loja oficial`,
          "seller": {
            "@type": "Organization",
            "name": resin.cta_2_label || "Vendedor",
            "url": resin.cta_2_url ? new URL(resin.cta_2_url).origin : undefined
          }
        });
      }
      if (resin.cta_3_url && resin.price) {
        offers.push({
          "@type": "Offer",
          "url": resin.cta_3_url,
          "priceCurrency": "BRL",
          "price": resin.price.toString(),
          "priceValidUntil": priceValidUntil,
          "availability": "https://schema.org/InStock",
          "itemCondition": "https://schema.org/NewCondition",
          "description": resin.cta_3_description || `Compre ${resin.name} na loja oficial`,
          "seller": {
            "@type": "Organization",
            "name": resin.cta_3_label || "Vendedor",
            "url": resin.cta_3_url ? new URL(resin.cta_3_url).origin : undefined
          }
        });
      }
      
      productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": resin.name,
        "sku": resin.id,
        "gtin": resin.id,
        "mpn": resin.name.replace(/\s+/g, '-').toUpperCase(),
        "keywords": `resina ${resin.type || 'odontológica'}, ${resin.manufacturer}, ${model?.name}, ${brand?.name}, impressão 3D dental, 405nm`,
        "brand": {
          "@type": "Brand",
          "name": resin.manufacturer
        },
        "description": resin.description || `Resina ${resin.name} para impressão 3D odontológica`,
        "material": "Resina fotopolimerizável 405nm",
        ...(resin.image_url && { "image": resin.image_url }),
        ...(resin.color && { "color": resin.color }),
        ...(resin.type && { "category": resin.type }),
        "additionalProperty": [
          {
            "@type": "PropertyValue",
            "name": "Comprimento de onda",
            "value": "405 nm"
          },
          ...(resin.type ? [{
            "@type": "PropertyValue",
            "name": "Tipo",
            "value": resin.type
          }] : []),
          ...(resin.color ? [{
            "@type": "PropertyValue",
            "name": "Cor",
            "value": resin.color
          }] : [])
        ],
        ...(offers.length > 0 && { 
          "offers": offers.length === 1 ? offers[0] : offers 
        })
      };
    } else {
      // ItemList Schema for multiple resins (each with multiple offers)
      const items = resins
        .filter(resin => resin.cta_1_url || resin.cta_2_url || resin.cta_3_url)
        .map((resin, index) => {
          // Build offers array for each resin with enriched data
          const offers = [];
          const priceValidUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          if (resin.cta_1_url && resin.price) {
            offers.push({
              "@type": "Offer",
              "url": resin.cta_1_url,
              "priceCurrency": "BRL",
              "price": resin.price.toString(),
              "priceValidUntil": priceValidUntil,
              "availability": "https://schema.org/InStock",
              "itemCondition": "https://schema.org/NewCondition",
              "description": resin.cta_1_description || `Compre ${resin.name} na loja oficial`,
              "seller": {
                "@type": "Organization",
                "name": resin.cta_1_label || "Vendedor",
                "url": resin.cta_1_url ? new URL(resin.cta_1_url).origin : undefined
              }
            });
          }
          if (resin.cta_2_url && resin.price) {
            offers.push({
              "@type": "Offer",
              "url": resin.cta_2_url,
              "priceCurrency": "BRL",
              "price": resin.price.toString(),
              "priceValidUntil": priceValidUntil,
              "availability": "https://schema.org/InStock",
              "itemCondition": "https://schema.org/NewCondition",
              "description": resin.cta_2_description || `Compre ${resin.name} na loja oficial`,
              "seller": {
                "@type": "Organization",
                "name": resin.cta_2_label || "Vendedor",
                "url": resin.cta_2_url ? new URL(resin.cta_2_url).origin : undefined
              }
            });
          }
          if (resin.cta_3_url && resin.price) {
            offers.push({
              "@type": "Offer",
              "url": resin.cta_3_url,
              "priceCurrency": "BRL",
              "price": resin.price.toString(),
              "priceValidUntil": priceValidUntil,
              "availability": "https://schema.org/InStock",
              "itemCondition": "https://schema.org/NewCondition",
              "description": resin.cta_3_description || `Compre ${resin.name} na loja oficial`,
              "seller": {
                "@type": "Organization",
                "name": resin.cta_3_label || "Vendedor",
                "url": resin.cta_3_url ? new URL(resin.cta_3_url).origin : undefined
              }
            });
          }
          
          return {
            "@type": "Product",
            "position": index + 1,
            "name": resin.name,
            "sku": resin.id,
            "gtin": resin.id,
            "mpn": resin.name.replace(/\s+/g, '-').toUpperCase(),
            "keywords": `resina ${resin.type || 'odontológica'}, ${resin.manufacturer}, ${model?.name}, ${brand?.name}, impressão 3D dental, 405nm`,
            "brand": {
              "@type": "Brand",
              "name": resin.manufacturer
            },
            "description": resin.description || `Resina ${resin.name} para impressão 3D odontológica`,
            "material": "Resina fotopolimerizável 405nm",
            ...(resin.image_url && { "image": resin.image_url }),
            ...(resin.color && { "color": resin.color }),
            ...(resin.type && { "category": resin.type }),
            "additionalProperty": [
              {
                "@type": "PropertyValue",
                "name": "Comprimento de onda",
                "value": "405 nm"
              },
              ...(resin.type ? [{
                "@type": "PropertyValue",
                "name": "Tipo",
                "value": resin.type
              }] : []),
              ...(resin.color ? [{
                "@type": "PropertyValue",
                "name": "Cor",
                "value": resin.color
              }] : [])
            ],
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
      <meta name="keywords" content={keywords} />
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
