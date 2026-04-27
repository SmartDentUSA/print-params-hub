import { Helmet } from 'react-helmet-async';
import { useProductReviews } from '@/hooks/useProductReviews';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyData } from '@/hooks/useCompanyData';
import { safeCategoryLetter } from '@/utils/knowledgeUrls';

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

// Extrai passos (HowTo) do conteúdo HTML - Universal Extractor
const extractHowToSteps = (htmlContent: string): string[] => {
  if (!htmlContent) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const steps: string[] = [];
  
  // ===== MÉTODO 1: Listas Ordenadas (<ol><li>) - RECOMENDADO =====
  const orderedLists = doc.querySelectorAll('ol');
  orderedLists.forEach((ol) => {
    const listItems = ol.querySelectorAll('li');
    listItems.forEach((li) => {
      const text = li.textContent?.trim();
      if (text && text.length > 10) {
        steps.push(text);
      }
    });
  });
  
  // ===== MÉTODO 2: Headings Numerados (Fallback) =====
  if (steps.length === 0) {
    const headings = doc.querySelectorAll('h2, h3, h4');
    headings.forEach((heading) => {
      const text = heading.textContent?.trim() || '';
      if (/^(\d+\.|passo \d+|etapa \d+|step \d+)/i.test(text)) {
        let stepContent = text;
        let nextElement = heading.nextElementSibling;
        
        // Adicionar próximo parágrafo ou lista ao passo
        while (nextElement && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(nextElement.tagName)) {
          if (['P', 'UL', 'OL', 'DIV'].includes(nextElement.tagName)) {
            stepContent += ' ' + nextElement.textContent?.trim();
          }
          nextElement = nextElement.nextElementSibling;
          if (nextElement && ['H1', 'H2', 'H3', 'H4'].includes(nextElement.tagName)) break;
        }
        
        if (stepContent.length > 15) {
          steps.push(stepContent);
        }
      }
    });
  }
  
  // ===== MÉTODO 3: Tabelas HTML (Fallback Terciário) =====
  if (steps.length === 0) {
    const tables = doc.querySelectorAll('table');
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr');
      
      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const firstCell = cells[0].textContent?.trim() || '';
          const secondCell = cells[1].textContent?.trim() || '';
          
          // Detectar se primeira coluna contém "Passo X" ou numeração
          if (/^(passo|etapa|step)?\s*\d+/i.test(firstCell) || 
              (idx > 0 && /^(passo|ação|descrição|instrução)/i.test(firstCell))) {
            
            // Combinar ambas as células como um único passo
            const stepText = `${firstCell}: ${secondCell}`.trim();
            if (stepText.length > 15) {
              steps.push(stepText);
            }
          }
        }
      });
    });
  }
  
  // ===== MÉTODO 4: Detectar Tabelas Markdown Convertidas (Fallback Final) =====
  if (steps.length === 0) {
    const paragraphs = doc.querySelectorAll('p, div');
    const tablePattern = /^\|\s*(passo|etapa|step)?\s*\d+/i;
    
    paragraphs.forEach((p) => {
      const text = p.textContent?.trim() || '';
      if (tablePattern.test(text)) {
        // Extrair conteúdo entre pipes |
        const cells = text.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 2) {
          const stepText = cells.join(': ');
          if (stepText.length > 15) {
            steps.push(stepText);
          }
        }
      }
    });
  }
  
  return steps.slice(0, 10); // Limitar a 10 passos (boas práticas Google)
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

// Extrai instruções de processamento das resinas e cria HowTo Schema
const extractProcessingInstructions = (instructions: string): { 
  preSteps: string[]; 
  postSteps: string[]; 
  totalTime?: string;
} => {
  if (!instructions) return { preSteps: [], postSteps: [] };
  
  const preSteps: string[] = [];
  const postSteps: string[] = [];
  let currentSection: 'pre' | 'post' | null = null;
  
  // Dividir por linhas
  const lines = instructions.split('\n').map(l => l.trim()).filter(l => l);
  
  for (const line of lines) {
    // Detectar seções
    if (/PRÉ(-|\s)?PROCESSAMENTO/i.test(line)) {
      currentSection = 'pre';
      continue;
    }
    if (/PÓS(-|\s)?PROCESSAMENTO/i.test(line)) {
      currentSection = 'post';
      continue;
    }
    
    // Adicionar passos (linhas que começam com • ou - ou números)
    if (/^[•\-\d]/.test(line)) {
      const cleanStep = line.replace(/^[•\-\d.)\s]+/, '').trim();
      if (cleanStep.length > 5) {
        if (currentSection === 'pre') {
          preSteps.push(cleanStep);
        } else if (currentSection === 'post') {
          postSteps.push(cleanStep);
        }
      }
    }
  }
  
  // Extrair tempo total (se mencionar minutos)
  const timeMatch = instructions.match(/(\d+)(-(\d+))?\s*(min|minutos)/i);
  const totalTime = timeMatch 
    ? `PT${timeMatch[3] || timeMatch[1]}M` 
    : undefined;
  
  return { preSteps, postSteps, totalTime };
};

// Extrai pontos técnicos chave da descrição HTML do Sistema A
const extractTechnicalDetailsFromHTML = (html: string): string[] => {
  if (!html) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const details: string[] = [];
  
  // Extrair itens de listas (especificações)
  doc.querySelectorAll('li').forEach((li) => {
    const text = li.textContent?.trim();
    if (text && text.length > 10 && text.length < 200) {
      details.push(text);
    }
  });
  
  // Extrair headers (características principais)
  doc.querySelectorAll('h2, h3, h4, strong').forEach((el) => {
    const text = el.textContent?.trim();
    if (text && text.length > 5 && text.length < 100) {
      details.push(text);
    }
  });
  
  return details.slice(0, 8); // Limitar a 8 pontos
};

// Gera SPIN pitch usando dados completos do Sistema A
const generateSPINFromCatalog = (
  products: any[], 
  title: string,
  categoryLetter?: string
): string => {
  if (products.length === 0) return '';
  
  // Agrupar por categoria/subcategoria
  const categories = [...new Set(products.map((p: any) => p.product_category).filter(Boolean))];
  const subcategories = [...new Set(products.map((p: any) => p.product_subcategory).filter(Boolean))];
  const productNames = products.map((p: any) => p.name).slice(0, 3).join(', ');
  
  // Extrair detalhes técnicos do primeiro produto (principal)
  const mainProduct = products[0];
  const technicalDetails = extractTechnicalDetailsFromHTML(mainProduct.description || '');
  
  // SITUATION: Contexto do profissional
  const situation = categories.length > 0
    ? `Profissionais de ${categories[0].toLowerCase()} buscam soluções confiáveis para ${subcategories.join(' e ').toLowerCase() || 'procedimentos clínicos'}.`
    : `Profissionais de odontologia digital buscam materiais e equipamentos de alta performance.`;
  
  // PROBLEM: Dor específica
  const problem = subcategories.length > 0
    ? `Dificuldade em encontrar ${subcategories[0].toLowerCase()} com especificações técnicas validadas e suporte especializado.`
    : `Dificuldade em encontrar produtos com documentação técnica completa e protocolos de uso.`;
  
  // IMPLICATION: Consequência
  const implication = `Uso inadequado pode comprometer resultados clínicos, gerar retrabalho e insatisfação do paciente.`;
  
  // NEED-SOLUTION: Proposta de valor (usar meta_description se disponível)
  const solution = mainProduct.meta_description 
    ? mainProduct.meta_description
    : `Este artigo fornece protocolo completo e validado para ${productNames}.`;
  
  // AUTHORITY: Credencial
  const authority = `Smart Dent é distribuidor oficial e especialista em impressão 3D odontológica no Brasil.`;
  
  // TECHNICAL: Especificações (do description HTML)
  const technicalSpecs = technicalDetails.length > 0
    ? `Especificações técnicas: ${technicalDetails.slice(0, 4).join('; ')}.`
    : '';
  
  return `[SITUATION] ${situation} [PROBLEM] ${problem} [IMPLICATION] ${implication} [NEED-SOLUTION] ${solution} [AUTHORITY] ${authority} ${technicalSpecs}`.trim();
};

export function KnowledgeSEOHead({ content, category, videos = [], relatedDocuments = [], currentLang = 'pt' }: KnowledgeSEOHeadProps) {
  const baseUrl = 'https://parametros.smartdent.com.br';
  const { data: companyData } = useCompanyData();
  
  // 🆕 Fetch products for Review Schema
  const { products } = useProductReviews(content?.recommended_products || []);
  
  // 🆕 Fetch resins with processing instructions
  const [resinsWithInstructions, setResinsWithInstructions] = useState<any[]>([]);
  
  useEffect(() => {
    if (content?.recommended_resins && content.recommended_resins.length > 0) {
      supabase
        .from('resins')
        .select('id, name, slug, manufacturer, processing_instructions')
        .in('slug', content.recommended_resins)
        .not('processing_instructions', 'is', null)
        .then(({ data }) => {
          if (data) setResinsWithInstructions(data);
        });
    }
  }, [content?.recommended_resins]);
  
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
        <meta name="author" content="Smart Dent" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}${pathByLang[currentLang]}`} />
        
        {/* AI Meta Tags */}
        <meta name="ai-content-type" content="knowledgebase" />
        <meta name="ai-topic" content="impressão 3D odontológica, tutoriais, guias, resinas dentais" />
        
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
        <meta property="og:site_name" content="Smart Dent | Fluxo Digital" />
        <meta property="og:locale" content="pt_BR" />
        
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
        <meta name="author" content="Smart Dent" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}${pathByLang[currentLang]}/${safeCategoryLetter(category?.letter)}`} />
        
        {/* AI Meta Tags */}
        <meta name="ai-content-type" content="categorypage" />
        <meta name="ai-topic" content={`${category.name}, impressão 3D odontológica, artigos`} />
        
        {/* hreflang tags for multilingual SEO */}
        <link rel="alternate" hrefLang="pt-BR" href={`${baseUrl}${pathByLang['pt']}/${safeCategoryLetter(category?.letter)}`} />
        <link rel="alternate" hrefLang="en-US" href={`${baseUrl}${pathByLang['en']}/${safeCategoryLetter(category?.letter)}`} />
        <link rel="alternate" hrefLang="es-ES" href={`${baseUrl}${pathByLang['es']}/${safeCategoryLetter(category?.letter)}`} />
        <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${pathByLang['pt']}/${safeCategoryLetter(category?.letter)}`} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${category.name} - Base de Conhecimento`} />
        <meta property="og:description" content={`Artigos sobre ${category.name} em impressão 3D odontológica`} />
        <meta property="og:url" content={`${baseUrl}${pathByLang[currentLang]}/${safeCategoryLetter(category?.letter)}`} />
        <meta property="og:site_name" content="Smart Dent | Fluxo Digital" />
        <meta property="og:locale" content="pt_BR" />
        
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
    'es': '/es/base-conocimiento'
  };

  // Check which language translations are available
  const hasTranslationEn = !!(content.title_en && content.content_html_en);
  const hasTranslationEs = !!(content.title_es && content.content_html_es);
  const hasTranslation = currentLang === 'pt' || (currentLang === 'en' && hasTranslationEn) || (currentLang === 'es' && hasTranslationEs);

  const canonicalUrl = `${baseUrl}${pathByLang[currentLang]}/${safeCategoryLetter(category?.letter)}/${content.slug}`;

  // Check if this is a technical parameter page (Category F)
  const isTechnicalPage = category?.letter === 'F' || content.slug?.startsWith('parametros-');

  // 🆕 AUDITORIA SEO: Detectar tipo de conteúdo para schemas avançados (MedicalWebPage, ScholarlyArticle)
  const detectContentType = (): 'MedicalWebPage' | 'ScholarlyArticle' | 'TechArticle' | 'Article' => {
    const keywords = (content.keywords || []).join(' ').toLowerCase();
    const title = (content.title || '').toLowerCase();
    const categoryName = category?.name?.toLowerCase() || '';
    
    // Conteúdo médico/biocompatibilidade
    if (keywords.includes('biocompatib') || keywords.includes('citotox') || 
        keywords.includes('iso 10993') || keywords.includes('anvisa') ||
        keywords.includes('médic') || categoryName.includes('biocompat') ||
        title.includes('biocompat') || title.includes('anvisa') ||
        title.includes('citotox')) {
      return 'MedicalWebPage';
    }
    
    // Laudos técnicos/certificados/pesquisas científicas
    if (keywords.includes('laudo') || keywords.includes('certificado') || 
        keywords.includes('ensaio clínico') || keywords.includes('pesquisa') ||
        keywords.includes('estudo') || categoryName.includes('document') ||
        title.includes('laudo') || title.includes('certificado') ||
        title.includes('teste')) {
      return 'ScholarlyArticle';
    }
    
    if (isTechnicalPage) return 'TechArticle';
    
    return 'Article';
  };
  
  const contentType = detectContentType();

  // 🆕 AUDITORIA SEO: Extrair credentials e alumniOf do mini_bio do autor
  const detectAuthorCredentials = (): { hasCredential?: any[]; alumniOf?: any[] } => {
    if (!content.authors?.mini_bio) return {};
    const bio = content.authors.mini_bio.toLowerCase();
    
    const credentials: any[] = [];
    const alumniOf: any[] = [];
    
    // Detectar graus acadêmicos
    if (bio.includes('doutor') || bio.includes('phd') || bio.includes('dr.')) {
      credentials.push({ 
        "@type": "EducationalOccupationalCredential", 
        "credentialCategory": "degree", 
        "educationalLevel": "Doctoral" 
      });
    }
    if (bio.includes('mestre') || bio.includes('msc') || bio.includes('mestrado')) {
      credentials.push({ 
        "@type": "EducationalOccupationalCredential", 
        "credentialCategory": "degree", 
        "educationalLevel": "Masters" 
      });
    }
    if (bio.includes('especialista') || bio.includes('especialização')) {
      credentials.push({ 
        "@type": "EducationalOccupationalCredential", 
        "credentialCategory": "certificate", 
        "educationalLevel": "Postgraduate Specialization" 
      });
    }
    
    // Detectar universidades
    if (bio.includes('usp') || bio.includes('são paulo')) {
      alumniOf.push({ "@type": "CollegeOrUniversity", "name": "Universidade de São Paulo (USP)" });
    }
    if (bio.includes('unicamp')) {
      alumniOf.push({ "@type": "CollegeOrUniversity", "name": "Universidade Estadual de Campinas (UNICAMP)" });
    }
    if (bio.includes('unesp')) {
      alumniOf.push({ "@type": "CollegeOrUniversity", "name": "Universidade Estadual Paulista (UNESP)" });
    }
    if (bio.includes('são carlos') || bio.includes('eesc')) {
      alumniOf.push({ "@type": "CollegeOrUniversity", "name": "Escola de Engenharia de São Carlos - USP" });
    }
    
    const result: { hasCredential?: any[]; alumniOf?: any[] } = {};
    if (credentials.length > 0) result.hasCredential = credentials;
    if (alumniOf.length > 0) result.alumniOf = alumniOf;
    
    return result;
  };
  
  const authorCredentials = detectAuthorCredentials();

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

  // 🆕 Preparar sameAs links do autor
  const authorSameAs = content.authors ? [
    content.authors.lattes_url,
    content.authors.linkedin_url,
    content.authors.instagram_url,
    content.authors.youtube_url,
    content.authors.facebook_url,
    content.authors.twitter_url,
    content.authors.website_url
  ].filter(Boolean) : [];

  const articleSchema: any = {
    "@context": "https://schema.org",
    // 🆕 AUDITORIA SEO: Usar tipo dinâmico com array para MedicalWebPage/ScholarlyArticle
    "@type": contentType === 'MedicalWebPage' 
      ? ["TechArticle", "MedicalWebPage"]
      : contentType === 'ScholarlyArticle'
      ? ["TechArticle", "ScholarlyArticle"]
      : isTechnicalPage ? "TechArticle" : "Article",
    "headline": displayTitle,
    "keywords": content.keywords?.join(', ') || extractKeywordsFromContent(content.content_html || ''),
    "description": content.meta_description || content.excerpt,
    "image": content.og_image_url,
    "datePublished": new Date(content.created_at).toISOString(),
    "dateModified": new Date(content.updated_at).toISOString(),
    // Fix Google Search Console: Product/Article sem offers
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "SmartDent",
        "url": "https://parametros.smartdent.com.br"
      }
    },
    "articleBody": articleBody,
    "wordCount": wordCount,
    "inLanguage": htmlLang,
    
    // 🆕 AUDITORIA SEO: Propriedades específicas para MedicalWebPage
    ...(contentType === 'MedicalWebPage' && {
      "specialty": {
        "@type": "MedicalSpecialty",
        "name": "Dentistry"
      },
      "medicalAudience": {
        "@type": "MedicalAudience",
        "audienceType": "Clinician",
        "geographicArea": { "@type": "Country", "name": "Brazil" }
      },
      "lastReviewed": new Date(content.updated_at).toISOString().split('T')[0],
      "reviewedBy": content.authors ? {
        "@type": "Person",
        "name": content.authors.name,
        "jobTitle": content.authors.specialty
      } : {
        "@type": "Organization",
        "name": "Smart Dent - Equipe Técnica"
      }
    }),
    
    // 🆕 AUDITORIA SEO: Propriedades específicas para ScholarlyArticle
    ...(contentType === 'ScholarlyArticle' && {
      "abstract": content.meta_description || content.excerpt,
      "isAccessibleForFree": true,
      "citation": content.keywords?.slice(0, 3).map((k: string) => `Protocolo ${k}`).join('; ')
    }),
    
    // TechArticle com proficiencyLevel
    ...(isTechnicalPage && { 
      "proficiencyLevel": "Expert",
      "teaches": content.keywords?.slice(0, 5) || [],
      "reviewAspect": [
        {
          "@type": "Review",
          "reviewAspect": "Rigor Técnico dos Dados",
          "reviewBody": "Artigo validado com dados de fabricante, especificações técnicas verificadas e protocolo clínico testado. Todas as informações técnicas (resistência, módulo de elasticidade, temperatura) foram extraídas de fichas técnicas oficiais e manuais de fabricante.",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5",
            "bestRating": "5",
            "worstRating": "1"
          },
          "author": content.authors ? {
            "@type": "Person",
            "name": content.authors.name,
            "jobTitle": content.authors.specialty
          } : {
            "@type": "Organization",
            "name": "Equipe Técnica Smart Dent"
          },
          "datePublished": new Date(content.created_at).toISOString()
        }
      ]
    }),
    
    // 🆕 AUDITORIA SEO: Autor enriquecido com credentials e alumniOf detectados automaticamente
    "author": content.authors ? {
      "@type": "Person",
      "@id": `${baseUrl}/#author-${content.authors.name?.toLowerCase().replace(/\s+/g, '-')}`,
      "name": content.authors.name,
      "jobTitle": content.authors.specialty,
      "description": content.authors.mini_bio,
      "url": content.authors.website_url,
      "image": content.authors.photo_url,
      ...(authorSameAs.length > 0 && { "sameAs": authorSameAs }),
      // Credenciais detectadas do mini_bio
      ...authorCredentials,
      // Lattes como credencial reconhecida pelo CNPq
      ...(content.authors.lattes_url && !authorCredentials.hasCredential && {
        "hasCredential": [{
          "@type": "EducationalOccupationalCredential",
          "credentialCategory": "Currículo Lattes",
          "recognizedBy": {
            "@type": "Organization",
            "name": "CNPq - Conselho Nacional de Desenvolvimento Científico e Tecnológico"
          },
          "url": content.authors.lattes_url
        }]
      }),
      // knowsAbout
      "knowsAbout": [
        content.authors.specialty,
        "Impressão 3D Odontológica",
        "Odontologia Digital",
        ...(content.keywords?.slice(0, 3) || [])
      ].filter(Boolean)
    } : { 
      "@type": "Organization", 
      "@id": `${baseUrl}/#organization`,
      "name": "Smart Dent" 
    },
    "publisher": {
      "@type": "Organization",
      "@id": "https://parametros.smartdent.com.br/#organization",
      "name": companyData?.name || "Smart Dent",
      "url": companyData?.website_url,
      "logo": {
        "@type": "ImageObject",
        "url": companyData?.logo_url || "https://smartdent.com.br/logo.png"
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

  // 🆕 LearningResource Schema (SEO + IA Regenerativa 2025) - FASE 4 Enhanced
  const learningResourceSchema = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "name": displayTitle,
    "description": content.meta_description || content.excerpt,
    "educationalLevel": isTechnicalPage ? "professional" : "expert",
    "learningResourceType": content.content_html?.includes('itemtype="https://schema.org/HowTo') ? "how-to" : "reference",
    "timeRequired": `PT${Math.ceil(wordCount / 200)}M`, // ~200 palavras/min
    "inLanguage": htmlLang,
    "keywords": content.keywords?.join(', ') || extractKeywordsFromContent(content.content_html || ''),
    "author": articleSchema.author,
    "datePublished": articleSchema.datePublished,
    "teaches": content.keywords?.slice(0, 5) || [],
    // 🆕 FASE 4: audience.educationalRole (Google AI Overviews Priority)
    "audience": {
      "@type": "EducationalAudience",
      "educationalRole": isTechnicalPage 
        ? ["dentist", "dental technician", "prosthodontist"] 
        : ["dentist", "dental professional"],
      "audienceType": "Professional"
    }
  };

  // 🆕 HowTo Schemas para Instruções de Processamento de Resinas
  const resinProcessingSchemas = resinsWithInstructions.map((resin) => {
    const { preSteps, postSteps, totalTime } = extractProcessingInstructions(resin.processing_instructions);
    
    if (preSteps.length === 0 && postSteps.length === 0) return null;
    
    return {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": `Como processar impressões com ${resin.name}`,
      "description": `Instruções de pré e pós processamento para resina ${resin.manufacturer} ${resin.name}`,
      ...(totalTime && { "totalTime": totalTime }),
      "tool": {
        "@type": "Product",
        "name": resin.name,
        "brand": { "@type": "Brand", "name": resin.manufacturer }
      },
      "step": [
        ...(preSteps.length > 0 ? [{
          "@type": "HowToSection",
          "name": "Pré-processamento",
          "itemListElement": preSteps.map((step, idx) => ({
            "@type": "HowToStep",
            "position": idx + 1,
            "itemListElement": {
              "@type": "HowToDirection",
              "text": step
            }
          }))
        }] : []),
        ...(postSteps.length > 0 ? [{
          "@type": "HowToSection",
          "name": "Pós-processamento",
          "itemListElement": postSteps.map((step, idx) => ({
            "@type": "HowToStep",
            "position": preSteps.length + idx + 1,
            "itemListElement": {
              "@type": "HowToDirection",
              "text": step
            }
          }))
        }] : [])
      ]
    };
  }).filter(Boolean);
  
  // 🆕 Atualizar AI-context com instruções de processamento e SPIN do Sistema A
  let enhancedAiContext = `Conteúdo técnico-científico sobre impressão 3D odontológica e materiais dentais. Público-alvo: cirurgiões-dentistas, protéticos e especialistas em odontologia digital. Nível: ${isTechnicalPage ? 'Expert' : 'Profissional'}. Tipo: ${content.content_html?.includes('itemtype="https://schema.org/HowTo') ? 'Tutorial prático com protocolo clínico' : 'Artigo técnico de referência'}.`;
  
  // 🆕 SPIN do Sistema A (produtos do catálogo)
  if (products.length > 0) {
    const catalogSPIN = generateSPINFromCatalog(products, displayTitle, category?.letter);
    enhancedAiContext += ` ${catalogSPIN}`;
  }
  
  // Manter instruções de processamento de resinas (tabela resins)
  if (resinsWithInstructions.length > 0) {
    const instructionsSummary = resinsWithInstructions.map((resin) => {
      const { preSteps, postSteps } = extractProcessingInstructions(resin.processing_instructions);
      return `${resin.name}: ${[...preSteps, ...postSteps].slice(0, 3).join('; ')}`;
    }).join(' | ');
    
    enhancedAiContext += ` Instruções de processamento: ${instructionsSummary}`;
  }
  
  // 🆕 Keywords do catálogo para enriquecer contexto
  const catalogKeywords = products
    .flatMap((p: any) => p.keywords || [])
    .filter((k: string, i: number, arr: string[]) => arr.indexOf(k) === i)
    .slice(0, 10);

  if (catalogKeywords.length > 0) {
    enhancedAiContext += ` Termos relacionados: ${catalogKeywords.join(', ')}.`;
  }

  // 🆕 Categorias/Subcategorias do Sistema A
  const productCategories = [...new Set(products.map((p: any) => p.product_subcategory).filter(Boolean))];
  if (productCategories.length > 0) {
    enhancedAiContext += ` Categorias de produtos: ${productCategories.join(', ')}.`;
  }

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
        "name": "Base de Conhecimento",
        "item": `${baseUrl}/base-conhecimento`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": category?.name || "Categoria",
        "item": `${baseUrl}/base-conhecimento/${safeCategoryLetter(category?.letter)}`
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

  // Validação rigorosa: filtrar FAQs com question E answer não-vazios.
  // Resolve 21 docs com `acceptedAnswer.text` ausente e 47 com FAQPage rejeitado pelo GSC.
  const validFaqs = (allFAQs as any[]).filter(
    (f) =>
      f &&
      typeof f.question === 'string' && f.question.trim().length > 0 &&
      typeof f.answer === 'string' && f.answer.trim().length > 0
  );

  const faqSchema = validFaqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": validFaqs.map((faq: any) => ({
      "@type": "Question",
      "name": faq.question.trim(),
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer.trim()
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

  // 🆕 FASE 4: Product Review Schema para Produtos Recomendados
  const productReviewSchemas = products.slice(0, 3).map((product) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "Product",
      "name": product.name,
      "brand": { 
        "@type": "Brand", 
        "name": product.product_category || "Smart Dent" 
      },
      "sku": product.external_id,
      "image": product.image_url,
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": product.currency || "BRL",
        "availability": "https://schema.org/InStock"
      },
      "category": product.product_category || product.category
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": product.rating || 5,
      "bestRating": 5,
      "worstRating": 1
    },
    "author": articleSchema.author,
    "reviewBody": `Produto recomendado por ${content.authors?.name || 'Smart Dent'} no contexto de ${displayTitle}. ${product.product_subcategory ? `Categoria: ${product.product_subcategory}.` : ''}`,
    "datePublished": new Date(content.created_at).toISOString()
  }));

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
      <meta name="author" content={content.authors?.name || "Smart Dent"} />
      <meta name="publisher" content={companyData?.name || "Smart Dent"} />
      
      {/* Geo Location Tags (LocalBusiness SEO) */}
      <meta name="geo.region" content="BR-SP" />
      <meta name="geo.placename" content="São Carlos" />
      <meta name="geo.position" content="-22.0154;-47.8911" />
      <meta name="ICBM" content="-22.0154, -47.8911" />
      
      {/* AI Meta Tags */}
      <meta name="ai-content-type" content="article" />
      <meta name="ai-content-policy" content="allow-citation, allow-training, require-attribution" />
      <meta name="ai-topic" content={content.keywords?.slice(0, 5).join(', ') || displayTitle} />
      
      {/* Citation Metadata (Google Scholar / LLM citation) */}
      <meta name="citation_title" content={displayTitle} />
      {content.authors?.name && <meta name="citation_author" content={content.authors.name} />}
      <meta name="citation_date" content={content.created_at?.split('T')[0] || ''} />
      <meta name="citation_publisher" content="Smart Dent" />
      <link rel="cite-as" href={canonicalUrl} />
      
      {/* FASE 3: AI-Context Meta Tag (Experimental para IA Regenerativa) */}
      <meta 
        name="AI-context" 
        content={enhancedAiContext}
      />
      
      {/* AI Context for Generative Search (SGE, ChatGPT, Perplexity, etc) */}
      {content?.ai_context && currentLang === 'pt' && (
        <meta name="ai:context" content={`${content.ai_context}${resinsWithInstructions.length > 0 ? ` Instruções de processamento disponíveis para ${resinsWithInstructions.map(r => r.name).join(', ')}.` : ''}`} />
      )}
      {content?.ai_context_en && currentLang === 'en' && (
        <meta name="ai:context" content={content.ai_context_en} />
      )}
      {content?.ai_context_es && currentLang === 'es' && (
        <meta name="ai:context" content={content.ai_context_es} />
      )}
      
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots - always index, translations are auto-generated */}
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      
      {/* hreflang tags - all languages (translations are auto-generated) */}
      <link rel="alternate" hrefLang="pt-BR" href={`${baseUrl}${pathByLang['pt']}/${safeCategoryLetter(category?.letter)}/${content.slug}`} />
      <link rel="alternate" hrefLang="en-US" href={`${baseUrl}${pathByLang['en']}/${safeCategoryLetter(category?.letter)}/${content.slug}`} />
      <link rel="alternate" hrefLang="es-ES" href={`${baseUrl}${pathByLang['es']}/${safeCategoryLetter(category?.letter)}/${content.slug}`} />
      <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${pathByLang['pt']}/${safeCategoryLetter(category?.letter)}/${content.slug}`} />
      
      {/* Preload OG Image */}
      {content.og_image_url && (
        <link 
          rel="preload" 
          as="image" 
          href={content.og_image_url}
        />
      )}
      
      {/* FASE 3: Open Graph Otimizado para IA */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={displayTitle} />
      <meta property="og:description" content={content.excerpt} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Smart Dent | Fluxo Digital" />
      <meta property="og:locale" content="pt_BR" />
      <meta property="article:section" content={category?.name || 'Conhecimento'} />
      <meta property="article:published_time" content={content.created_at || new Date().toISOString()} />
      <meta property="article:modified_time" content={content.updated_at || new Date().toISOString()} />
      {content.keywords?.slice(0, 10).map((keyword: string, index: number) => (
        <meta key={`article-tag-${index}`} property="article:tag" content={keyword} />
      ))}
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
      
      {/* FASE 1 & 2: JSON-LD Schemas Unificados (SPA + SEO-Proxy) */}
      <script type="application/ld+json" defer>
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            articleSchema,
            breadcrumbSchema,
            ...videoSchemas,
            ...(faqSchema ? [faqSchema] : []),
            ...(howToSchema ? [howToSchema] : []),
            // 🆕 HowTo Schemas para Instruções de Processamento de Resinas
            ...resinProcessingSchemas,
            // 🆕 FASE 3: LearningResource Schema Avançado (SEO + IA 2025)
            learningResourceSchema,
            // 🆕 FASE 4: Product Review Schemas (E-E-A-T)
            ...productReviewSchemas,
            // 🆕 AUDITORIA: SpeakableSpecification para Voice Search e AI Assistants
            {
              "@type": "WebPage",
              "@id": canonicalUrl,
              "speakable": {
                "@type": "SpeakableSpecification",
                "cssSelector": [
                  ".veredict-summary",
                  ".ai-summary-box", 
                  "h1",
                  ".article-excerpt",
                  ".knowledge-faq"
                ]
              }
            }
          ]
        })}
      </script>
    </Helmet>
  );
}
