import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "knowledge-images";
const PREFIX = "course-covers";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES];

function isVideoUrl(url: string) {
  return /(\.mp4|\.webm|\.ogg|\.mov)(\?|#|$)/i.test(url);
}

function isEmbedPlayerUrl(url: string) {
  return /pandavideo|\/embed\/?\?v=|player-vz-/i.test(url);
}

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function CoverImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isVideo && !IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG, WEBP, MP4 ou WEBM.");
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      toast.error("Vídeo muito grande (máx. 50 MB).");
      return;
    }
    if (!isVideo && file.size > MAX_IMAGE_BYTES) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success(isVideo ? "Vídeo enviado" : "Imagem enviada");
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
          {value ? "Trocar mídia" : "Enviar imagem ou vídeo"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={uploading}>
            <X className="w-4 h-4 mr-1" /> Remover
          </Button>
        )}
      </div>
      {value && (
        <div className="aspect-[16/9] w-full max-w-xs rounded-md overflow-hidden border bg-muted">
          {isVideoUrl(value) ? (
            <video src={value} controls playsInline preload="metadata" className="w-full h-full object-cover" />
          ) : (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">PNG, JPG ou WEBP até 5 MB; MP4 ou WEBM até 50 MB. Recomendado 1200×675 (16:9).</p>
    </div>
  );
}
