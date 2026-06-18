import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Upload, X, Search, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { IMAGE_PRESETS, validateAgainstPreset } from "@/lib/social/imagePresets";

type Lang = "pt" | "en" | "es";
const LANGS: Array<{ id: Lang; label: string }> = [
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
  { id: "es", label: "Espanhol" },
];

const HERO = IMAGE_PRESETS.hero_kb;
const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const BUCKET = "wa-media";

async function uploadToWaMedia(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Web research ----------
export function EventWebResearchButton({
  websiteUrl,
  onResult,
}: {
  websiteUrl?: string | null;
  onResult: (extracted: any, metadata: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  async function run() {
    if (!websiteUrl) {
      toast.error("Informe o site do evento primeiro.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("event-web-research", { body: { url: websiteUrl } });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Falha na pesquisa");
      onResult((data as any).extracted || {}, (data as any).metadata || {});
      toast.success("Informações extraídas. Revise os campos.");
    } catch (e: any) {
      toast.error(e?.message || "Falha na pesquisa web");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
      Buscar info na web
    </Button>
  );
}

// ---------- Reference uploads ----------
export function EventReferenceUploads({
  eventId,
  referenceImageUrl,
  eventLogoUrl,
  onChange,
}: {
  eventId?: string;
  referenceImageUrl?: string | null;
  eventLogoUrl?: string | null;
  onChange: (patch: { reference_image_url?: string; event_logo_url?: string }) => void;
}) {
  const refInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"ref" | "logo" | null>(null);

  async function up(file: File, kind: "ref" | "logo") {
    if (!ACCEPT.includes(file.type)) return toast.error("Use PNG, JPG ou WEBP");
    setBusy(kind);
    try {
      const folder = `events-ref/${eventId || "new"}`;
      const url = await uploadToWaMedia(file, folder);
      onChange(kind === "ref" ? { reference_image_url: url } : { event_logo_url: url });
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {(
        [
          { kind: "ref" as const, label: "Imagem de referência", value: referenceImageUrl, ref: refInput, field: "reference_image_url" as const },
          { kind: "logo" as const, label: "Logo do evento", value: eventLogoUrl, ref: logoInput, field: "event_logo_url" as const },
        ]
      ).map(({ kind, label, value, ref, field }) => (
        <div key={kind} className="space-y-2">
          <Label className="text-xs">{label}</Label>
          <div className="flex items-center gap-2">
            <input
              ref={ref}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f, kind); if (ref.current) ref.current.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy === kind} onClick={() => ref.current?.click()}>
              {busy === kind ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              {value ? "Trocar" : "Enviar"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ [field]: "" } as any)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {value && (
            <div className="w-full h-20 rounded border bg-muted overflow-hidden">
              <img src={value} alt={label} className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- About by language ----------
export function EventAboutByLanguage({
  eventId,
  values,
  onChange,
}: {
  eventId?: string;
  values: { pt?: string | null; en?: string | null; es?: string | null };
  onChange: (lang: Lang, value: string) => void;
}) {
  const [busy, setBusy] = useState<Lang | null>(null);

  async function gen(lang: Lang) {
    if (!eventId) return toast.error("Salve o evento antes de gerar conteúdo por IA.");
    setBusy(lang);
    try {
      const { data, error } = await supabase.functions.invoke("event-generate-about", {
        body: { event_id: eventId, language: lang },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Falha na geração");
      onChange(lang, (data as any).text || "");
      toast.success("Sobre o evento gerado");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Tabs defaultValue="pt">
      <TabsList>
        {LANGS.map((l) => <TabsTrigger key={l.id} value={l.id}>{l.label}</TabsTrigger>)}
      </TabsList>
      {LANGS.map((l) => (
        <TabsContent key={l.id} value={l.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Sobre o evento ({l.label}) — usado em Artigos Ciência & Tecnologia</Label>
            <Button type="button" size="sm" variant="outline" disabled={busy === l.id} onClick={() => gen(l.id)}>
              {busy === l.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Gerar por IA
            </Button>
          </div>
          <Textarea
            rows={8}
            value={values[l.id] || ""}
            onChange={(e) => onChange(l.id, e.target.value)}
            placeholder={`Texto editorial em ${l.label} (300–500 palavras, sem preços)…`}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ---------- Cover by language (upload + AI) ----------
export function EventCoverByLanguage({
  eventId,
  covers,
  prompts,
  referenceImageUrl,
  eventLogoUrl,
  onCoverChange,
  onPromptChange,
}: {
  eventId?: string;
  covers: { pt?: string | null; en?: string | null; es?: string | null };
  prompts: { pt?: string | null; en?: string | null; es?: string | null };
  referenceImageUrl?: string | null;
  eventLogoUrl?: string | null;
  onCoverChange: (lang: Lang, url: string) => void;
  onPromptChange: (lang: Lang, value: string) => void;
}) {
  const [busyUp, setBusyUp] = useState<Lang | null>(null);
  const [busyAi, setBusyAi] = useState<Lang | null>(null);
  const inputs = { pt: useRef<HTMLInputElement>(null), en: useRef<HTMLInputElement>(null), es: useRef<HTMLInputElement>(null) };

  async function up(lang: Lang, file: File) {
    if (!ACCEPT.includes(file.type)) return toast.error("Use PNG, JPG ou WEBP");
    const warn = validateAgainstPreset(file, HERO);
    if (warn) toast.warning(warn);
    setBusyUp(lang);
    try {
      const folder = `events-covers/${eventId || "new"}/${lang}`;
      const url = await uploadToWaMedia(file, folder);
      onCoverChange(lang, url);
      toast.success("Capa enviada");
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setBusyUp(null);
    }
  }

  async function genAi(lang: Lang) {
    if (!eventId) return toast.error("Salve o evento antes de gerar imagem.");
    const prompt = prompts[lang]?.trim();
    if (!prompt) return toast.error("Escreva um prompt para a IA.");
    setBusyAi(lang);
    try {
      const { data, error } = await supabase.functions.invoke("event-generate-image", {
        body: {
          event_id: eventId,
          language: lang,
          prompt,
          reference_image_url: referenceImageUrl || undefined,
          logo_url: eventLogoUrl || undefined,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Falha na geração");
      onCoverChange(lang, (data as any).url);
      toast.success("Capa gerada");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setBusyAi(null);
    }
  }

  return (
    <Tabs defaultValue="pt">
      <TabsList>
        {LANGS.map((l) => <TabsTrigger key={l.id} value={l.id}>{l.label}</TabsTrigger>)}
      </TabsList>
      {LANGS.map((l) => (
        <TabsContent key={l.id} value={l.id} className="space-y-3">
          <div className="aspect-[16/9] w-full max-w-md rounded border bg-muted overflow-hidden">
            {covers[l.id] ? (
              <img src={covers[l.id]!} alt={`Capa ${l.label}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                <ImageIcon className="w-5 h-5 mr-2" /> Sem capa em {l.label}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={inputs[l.id]}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) up(l.id, f); if (inputs[l.id].current) inputs[l.id].current!.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busyUp === l.id} onClick={() => inputs[l.id].current?.click()}>
              {busyUp === l.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              {covers[l.id] ? "Trocar imagem" : "Enviar imagem"}
            </Button>
            {covers[l.id] && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onCoverChange(l.id, "")}>
                <X className="w-4 h-4 mr-1" /> Remover
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{HERO.note}</p>

          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs">Prompt para IA (Poe — Nano-Banana) — {l.label}</Label>
            <Textarea
              rows={3}
              value={prompts[l.id] || ""}
              onChange={(e) => onPromptChange(l.id, e.target.value)}
              placeholder={`Descreva a cena/estética desejada para a capa em ${l.label}…`}
            />
            <Button type="button" size="sm" disabled={busyAi === l.id} onClick={() => genAi(l.id)}>
              {busyAi === l.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Gerar capa por IA ({l.label})
            </Button>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}