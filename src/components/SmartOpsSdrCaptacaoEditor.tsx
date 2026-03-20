import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, ImageIcon } from "lucide-react";
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
}

interface CatalogOption {
  id: string;
  name: string;
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

  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
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
  };

  const handleSaveSectionB = async () => {
    setSaving(true);
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

        {/* Imagem HERO */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Imagem HERO</Label>
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="w-32 h-20 border rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {heroImageUrl ? (
                <img src={heroImageUrl} alt={heroImageAlt || "HERO"} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploading ? "Enviando..." : "Upload"}
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
              <Input
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder="Ou cole a URL da imagem"
                className="text-xs"
              />
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
        </div>

        {/* Hero ALT */}
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
                <SelectItem value="">— Nenhum —</SelectItem>
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
                <SelectItem value="">— Nenhuma —</SelectItem>
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
