import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, Check, Sparkles, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PDFTranscriptionProps {
  onTextExtracted: (extractedText: string) => void;
  disabled?: boolean;
  autoInsert?: boolean;
}

export const PDFTranscription = ({ onTextExtracted, disabled = false, autoInsert = false }: PDFTranscriptionProps) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [enrichedText, setEnrichedText] = useState<string | null>(null);
  const [detectedProduct, setDetectedProduct] = useState<any>(null);
  const [usedData, setUsedData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Apenas arquivos PDF são permitidos';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'PDF muito grande. Máximo permitido: 10MB';
    }
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File) => {
    console.log('📄 Processing PDF:', file.name, 'Size:', file.size);
    
    const error = validateFile(file);
    if (error) {
      toast({
        title: 'Erro',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    setIsTranscribing(true);
    setRawText(null);
    setEnrichedText(null);
    setShowComparison(false);

    try {
      const pdfBase64 = await fileToBase64(file);
      
      const pdfHash = pdfBase64.substring(0, 30);
      const timestamp = new Date().toISOString();
      console.log('🔑 PDF Hash:', pdfHash);
      console.log('📄 PDF Size:', Math.round(pdfBase64.length / 1024), 'KB');
      console.log('⏰ Processing at:', timestamp);
      
      const { data, error } = await supabase.functions.invoke('ai-enrich-pdf-content', {
        body: { pdfBase64 },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Request-Time': Date.now().toString(),
          'X-PDF-Hash': pdfHash
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.rawText) {
        throw new Error('Nenhum texto foi extraído do PDF');
      }

      setRawText(data.rawText);
      setEnrichedText(data.enrichedText);
      setDetectedProduct(data.detectedProduct);
      setUsedData(data.usedData);
      setStats(data.stats);
      setShowComparison(true);

      toast({
        title: '✅ PDF processado com sucesso!',
        description: data.detectedProduct 
          ? `Produto detectado: ${data.detectedProduct.productName} • ${data.usedData.productsCount + data.usedData.resinsCount + data.usedData.parametersCount + data.usedData.articlesCount} dados do banco encontrados`
          : `${data.rawText.length} caracteres extraídos`,
      });

      // Auto-inserção para modo orquestrador
      if (autoInsert) {
        onTextExtracted(data.enrichedText || data.rawText);
        setTimeout(() => {
          setShowComparison(false);
          setRawText(null);
          setEnrichedText(null);
        }, 3000);
      }

      if (data.stats?.warning) {
        toast({
          title: '⚠️ Aviso',
          description: data.stats.warning,
          variant: 'destructive',
        });
      }

    } catch (error: any) {
      console.error('Error processing PDF:', error);
      toast({
        title: 'Erro ao processar PDF',
        description: error.message || 'Verifique se o arquivo não está corrompido e tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
      // Limpar o input file para permitir re-upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isTranscribing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !isTranscribing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!disabled && !isTranscribing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleInsertText = (textToUse: 'raw' | 'enriched') => {
    const text = textToUse === 'raw' ? rawText : enrichedText;
    if (text) {
      onTextExtracted(text);
      setRawText(null);
      setEnrichedText(null);
      setShowComparison(false);
      // Limpar o input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: '✅ Texto inserido',
        description: `${textToUse === 'enriched' ? 'Texto enriquecido' : 'Texto original'} inserido no campo.`,
      });
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">📄 Transcrição de PDF</label>
      
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
          💡 <strong>Dica:</strong> Você também pode transcrever PDFs já existentes na lista de "PDFs Relacionados" acima, sem precisar fazer upload novamente!
        </p>
      </div>
      
      <Card
        className={`
          relative cursor-pointer transition-all border-2 border-dashed
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
          ${disabled || isTranscribing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="p-8 text-center space-y-3">
          {isTranscribing ? (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Transcrevendo PDF com IA...
              </p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Arraste um PDF ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Máximo 10MB • Funciona com PDFs escaneados (OCR)
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled || isTranscribing}
        />
      </Card>

      {showComparison && rawText && enrichedText && (
        <Card className="p-4 space-y-4 border-primary/20 bg-primary/5">
          {/* Header com produto detectado */}
          {detectedProduct && (
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Produto detectado:</p>
                <p className="text-lg font-bold">{detectedProduct.productName}</p>
                {detectedProduct.manufacturer && (
                  <p className="text-sm text-muted-foreground">{detectedProduct.manufacturer}</p>
                )}
              </div>
              <Badge variant="secondary" className="ml-2">
                {detectedProduct.category}
              </Badge>
            </div>
          )}

          {/* Stats dos dados do banco */}
          {usedData && (usedData.productsCount + usedData.resinsCount + usedData.parametersCount + usedData.articlesCount) > 0 && (
            <div className="grid grid-cols-4 gap-2 p-3 bg-background rounded-lg">
              <div className="text-center">
                <Database className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{usedData.productsCount}</p>
                <p className="text-xs text-muted-foreground">Produtos</p>
              </div>
              <div className="text-center">
                <Database className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{usedData.resinsCount}</p>
                <p className="text-xs text-muted-foreground">Resinas</p>
              </div>
              <div className="text-center">
                <Database className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{usedData.parametersCount}</p>
                <p className="text-xs text-muted-foreground">Parâmetros</p>
              </div>
              <div className="text-center">
                <Database className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{usedData.articlesCount}</p>
                <p className="text-xs text-muted-foreground">Artigos</p>
              </div>
            </div>
          )}

          {/* Tabs: Original vs Enriquecido */}
          <Tabs defaultValue="enriched" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="original" className="gap-2">
                <FileText className="w-4 h-4" />
                Original
              </TabsTrigger>
              <TabsTrigger value="enriched" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Enriquecido
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="original" className="mt-3">
              <div className="bg-background rounded-md p-4 max-h-64 overflow-y-auto border">
                <p className="text-sm whitespace-pre-wrap">{rawText}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {rawText.length} caracteres • Apenas texto extraído do PDF
              </p>
            </TabsContent>
            
            <TabsContent value="enriched" className="mt-3">
              <div className="bg-background rounded-md p-4 max-h-64 overflow-y-auto border border-primary/20">
                <p className="text-sm whitespace-pre-wrap">{enrichedText}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {enrichedText.length} caracteres • Enriquecido com dados do banco
                {stats?.expansionRate && ` • Taxa de expansão: ${stats.expansionRate}x`}
              </p>
            </TabsContent>
          </Tabs>

          {/* Botões de ação ou badge de sucesso */}
          {autoInsert ? (
            <div className="flex items-center justify-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Texto adicionado automaticamente às fontes
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleInsertText('raw')}
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-2" />
                Usar Original
              </Button>
              <Button
                onClick={() => handleInsertText('enriched')}
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Usar Enriquecido
              </Button>
            </div>
          )}

          {stats?.warning && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-xs text-destructive">{stats.warning}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
