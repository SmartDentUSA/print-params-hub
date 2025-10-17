import { Helmet } from 'react-helmet-async';

interface KnowledgeSEOHeadProps {
  content?: any;
  category?: any;
}

export function KnowledgeSEOHead({ content, category }: KnowledgeSEOHeadProps) {
  if (!content) {
    return (
      <Helmet>
        <title>Base de Conhecimento | Smart Dent</title>
        <meta name="description" content="Aprenda tudo sobre impressão 3D odontológica" />
      </Helmet>
    );
  }

  const canonicalUrl = `https://smartdent.com.br/base-conhecimento/${category?.letter?.toLowerCase()}/${content.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": content.title,
    "description": content.meta_description || content.excerpt,
    "image": content.og_image_url,
    "datePublished": content.created_at,
    "dateModified": content.updated_at,
    "author": content.authors ? {
      "@type": "Person",
      "name": content.authors.name,
      "url": content.authors.website_url,
      "image": content.authors.photo_url
    } : { 
      "@type": "Organization", 
      "name": "Smart Dent" 
    },
    "publisher": {
      "@type": "Organization",
      "name": "Smart Dent",
      "logo": {
        "@type": "ImageObject",
        "url": "https://smartdent.com.br/logo.png"
      }
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://smartdent.com.br"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Base de Conhecimento",
        "item": "https://smartdent.com.br/base-conhecimento"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": category?.name || "Categoria",
        "item": `https://smartdent.com.br/base-conhecimento/${category?.letter?.toLowerCase()}`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": content.title,
        "item": canonicalUrl
      }
    ]
  };

  return (
    <Helmet>
      <title>{content.title} | Smart Dent</title>
      <meta name="description" content={content.meta_description || content.excerpt} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={content.title} />
      <meta property="og:description" content={content.excerpt} />
      <meta property="og:url" content={canonicalUrl} />
      {content.og_image_url && <meta property="og:image" content={content.og_image_url} />}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={content.title} />
      <meta name="twitter:description" content={content.excerpt} />
      {content.og_image_url && <meta name="twitter:image" content={content.og_image_url} />}
      
      {/* JSON-LD Schemas */}
      <script type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
    </Helmet>
  );
}
