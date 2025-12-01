import { DirectHTMLRenderer } from './DirectHTMLRenderer';
import { PDFViewerEmbed } from './PDFViewerEmbed';
import { devLog, devWarn } from '@/utils/logger';

interface PDFContentRendererProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export function PDFContentRenderer({ htmlContent, deviceMode = 'desktop' }: PDFContentRendererProps) {
  // Verificar se há PDFs no conteúdo
  const hasPDFContainer = htmlContent.includes('pdf-viewer-container');
  
  // Se não há PDFs, renderizar normalmente
  if (!hasPDFContainer) {
    return <DirectHTMLRenderer htmlContent={htmlContent} deviceMode={deviceMode} />;
  }

  devLog('PDFContentRenderer: HTML snippet (first 500 chars):', htmlContent.substring(0, 500));

  // Regex mais simples e robusto: procurar por iframes dentro de pdf-viewer-container
  const containerPattern = /<div[^>]*class="pdf-viewer-container"[^>]*>([\s\S]*?)<\/div>(?=\s*(?:<div[^>]*class="pdf-viewer-container"|$))/g;
  
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = containerPattern.exec(htmlContent)) !== null) {
    const containerHTML = match[0];
    const containerContent = match[1];
    
    // Extrair URL do iframe
    const iframeMatch = containerContent.match(/<iframe[^>]+src="([^"]+)"[^>]*>/);
    // Extrair title do iframe
    const titleMatch = containerContent.match(/<iframe[^>]+title="([^"]+)"[^>]*>/) || 
                       containerContent.match(/<h3[^>]*>([^<]+)<\/h3>/);
    // Extrair subtitle (texto do <p> no header)
    const subtitleMatch = containerContent.match(/<p[^>]*style="[^"]*font-size:\s*12px[^"]*"[^>]*>([^<]+)<\/p>/);
    
    if (!iframeMatch) {
      devWarn('PDFContentRenderer: Found container but no iframe, skipping');
      continue;
    }
    
    const pdfUrl = iframeMatch[1];
    const pdfTitle = titleMatch ? titleMatch[1] : 'Documento PDF';
    const pdfSubtitle = subtitleMatch ? subtitleMatch[1].trim() : '';
    
    devLog('PDFContentRenderer: Found PDF:', { pdfUrl, pdfTitle, pdfSubtitle });
    
    // Conteúdo HTML antes do PDF
    if (match.index > lastIndex) {
      const htmlBefore = htmlContent.slice(lastIndex, match.index);
      if (htmlBefore.trim()) {
        parts.push(
          <DirectHTMLRenderer 
            key={`html-${key}`} 
            htmlContent={htmlBefore}
            deviceMode={deviceMode}
          />
        );
      }
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
    
    lastIndex = match.index + containerHTML.length;
    key++;
  }

  // Conteúdo HTML após o último PDF
  if (lastIndex < htmlContent.length) {
    const htmlAfter = htmlContent.slice(lastIndex);
    if (htmlAfter.trim()) {
      parts.push(
        <DirectHTMLRenderer 
          key={`html-${key}`} 
          htmlContent={htmlAfter}
          deviceMode={deviceMode}
        />
      );
    }
  }

  // Se não conseguiu extrair nenhum PDF com o regex, renderizar tudo diretamente
  if (parts.length === 0) {
    devWarn('PDFContentRenderer: Container found but regex failed, falling back to DirectHTMLRenderer');
    return <DirectHTMLRenderer htmlContent={htmlContent} deviceMode={deviceMode} />;
  }

  devLog('PDFContentRenderer: Successfully rendered', parts.length, 'parts');
  return <>{parts}</>;
}
