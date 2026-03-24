import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Video } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartOpsFormEditor } from "./SmartOpsFormEditor";
import { SmartOpsMappingFieldsEditor } from "./SmartOpsMappingFieldsEditor";
import { WORKFLOW_CELLS } from "./SmartOpsMappingFieldsEditor";

interface SdrForm {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  success_message: string | null;
  success_redirect_url: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  campaign_identifier: string | null;
  product_catalog_id: string | null;
  workflow_stage_target: string | null;
  media_type: string | null;
  video_id: string | null;
  video_thumbnail_url: string | null;
  video_embed_url: string | null;
  brand_color_h: number | null;
  brand_color_s: number | null;
  brand_color_l: number | null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

async function extractDominantHue(
  imageUrl: string
): Promise<{ h: number; s: number; l: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 80; canvas.height = 45;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 80, 45);
        const data = ctx.getImageData(0, 0, 80, 45).data;

        // Count vibrant hue buckets
        const buckets: Record<number, number> = {};
        for (let i = 0; i < data.length; i += 16) {
          if (data[i + 3] < 100) continue;
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          // Only vibrant colors
          if (s < 28 || l < 18 || l > 80) continue;
          const bucket = Math.round(h / 15) * 15;
          buckets[bucket] = (buckets[bucket] || 0) + 1;
        }

        // Find dominant hue
        let bestHue = 215;
        let bestCount = 0;
        for (const [hue, count] of Object.entries(buckets)) {
          if (count > bestCount) { bestCount = count; bestHue = +hue; }
        }

        // Tune saturation/lightness by hue range
        let s = 72, l = 54;
        if (bestHue >= 15 && bestHue <= 50)   { s = 88; l = 52; } // orange/gold
        else if (bestHue >= 250 && bestHue <= 295) { s = 68; l = 52; } // purple
        else if (bestHue >= 190 && bestHue <= 250) { s = 75; l = 50; } // blue/cyan
        else if (bestHue >= 95  && bestHue <= 165) { s = 65; l = 42; } // green

        resolve({ h: bestHue, s, l });
      } catch {
        resolve({ h: 215, s: 78, l: 54 }); // fallback SmartDent blue
      }
    };
    img.onerror = () => resolve({ h: 215, s: 78, l: 54 });
    img.src = imageUrl;
  });
}

interface CatalogOption {
  id: string;
  name: string;
}

interface VideoOption {
  id: string;
  title: string;
  thumbnail_url: string | null;
  embed_url: string | null;
}

export function SmartOpsSdrCaptacaoEditor({ form }: { form: SdrForm }) {
  // Seção B state
  const [name, setName] = useState(form.name ?? "");
  const [slug, setSlug] = useState(form.slug ?? "");
  const [title, setTitle] = useState(form.title ?? "");
  const [subtitle, setSubtitle] = useState(form.subtitle ?? "");
  const [description, setDescription] = useState(form.description ?? "");
  const [successMessage, setSuccessMessage] = useState(form.success_message ?? "");
  const [successRedirectUrl, setSuccessRedirectUrl] = useState(form.success_redirect_url ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(form.hero_image_url ?? "");
  const [heroImageAlt, setHeroImageAlt] = useState(form.hero_image_alt ?? "");
  const [campaignIdentifier, setCampaignIdentifier] = useState(form.campaign_identifier ?? "");
  const [productCatalogId, setProductCatalogId] = useState(form.product_catalog_id ?? "__none__");
  const [workflowStageTarget, setWorkflowStageTarget] = useState(form.workflow_stage_target ?? "__none__");
  const [mediaType, setMediaType] = useState<"image" | "video">(
    form.media_type === "video" ? "video" : "image"
  );
  const [videoId, setVideoId] = useState(form.video_id ?? "");
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(form.video_thumbnail_url ?? "");
  const [videoEmbedUrl, setVideoEmbedUrl] = useState(form.video_embed_url ?? "");

  const [brandColor, setBrandColor] = useState<{ h: number; s: number; l: number } | null>(
    form.brand_color_h != null
      ? { h: form.brand_color_h, s: form.brand_color_s ?? 78, l: form.brand_color_l ?? 54 }
      : null
  );

  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [videoOptions, setVideoOptions] = useState<VideoOption[]>([]);
  const [videoSearch, setVideoSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("system_a_catalog" as any)
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCatalogOptions(data as unknown as CatalogOption[]);
      });
    supabase
      .from("knowledge_videos" as any)
      .select("id, title, thumbnail_url, embed_url")
      .order("title")
      .then(({ data }) => {
        if (data) setVideoOptions(data as unknown as VideoOption[]);
      });
  }, []);

  const handleHeroUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `form-hero/${form.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("catalog-images")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error(`Erro no upload: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("catalog-images").getPublicUrl(path);
    setHeroImageUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem HERO enviada!");
    // Extract dominant color from uploaded image
    extractDominantHue(urlData.publicUrl).then((color) => setBrandColor(color));
  };

  const handleVideoSelect = (vid: VideoOption) => {
    setVideoId(vid.id);
    setVideoThumbnailUrl(vid.thumbnail_url ?? "");
    setVideoEmbedUrl(vid.embed_url ?? "");
    // Extract dominant color from video thumbnail
    if (vid.thumbnail_url) {
      extractDominantHue(vid.thumbnail_url).then((color) => setBrandColor(color));
    }
  };

  const handleSaveSectionB = async () => {
    setSaving(true);

    // Extract dominant color from media if not yet extracted
    const imageToAnalyze = mediaType === "video" ? videoThumbnailUrl : heroImageUrl;
    let colorResult = brandColor ?? { h: 215, s: 78, l: 54 };
    if (imageToAnalyze && !brandColor) {
      colorResult = await extractDominantHue(imageToAnalyze);
      setBrandColor(colorResult);
    }

    const { error } = await supabase
      .from("smartops_forms" as any)
      .update({
        name: name.trim() || form.name,
        slug: slug.trim() || form.slug,
        title: title || null,
        subtitle: subtitle || null,
        description: description || null,
        success_message: successMessage || null,
        success_redirect_url: successRedirectUrl || null,
        hero_image_url: heroImageUrl || null,
        hero_image_alt: heroImageAlt || null,
        campaign_identifier: campaignIdentifier || null,
        product_catalog_id: productCatalogId === "__none__" ? null : (productCatalogId || null),
        workflow_stage_target: workflowStageTarget === "__none__" ? null : (workflowStageTarget || null),
        media_type: mediaType,
        video_id: mediaType === "video" ? (videoId || null) : null,
        video_thumbnail_url: mediaType === "video" ? (videoThumbnailUrl || null) : null,
        video_embed_url: mediaType === "video" ? (videoEmbedUrl || null) : null,
        brand_color_h: colorResult.h,
        brand_color_s: colorResult.s,
        brand_color_l: colorResult.l,
      } as any)
      .eq("id", form.id);
    setSaving(false);
    if (error) toast.error(`Erro ao salvar: ${error.message}`);
    else toast.success("Configurações salvas!");
  };

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────── SEÇÃO B ─────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">B</span>
          <h4 className="font-semibold text-base">Configurações e Vínculo Workflow</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome interno */}
          <div>
            <Label className="text-xs font-medium">Nome interno (admin)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Slug */}
          <div>
            <Label className="text-xs font-medium">Slug (URL)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="ex: feira-cbo-2026-scanner"
            />
            <p className="text-xs text-muted-foreground mt-1">/f/{slug || "..."}</p>
          </div>

          {/* Título público */}
          <div>
            <Label className="text-xs font-medium">Título público (web)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Cadastre-se para atendimento" />
          </div>

          {/* Subtítulo */}
          <div>
            <Label className="text-xs font-medium">Subtítulo (web)</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex: Preencha seus dados" />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <Label className="text-xs font-medium">Descrição / Meta Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Texto descritivo para SEO e exibição pública"
            rows={3}
          />
        </div>

        {/* Mídia HERO — toggle Imagem / Vídeo */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Mídia HERO</Label>

          {/* Toggle */}
          <div className="inline-flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setMediaType("image")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                mediaType === "image"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <ImageIcon className="w-3 h-3" /> Imagem
            </button>
            <button
              type="button"
              onClick={() => setMediaType("video")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                mediaType === "video"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Video className="w-3 h-3" /> Vídeo
            </button>
          </div>

          {/* Painel Imagem */}
          {mediaType === "image" && (
            <div className="flex items-start gap-4">
              <div className="w-32 h-20 border rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt={heroImageAlt || "HERO"} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {uploading ? "Enviando..." : heroImageUrl ? "Trocar" : "Upload"}
                  </Button>
                  {heroImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setHeroImageUrl("")}
                    >
                      <X className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  )}
                </div>
                {!heroImageUrl && (
                  <Input
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    placeholder="Ou cole a URL da imagem"
                    className="text-xs"
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleHeroUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}

          {/* Painel Vídeo */}
          {mediaType === "video" && (
            <div className="space-y-2">
              {/* Preview do vídeo selecionado */}
              {videoId && (
                <div className="space-y-2 p-2 border rounded-md bg-muted/40">
                  <div className="flex items-center gap-3">
                    {videoThumbnailUrl && (
                      <img
                        src={videoThumbnailUrl}
                        alt="Thumbnail do vídeo"
                        className="w-24 h-14 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {videoOptions.find((v) => v.id === videoId)?.title ?? "Vídeo selecionado"}
                      </p>
                      {videoEmbedUrl && (
                        <p className="text-xs text-green-600 mt-0.5">✓ Player embed configurado</p>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 text-xs px-2"
                        onClick={() => { setVideoId(""); setVideoThumbnailUrl(""); setVideoEmbedUrl(""); }}
                      >
                        <X className="w-3 h-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                  {videoEmbedUrl && (
                    <iframe
                      src={videoEmbedUrl}
                      className="w-full rounded"
                      style={{ height: 160 }}
                      allowFullScreen
                      allow="autoplay"
                    />
                  )}
                </div>
              )}

              {/* Busca + Grid de seleção de vídeos */}
              <p className="text-xs font-medium text-muted-foreground">Selecione um vídeo da biblioteca:</p>
              <Input
                placeholder="Buscar vídeo por título..."
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto border rounded-md p-2">
                {videoOptions
                  .filter((v) => v.title.toLowerCase().includes(videoSearch.toLowerCase()))
                  .map((vid) => (
                    <button
                      key={vid.id}
                      type="button"
                      onClick={() => handleVideoSelect(vid)}
                      className={`rounded-md overflow-hidden border-2 text-left transition-colors ${
                        videoId === vid.id
                          ? "border-primary"
                          : "border-transparent hover:border-muted-foreground/40"
                      }`}
                    >
                      {vid.thumbnail_url ? (
                        <img
                          src={vid.thumbnail_url}
                          alt={vid.title}
                          className="w-full h-24 object-cover"
                        />
                      ) : (
                        <div className="w-full h-24 bg-muted flex items-center justify-center">
                          <Video className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs px-1 py-1 leading-tight line-clamp-2">{vid.title}</p>
                    </button>
                  ))}
                {videoOptions.filter((v) => v.title.toLowerCase().includes(videoSearch.toLowerCase())).length === 0 && (
                  <p className="col-span-3 text-xs text-muted-foreground text-center py-4">
                    {videoSearch ? `Nenhum resultado para "${videoSearch}"` : "Nenhum vídeo encontrado."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Adaptive color preview */}
        {brandColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4,
              background: `hsl(${brandColor.h}, ${brandColor.s}%, ${brandColor.l}%)`,
              border: '1px solid rgba(0,0,0,0.15)',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
              Cor adaptativa extraída · hsl({brandColor.h}, {brandColor.s}%, {brandColor.l}%)
            </span>
          </div>
        )}

        {/* Hero ALT (acessibilidade / SEO) */}
        <div>
          <Label className="text-xs font-medium">Nome ALT da imagem (acessibilidade / SEO)</Label>
          <Input
            value={heroImageAlt}
            onChange={(e) => setHeroImageAlt(e.target.value)}
            placeholder="Ex: Scanner intraoral SmartDent 3D"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Identificador de campanha */}
          <div>
            <Label className="text-xs font-medium">Identificador de campanha</Label>
            <Input
              value={campaignIdentifier}
              onChange={(e) => setCampaignIdentifier(e.target.value)}
              placeholder="ex: feira-cbo-2026"
            />
          </div>

          {/* Produto de interesse (admin) */}
          <div>
            <Label className="text-xs font-medium">Produto de interesse (admin)</Label>
            <Select value={productCatalogId} onValueChange={setProductCatalogId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {catalogOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa SDR/Interesse no Workflow 7×3 */}
          <div className="md:col-span-2">
            <Label className="text-xs font-medium">Etapa SDR / Interesse no Workflow 7×3</Label>
            <Select value={workflowStageTarget} onValueChange={setWorkflowStageTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a célula do workflow..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {WORKFLOW_CELLS.map((cell) => (
                  <SelectItem key={cell.value} value={cell.value}>{cell.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mensagem de sucesso */}
          <div>
            <Label className="text-xs font-medium">Mensagem de sucesso</Label>
            <Input
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder="Obrigado! Recebemos suas informações."
            />
          </div>

          {/* URL de redirecionamento */}
          <div>
            <Label className="text-xs font-medium">URL de redirecionamento após envio</Label>
            <Input
              value={successRedirectUrl}
              onChange={(e) => setSuccessRedirectUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <Button onClick={handleSaveSectionB} disabled={saving} className="w-full md:w-auto">
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </section>

      {/* ─────────────────────────────────── SEÇÃO C ─────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">C</span>
          <h4 className="font-semibold text-base">Campos de Qualificação</h4>
          <p className="text-xs text-muted-foreground ml-1">
            Campos exibidos no formulário público e gravados na ficha do lead.
          </p>
        </div>
        <SmartOpsFormEditor formId={form.id} filterMappingFields={true} />
      </section>

      {/* ─────────────────────────────────── SEÇÃO D ─────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">D</span>
          <h4 className="font-semibold text-base">Identificação "MAPEAMENTO" de Workflow 7×3</h4>
          <p className="text-xs text-muted-foreground ml-1">
            Campos que identificam o que o lead já possui. Cada campo é vinculado a uma célula do Workflow.
          </p>
        </div>
        <SmartOpsMappingFieldsEditor formId={form.id} />
      </section>
    </div>
  );
}
