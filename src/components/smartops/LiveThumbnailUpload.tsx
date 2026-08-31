import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "knowledge-images";
const PREFIX = "live-covers";
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function LiveThumbnailUpload({ value, onChange, label = "Enviar capa (upload)" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPT.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem muito grande (máx. 8 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Capa enviada");
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
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
        className="mt-2 w-full"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
        {uploading ? "Enviando…" : value ? "Trocar capa (upload)" : label}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" disabled={uploading} onClick={() => onChange("")}>
          <X className="w-3.5 h-3.5 mr-1" /> Remover capa
        </Button>
      )}
    </>
  );
}
