import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "knowledge-images";
const PREFIX = "lp-audio";
const MAX_BYTES = 30 * 1024 * 1024;
const ACCEPT = ["audio/mpeg", "audio/mp3"];

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function HeroAudioUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    const isMp3 = ACCEPT.includes(file.type) || /\.mp3$/i.test(file.name);
    if (!isMp3) {
      toast.error("Formato inválido. Envie um arquivo .mp3");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Áudio muito grande (máx. 30 MB).");
      return;
    }
    setUploading(true);
    try {
      const path = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: "audio/mpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Áudio enviado");
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,.mp3"
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
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-1.5" />
          )}
          {value ? "Trocar áudio" : "Enviar áudio (.mp3)"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={uploading}>
            <X className="w-4 h-4 mr-1" /> Remover
          </Button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <Volume2 className="w-4 h-4 text-primary flex-shrink-0" />
          <audio src={value} controls className="w-full h-8" />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Arquivo .mp3 até 30 MB. Aparece como player animado no card do hero.</p>
    </div>
  );
}