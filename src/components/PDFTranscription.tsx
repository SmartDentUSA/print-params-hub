import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PDFTranscriptionProps {
  onTextExtracted: (extractedText: string) => void;
  disabled?: boolean;
}

export const PDFTranscription = ({ onTextExtracted, disabled = false }: PDFTranscriptionProps) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
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
    setExtractedText(null);

    try {
      const pdfBase64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
        body: { pdfBase64 }
      });

      if (error) {
        throw error;
      }

      if (!data?.extractedText) {
        throw new Error('Nenhum texto foi extraído do PDF');
      }

      setExtractedText(data.extractedText);
      toast({
        title: '✅ PDF transcrito com sucesso!',
        description: `${data.extractedText.length} caracteres extraídos. Clique em "Inserir no campo" para usar.`,
      });

    } catch (error: any) {
      console.error('Error transcribing PDF:', error);
      toast({
        title: 'Erro ao transcrever PDF',
        description: error.message || 'Verifique se o arquivo não está corrompido e tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
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

  const handleInsertText = () => {
    if (extractedText) {
      onTextExtracted(extractedText);
      setExtractedText(null);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">📄 Transcrição de PDF</label>
      
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

      {extractedText && (
        <Card className="p-4 space-y-3 bg-success/5 border-success/20">
          <div className="flex items-start gap-2">
            <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-success">Texto extraído com sucesso!</p>
              <p className="text-xs text-muted-foreground mt-1">
                {extractedText.length} caracteres • 
                {extractedText.split('\n').filter(l => l.trim()).length} linhas
              </p>
            </div>
          </div>

          <div className="bg-background rounded-md p-3 max-h-32 overflow-y-auto">
            <p className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
              {extractedText.slice(0, 300)}
              {extractedText.length > 300 && '...'}
            </p>
          </div>

          <Button
            onClick={handleInsertText}
            size="sm"
            className="w-full"
          >
            <FileText className="w-4 h-4 mr-2" />
            Inserir no campo de texto
          </Button>
        </Card>
      )}
    </div>
  );
};
