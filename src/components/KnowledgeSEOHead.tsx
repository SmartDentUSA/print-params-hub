import { Helmet } from 'react-helmet-async';

interface KnowledgeSEOHeadProps {
  content?: any;
  category?: any;
  videos?: any[];
  relatedDocuments?: {
    id: string;
    document_name: string;
    document_description: string | null;
    file_url: string;
    file_size: number | null;
    updated_at: string;
    resin_name: string;
    resin_manufacturer: string;
  }[];
  currentLang?: 'pt' | 'en' | 'es';
}

const extractVideoId = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    return url.split('v=')[1]?.split('&')[0] || '';
  }
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split('?')[0] || '';
  }
  return '';
};

const getEmbedUrl = (url: string | null | undefined): string => {
  if (!url) return '';
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

// Extrai keywords do conteúdo HTML
const extractKeywordsFromContent = (htmlContent: string): string => {
  if (!htmlContent) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const keywords: string[] = [];
  
  // Termos técnicos comuns
  const technicalTerms = [
    'impressão 3D', 'resina', 'impressora', 'parâmetros', 'configuração',
    '405nm', 'tempo de cura', 'altura de camada', 'lift speed', 'odontológica',
    'dental', 'Smart Dent'
  ];
  
  // Pegar headings principais
  const headings = doc.querySelectorAll('h2, h3');
  headings.forEach(h => {
    const text = h.textContent?.trim() || '';
    if (text.length > 3 && text.length < 50) {
      keywords.push(text);
    }
  });
  
  // Adicionar termos técnicos encontrados no conteúdo
  const contentText = doc.body.textContent?.toLowerCase() || '';
  technicalTerms.forEach(term => {
    if (contentText.includes(term.toLowerCase())) {
      keywords.push(term);
    }
  });
  
  // Limitar a 10 keywords e 255 caracteres
  return [...new Set(keywords)].slice(0, 10).join(', ').substring(0, 255);
};

// Remove tags HTML e retorna texto limpo
const stripTags = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export function KnowledgeSEOHead({ content, category, videos = [], relatedDocuments = [], currentLang = 'pt' }: KnowledgeSEOHeadProps) {
  const baseUrl = 'https://smartdent.com.br';
  
  // Map language to hreflang format
  const langMap = {
    'pt': 'pt-BR',
    'en': 'en-US',
    'es': 'es-ES'
  };
  
  const htmlLang = langMap[currentLang];
  
  // Default to Portuguese title if no language-specific title exists
  const displayTitle = content?.title || '';

  // Página inicial da Base de Conhecimento
  if (!content && !category) {
    const pathByLang = {
      'pt': '/base-conhecimento',
      'en': '/en/knowledge-base',
      'es': '/es/base-conocimiento'
    };
    
    return (
      <Helmet htmlAttributes={{ lang: htmlLang }}>
        <title>Base de Conhecimento - Impressão 3D Odontológica | Smart Dent</title>
        <meta name="description" content="Tutoriais, guias e dicas sobre impressão 3D para odontologia. Aprenda a configurar impressoras, escolher resinas e resolver problemas." />
        <link rel="canonical" href={`${baseUrl}${pathByLang[currentLang]}`} />
        
        {/* hreflang tags for multilingual SEO */}
        <link rel="alternate" hrefLang="pt-BR" href={`${baseUrl}${pathByLang['pt']}`} />
        <link rel="alternate" hrefLang="en-US" href={`${baseUrl}${pathByLang['en']}`} />
        <link rel="alternate" hrefLang="es-ES" href={`${baseUrl}${pathByLang['es']}`} />
        <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${pathByLang['pt']}`} />
        
        {/* RSS/Atom Feed Auto-discovery (Categorias C, D, E) */}
        <link rel="alternate" type="application/rss+xml" title="Base de Conhecimento - RSS (C, D, E)" href="https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/knowledge-feed?format=rss" />
        <link rel="alternate" type="application/atom+xml" title="Base de Conhecimento - Atom (C, D, E)" href="https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/knowledge-feed?format=atom" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Base de Conhecimento - Impressão 3D Odontológica" />
        <meta property="og:description" content="Tutoriais, guias e dicas sobre impressão 3D para odontologia" />
        <meta property="og:url" content={`${baseUrl}${pathByLang[currentLang]}`} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Base de Conhecimento - Impressão 3D Odontológica" />
        <meta name="twitter:description" content="Tutoriais, guias e dicas sobre impressão 3D para odontologia" />
      </Helmet>
    );
  }

  // Página de categoria
  if (!content && category) {
    const pathByLang = {
      'pt': '/base-conhecimento',
      'en': '/en/knowledge-base',
      'es': '/es/base-conocimiento'
    };
    
    return (
      <Helmet htmlAttributes={{ lang: htmlLang }}>
        <title>{category.name} - Base de Conhecimento | Smart Dent</title>
        <meta name="description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
        <link rel="canonical" href={`${baseUrl}${pathByLang[currentLang]}/${category.letter?.toLowerCase()}`} />
        
        {/* hreflang tags for multilingual SEO */}
        <link rel="alternate" hrefLang="pt-BR" href={`${baseUrl}${pathByLang['pt']}/${category.letter?.toLowerCase()}`} />
        <link rel="alternate" hrefLang="en-US" href={`${baseUrl}${pathByLang['en']}/${category.letter?.toLowerCase()}`} />
        <link rel="alternate" hrefLang="es-ES" href={`${baseUrl}${pathByLang['es']}/${category.letter?.toLowerCase()}`} />
        <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${pathByLang['pt']}/${category.letter?.toLowerCase()}`} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${category.name} - Base de Conhecimento`} />
        <meta property="og:description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
        <meta property="og:url" content={`${baseUrl}${pathByLang[currentLang]}/${category.letter?.toLowerCase()}`} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${category.name} - Base de Conhecimento`} />
        <meta name="twitter:description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
      </Helmet>
    );
  }

  // Artigo individual
  if (!content) return null;

  const pathByLang = {
    'pt': '/base-conhecimento',
    'en': '/en/knowledge-base',
    'es': '/es/base-conocimento'
  };

  // Check which language translations are available
  const hasTranslationEn = !!(content.title_en && content.content_html_en);
  const hasTranslationEs = !!(content.title_es && content.content_html_es);
  const hasTranslation = currentLang === 'pt' || (currentLang === 'en' && hasTranslationEn) || (currentLang === 'es' && hasTranslationEs);

  const canonicalUrl = `${baseUrl}${pathByLang[currentLang]}/${category?.letter?.toLowerCase()}/${content.slug}`;

  // Check if this is a technical parameter page (Category F)
  const isTechnicalPage = category?.letter === 'F' || content.slug?.startsWith('parametros-');

  // Preparar articleBody e wordCount para E-E-A-T
  const articleBody = stripTags(content.content_html || '');
  const wordCount = articleBody.split(/\s+/).filter(w => w.length > 0).length;

  // Extract product mentions for technical pages
  const productMentions = isTechnicalPage ? (() => {
    const mentions = [];
    const html = content.content_html || '';
    
    // Extract printer (brand + model) from title
    const printerMatch = content.title?.match(/Parâmetros\s+(\w+)\s+([\w\s]+?)\s+-/);
    if (printerMatch) {
      mentions.push({
        "@type": "Product",
        "name": `${printerMatch[1]} ${printerMatch[2].trim()}`,
        "category": "Impressora 3D"
      });
    }
    
    // Extract resin (manufacturer + name) from title
    const resinMatch = content.title?.match(/-\s+([\w\s]+?)\s+([\w\s]+)$/);
    if (resinMatch) {
      mentions.push({
        "@type": "Product",
        "name": `${resinMatch[1].trim()} ${resinMatch[2].trim()}`,
        "category": "Resina para Impressão 3D"
      });
    }
    
    return mentions;
  })() : [];

  const articleSchema: any = {
    "@context": "https://schema.org",
    "@type": isTechnicalPage ? "TechArticle" : "Article",
    "headline": displayTitle,
    "keywords": content.keywords?.join(', ') || extractKeywordsFromContent(content.content_html || ''),
    "description": content.meta_description || content.excerpt,
    "image": content.og_image_url,
    "datePublished": new Date(content.created_at).toISOString(),
    "dateModified": new Date(content.updated_at).toISOString(),
    "articleBody": articleBody,
    "wordCount": wordCount,
    "inLanguage": htmlLang,
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
    },
    // 🆕 Product mentions for technical pages
    ...(productMentions.length > 0 && { "mentions": productMentions }),
    // 🆕 Documentos Técnicos Relacionados
    ...(relatedDocuments && relatedDocuments.length > 0 && {
      "associatedMedia": relatedDocuments.map(doc => ({
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
          "name": `${doc.resin_name} - ${doc.resin_manufacturer}`
        }
      }))
    })
  };

  // VideoObject Schema para cada vídeo
  const videoSchemas = videos
    .filter(video => video.url)
    .map((video, idx) => {
      const videoId = extractVideoId(video.url);
      
      // Calcular duração real em formato ISO 8601
      const duration = video.video_duration_seconds && video.video_duration_seconds > 0
        ? `PT${Math.floor(video.video_duration_seconds / 60)}M${video.video_duration_seconds % 60}S`
        : undefined;
      
      // Preparar audioLanguage a partir de panda_config.audios
      const audioLanguages = video.panda_config?.audios?.map((aud: any) => aud.srclang).filter(Boolean) || [];
      
      // Preparar captions a partir de panda_config
      const captions = video.panda_config?.subtitles?.map((sub: any) => ({
        "@type": "AudioObject",
        "inLanguage": sub.srclang,
        "name": sub.label,
        "encodingFormat": "text/vtt",
        "contentUrl": sub.src
      })) || [];
      
      return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": video.title || `${displayTitle} - Vídeo ${idx + 1}`,
        "description": video.description || content.meta_description || content.excerpt,
        "thumbnailUrl": video.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : content.og_image_url),
        "uploadDate": new Date(video.created_at || content.created_at).toISOString(),
        "contentUrl": video.url,
        "embedUrl": video.embed_url || getEmbedUrl(video.url),
        "inLanguage": htmlLang,
        ...(audioLanguages.length > 0 && { "audioLanguage": audioLanguages }),
        ...(duration && { "duration": duration }),
        ...(video.video_transcript && { "transcript": video.video_transcript }),
        ...(captions.length > 0 && { "caption": captions })
      };
    });
  
  // Vincular vídeos ao artigo
  if (videoSchemas.length > 0) {
    articleSchema.video = videoSchemas;
  }

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
        "name": displayTitle,
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
    "name": displayTitle,
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
    <Helmet htmlAttributes={{ lang: htmlLang }}>
      <title>{displayTitle} | Smart Dent</title>
      <meta name="description" content={content.meta_description || content.excerpt} />
      <meta name="keywords" content={content.keywords?.join(', ') || extractKeywordsFromContent(content.content_html || '')} />
      {content.ai_context && <meta name="ai-context" content={content.ai_context} />}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Prevent indexing if translation is missing */}
      {!hasTranslation && <meta name="robots" content="noindex, follow" />}
      
      {/* hreflang tags - only for languages with actual translations */}
      <link rel="alternate" hrefLang="pt-BR" href={`${baseUrl}${pathByLang['pt']}/${category?.letter?.toLowerCase()}/${content.slug}`} />
      {hasTranslationEn && <link rel="alternate" hrefLang="en-US" href={`${baseUrl}${pathByLang['en']}/${category?.letter?.toLowerCase()}/${content.slug}`} />}
      {hasTranslationEs && <link rel="alternate" hrefLang="es-ES" href={`${baseUrl}${pathByLang['es']}/${category?.letter?.toLowerCase()}/${content.slug}`} />}
      <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${pathByLang['pt']}/${category?.letter?.toLowerCase()}/${content.slug}`} />
      
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
      <meta property="og:title" content={displayTitle} />
      <meta property="og:description" content={content.excerpt} />
      <meta property="og:url" content={canonicalUrl} />
      {content.og_image_url && (
        <>
          <meta property="og:image" content={content.og_image_url} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content={displayTitle} />
          <meta property="og:image:type" content="image/png" />
        </>
      )}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCardType} />
      <meta name="twitter:title" content={displayTitle} />
      <meta name="twitter:description" content={content.excerpt} />
      {content.og_image_url && <meta name="twitter:image" content={content.og_image_url} />}
      {twitterCardType === "player" && videos[0]?.url && (
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
