import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Download, Loader2, FileText, Video, Package, Users, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ApostilaExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportApostila = async () => {
    setIsExporting(true);
    
    try {
      toast({
        title: "Gerando apostila...",
        description: "Isso pode levar alguns segundos. Por favor, aguarde.",
      });

      const response = await fetch(
        'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/export-apostila-docx',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      
      link.href = url;
      link.download = `smartdent-apostila-completa-${today}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Apostila gerada com sucesso!",
        description: "O download do arquivo DOCX foi iniciado.",
      });

    } catch (error) {
      console.error("Erro ao exportar apostila:", error);
      toast({
        title: "Erro ao gerar apostila",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Exportar Apostila Completa (DOCX)
        </CardTitle>
        <CardDescription>
          Gere uma apostila técnica completa em formato Word contendo todos os dados do sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="text-sm space-y-3">
            <div className="font-medium text-foreground">O documento incluirá:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span>Catálogo de Produtos</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Resinas e Parâmetros</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Base de Conhecimento</span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span>Videoteca com Links</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Documentos e Transcrições</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Autores e Especialistas</span>
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <span>Links Externos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            <strong>Formato:</strong> Microsoft Word (.docx) • 
            <strong> Compatível com:</strong> Word, Google Docs, LibreOffice
          </p>
        </div>

        <Button 
          onClick={handleExportApostila} 
          disabled={isExporting}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Gerando apostila...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Exportar Apostila DOCX
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
