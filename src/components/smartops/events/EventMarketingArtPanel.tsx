import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, Sparkles, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "wa-media";
const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export interface EventMarketingAsset {
  kind: string;
  label: string;
  url: string;
  width: number;
  height: number;
}

export function EventMarketingArtPanel({
  eventId,
  artUrl,
  assets,
  commentKeyword,
  onChange,
}: {
  eventId?: string;
  artUrl?: string | null;
  assets?: EventMarketingAsset[] | null;
  commentKeyword?: string | null;
  onChange: (patch: { marketing_art_url?: string | null; marketing_assets?: EventMarketingAsset[] }) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [keyword, setKeyword] = useState(commentKeyword || "");

  const list = assets || [];

  async function upload(file: File) {
    if (!ACCEPT.includes(file.type)) return toast.error("Use PNG, JPG ou WEBP");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `events-marketing-art/${eventId || "new"}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange({ marketing_art_url: data.publicUrl });
      toast.success("Arte enviada. Salve o evento e gere as artes.");
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!eventId) return toast.error("Salve o evento antes de gerar as artes.");
    if (!artUrl) return toast.error("Envie a arte padrão de divulgação primeiro.");
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("event-marketing-render", {
        body: {
          event_id: eventId,
          comment_keyword: keyword.trim() || undefined,
          ai_background: aiBg,
        },
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || res?.error || "Falha na geração");
      onChange({ marketing_assets: res.assets as EventMarketingAsset[] });
      toast.success(`${res.count} artes geradas`, { description: `Palavra-chave: ${res.comment_keyword}` });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar as artes");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3 border rounded-md p-3">
      <div>
        <Label className="text-sm font-semibold">Upload da arte do evento (padrão de divulgação)</Label>
        <p className="text-[11px] text-muted-foreground">
          Este layout é a base para gerar automaticamente o carrossel 1080×1350 (4:5) — um card por dia com
          palestrantes, horários e temas, mais o card final “Comente {keyword || "PALAVRA"}” — e um story
          1080×1920 (9:16) por palestrante.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            if (fileInput.current) fileInput.current.value = "";
          }}
        />
        {artUrl ? (
          <a href={artUrl} target="_blank" rel="noopener" className="block">
            <img src={artUrl} alt="Arte do evento" className="h-28 w-auto rounded-md border object-cover" />
          </a>
        ) : (
          <div className="flex h-28 w-24 items-center justify-center rounded-md border border-dashed text-[11px] text-muted-foreground">
            sem arte
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            {artUrl ? "Trocar arte" : "Enviar arte"}
          </Button>
          {artUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ marketing_art_url: null })}>
              <X className="w-4 h-4 mr-1.5" /> Remover
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <Label className="text-xs">Palavra-chave do comentário</Label>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value.toUpperCase())}
            placeholder="Ex: CIPRO"
            maxLength={24}
          />
        </div>
        <Button type="button" size="sm" onClick={generate} disabled={generating || !eventId || !artUrl}>
          {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Gerar carrossel + stories
        </Button>
        {!!list.length && <Badge variant="outline">{list.length} artes</Badge>}
      </div>

      {!!list.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {list.map((a) => (
            <div key={a.url} className="space-y-1 rounded-md border p-2">
              <img src={a.url} alt={a.label} className="w-full rounded object-cover" loading="lazy" />
              <p className="truncate text-[11px] font-medium">{a.label}</p>
              <p className="text-[10px] text-muted-foreground">{a.width}×{a.height}</p>
              <div className="flex gap-1">
                <a href={a.url} target="_blank" rel="noopener" className="text-primary">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a href={a.url} download className="text-primary">
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
