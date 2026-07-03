import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, FileText, ExternalLink, Rocket, Wand2, Save } from "lucide-react";
import { LandingPageVisualEditor, triggerLandingPageEditorSave } from "./LandingPageVisualEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: { id: string; name: string; slug: string; form_purpose: string } | null;
}

type LP = {
  id: string;
  form_id: string;
  mode: "ai" | "briefing";
  input_prompt: string | null;
  generated_html: string | null;
  status: "draft" | "published";
  published_at: string | null;
  editor_state?: Record<string, unknown> | null;
};

export function LandingPageBuilderModal({ open, onOpenChange, form }: Props) {
  const [tab, setTab] = useState<"ai" | "briefing" | "visual">("ai");
  const [aiIdea, setAiIdea] = useState("");
  const [briefing, setBriefing] = useState("");
  const [lp, setLp] = useState<LP | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !form) return;
    setLp(null);
    setAiIdea("");
    setBriefing("");
    setLoading(true);
    supabase
      .from("smartops_form_landing_pages" as any)
      .select("*")
      .eq("form_id", form.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as unknown as LP;
          setLp(row);
          setTab(row.mode as "ai" | "briefing");
          if (row.mode === "ai") setAiIdea(row.input_prompt || "");
          else setBriefing(row.input_prompt || "");
        }
        setLoading(false);
      });
  }, [open, form]);

  if (!form) return null;

  const publicUrl = `${window.location.origin}/lp/${form.slug}`;

  async function handleGenerate() {
    if (!form) return;
    if (tab === "visual") return;
    const input = tab === "ai" ? aiIdea.trim() : briefing.trim();
    if (!input) {
      toast.error(tab === "ai" ? "Descreva a ideia da landing page" : "Cole o briefing");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("landing-page-generator", {
        body: { form_id: form.id, mode: tab, input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const html = (data as any).html as string;

      const payload = {
        form_id: form.id,
        mode: tab,
        input_prompt: input,
        generated_html: html,
        status: lp?.status ?? "draft",
      };
      const { data: saved, error: upErr } = await supabase
        .from("smartops_form_landing_pages" as any)
        .upsert(payload, { onConflict: "form_id" })
        .select()
        .single();
      if (upErr) throw upErr;
      setLp(saved as unknown as LP);
      toast.success("Landing page gerada");
    } catch (e: any) {
      const msg = e?.message || "Falha ao gerar";
      if (msg.includes("rate_limited")) toast.error("Muitas requisições — aguarde alguns segundos");
      else if (msg.includes("credits_exhausted")) toast.error("Créditos de IA esgotados — recarregue em Settings");
      else toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleVisualSave(html: string, css: string, state: Record<string, unknown>) {
    if (!lp) return;
    // combina CSS custom no início do HTML (Tailwind já cobre a maior parte)
    const combined = css ? `<style>${css}</style>${html}` : html;
    const { data, error } = await supabase
      .from("smartops_form_landing_pages" as any)
      .update({ generated_html: combined, editor_state: state })
      .eq("id", lp.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setLp(data as unknown as LP);
    toast.success("Edição visual salva");
  }

  async function togglePublish() {
    if (!lp) return;
    setSaving(true);
    const nextStatus = lp.status === "published" ? "draft" : "published";
    const { data, error } = await supabase
      .from("smartops_form_landing_pages" as any)
      .update({
        status: nextStatus,
        published_at: nextStatus === "published" ? new Date().toISOString() : null,
      })
      .eq("id", lp.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLp(data as unknown as LP);
    toast.success(nextStatus === "published" ? "Landing page publicada" : "Landing page voltou para rascunho");
  }

  const previewSrcDoc = lp?.generated_html
    ? `<!doctype html><html><head><meta charset="utf-8"/><script src="https://cdn.tailwindcss.com"></script><style>body{font-family:Inter,system-ui,sans-serif;margin:0}[data-form-cta]{cursor:pointer}</style></head><body>${lp.generated_html}</body></html>`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Landing Page — {form.name}
            {lp?.status === "published" ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Publicada</Badge>
            ) : (
              <Badge variant="outline">Rascunho</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">URL final:</span>
            <code className="px-1.5 py-0.5 bg-muted rounded">/lp/{form.slug}</code>
            {lp?.status === "published" && (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-fit">
            <TabsTrigger value="ai" className="gap-1"><Sparkles className="w-3.5 h-3.5" /> Gerar por IA</TabsTrigger>
            <TabsTrigger value="briefing" className="gap-1"><FileText className="w-3.5 h-3.5" /> Briefing</TabsTrigger>
            <TabsTrigger value="visual" className="gap-1" disabled={!lp?.generated_html}>
              <Wand2 className="w-3.5 h-3.5" /> Editor Visual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="flex-1 overflow-hidden mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
          <div className="flex flex-col overflow-hidden">
                <div>
                  <Label className="text-xs">Ideia central</Label>
                  <Textarea
                    value={aiIdea}
                    onChange={(e) => setAiIdea(e.target.value)}
                    rows={14}
                    placeholder="Ex.: Landing page do curso Ativação exocad DentalCad I.A. para dentistas e protéticos, foco em fluxo digital, tom premium..."
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  IA premium (Gemini 3.1 Pro). Aplica paleta Smart Dent (#1D173E/#2C245B/#F47C42), Inter+Manrope,
                  selo "ATIVAÇÃO INICIAL", CTA fixo no mobile, FAQ acordeão e acessibilidade AA.
                </p>
            <div className="flex gap-2 pt-3 mt-auto border-t">
              <Button onClick={handleGenerate} disabled={generating || loading} className="gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {lp?.generated_html ? "Regenerar" : "Gerar landing"}
              </Button>
              {lp?.generated_html && (
                <Button
                  variant={lp.status === "published" ? "outline" : "default"}
                  onClick={togglePublish}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {lp.status === "published" ? "Despublicar" : "Publicar"}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden border rounded-lg bg-muted/30">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-background">
              Prévia
            </div>
            {previewSrcDoc ? (
              <iframe
                title="Preview da landing page"
                srcDoc={previewSrcDoc}
                className="flex-1 w-full bg-white"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
                {loading ? "Carregando…" : "Nenhuma landing page gerada ainda. Descreva a ideia ou cole o briefing e clique em Gerar."}
              </div>
            )}
          </div>
            </div>
          </TabsContent>

          <TabsContent value="briefing" className="flex-1 overflow-hidden mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
              <div className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto">
                  <Label className="text-xs">Cole o briefing completo</Label>
                  <Textarea
                    value={briefing}
                    onChange={(e) => setBriefing(e.target.value)}
                    rows={20}
                    placeholder="Cole o texto do LOVABLE.docx ou similar. A IA será fiel ao conteúdo (preços, ofertas, módulos, tom)."
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground pt-2">
                    Modo fiel: a IA usa apenas o conteúdo colado. Sem invenção de preço ou promessa.
                    Mantém o padrão estético Smart Dent com selo "ATIVAÇÃO INICIAL" e CTA fixo no mobile.
                  </p>
                </div>
                <div className="flex gap-2 pt-3 border-t">
                  <Button onClick={handleGenerate} disabled={generating || loading} className="gap-2">
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {lp?.generated_html ? "Regenerar" : "Gerar landing"}
                  </Button>
                  {lp?.generated_html && (
                    <Button
                      variant={lp.status === "published" ? "outline" : "default"}
                      onClick={togglePublish}
                      disabled={saving}
                      className="gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                      {lp.status === "published" ? "Despublicar" : "Publicar"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-col overflow-hidden border rounded-lg bg-muted/30">
                <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-background">
                  Prévia
                </div>
                {previewSrcDoc ? (
                  <iframe
                    title="Preview da landing page"
                    srcDoc={previewSrcDoc}
                    className="flex-1 w-full bg-white"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
                    {loading ? "Carregando…" : "Nenhuma landing page gerada ainda."}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visual" className="flex-1 overflow-hidden mt-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b">
              <p className="text-[11px] text-muted-foreground">
                Arraste blocos, edite textos e cores. Paleta oficial: #2C245B · #1D173E · #F47C42 · #F4F5F8 · #202331.
                Preserve botões com <code>data-form-cta</code>.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={triggerLandingPageEditorSave} className="gap-2">
                  <Save className="w-4 h-4" /> Salvar edição
                </Button>
                {lp && (
                  <Button
                    size="sm"
                    variant={lp.status === "published" ? "outline" : "default"}
                    onClick={togglePublish}
                    disabled={saving}
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {lp.status === "published" ? "Despublicar" : "Publicar"}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden mt-2">
              {lp?.generated_html ? (
                <LandingPageVisualEditor
                  key={lp.id}
                  html={lp.generated_html}
                  editorState={(lp.editor_state as Record<string, unknown>) ?? null}
                  onSave={handleVisualSave}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Gere a landing page primeiro na aba "Gerar por IA" ou "Briefing".
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}