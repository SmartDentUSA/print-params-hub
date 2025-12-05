import { Helmet } from "react-helmet-async";

interface TestimonialSEOHeadProps {
  testimonial: {
    name: string;
    slug: string;
    description: string | null;
    seo_title_override: string | null;
    meta_description: string | null;
    og_image_url: string | null;
    image_url: string | null;
    extra_data: any;
  };
}

export const TestimonialSEOHead = ({ testimonial }: TestimonialSEOHeadProps) => {
  const seoTitle = testimonial.seo_title_override || `${testimonial.name} | Smart Dent`;
  const metaDescription = testimonial.meta_description || testimonial.description || "";
  const ogImage = testimonial.og_image_url || testimonial.image_url || "/og-image.jpg";
  const canonicalUrl = `https://parametros.smartdent.com.br/depoimentos/${testimonial.slug}`;
  
  const extraData = testimonial.extra_data || {};
  const youtubeUrl = extraData.youtube_url;
  const videoThumbnail = extraData.video_thumbnail;
  const videoDuration = extraData.video_duration_seconds;
  const videoTranscript = extraData.video_transcript;
  
  // Extract YouTube video ID
  const getYouTubeId = (url: string | undefined): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };
  
  const youtubeId = getYouTubeId(youtubeUrl);
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;
  const thumbnailUrl = videoThumbnail || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null);
  
  // Build Schema.org structures
  const schemas = [];
  
  // 1. VideoObject Schema (if video exists)
  const videoObject = (youtubeUrl && embedUrl) ? {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": seoTitle,
    "description": metaDescription,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": new Date().toISOString(),
    ...(videoDuration && { "duration": `PT${videoDuration}S` }),
    "contentUrl": youtubeUrl,
    "embedUrl": embedUrl,
    "inLanguage": "pt-BR",
    ...(videoTranscript && { "transcript": videoTranscript }),
    "mentions": [
      { "@type": "Product", "name": "Scanner intraoral BLZ INO200" },
      { "@type": "Product", "name": "Scanner intraoral Medit" },
      { "@type": "Product", "name": "Impressora RayShape Edge mini" },
      { "@type": "Product", "name": "Resina Smart Dent Bio Vitality" },
      { "@type": "Product", "name": "Resina Smart Dent Bite Splint +Flex" }
    ]
  } : null;

  if (videoObject) {
    schemas.push(videoObject);
  }
  
  // 2. Review Schema - CRITICAL for testimonials SEO
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "Product",
      "name": extraData.products_mentioned?.[0] || "Smart Dent - Produtos Odontológicos",
      "brand": {
        "@type": "Brand",
        "name": "Smart Dent"
      }
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": extraData.rating || 5,
      "bestRating": 5,
      "worstRating": 1
    },
    "author": {
      "@type": "Person",
      "name": testimonial.name,
      ...(extraData.profession && { "jobTitle": extraData.profession }),
      ...(extraData.specialty && { "description": extraData.specialty }),
      ...(extraData.location && { "workLocation": extraData.location })
    },
    "reviewBody": testimonial.description,
    "datePublished": new Date().toISOString(),
    ...(videoObject && { "video": videoObject })
  });
  
  // 3. Person Schema (E-E-A-T)
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": testimonial.name,
    ...(extraData.profession && { "jobTitle": extraData.profession }),
    ...(extraData.specialty && { "knowsAbout": extraData.specialty }),
    ...(extraData.location && {
      "address": {
        "@type": "PostalAddress",
        "addressLocality": extraData.location
      }
    }),
    ...(extraData.instagram_url && { "sameAs": extraData.instagram_url })
  });
  
  // 4. BreadcrumbList Schema
  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://parametros.smartdent.com.br"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Depoimentos",
        "item": "https://parametros.smartdent.com.br/depoimentos"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": testimonial.name
      }
    ]
  });
  
  const keywords = [
    testimonial.name,
    extraData.profession,
    extraData.specialty,
    "depoimento",
    "Smart Dent",
    "impressão 3D odontológica"
  ].filter(Boolean).join(", ");

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
      <meta name="ai-content-type" content="testimonial" />
      <meta name="ai-topic" content={keywords} />
      
      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={thumbnailUrl || ogImage} />
      <meta property="og:site_name" content="PrinterParams Smart Dent" />
      <meta property="og:locale" content="pt_BR" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={youtubeUrl ? "player" : "summary_large_image"} />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={thumbnailUrl || ogImage} />
      {embedUrl && (
        <>
          <meta name="twitter:player" content={embedUrl} />
          <meta name="twitter:player:width" content="1280" />
          <meta name="twitter:player:height" content="720" />
        </>
      )}
      
      {/* Schema.org JSON-LD */}
      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};
