import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Wand2, Check, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface FormRow {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  badge_text: string | null;
  cta_text: string | null;
  hero_image_url: string | null;
  product_catalog_id: string | null;
}

interface CatalogRow {
  id: string;
  name: string;
  image_url: string | null;
  og_image_url: string | null;
  product_category: string | null;
}

const DEFAULT_BULLETS = ["Mais margem", "Menos custo", "Planejamento incluso", "Responsabilidade técnica total"];

export function FormHeroImageStudio({
  formId: fixedFormId,
  onApplied,
}: { formId?: string; onApplied?: (url: string) => void } = {}) {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [formId, setFormId] = useState<string>(fixedFormId ?? "");

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [productName, setProductName] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [badge, setBadge] = useState("");
  const [cta, setCta] = useState("FALE COM NOSSO CONSULTOR");
  const [bullets, setBullets] = useState<string[]>(DEFAULT_BULLETS);
  const [aspect, setAspect] = useState<"horizontal" | "square" | "vertical">("horizontal");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [styleNotes, setStyleNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [ragLoading, setRagLoading] = useState(false);
  const [uploads, setUploads] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      let q = (supabase as any)
        .from("smartops_forms")
        .select("id, name, slug, subtitle, badge_text, cta_text, hero_image_url, product_catalog_id");
      if (fixedFormId) q = q.eq("id", fixedFormId);
      const { data } = await q.order("name");
      setForms((data ?? []) as FormRow[]);
      const { data: cat } = await (supabase as any)
        .from("system_a_catalog")
        .select("id, name, image_url, og_image_url, product_category")
        .not("image_url", "is", null)
        .order("name")
        .limit(600);
      setCatalog((cat ?? []) as CatalogRow[]);
    })();
  }, [fixedFormId]);

  useEffect(() => {
    if (fixedFormId) setFormId(fixedFormId);
  }, [fixedFormId]);


  const selectedForm = useMemo(() => forms.find((f) => f.id === formId), [forms, formId]);

  useEffect(() => {
    if (!selectedForm) return;
    setHeadline(selectedForm.name);
    setSubheadline(selectedForm.subtitle || "");
    setBadge(selectedForm.badge_text || "");
    setCta(selectedForm.cta_text || "FALE COM NOSSO CONSULTOR");
    setResult(null);
    if (selectedForm.product_catalog_id) {
      const p = catalog.find((c) => c.id === selectedForm.product_catalog_id);
      if (p) {
        setProductName(p.name);
        const img = p.image_url || p.og_image_url;
        if (img) setSelectedImages([img]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, catalog.length]);

  const toggleImage = (url: string) => {
    setSelectedImages((s) => (s.includes(url) ? s.filter((u) => u !== url) : s.length >= 5 ? s : [...s, url]));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 5 - selectedImages.length;
    if (room <= 0) {
      toast.error("Máximo de 5 imagens de referência");
      return;
    }
    const list = Array.from(files).slice(0, room);
    const dataUrls = await Promise.all(
      list.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error(`Falha ao ler ${f.name}`));
            r.readAsDataURL(f);
          }),
      ),
    ).catch((e) => {
      toast.error(e.message);
      return [] as string[];
    });
    if (dataUrls.length) {
      setSelectedImages((s) => [...s, ...dataUrls].slice(0, 5));
      setUploads((s) => [...s, ...dataUrls].slice(0, 5));
      toast.success(`${dataUrls.length} imagem(ns) adicionada(s)`);
    }
  };

  const fillFromRag = async () => {
    if (!formId && !productName.trim()) {
      toast.error("Selecione o formulário (ou informe o produto)");
      return;
    }
    setRagLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("form-hero-brief", {
        body: { form_id: formId || undefined, product_name: productName || undefined },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) throw new Error(typeof payload.error === "string" ? payload.error : JSON.stringify(payload.error));
      const b = payload.brief;
      if (b.headline) setHeadline(b.headline);
      if (b.subheadline) setSubheadline(b.subheadline);
      if (b.badge_text) setBadge(b.badge_text);
      if (b.cta_text) setCta(b.cta_text);
      if (Array.isArray(b.bullets) && b.bullets.length) setBullets(b.bullets);
      if (b.style_notes) setStyleNotes(b.style_notes);
      if (payload.product_name) setProductName(payload.product_name);
      const imgs: string[] = Array.isArray(payload.images) ? payload.images : [];
      if (imgs.length) setSelectedImages((s) => Array.from(new Set([...imgs, ...s])).slice(0, 5));
      toast.success("Briefing preenchido pela RAG do produto");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao buscar dados na RAG");
    } finally {
      setRagLoading(false);
    }
  };

  const generate = async (apply = false) => {
    if (!headline.trim()) {
      toast.error("Informe o headline");
      return;
    }
    setLoading(true);
    setApplying(apply);
    try {
      const { data, error } = await supabase.functions.invoke("form-hero-image", {
        body: {
          form_id: formId || undefined,
          headline,
          subheadline,
          badge_text: badge,
          cta_text: cta,
          product_name: productName,
          bullets: bullets.map((b) => b.trim()).filter(Boolean),
          reference_images: selectedImages,
          include_logo: includeLogo,
          aspect,
          style_notes: styleNotes,
          apply_to_form: apply,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      setResult((data as any).url);
      toast.success(apply ? "Hero gerado e aplicado ao formulário" : "Hero gerado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar imagem");
    } finally {
      setLoading(false);
      setApplying(false);
    }
  };

  const applyExisting = async () => {
    if (!result || !formId) return;
    setApplying(true);
    const { error } = await (supabase as any)
      .from("smartops_forms")
      .update({ hero_image_url: result, hero_image_alt: headline.slice(0, 160) })
      .eq("id", formId);
    setApplying(false);
    if (error) toast.error(error.message);
    else toast.success("Imagem aplicada como hero do formulário");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Hero por IA — briefing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Formulário</Label>
            <Select value={formId} onValueChange={setFormId}>
              <SelectTrigger><SelectValue placeholder="Selecione o formulário..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={() => void fillFromRag()} disabled={ragLoading} className="w-full">
            {ragLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Preencher por IA (busca na RAG do produto)
          </Button>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Badge</Label>
              <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Condição inédita | por tempo limitado" />
            </div>
            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Input value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Textarea
              rows={2}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="O único combo que subsidia equipamento E consumível."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Texto de apoio (ao lado do CTA)</Label>
            <Input
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              placeholder="E descubra como aumentar o faturamento da sua clínica."
            />
          </div>

          <div className="space-y-2">
            <Label>Bullets de vantagens (máx. 6)</Label>
            {bullets.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={b}
                  onChange={(e) => setBullets((s) => s.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`Vantagem ${i + 1}`}
                />
                <Button variant="outline" size="icon" onClick={() => setBullets((s) => s.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            {bullets.length < 6 && (
              <Button variant="outline" size="sm" onClick={() => setBullets((s) => [...s, ""])}>
                + Adicionar vantagem
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select value={aspect} onValueChange={(v) => setAspect(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal (banner hero)</SelectItem>
                  <SelectItem value="square">Quadrado 1:1</SelectItem>
                  <SelectItem value="vertical">Vertical 4:5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch checked={includeLogo} onCheckedChange={setIncludeLogo} id="logo" />
              <Label htmlFor="logo" className="cursor-pointer">Incluir logo Smart Dent</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações de estilo (opcional)</Label>
            <Textarea rows={2} value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)} placeholder="Ex: fundo escuro, destaque na impressora, cena de consultório" />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => void generate(false)} disabled={loading}>
              {loading && !applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Gerar imagem
            </Button>
            <Button variant="secondary" onClick={() => void generate(true)} disabled={loading || !formId}>
              {loading && applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Gerar e aplicar no formulário
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="w-4 h-4 text-primary" />
              Fotos reais do produto (referência)
              <Badge variant="secondary">{selectedImages.length}/5</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Buscar produto no catálogo..."
              onChange={(e) => setProductName(e.target.value)}
              value={productName}
            />
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {catalog
                .filter((c) => !productName || c.name.toLowerCase().includes(productName.toLowerCase()))
                .slice(0, 60)
                .map((c) => {
                  const img = c.image_url || c.og_image_url!;
                  const on = selectedImages.includes(img);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleImage(img)}
                      title={c.name}
                      className={`relative aspect-square rounded-md border bg-muted overflow-hidden ${on ? "ring-2 ring-primary" : ""}`}
                    >
                      <img src={img} alt={c.name} loading="lazy" className="w-full h-full object-contain" />
                      {on && (
                        <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="space-y-2 pt-1 border-t">
              <Label className="text-xs text-muted-foreground">Ou envie suas próprias imagens</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => void handleUpload(e.target.files)} />
              {uploads.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {uploads.map((u, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setUploads((s) => s.filter((_, j) => j !== i));
                        setSelectedImages((s) => s.filter((v) => v !== u));
                      }}
                      title="Remover"
                      className="relative aspect-square rounded-md border bg-muted overflow-hidden ring-2 ring-primary"
                    >
                      <img src={u} alt={`Upload ${i + 1}`} className="w-full h-full object-contain" />
                      <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full px-1 text-xs">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result ? (
              <>
                <img src={result} alt={headline} className="w-full rounded-md border" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={result} target="_blank" rel="noreferrer">
                      <Download className="w-4 h-4 mr-2" /> Abrir / baixar
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => void applyExisting()} disabled={!formId || applying}>
                    {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Usar como hero do formulário
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione o formulário, as fotos do produto e os bullets de vantagens — a IA monta o banner
                com o logo Smart Dent, badge, headline, ícones dos benefícios e botão de CTA.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
