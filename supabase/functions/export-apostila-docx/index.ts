import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ExternalHyperlink,
  PageBreak,
  BorderStyle,
  WidthType,
  AlignmentType,
  TableOfContents,
  StyleLevel,
  ShadingType,
} from "https://esm.sh/docx@8.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to strip HTML tags and decode entities
function stripHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper to truncate text
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper to format date
function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

// Helper to create a hyperlink paragraph
function createLink(text: string, url: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: '🔗 ', size: 20 }),
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: truncate(url, 80),
            style: 'Hyperlink',
            size: 18,
          }),
        ],
        link: url,
      }),
    ],
    spacing: { after: 100 },
  });
}

// Create section heading
function createSectionHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 400, after: 200 },
  });
}

// Create bullet point
function createBullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
    spacing: { after: 80 },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting DOCX apostila generation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all data in parallel
    console.log('📊 Fetching all data from database...');
    const [
      { data: brands },
      { data: models },
      { data: resins },
      { data: parameterSets },
      { data: categories },
      { data: contents },
      { data: videos },
      { data: catalogDocs },
      { data: resinDocs },
      { data: catalog },
      { data: authors },
      { data: externalLinks },
    ] = await Promise.all([
      supabase.from('brands').select('*').eq('active', true).order('name'),
      supabase.from('models').select('*').eq('active', true).order('name'),
      supabase.from('resins').select('*').eq('active', true).order('manufacturer, name'),
      supabase.from('parameter_sets').select('*').eq('active', true).order('brand_slug, model_slug, resin_name'),
      supabase.from('knowledge_categories').select('*').eq('enabled', true).order('order_index'),
      supabase.from('knowledge_contents').select('*').eq('active', true).order('order_index'),
      supabase.from('knowledge_videos').select('*').order('order_index'),
      supabase.from('catalog_documents').select('*').eq('active', true),
      supabase.from('resin_documents').select('*').eq('active', true),
      supabase.from('system_a_catalog').select('*').eq('active', true).eq('approved', true).order('category, name'),
      supabase.from('authors').select('*').eq('active', true).order('order_index'),
      supabase.from('external_links').select('*').eq('approved', true).order('category, name'),
    ]);

    console.log(`📈 Data fetched: ${brands?.length || 0} brands, ${models?.length || 0} models, ${resins?.length || 0} resins, ${parameterSets?.length || 0} parameters`);
    console.log(`📝 Contents: ${contents?.length || 0} articles, ${videos?.length || 0} videos, ${catalog?.length || 0} products`);

    // Create lookup maps
    const brandMap = new Map(brands?.map(b => [b.slug, b.name]) || []);
    const modelMap = new Map(models?.map(m => [m.slug, m.name]) || []);
    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Build document sections
    const sections: Paragraph[] = [];

    // =====================
    // 1. COVER PAGE
    // =====================
    sections.push(
      new Paragraph({ spacing: { before: 2000 } }),
      new Paragraph({
        children: [
          new TextRun({ text: '📘', size: 96 }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: 'APOSTILA TÉCNICA COMPLETA', 
            bold: true, 
            size: 56,
            color: '1E40AF'
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: 'SMARTDENT 3D', 
            bold: true, 
            size: 72,
            color: '1E40AF'
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: 'Impressão 3D Odontológica • Resinas • Parâmetros • Conhecimento', 
            size: 24,
            italics: true,
            color: '6B7280'
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Gerado em: ${today}`, size: 22, color: '6B7280' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: `Total de registros: ${(brands?.length || 0) + (models?.length || 0) + (resins?.length || 0) + (parameterSets?.length || 0) + (contents?.length || 0) + (videos?.length || 0) + (catalog?.length || 0)}`, 
            size: 20, 
            color: '9CA3AF' 
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ children: [new PageBreak()] })
    );

    // =====================
    // 2. TABLE OF CONTENTS
    // =====================
    sections.push(
      createSectionHeading('📑 ÍNDICE', HeadingLevel.HEADING_1),
      new Paragraph({ text: '1. Resinas 3D Odontológicas', spacing: { after: 100 } }),
      new Paragraph({ text: '2. Parâmetros de Impressão', spacing: { after: 100 } }),
      new Paragraph({ text: '3. Impressoras Compatíveis (Marcas e Modelos)', spacing: { after: 100 } }),
      new Paragraph({ text: '4. Catálogo de Produtos', spacing: { after: 100 } }),
      new Paragraph({ text: '5. Base de Conhecimento (Artigos)', spacing: { after: 100 } }),
      new Paragraph({ text: '6. Documentos Técnicos (PDFs)', spacing: { after: 100 } }),
      new Paragraph({ text: '7. Videoteca', spacing: { after: 100 } }),
      new Paragraph({ text: '8. Autores e Especialistas', spacing: { after: 100 } }),
      new Paragraph({ text: '9. Links Úteis', spacing: { after: 100 } }),
      new Paragraph({ children: [new PageBreak()] })
    );

    // =====================
    // 3. RESINS SECTION
    // =====================
    sections.push(createSectionHeading('1. RESINAS 3D ODONTOLÓGICAS', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${resins?.length || 0} resinas cadastradas`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (resins && resins.length > 0) {
      // Group by manufacturer
      const resinsByManufacturer = new Map<string, typeof resins>();
      for (const resin of resins) {
        const mfr = resin.manufacturer || 'Outros';
        if (!resinsByManufacturer.has(mfr)) {
          resinsByManufacturer.set(mfr, []);
        }
        resinsByManufacturer.get(mfr)!.push(resin);
      }

      for (const [manufacturer, mfrResins] of resinsByManufacturer) {
        sections.push(createSectionHeading(`🏭 ${manufacturer}`, HeadingLevel.HEADING_2));
        
        for (const resin of mfrResins) {
          sections.push(createSectionHeading(`${resin.name}`, HeadingLevel.HEADING_3));
          
          if (resin.description) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: stripHtml(resin.description), size: 22 })],
              spacing: { after: 150 },
            }));
          }
          
          if (resin.type) {
            sections.push(createBullet(`Tipo: ${resin.type}`));
          }
          
          if (resin.processing_instructions) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: '📋 Instruções de Processamento:', bold: true, size: 22 })],
              spacing: { before: 150, after: 80 },
            }));
            sections.push(new Paragraph({
              children: [new TextRun({ text: truncate(stripHtml(resin.processing_instructions), 500), size: 20, color: '374151' })],
              spacing: { after: 150 },
            }));
          }
          
          // CTAs (purchase links)
          const ctas = [
            { label: resin.cta_1_label, url: resin.cta_1_url },
            { label: resin.cta_2_label, url: resin.cta_2_url },
            { label: resin.cta_3_label, url: resin.cta_3_url },
            { label: resin.cta_4_label, url: resin.cta_4_url },
          ].filter(c => c.url);
          
          if (ctas.length > 0) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: '🛒 Links de Compra:', bold: true, size: 22 })],
              spacing: { before: 100, after: 80 },
            }));
            for (const cta of ctas) {
              if (cta.url) {
                sections.push(createLink(cta.label || 'Comprar', cta.url));
              }
            }
          }
          
          sections.push(new Paragraph({ spacing: { after: 200 } }));
        }
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 4. PARAMETERS SECTION
    // =====================
    sections.push(createSectionHeading('2. PARÂMETROS DE IMPRESSÃO', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${parameterSets?.length || 0} configurações cadastradas`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (parameterSets && parameterSets.length > 0) {
      // Group by brand -> model
      const paramsByBrand = new Map<string, Map<string, typeof parameterSets>>();
      
      for (const param of parameterSets) {
        const brandSlug = param.brand_slug || 'outros';
        const modelSlug = param.model_slug || 'outros';
        
        if (!paramsByBrand.has(brandSlug)) {
          paramsByBrand.set(brandSlug, new Map());
        }
        if (!paramsByBrand.get(brandSlug)!.has(modelSlug)) {
          paramsByBrand.get(brandSlug)!.set(modelSlug, []);
        }
        paramsByBrand.get(brandSlug)!.get(modelSlug)!.push(param);
      }

      for (const [brandSlug, modelParams] of paramsByBrand) {
        const brandName = brandMap.get(brandSlug) || brandSlug;
        sections.push(createSectionHeading(`🏷️ ${brandName}`, HeadingLevel.HEADING_2));
        
        for (const [modelSlug, params] of modelParams) {
          const modelName = modelMap.get(modelSlug) || modelSlug;
          sections.push(createSectionHeading(`${modelName}`, HeadingLevel.HEADING_3));
          
          // Create parameters table
          const tableRows: TableRow[] = [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Resina', bold: true, size: 18 })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Layer', bold: true, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cure', bold: true, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Bottom', bold: true, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Intensidade', bold: true, size: 18 })] })], width: { size: 12, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lift', bold: true, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
              ],
              tableHeader: true,
            }),
          ];
          
          for (const p of params) {
            tableRows.push(
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.resin_name} (${p.resin_manufacturer})`, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.layer_height}mm`, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.cure_time}s`, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.bottom_cure_time || '-'}s`, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.light_intensity}%`, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.lift_distance || '-'}mm`, size: 18 })] })] }),
                ],
              })
            );
          }
          
          sections.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }));
          
          sections.push(new Paragraph({ spacing: { after: 300 } }));
        }
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 5. PRINTERS SECTION
    // =====================
    sections.push(createSectionHeading('3. IMPRESSORAS COMPATÍVEIS', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${brands?.length || 0} marcas, ${models?.length || 0} modelos`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (brands && brands.length > 0) {
      for (const brand of brands) {
        sections.push(createSectionHeading(`🖨️ ${brand.name}`, HeadingLevel.HEADING_2));
        
        const brandModels = models?.filter(m => m.brand_id === brand.id) || [];
        if (brandModels.length > 0) {
          for (const model of brandModels) {
            sections.push(createBullet(`${model.name}${model.notes ? ` - ${model.notes}` : ''}`));
          }
        } else {
          sections.push(new Paragraph({
            children: [new TextRun({ text: 'Nenhum modelo cadastrado', italics: true, size: 20, color: '9CA3AF' })],
          }));
        }
        
        sections.push(new Paragraph({ spacing: { after: 200 } }));
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 6. CATALOG SECTION
    // =====================
    sections.push(createSectionHeading('4. CATÁLOGO DE PRODUTOS', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${catalog?.length || 0} produtos`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (catalog && catalog.length > 0) {
      // Group by category
      const productsByCategory = new Map<string, typeof catalog>();
      for (const product of catalog) {
        const cat = product.category || 'Outros';
        if (!productsByCategory.has(cat)) {
          productsByCategory.set(cat, []);
        }
        productsByCategory.get(cat)!.push(product);
      }

      for (const [category, products] of productsByCategory) {
        sections.push(createSectionHeading(`📦 ${category}`, HeadingLevel.HEADING_2));
        
        for (const product of products) {
          sections.push(createSectionHeading(product.name, HeadingLevel.HEADING_3));
          
          if (product.description) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: truncate(stripHtml(product.description), 300), size: 22 })],
              spacing: { after: 150 },
            }));
          }
          
          if (product.price) {
            sections.push(createBullet(`Preço: R$ ${product.price.toFixed(2).replace('.', ',')}`));
          }
          
          // CTAs
          const ctas = [
            { label: product.cta_1_label, url: product.cta_1_url },
            { label: product.cta_2_label, url: product.cta_2_url },
            { label: product.cta_3_label, url: product.cta_3_url },
          ].filter(c => c.url);
          
          for (const cta of ctas) {
            if (cta.url) {
              sections.push(createLink(cta.label || 'Ver produto', cta.url));
            }
          }
          
          sections.push(new Paragraph({ spacing: { after: 200 } }));
        }
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 7. KNOWLEDGE BASE SECTION
    // =====================
    sections.push(createSectionHeading('5. BASE DE CONHECIMENTO', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${contents?.length || 0} artigos`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (contents && contents.length > 0) {
      // Group by category
      const contentsByCategory = new Map<string, typeof contents>();
      for (const content of contents) {
        const catName = categoryMap.get(content.category_id) || 'Sem Categoria';
        if (!contentsByCategory.has(catName)) {
          contentsByCategory.set(catName, []);
        }
        contentsByCategory.get(catName)!.push(content);
      }

      for (const [category, articles] of contentsByCategory) {
        sections.push(createSectionHeading(`📚 ${category}`, HeadingLevel.HEADING_2));
        
        for (const article of articles) {
          sections.push(createSectionHeading(article.title, HeadingLevel.HEADING_3));
          
          if (article.excerpt) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: article.excerpt, italics: true, size: 22, color: '4B5563' })],
              spacing: { after: 150 },
            }));
          }
          
          if (article.content_html) {
            const cleanContent = stripHtml(article.content_html);
            sections.push(new Paragraph({
              children: [new TextRun({ text: truncate(cleanContent, 1000), size: 22 })],
              spacing: { after: 150 },
            }));
          }
          
          // FAQs
          if (article.faqs && Array.isArray(article.faqs) && article.faqs.length > 0) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: '❓ Perguntas Frequentes:', bold: true, size: 22 })],
              spacing: { before: 150, after: 100 },
            }));
            
            for (const faq of article.faqs.slice(0, 5)) {
              if (faq.question && faq.answer) {
                sections.push(new Paragraph({
                  children: [new TextRun({ text: `P: ${faq.question}`, bold: true, size: 20 })],
                  spacing: { after: 50 },
                }));
                sections.push(new Paragraph({
                  children: [new TextRun({ text: `R: ${truncate(stripHtml(faq.answer), 200)}`, size: 20, color: '4B5563' })],
                  spacing: { after: 100 },
                }));
              }
            }
          }
          
          if (article.slug) {
            sections.push(createLink('Ver artigo completo', `https://smartdent3d.com.br/base-conhecimento/${article.slug}`));
          }
          
          sections.push(new Paragraph({ spacing: { after: 300 } }));
        }
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 8. DOCUMENTS SECTION
    // =====================
    sections.push(createSectionHeading('6. DOCUMENTOS TÉCNICOS', HeadingLevel.HEADING_1));
    
    const allDocs = [
      ...(resinDocs || []).map(d => ({ ...d, source: 'resin' })),
      ...(catalogDocs || []).map(d => ({ ...d, source: 'catalog' })),
    ];
    
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${allDocs.length} documentos`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (allDocs.length > 0) {
      // Group by category
      const docsByCategory = new Map<string, typeof allDocs>();
      for (const doc of allDocs) {
        const cat = doc.document_category || 'Outros';
        if (!docsByCategory.has(cat)) {
          docsByCategory.set(cat, []);
        }
        docsByCategory.get(cat)!.push(doc);
      }

      for (const [category, docs] of docsByCategory) {
        sections.push(createSectionHeading(`📄 ${category}`, HeadingLevel.HEADING_2));
        
        for (const doc of docs) {
          sections.push(createSectionHeading(doc.document_name, HeadingLevel.HEADING_3));
          
          if (doc.document_description) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: doc.document_description, size: 22 })],
              spacing: { after: 100 },
            }));
          }
          
          if (doc.document_type) {
            sections.push(createBullet(`Tipo: ${doc.document_type}`));
          }
          
          if (doc.language) {
            sections.push(createBullet(`Idioma: ${doc.language.toUpperCase()}`));
          }
          
          if (doc.file_url) {
            sections.push(createLink('Download PDF', doc.file_url));
          }
          
          // Transcription
          if (doc.extracted_text) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: '📋 Transcrição (resumo):', bold: true, size: 22 })],
              spacing: { before: 150, after: 80 },
            }));
            sections.push(new Paragraph({
              children: [new TextRun({ text: truncate(doc.extracted_text, 500), size: 18, color: '4B5563' })],
              spacing: { after: 150 },
            }));
          }
          
          sections.push(new Paragraph({ spacing: { after: 200 } }));
        }
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 9. VIDEOS SECTION
    // =====================
    sections.push(createSectionHeading('7. VIDEOTECA', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${videos?.length || 0} vídeos`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (videos && videos.length > 0) {
      // Group by content type
      const videosByType = new Map<string, typeof videos>();
      for (const video of videos) {
        const type = video.content_type || video.video_type || 'Outros';
        if (!videosByType.has(type)) {
          videosByType.set(type, []);
        }
        videosByType.get(type)!.push(video);
      }

      for (const [type, typeVideos] of videosByType) {
        sections.push(createSectionHeading(`🎬 ${type}`, HeadingLevel.HEADING_2));
        
        for (const video of typeVideos) {
          sections.push(new Paragraph({
            children: [new TextRun({ text: `📹 ${video.title}`, bold: true, size: 24 })],
            spacing: { before: 200, after: 100 },
          }));
          
          if (video.description) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: truncate(stripHtml(video.description), 300), size: 22 })],
              spacing: { after: 100 },
            }));
          }
          
          // Video link
          const videoUrl = video.embed_url || video.url || (video.pandavideo_id ? `https://player-vz-004839ee-19a.tv.pandavideo.com.br/embed/?v=${video.pandavideo_id}` : null);
          if (videoUrl) {
            sections.push(createLink('Assistir vídeo', videoUrl));
          }
          
          // Analytics
          if (video.analytics_views || video.analytics_plays) {
            sections.push(createBullet(`Estatísticas: ${video.analytics_views || 0} visualizações, ${video.analytics_plays || 0} plays`));
          }
          
          // Duration
          if (video.video_duration_seconds) {
            const mins = Math.floor(video.video_duration_seconds / 60);
            const secs = video.video_duration_seconds % 60;
            sections.push(createBullet(`Duração: ${mins}:${secs.toString().padStart(2, '0')}`));
          }
          
          // Transcript
          if (video.video_transcript) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: '📝 Transcrição (resumo):', bold: true, size: 22 })],
              spacing: { before: 100, after: 80 },
            }));
            sections.push(new Paragraph({
              children: [new TextRun({ text: truncate(video.video_transcript, 400), size: 18, color: '4B5563' })],
              spacing: { after: 100 },
            }));
          }
          
          sections.push(new Paragraph({ spacing: { after: 200 } }));
        }
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 10. AUTHORS SECTION
    // =====================
    sections.push(createSectionHeading('8. AUTORES E ESPECIALISTAS', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${authors?.length || 0} autores`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (authors && authors.length > 0) {
      for (const author of authors) {
        sections.push(createSectionHeading(`👤 ${author.name}`, HeadingLevel.HEADING_2));
        
        if (author.specialty) {
          sections.push(createBullet(`Especialidade: ${author.specialty}`));
        }
        
        if (author.mini_bio) {
          sections.push(new Paragraph({
            children: [new TextRun({ text: author.mini_bio, italics: true, size: 22 })],
            spacing: { after: 100 },
          }));
        }
        
        if (author.full_bio) {
          sections.push(new Paragraph({
            children: [new TextRun({ text: truncate(stripHtml(author.full_bio), 400), size: 22 })],
            spacing: { after: 100 },
          }));
        }
        
        // Social links
        const socials = [
          { name: 'Instagram', url: author.instagram_url },
          { name: 'YouTube', url: author.youtube_url },
          { name: 'LinkedIn', url: author.linkedin_url },
          { name: 'Lattes', url: author.lattes_url },
          { name: 'Website', url: author.website_url },
        ].filter(s => s.url);
        
        if (socials.length > 0) {
          sections.push(new Paragraph({
            children: [new TextRun({ text: '🌐 Redes Sociais:', bold: true, size: 22 })],
            spacing: { before: 100, after: 80 },
          }));
          for (const social of socials) {
            if (social.url) {
              sections.push(createLink(social.name, social.url));
            }
          }
        }
        
        sections.push(new Paragraph({ spacing: { after: 300 } }));
      }
    }

    sections.push(new Paragraph({ children: [new PageBreak()] }));

    // =====================
    // 11. EXTERNAL LINKS SECTION
    // =====================
    sections.push(createSectionHeading('9. LINKS ÚTEIS', HeadingLevel.HEADING_1));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Total: ${externalLinks?.length || 0} links`, italics: true, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
    }));

    if (externalLinks && externalLinks.length > 0) {
      // Group by category
      const linksByCategory = new Map<string, typeof externalLinks>();
      for (const link of externalLinks) {
        const cat = link.category || 'Outros';
        if (!linksByCategory.has(cat)) {
          linksByCategory.set(cat, []);
        }
        linksByCategory.get(cat)!.push(link);
      }

      for (const [category, links] of linksByCategory) {
        sections.push(createSectionHeading(`🔗 ${category}`, HeadingLevel.HEADING_2));
        
        for (const link of links) {
          sections.push(new Paragraph({
            children: [new TextRun({ text: link.name, bold: true, size: 22 })],
            spacing: { after: 50 },
          }));
          
          if (link.description) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: link.description, size: 20, color: '4B5563' })],
              spacing: { after: 80 },
            }));
          }
          
          sections.push(createLink('Acessar', link.url));
          sections.push(new Paragraph({ spacing: { after: 150 } }));
        }
      }
    }

    // =====================
    // FOOTER
    // =====================
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    sections.push(new Paragraph({
      children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 20, color: 'D1D5DB' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
    }));
    sections.push(new Paragraph({
      children: [new TextRun({ text: 'SMARTDENT 3D - Apostila Técnica Completa', bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }));
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Documento gerado automaticamente em ${today}`, size: 20, color: '6B7280' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }));
    sections.push(new Paragraph({
      children: [new TextRun({ text: 'https://smartdent3d.com.br', size: 20, color: '2563EB' })],
      alignment: AlignmentType.CENTER,
    }));

    // Create document
    console.log('📄 Building DOCX document...');
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Calibri',
              size: 22,
            },
          },
        },
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 36,
              bold: true,
              color: '1E40AF',
            },
            paragraph: {
              spacing: { before: 400, after: 200 },
            },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 28,
              bold: true,
              color: '1E3A8A',
            },
            paragraph: {
              spacing: { before: 300, after: 150 },
            },
          },
          {
            id: 'Heading3',
            name: 'Heading 3',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 24,
              bold: true,
              color: '1F2937',
            },
            paragraph: {
              spacing: { before: 200, after: 100 },
            },
          },
        ],
      },
      sections: [{
        properties: {},
        children: sections,
      }],
    });

    // Generate buffer
    console.log('📦 Packing document...');
    const buffer = await Packer.toBuffer(doc);

    console.log(`✅ DOCX generated successfully! Size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

    // Return as downloadable file
    const filename = `smartdent-apostila-completa-${new Date().toISOString().split('T')[0]}.docx`;
    
    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('❌ Error generating DOCX:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate DOCX', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
