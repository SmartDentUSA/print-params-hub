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
  // 🆕 Campos SEO do Sistema A
  seo_title_override?: string;
  meta_description?: string;
  og_image_url?: string;
  canonical_url?: string;
  slug?: string;
  keywords?: string[];
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
  // 🆕 Documentos técnicos
  documents?: {
    id: string;
    document_name: string;
    document_description: string | null;
    file_url: string;
    file_name: string;
    file_size: number | null;
    updated_at: string;
  }[];
}

interface SEOHeadProps {
  pageType: 'home' | 'brand' | 'model';
  brand?: Brand | null;
  model?: Model | null;
  resins?: Resin[];
  faqs?: Array<{ question: string; answer: string }>; // 🆕 FAQ Schema support
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
    // 🆕 Mesclar keywords das resinas (se existirem)
    const resinKeywords = resins
      .flatMap(r => r.keywords || [])
      .slice(0, 10); // Limitar a 10 keywords adicionais

    // 🆕 Keywords dos documentos técnicos
    const documentKeywords = resins
      .flatMap(r => r.documents || [])
      .flatMap(doc => [
        doc.document_name,
        ...(doc.document_description ? [doc.document_description.substring(0, 50)] : [])
      ])
      .slice(0, 5); // Limitar a 5 keywords de documentos

    const keywords = [
      ...baseKeywords,
      ...resinKeywords, // 🆕 Keywords do Sistema A
      ...documentKeywords, // 🆕 Adicionar keywords de documentos
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

// Helper function to generate AI context for generative search
const generateAIContext = (
  pageType: 'home' | 'brand' | 'model',
  brand?: Brand | null,
  model?: Model | null,
  resins: Resin[] = []
): string => {
  const contexts = [
    'impressão 3D odontológica',
    'resina fotopolimerizável',
    'parâmetros de cura 405nm'
  ];
  
  if (brand) contexts.push(`impressora ${brand.name}`);
  if (model) contexts.push(`modelo ${model.name}`);
  if (resins.length > 0) {
    contexts.push(...resins.slice(0, 3).map(r => `${r.name} ${r.manufacturer}`));
  }
  
  return contexts.join(', ').substring(0, 200); // Limitar a 200 caracteres
};

export const SEOHead = ({ pageType, brand, model, resins = [], faqs = [] }: SEOHeadProps) => {
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
    canonical = `${baseUrl}/${brand.slug}`;
    if (brand.logo_url) ogImage = brand.logo_url;
  } else if (pageType === 'model' && brand && model) {
    // 🆕 Priorizar seo_title_override da primeira resina (se existir)
    if (resins.length > 0 && resins[0].seo_title_override) {
      title = resins[0].seo_title_override;
    } else {
      title = `${model.name} ${brand.name} - Configurações de Resina para Impressão 3D | Smart Dent`;
    }
    
    // 🆕 Se houver uma resina com meta_description, usar ela
    if (resins.length > 0 && resins[0].meta_description) {
      description = resins[0].meta_description;
    } else {
      const resinCount = resins.length;
      description = `Parâmetros completos para ${model.name} ${brand.name}. ${resinCount} ${resinCount === 1 ? 'resina testada' : 'resinas testadas'} com tempo de cura, altura de camada e intensidade de luz otimizadas.`;
    }
    
    // 🆕 Priorizar canonical_url da primeira resina (se existir)
    if (resins.length > 0 && resins[0].canonical_url) {
      canonical = resins[0].canonical_url;
    } else {
      canonical = `${baseUrl}/${brand.slug}/${model.slug}`;
    }
    
    // 🆕 Priorizar og_image_url da primeira resina (se existir)
    if (resins.length > 0 && resins[0].og_image_url) {
      ogImage = resins[0].og_image_url;
    } else if (model.image_url) {
      ogImage = model.image_url;
    } else if (brand?.logo_url) {
      ogImage = brand.logo_url;
    }
  }

  // 🆕 Organization Schema completo (autoridade do domínio)
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://parametros.smartdent.com.br/#organization",
    "name": "Smart Dent",
    "alternateName": "Smart Dent Odontologia Digital",
    "url": "https://parametros.smartdent.com.br",
    "logo": {
      "@type": "ImageObject",
      "url": "https://parametros.smartdent.com.br/og-image.jpg",
      "width": 1200,
      "height": 630
    },
    "sameAs": [
      "https://www.instagram.com/smartdent.br/",
      "https://www.youtube.com/@smartdent",
      "https://www.facebook.com/smartdent.br/",
      "https://www.linkedin.com/company/smartdent/",
      "https://loja.smartdent.com.br"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+55-16-993831794",
      "contactType": "customer service",
      "areaServed": "BR",
      "availableLanguage": ["Portuguese", "Spanish", "English"]
    },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "R. Dr. Procópio de Tolêdo Malta, 62, Morada dos Deuses",
      "addressLocality": "São Carlos",
      "addressRegion": "SP",
      "postalCode": "13562-291",
      "addressCountry": "BR"
    },
    "description": "Smart Dent oferece parâmetros de impressão 3D odontológica testados e validados para mais de 50 impressoras e 200+ resinas dentais.",
    "knowsAbout": [
      "Impressão 3D Odontológica",
      "Resinas Dentais 3D",
      "Parâmetros de Impressão",
      "Odontologia Digital",
      "Prototipagem Rápida"
    ],
    "founder": {
      "@type": "Person",
      "name": "Smart Dent Team"
    },
    "foundingDate": "2020",
    "slogan": "Parâmetros precisos, impressões perfeitas"
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
        "item": `${baseUrl}/${brand.slug}`
      });
    }

    if (model && brand) {
      itemList.push({
        "@type": "ListItem",
        "position": 3,
        "name": model.name,
        "item": `${baseUrl}/${brand.slug}/${model.slug}`
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
        "keywords": [
          `resina ${resin.type || 'odontológica'}`,
          resin.manufacturer,
          model?.name,
          brand?.name,
          'impressão 3D dental',
          '405nm',
          ...(resin.keywords || []) // 🆕 Keywords do Sistema A
        ].filter(Boolean).join(', '),
        "brand": {
          "@type": "Brand",
          "name": resin.manufacturer
        },
        "description": resin.description || `Resina ${resin.name} para impressão 3D odontológica`,
        "material": "Resina fotopolimerizável 405nm",
        ...(resin.image_url && { "image": resin.image_url }),
        ...(resin.color && { "color": resin.color }),
        ...(resin.type && { "category": resin.type }),
        // 🆕 Documentos Técnicos como associatedMedia
        ...(resin.documents && resin.documents.length > 0 && {
          "associatedMedia": resin.documents.map(doc => ({
            "@type": "DigitalDocument",
            "name": doc.document_name,
            "description": doc.document_description || `Documento técnico: ${doc.document_name}`,
            "encodingFormat": "application/pdf",
            "contentUrl": doc.file_url,
            "dateModified": new Date(doc.updated_at).toISOString(),
            "fileSize": doc.file_size ? `${doc.file_size} bytes` : undefined,
            "inLanguage": "pt-BR",
            "about": {
              "@type": "Product",
              "name": resin.name,
              "manufacturer": {
                "@type": "Organization",
                "name": resin.manufacturer
              }
            }
          }))
        }),
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
            "keywords": [
              `resina ${resin.type || 'odontológica'}`,
              resin.manufacturer,
              model?.name,
              brand?.name,
              'impressão 3D dental',
              '405nm',
              ...(resin.keywords || []) // 🆕 Keywords do Sistema A
            ].filter(Boolean).join(', '),
            "brand": {
              "@type": "Brand",
              "name": resin.manufacturer
            },
            "description": resin.description || `Resina ${resin.name} para impressão 3D odontológica`,
            "material": "Resina fotopolimerizável 405nm",
            ...(resin.image_url && { "image": resin.image_url }),
            ...(resin.color && { "color": resin.color }),
            ...(resin.type && { "category": resin.type }),
            // 🆕 Documentos Técnicos como associatedMedia
            ...(resin.documents && resin.documents.length > 0 && {
              "associatedMedia": resin.documents.map(doc => ({
                "@type": "DigitalDocument",
                "name": doc.document_name,
                "description": doc.document_description || `Documento técnico: ${doc.document_name}`,
                "encodingFormat": "application/pdf",
                "contentUrl": doc.file_url,
                "dateModified": new Date(doc.updated_at).toISOString(),
                "fileSize": doc.file_size ? `${doc.file_size} bytes` : undefined,
                "inLanguage": "pt-BR",
                "about": {
                  "@type": "Product",
                  "name": resin.name,
                  "manufacturer": {
                    "@type": "Organization",
                    "name": resin.manufacturer
                  }
                }
              }))
            }),
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

  // FAQ Schema (if faqs provided)
  let faqSchema = null;
  if (faqs && faqs.length > 0) {
    faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };
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
      <meta name="ai:context" content={generateAIContext(pageType, brand, model, resins)} />
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

      {/* Favicon for SEO - Prioridade para Google */}
      <link rel="icon" type="image/png" sizes="192x192" href="https://parametros.smartdent.com.br/favicon-192x192.png?v=4" />
      <link rel="icon" type="image/png" sizes="512x512" href="https://parametros.smartdent.com.br/favicon-512x512.png?v=4" />
      <link rel="shortcut icon" href="https://parametros.smartdent.com.br/favicon.ico?v=4" />
      <link rel="apple-touch-icon" href="https://parametros.smartdent.com.br/apple-touch-icon.png?v=4" />
      <link rel="manifest" href="https://parametros.smartdent.com.br/manifest.json" />

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

      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}

      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
    </Helmet>
  );
};
