import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Loader2, ExternalLink, X } from "lucide-react";

type MediaKind = "image" | "video" | "audio" | "document";

const ACCEPT: Record<MediaKind, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,text/plain,text/csv",
};

function prettyFileName(url: string, fallback?: string): string {
  if (fallback) return fallback;
  try {
    const u = new URL(url);
    const raw = u.pathname.split("/").pop() || "arquivo";
    const decoded = decodeURIComponent(raw);
    if (decoded.length > 40) {
      const dot = decoded.lastIndexOf(".");
      const ext = dot > 0 ? decoded.slice(dot) : "";
      return decoded.slice(0, 32) + "…" + ext;
    }
    return decoded;
  } catch {
    return "arquivo";
  }
}

interface Props {
  kind: MediaKind;
  value: string;
  fileName?: string;
  onChange: (patch: { media_url: string; file_name?: string; mime_type?: string }) => void;
}

export function WaMediaUploader({ kind, value, fileName, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `${kind}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safe}`;
      const { error } = await supabase.storage.from("wa-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("wa-media").getPublicUrl(path);
      onChange({ media_url: data.publicUrl, file_name: file.name, mime_type: file.type });
      toast.success("Arquivo enviado");
    } catch (err: any) {
      toast.error("Falha no upload: " + (err?.message ?? String(err)));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => onChange({ media_url: "", file_name: undefined, mime_type: undefined });

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {value ? (
        <div className="space-y-1.5">
          {kind === "image" && (
            <img src={value} alt={fileName || "preview"} className="max-h-32 rounded border object-contain bg-muted/30" />
          )}
          {kind === "video" && (
            <video src={value} controls className="max-h-32 rounded border bg-muted/30" />
          )}
          {kind === "audio" && (
            <audio src={value} controls className="w-full h-8" />
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground truncate flex-1" title={value}>
              {prettyFileName(value, fileName)}
            </span>
            <Button size="sm" variant="ghost" className="h-7" asChild>
              <a href={value} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={clear}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline" className="flex-1"
            onClick={() => inputRef.current?.click()} disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Upload className="w-3 h-3 mr-1.5" />}
            {uploading ? "Enviando..." : `Enviar ${kind === "image" ? "imagem" : kind === "video" ? "vídeo" : kind === "audio" ? "áudio" : "arquivo"}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowUrl(v => !v)}>URL</Button>
        </div>
      )}

      {showUrl && !value && (
        <Input
          placeholder="ou cole uma URL pública"
          onChange={(e) => onChange({ media_url: e.target.value })}
        />
      )}
    </div>
  );
}