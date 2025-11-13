import { BlogPreviewFrame } from './BlogPreviewFrame';
import { PDFViewerEmbed } from './PDFViewerEmbed';

interface PDFContentRendererProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export function PDFContentRenderer({ htmlContent, deviceMode = 'desktop' }: PDFContentRendererProps) {
  // Regex para extrair PDFs embedded
  const pdfPattern = /<div class="pdf-viewer-container"[^>]*>.*?<iframe\s+src="([^"]+)"[^>]*title="([^"]+)"[^>]*>.*?<\/iframe>.*?<p[^>]*class="pdf-subtitle"[^>]*>([^<]*)<\/p>.*?<\/div>/gs;
  
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pdfPattern.exec(htmlContent)) !== null) {
    const [fullMatch, pdfUrl, pdfTitle, pdfSubtitle] = match;
    
    // Conteúdo HTML antes do PDF
    if (match.index > lastIndex) {
      const htmlBefore = htmlContent.slice(lastIndex, match.index);
      parts.push(
        <BlogPreviewFrame 
          key={`html-${key}`} 
          htmlContent={htmlBefore}
          deviceMode={deviceMode}
        />
      );
    }
    
    // PDF viewer
    parts.push(
      <PDFViewerEmbed 
        key={`pdf-${key}`}
        url={pdfUrl} 
        title={pdfTitle}
        subtitle={pdfSubtitle}
      />
    );
    
    lastIndex = match.index + fullMatch.length;
    key++;
  }

  // Conteúdo HTML após o último PDF
  if (lastIndex < htmlContent.length) {
    const htmlAfter = htmlContent.slice(lastIndex);
    parts.push(
      <BlogPreviewFrame 
        key={`html-${key}`} 
        htmlContent={htmlAfter}
        deviceMode={deviceMode}
      />
    );
  }

  // Se não encontrou nenhum PDF, renderizar normalmente
  if (parts.length === 0) {
    return <BlogPreviewFrame htmlContent={htmlContent} deviceMode={deviceMode} />;
  }

  return <>{parts}</>;
}
