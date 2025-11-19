import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Video, FileText, Languages } from 'lucide-react';

interface VideoContentExtractorProps {
  video: {
    id: string;
    title: string;
    video_type: 'youtube' | 'pandavideo';
    url?: string;
    pandavideo_id?: string;
  };
  onContentExtracted: (content: string) => void;
  onClose: () => void;
}

export function VideoContentExtractor({ 
  video, 
  onContentExtracted, 
  onClose 
}: VideoContentExtractorProps) {
  const { toast } = useToast();
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [includeDescription, setIncludeDescription] = useState(true);
  const [language, setLanguage] = useState<'pt-BR' | 'en' | 'es'>('pt-BR');
  const [extracting, setExtracting] = useState(false);
  const [extractedContent, setExtractedContent] = useState('');
  const [error, setError] = useState('');

  const handleExtract = async () => {
    setExtracting(true);
    setError('');
    
    try {
      const videoId = video.video_type === 'pandavideo' 
        ? video.pandavideo_id 
        : video.url;

      if (!videoId) {
        throw new Error('ID do vídeo não disponível');
      }

      console.log('Extracting content for:', { videoType: video.video_type, videoId });

      const { data, error: functionError } = await supabase.functions.invoke('extract-video-content', {
        body: {
          videoType: video.video_type,
          videoId,
          includeTranscript,
          includeDescription,
          preferredLanguage: language
        }
      });

      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error || 'Erro ao extrair conteúdo');
      
      // Build formatted content
      let content = `# ${data.data.videoTitle}\n\n`;
      
      if (includeDescription && data.data.description) {
        content += `## 📝 Descrição\n\n${data.data.description}\n\n`;
      }
      
      if (includeTranscript && data.data.transcript) {
        const langLabel = language === 'pt-BR' ? 'Português' : language === 'en' ? 'English' : 'Español';
        content += `## 🎬 Transcrição (${langLabel})\n\n${data.data.transcript}\n`;
      }
      
      setExtractedContent(content);
      
      // 🆕 Avisos inteligentes baseados no conteúdo extraído
      if (data.data.videoTitle === 'Video' || !data.data.videoTitle) {
        toast({
          title: '⚠️ Título Genérico',
          description: 'Configure um título descritivo no PandaVideo para melhor organização',
          variant: 'default'
        });
      }

      if (includeDescription && !data.data.description) {
        toast({
          title: '⚠️ Descrição não disponível',
          description: 'Este vídeo não possui descrição. Configure no PandaVideo para enriquecer o conteúdo.',
          variant: 'default'
        });
      }

      if (includeTranscript && !data.data.transcript) {
        toast({
          title: '⚠️ Transcrição não disponível',
          description: 'Legendas não encontradas. Configure legendas no PandaVideo ou copie manualmente.',
          variant: 'destructive'
        });
      }

      // Toast de sucesso apenas se extraiu algo útil
      const wordCount = content.split(/\s+/).length;
      if (wordCount > 3) { // Mais que apenas "# Video"
        toast({
          title: '✅ Conteúdo extraído!',
          description: `${wordCount} palavras capturadas com sucesso`
        });
      } else {
        toast({
          title: '⚠️ Conteúdo mínimo extraído',
          description: 'Verifique se o vídeo possui descrição/legendas no PandaVideo',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Extraction error:', error);
      setError(error.message || 'Erro ao extrair conteúdo');
      toast({
        title: '❌ Erro ao extrair conteúdo',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleSendToEditor = () => {
    onContentExtracted(extractedContent);
    toast({
      title: '✅ Conteúdo enviado!',
      description: 'O texto foi adicionado ao campo de entrada'
    });
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  const wordCount = extractedContent ? extractedContent.split(/\s+/).length : 0;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-2">
        <div className="flex items-start gap-3">
          <Video className="h-6 w-6 text-primary mt-1" />
          <div className="flex-1">
            <CardTitle className="text-xl">{video.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {video.video_type === 'pandavideo' ? '🟣 PandaVideo' : '🔴 YouTube'}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">O que deseja extrair?</Label>
          </div>
          
          <div className="space-y-3 pl-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="transcript"
                checked={includeTranscript}
                onCheckedChange={(checked) => setIncludeTranscript(!!checked)}
              />
              <Label htmlFor="transcript" className="cursor-pointer font-normal">
                Legenda/Transcrição do vídeo
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="description"
                checked={includeDescription}
                onCheckedChange={(checked) => setIncludeDescription(!!checked)}
              />
              <Label htmlFor="description" className="cursor-pointer font-normal">
                Descrição do vídeo
              </Label>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Idioma Preferencial</Label>
          </div>
          <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">🇧🇷 Português (Brasil)</SelectItem>
              <SelectItem value="en">🇺🇸 English</SelectItem>
              <SelectItem value="es">🇪🇸 Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {extractedContent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                📝 Prévia do Conteúdo ({wordCount.toLocaleString('pt-BR')} palavras)
              </Label>
              <ScrollArea className="h-64 w-full rounded-lg border bg-muted/50 p-4">
                <pre className="text-sm whitespace-pre-wrap font-sans">
                  {extractedContent}
                </pre>
              </ScrollArea>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSendToEditor}
                className="flex-1"
              >
                ✅ Enviar para Campo de Texto
              </Button>
              <Button 
                onClick={handleSkip}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button 
              onClick={handleExtract}
              disabled={extracting || (!includeTranscript && !includeDescription)}
              className="flex-1"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extraindo conteúdo...
                </>
              ) : (
                <>📥 Capturar Conteúdo</>
              )}
            </Button>
            <Button 
              onClick={handleSkip}
              variant="outline"
            >
              Pular
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
