import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Video, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useMediaUpload } from '@/hooks/social/useMediaUpload';
import { extractAudioMp3Base64, extractFrames } from '@/lib/social/videoExtract';

export interface VideoCopyResult {
  caption: string;
  hashtags: string[];
  first_comment: string;
  transcript?: string;
  on_screen_text?: string;
}

interface Props {
  /** Briefing/contexto textual (mesmo usado na geração de legenda). */
  instructions?: string;
  /** Linhas que devem aparecer literalmente (datas, local, estande, horários). */
  hardFacts?: string[];
  /** @perfis autorizados (palestrantes cadastrados, evento, marcas). */
  mentions?: string[];
  platform?: string;
  tone?: string;
  onApply: (result: VideoCopyResult) => void;
  /** Opcional: também adiciona o vídeo enviado às mídias do post. */
  onVideoUploaded?: (media: { url: string; path?: string; type: 'video' }) => void;
}

export function VideoCopyStudio({
  instructions,
  hardFacts,
  mentions,
  platform,
  tone,
  onApply,
  onVideoUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useMediaUpload();
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoName, setVideoName] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<string>('');
  const [result, setResult] = useState<VideoCopyResult | null>(null);

  const handlePick = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!file.type.startsWith('video/')) {
      toast.error('Envie um arquivo de vídeo');
      return;
    }
    setResult(null);
    setVideoFile(file);
    const items = await upload([file]);
    const item = items[0];
    if (!item) return;
    setVideoUrl(item.url);
    setVideoName(file.name);
    onVideoUploaded?.({ url: item.url, path: item.path, type: 'video' });
  };

  const handleAnalyze = async () => {
    if (!videoUrl && !videoFile) return;
    setAnalyzing(true);
    try {
      let audio_base64 = '';
      let frames: string[] = [];
      if (videoFile) {
        setStage('Extraindo áudio...');
        const audio = await extractAudioMp3Base64(videoFile).catch(() => null);
        audio_base64 = audio?.base64 || '';
        setStage('Lendo os textos da tela...');
        frames = await extractFrames(videoFile, 8).catch(() => []);
      }
      if (!audio_base64 && !frames.length && !videoUrl) {
        throw new Error('Não foi possível ler o vídeo neste navegador');
      }
      setStage('Escrevendo a copy...');
      const { data, error } = await supabase.functions.invoke('social-video-copy', {
        body: {
          video_url: videoUrl,
          audio_base64,
          audio_format: 'mp3',
          frames,
          instructions,
          hard_facts: hardFacts || [],
          mentions: mentions || [],
          platform,
          tone,
          language: 'pt-BR',
        },
      });
      const serverMsg =
        (data && typeof data === 'object' && (data as any).error) ||
        (error as any)?.context?.responseJson?.error ||
        null;
      if (serverMsg) throw new Error(String(serverMsg));
      if (error) throw new Error(error.message);
      const res = data as VideoCopyResult;
      setResult(res);
      toast.success('Copy gerada a partir do vídeo');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao analisar o vídeo');
    } finally {
      setAnalyzing(false);
      setStage('');
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Upload de vídeo → copy automática</Label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Envie um vídeo com narração. O sistema transcreve o áudio, lê os textos da tela e escreve a
          legenda com os horários, o estande e as marcações dos palestrantes cadastrados.
        </p>
        {hardFacts?.length ? (
          <p className="text-[11px] text-primary">
            Agenda carregada: {hardFacts.length} informações do evento (datas, horários, local e estande).
          </p>
        ) : (
          <p className="text-[11px] text-amber-600">
            Nenhuma agenda carregada. Selecione o evento acima para que as datas e os horários das
            demonstrações entrem na legenda.
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handlePick(e.target.files)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || analyzing}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando vídeo...</>
            ) : (
              <><Upload className="w-4 h-4 mr-1" /> {videoUrl ? 'Trocar vídeo' : 'Upload Vídeo'}</>
            )}
          </Button>
          {videoName && (
            <Badge variant="outline" className="max-w-[240px] truncate text-[10px]">{videoName}</Badge>
          )}
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={handleAnalyze}
            disabled={(!videoUrl && !videoFile) || analyzing || uploading}
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {stage || 'Transcrevendo e escrevendo...'}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1" /> Gerar copy do vídeo</>
            )}
          </Button>
        </div>

        {videoUrl && (
          <video src={videoUrl} controls className="w-full max-h-64 rounded-md bg-black" />
        )}

        {result && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Prévia da copy</Label>
            <ScrollArea className="h-48 rounded-md border bg-muted/50 p-3">
              <pre className="text-xs whitespace-pre-wrap font-sans">{result.caption}</pre>
              {!!result.hashtags?.length && (
                <p className="text-xs mt-2 text-muted-foreground">
                  {result.hashtags.map((h) => `#${h}`).join(' ')}
                </p>
              )}
              {result.first_comment && (
                <p className="text-xs mt-2 whitespace-pre-wrap">1º comentário: {result.first_comment}</p>
              )}
              {result.transcript && (
                <details className="mt-3 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer">Transcrição do vídeo</summary>
                  <pre className="whitespace-pre-wrap font-sans mt-1">{result.transcript}</pre>
                  {result.on_screen_text && (
                    <pre className="whitespace-pre-wrap font-sans mt-2">Textos na tela: {result.on_screen_text}</pre>
                  )}
                </details>
              )}
            </ScrollArea>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => onApply(result)}>
                Usar esta copy
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setResult(null)}>
                Descartar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
