// 🎯 SCRIPT SEO OTIMIZADO COMPLETO - BLZ Dental
// Insira este código após a função getCookie() no seu HTML (linha ~57)

(async function() {
  try {
    // Fetch product data from Supabase
    const response = await fetch(
      'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=full&include=system_a_catalog&approved_only=true'
    );
    
    if (!response.ok) throw new Error('Failed to fetch product data');
    
    const data = await response.json();
    const product = data.system_a_catalog?.find(p => p.slug === 'blz-ino200');
    
    if (!product) {
      console.warn('Product blz-ino200 not found');
      return;
    }

    // ============================================
    // FASE 1: META TAGS COMPLETAS + CANONICAL
    // ============================================
    
    const currentUrl = 'https://blzdental.com.br/blz-ino200';
    const siteName = 'BLZ Dental';
    
    // Update basic meta tags
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', product.meta_description || product.description || '');
    }
    
    // Update page title
    if (product.seo_title_override) {
      document.title = product.seo_title_override;
    }
    
    // ===== OPEN GRAPH TAGS (COMPLETO) =====
    const ogTags = {
      'og:type': 'product',
      'og:url': currentUrl,
      'og:site_name': siteName,
      'og:locale': 'pt_BR',
      'og:title': product.seo_title_override || product.name || document.title,
      'og:description': product.meta_description || product.description || '',
      'og:image': product.og_image_url || product.image_url || '',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': `Imagem do produto ${product.name || 'BLZ INO200'}`
    };
    
    Object.entries(ogTags).forEach(([property, content]) => {
      if (!content) return;
      
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    });
    
    // ===== TWITTER CARDS (COMPLETO) =====
    const twitterTags = {
      'twitter:card': 'summary_large_image',
      'twitter:site': '@blzdental',
      'twitter:title': product.seo_title_override || product.name || document.title,
      'twitter:description': product.meta_description || product.description || '',
      'twitter:image': product.og_image_url || product.image_url || '',
      'twitter:image:alt': `Imagem do produto ${product.name || 'BLZ INO200'}`
    };
    
    Object.entries(twitterTags).forEach(([name, content]) => {
      if (!content) return;
      
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    });
    
    // ===== CANONICAL LINK =====
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);
    
    // ============================================
    // JSON-LD SCHEMAS (JÁ EXISTENTES + MELHORADOS)
    // ============================================
    
    // Product Schema
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": `${currentUrl}#product`,
      "name": product.name || "BLZ INO200",
      "description": product.description || "",
      "image": product.image_url || "",
      "brand": {
        "@type": "Brand",
        "name": siteName
      },
      "url": currentUrl
    };
    
    // Add offers if price exists
    if (product.price) {
      productSchema.offers = {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": product.currency || "BRL",
        "availability": "https://schema.org/InStock",
        "url": currentUrl
      };
      
      // Add promo price if exists
      if (product.promo_price && product.promo_price < product.price) {
        productSchema.offers.priceValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
    }
    
    // Add rating if exists
    if (product.rating && product.review_count) {
      productSchema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": product.rating,
        "reviewCount": product.review_count,
        "bestRating": "5",
        "worstRating": "1"
      };
    }
    
    // Organization Schema
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": siteName,
      "url": "https://blzdental.com.br",
      "logo": "https://blzdental.com.br/logo.png",
      "sameAs": [
        "https://www.facebook.com/blzdental",
        "https://www.instagram.com/blzdental"
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
          "item": "https://blzdental.com.br"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Produtos",
          "item": "https://blzdental.com.br/produtos"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": product.name || "BLZ INO200",
          "item": currentUrl
        }
      ]
    };
    
    // Insert all schemas
    const schemas = [productSchema, organizationSchema, breadcrumbSchema];
    schemas.forEach(schema => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });
    
    console.log('✅ SEO dinâmico carregado com sucesso:', {
      product: product.name,
      ogTags: Object.keys(ogTags).length,
      twitterTags: Object.keys(twitterTags).length,
      schemas: schemas.length,
      canonical: currentUrl
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar SEO dinâmico:', error);
  }
})();
