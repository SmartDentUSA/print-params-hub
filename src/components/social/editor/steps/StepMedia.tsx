import { useRef } from 'react';
import { Upload, X, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaUpload } from '@/hooks/social/useMediaUpload';
import type { PostInput, MediaItem } from '@/lib/social/postSchema';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

export function StepMedia({ value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useMediaUpload();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded = await upload(files);
    if (uploaded.length) onChange({ media_items: [...value.media_items, ...uploaded] });
  };

  const remove = (idx: number) =>
    onChange({ media_items: value.media_items.filter((_, i) => i !== idx) });

  const move = (idx: number, dir: -1 | 1) => {
    const next: MediaItem[] = [...value.media_items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ media_items: next });
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          'hover:bg-muted/30',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Enviando {progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-8 h-8" />
            <span className="text-sm">Arraste arquivos ou clique para selecionar</span>
            <span className="text-xs">Imagens ou vídeos (até 100MB cada)</span>
          </div>
        )}
      </div>

      {value.media_items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {value.media_items.map((m, idx) => {
            const vertical = m.width && m.height && m.height > m.width;
            return (
              <div key={`${m.url}-${idx}`} className="relative group border rounded-md overflow-hidden bg-muted">
                <div className={cn(vertical ? 'aspect-[9/16]' : 'aspect-square')}>
                  {m.type === 'video' ? (
                    <video src={m.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={m.url} className="w-full h-full object-cover" alt="" />
                  )}
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowLeft className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === value.media_items.length - 1}>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(idx)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
                  {m.type} {idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}