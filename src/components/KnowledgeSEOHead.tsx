import { Helmet } from 'react-helmet-async';

interface KnowledgeSEOHeadProps {
  content?: any;
  category?: any;
  videos?: any[];
}

const extractVideoId = (url: string): string => {
  if (url.includes('youtube.com/watch?v=')) {
    return url.split('v=')[1]?.split('&')[0] || '';
  }
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split('?')[0] || '';
  }
  return '';
};

const getEmbedUrl = (url: string): string => {
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('watch?v=', 'embed/');
  }
  if (url.includes('youtu.be/')) {
    return url.replace('youtu.be/', 'youtube.com/embed/');
  }
  return url;
};

// Extrai FAQs do conteúdo HTML
const extractFAQsFromContent = (htmlContent: string): { question: string; answer: string }[] => {
  if (!htmlContent) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const faqs: { question: string; answer: string }[] = [];
  
  // Procurar por padrões de perguntas (h2, h3 com "?")
  const headings = doc.querySelectorAll('h2, h3, h4');
  
  headings.forEach((heading) => {
    const text = heading.textContent?.trim() || '';
    
    // Se o heading contém "?" ou começa com palavras interrogativas
    if (text.includes('?') || /^(como|qual|quando|onde|por que|o que|quais|quanto)/i.test(text)) {
      let answer = '';
      let nextElement = heading.nextElementSibling;
      
      // Coletar próximos parágrafos como resposta (até encontrar outro heading)
      while (nextElement && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(nextElement.tagName)) {
        if (nextElement.tagName === 'P' || nextElement.tagName === 'UL' || nextElement.tagName === 'OL') {
          answer += nextElement.textContent?.trim() + ' ';
        }
        nextElement = nextElement.nextElementSibling;
      }
      
      if (answer.trim()) {
        faqs.push({
          question: text,
          answer: answer.trim().substring(0, 500) // Limitar resposta
        });
      }
    }
  });
  
  return faqs;
};

// Extrai passos (HowTo) do conteúdo HTML
const extractHowToSteps = (htmlContent: string): string[] => {
  if (!htmlContent) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const steps: string[] = [];
  
  // Procurar por listas ordenadas
  const orderedLists = doc.querySelectorAll('ol');
  
  orderedLists.forEach((ol) => {
    const listItems = ol.querySelectorAll('li');
    listItems.forEach((li) => {
      const text = li.textContent?.trim();
      if (text && text.length > 10) { // Ignorar itens muito curtos
        steps.push(text);
      }
    });
  });
  
  // Se não encontrou lista ordenada, procurar por headings numerados
  if (steps.length === 0) {
    const headings = doc.querySelectorAll('h2, h3, h4');
    headings.forEach((heading) => {
      const text = heading.textContent?.trim() || '';
      // Padrões: "1.", "Passo 1", "Etapa 1", etc.
      if (/^(\d+\.|passo \d+|etapa \d+|step \d+)/i.test(text)) {
        let stepContent = text;
        let nextElement = heading.nextElementSibling;
        
        // Adicionar próximo parágrafo ao passo
        if (nextElement && nextElement.tagName === 'P') {
          stepContent += ' ' + nextElement.textContent?.trim();
        }
        
        steps.push(stepContent);
      }
    });
  }
  
  return steps;
};

export function KnowledgeSEOHead({ content, category, videos = [] }: KnowledgeSEOHeadProps) {
  const baseUrl = 'https://smartdent.com.br';

  // Página inicial da Base de Conhecimento
  if (!content && !category) {
    return (
      <Helmet htmlAttributes={{ lang: 'pt-BR' }}>
        <title>Base de Conhecimento - Impressão 3D Odontológica | Smart Dent</title>
        <meta name="description" content="Tutoriais, guias e dicas sobre impressão 3D para odontologia. Aprenda a configurar impressoras, escolher resinas e resolver problemas." />
        <link rel="canonical" href={`${baseUrl}/base-conhecimento`} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Base de Conhecimento - Impressão 3D Odontológica" />
        <meta property="og:description" content="Tutoriais, guias e dicas sobre impressão 3D para odontologia" />
        <meta property="og:url" content={`${baseUrl}/base-conhecimento`} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Base de Conhecimento - Impressão 3D Odontológica" />
        <meta name="twitter:description" content="Tutoriais, guias e dicas sobre impressão 3D para odontologia" />
      </Helmet>
    );
  }

  // Página de categoria
  if (!content && category) {
    return (
      <Helmet htmlAttributes={{ lang: 'pt-BR' }}>
        <title>{category.name} - Base de Conhecimento | Smart Dent</title>
        <meta name="description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
        <link rel="canonical" href={`${baseUrl}/base-conhecimento/${category.letter?.toLowerCase()}`} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${category.name} - Base de Conhecimento`} />
        <meta property="og:description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
        <meta property="og:url" content={`${baseUrl}/base-conhecimento/${category.letter?.toLowerCase()}`} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${category.name} - Base de Conhecimento`} />
        <meta name="twitter:description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
      </Helmet>
    );
  }

  // Artigo individual
  if (!content) return null;

  const canonicalUrl = `https://smartdent.com.br/base-conhecimento/${category?.letter?.toLowerCase()}/${content.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": content.title,
    "description": content.meta_description || content.excerpt,
    "image": content.og_image_url,
    "datePublished": new Date(content.created_at).toISOString(),
    "dateModified": new Date(content.updated_at).toISOString(),
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

  // VideoObject Schema para cada vídeo
  const videoSchemas = videos.map((video, idx) => {
    const videoId = extractVideoId(video.url);
    return {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": video.title || `${content.title} - Vídeo ${idx + 1}`,
      "description": content.meta_description || content.excerpt,
      "thumbnailUrl": videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : content.og_image_url,
      "uploadDate": new Date(content.created_at).toISOString(),
      "contentUrl": video.url,
      "embedUrl": getEmbedUrl(video.url),
      "duration": "PT15M"
    };
  });

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

  // FAQ Schema - usar FAQs do banco OU extrair do conteúdo
  const contentFAQs = extractFAQsFromContent(content.content || '');
  const allFAQs = content.faqs && content.faqs.length > 0 
    ? content.faqs 
    : contentFAQs.length > 0 
      ? contentFAQs 
      : [];
  
  const faqSchema = allFAQs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": allFAQs.map((faq: any) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  } : null;

  // HowTo Schema - detectar tutoriais passo a passo
  const howToSteps = extractHowToSteps(content.content || '');
  const howToSchema = howToSteps.length >= 2 ? {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": content.title,
    "description": content.meta_description || content.excerpt,
    "image": content.og_image_url,
    "step": howToSteps.map((step, idx) => ({
      "@type": "HowToStep",
      "position": idx + 1,
      "name": `Passo ${idx + 1}`,
      "text": step
    }))
  } : null;

  // Detectar tipo de Twitter Card baseado no conteúdo
  const twitterCardType = videos.length > 0 
    ? "player" 
    : content.og_image_url 
      ? "summary_large_image" 
      : "summary";

  return (
    <Helmet htmlAttributes={{ lang: 'pt-BR' }}>
      <title>{content.title} | Smart Dent</title>
      <meta name="description" content={content.meta_description || content.excerpt} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Preload OG Image */}
      {content.og_image_url && (
        <link 
          rel="preload" 
          as="image" 
          href={content.og_image_url}
        />
      )}
      
      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={content.title} />
      <meta property="og:description" content={content.excerpt} />
      <meta property="og:url" content={canonicalUrl} />
      {content.og_image_url && (
        <>
          <meta property="og:image" content={content.og_image_url} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content={content.title} />
          <meta property="og:image:type" content="image/png" />
        </>
      )}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCardType} />
      <meta name="twitter:title" content={content.title} />
      <meta name="twitter:description" content={content.excerpt} />
      {content.og_image_url && <meta name="twitter:image" content={content.og_image_url} />}
      {twitterCardType === "player" && videos[0] && (
        <>
          <meta name="twitter:player" content={getEmbedUrl(videos[0].url)} />
          <meta name="twitter:player:width" content="1280" />
          <meta name="twitter:player:height" content="720" />
        </>
      )}
      
      {/* JSON-LD Schemas - Agrupados em 1 único script */}
      <script type="application/ld+json" defer>
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            articleSchema,
            breadcrumbSchema,
            ...videoSchemas,
            ...(faqSchema ? [faqSchema] : []),
            ...(howToSchema ? [howToSchema] : [])
          ]
        })}
      </script>
    </Helmet>
  );
}
