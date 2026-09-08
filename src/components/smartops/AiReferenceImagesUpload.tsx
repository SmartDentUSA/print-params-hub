import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "knowledge-images";
const PREFIX = "live-ai-references";
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_IMAGES = 6;

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Imagens enviadas manualmente que a IA pode usar como referência na geração
 * das capas da live — somam-se às fotos oficiais dos produtos associados.
 */
export default function AiReferenceImagesUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const urls = Array.isArray(value) ? value : [];

  async function handleFiles(files: File[]) {
    const room = MAX_IMAGES - urls.length;
    if (room <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens de referência.`);
      return;
    }
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of files.slice(0, room)) {
        if (!ACCEPT.includes(file.type)) {
          toast.error(`${file.name}: use PNG, JPG ou WEBP.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: imagem maior que 8 MB.`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
        if (error) throw error;
        added.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      if (added.length) {
        onChange([...urls, ...added]);
        toast.success(added.length === 1 ? "Imagem de referência enviada" : `${added.length} imagens enviadas`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) handleFiles(files);
        }}
      />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u) => (
            <div key={u} className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted">
              <img src={u} alt="Referência para geração por IA" className="w-full h-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((x) => x !== u))}
                className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 shadow"
                aria-label="Remover imagem de referência"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={uploading || urls.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
        ) : urls.length ? (
          <ImagePlus className="w-3.5 h-3.5 mr-1" />
        ) : (
          <Upload className="w-3.5 h-3.5 mr-1" />
        )}
        {uploading
          ? "Enviando…"
          : urls.length
            ? `Adicionar imagem (${urls.length}/${MAX_IMAGES})`
            : "Enviar imagens de referência"}
      </Button>
    </div>
  );
}
