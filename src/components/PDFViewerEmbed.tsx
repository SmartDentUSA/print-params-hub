import { FileText, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PDFViewerEmbedProps {
  url: string;
  title: string;
  subtitle?: string;
}

export function PDFViewerEmbed({ url, title, subtitle }: PDFViewerEmbedProps) {
  return (
    <Card className="my-8 border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm opacity-90 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* PDF iframe */}
        <iframe
          src={`${url}#view=FitH&toolbar=0&navpanes=0`}
          className="w-full h-[500px] md:h-[800px] lg:h-[1123px] border-none"
          title={title}
          loading="lazy"
        />
        
        {/* Download button */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(url, '_blank')}
            className="w-full border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar PDF completo
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
