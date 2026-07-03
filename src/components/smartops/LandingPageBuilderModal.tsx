import { useEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, Sparkles, FileText, ExternalLink, Rocket, Pencil } from "lucide-react";
import {
  PremiumLandingTemplate,
  DEFAULT_LP_CONTENT,
  LP_THEMES,
  type LPThemeKey,
  type LPContent,
} from "@/components/lp/PremiumLandingTemplate";
import CoverImageUpload from "@/components/smartops/CoverImageUpload";

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
  content: LPContent | null;
  generated_html: string | null;
  hero_image_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
};

type ConditionCards = NonNullable<LPContent["conditions"]>["cards"];

function ensureContent(raw: unknown): LPContent {
  if (raw && typeof raw === "object" && "hero" in raw) {
    const parsed = raw as LPContent;
    const filteredCards = (parsed.conditions?.cards ?? []).filter(
      (card) => !/pr[ée]-?venda/i.test(`${card?.ribbon ?? ""} ${card?.title ?? ""}`),
    );
    return {
      ...parsed,
      price: undefined,
      conditions: parsed.conditions
        ? {
            ...parsed.conditions,
            title: parsed.conditions.title || "Escolha a melhor condição para ativar seu exocad",
            cards: filteredCards.length > 0 ? filteredCards : DEFAULT_LP_CONTENT.conditions!.cards,
          }
        : DEFAULT_LP_CONTENT.conditions,
      modules: parsed.modules ?? DEFAULT_LP_CONTENT.modules,
      regionalRules: parsed.regionalRules ?? DEFAULT_LP_CONTENT.regionalRules,
      implementation: parsed.implementation ?? DEFAULT_LP_CONTENT.implementation,
    };
  }
  return DEFAULT_LP_CONTENT;
}

export function LandingPageBuilderModal({ open, onOpenChange, form }: Props) {
  const [tab, setTab] = useState<"ai" | "briefing" | "edit">("ai");
  const [aiIdea, setAiIdea] = useState("");
  const [briefing, setBriefing] = useState("");
  const [lp, setLp] = useState<LP | null>(null);
  const [content, setContent] = useState<LPContent | null>(null);
  const [heroImage, setHeroImage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !form) return;
    setLp(null);
    setContent(null);
    setHeroImage("");
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
          const rowContent = ensureContent(row.content);
          setLp(row);
          setContent(row.content && (row.content as any).hero ? rowContent : null);
          setHeroImage(row.hero_image_url || "");
          setTab(row.mode === "briefing" ? "briefing" : "ai");
          if (row.mode === "briefing") setBriefing(row.input_prompt || "");
          else setAiIdea(row.input_prompt || "");
        }
        setLoading(false);
      });
  }, [open, form]);

  if (!form) return null;
  const publicUrl = `${window.location.origin}/lp/${form.slug}`;

  async function persist(patch: Partial<LP> & { content?: LPContent }) {
    if (!form) return null;
    const payload: Record<string, unknown> = {
      form_id: form.id,
      ...patch,
    };
    const { data, error } = await supabase
      .from("smartops_form_landing_pages" as any)
      .upsert(payload, { onConflict: "form_id" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as unknown as LP;
  }

  async function handleGenerate() {
    if (tab === "edit") return;
    const input = tab === "ai" ? aiIdea.trim() : briefing.trim();
    if (!input) {
      toast.error(tab === "ai" ? "Descreva a ideia da landing page" : "Cole o briefing");
      return;
    }
    await runGenerate(tab, input);
  }

  async function handleRegenerate() {
    if (!lp) return;
    const mode = (lp.mode ?? "ai") as "ai" | "briefing";
    const input = (lp.input_prompt ?? (mode === "ai" ? aiIdea : briefing)).trim();
    if (!input) {
      toast.error("Preencha a ideia ou o briefing primeiro");
      setTab(mode === "briefing" ? "briefing" : "ai");
      return;
    }
    await runGenerate(mode, input);
  }

  async function runGenerate(mode: "ai" | "briefing", input: string) {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("landing-page-generator", {
        body: { form_id: form!.id, mode, input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const nextContent = ensureContent((data as any).content);

      const saved = await persist({
        mode,
        input_prompt: input,
        content: nextContent,
        status: lp?.status ?? "draft",
      } as any);
      if (saved) {
        setLp(saved);
        setContent(nextContent);
        setTab("edit");
        toast.success("Landing page gerada");
      }
    } catch (e: any) {
      const msg = e?.message || "Falha ao gerar";
      if (msg.includes("rate_limited")) toast.error("Muitas requisições — aguarde alguns segundos");
      else if (msg.includes("credits_exhausted"))
        toast.error("Créditos de IA esgotados — recarregue em Settings");
      else toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveEdits() {
    if (!content) return;
    setSaving(true);
    const saved = await persist({ content, hero_image_url: heroImage || null } as any);
    setSaving(false);
    if (saved) {
      setLp(saved);
      toast.success("Alterações salvas");
    }
  }

  async function togglePublish() {
    if (!lp) return;
    // save latest edits alongside publish toggle
    setSaving(true);
    const nextStatus = lp.status === "published" ? "draft" : "published";
    const saved = await persist({
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : null,
      ...(content ? { content } : {}),
      hero_image_url: heroImage || null,
    } as any);
    setSaving(false);
    if (saved) {
      setLp(saved);
      toast.success(nextStatus === "published" ? "Landing page publicada" : "Voltou para rascunho");
    }
  }

  const previewContent = content ?? DEFAULT_LP_CONTENT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            Landing Page — {form.name}
            {lp?.status === "published" ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Publicada</Badge>
            ) : (
              <Badge variant="outline">Rascunho</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">URL:</span>
            <code className="px-1.5 py-0.5 bg-muted rounded">/lp/{form.slug}</code>
            {lp?.status === "published" && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
        >
          <div className="px-6 pt-3 flex items-center justify-between gap-3 border-b pb-3">
            <TabsList>
              <TabsTrigger value="ai" className="gap-1"><Sparkles className="w-3.5 h-3.5" /> Gerar por IA</TabsTrigger>
              <TabsTrigger value="briefing" className="gap-1"><FileText className="w-3.5 h-3.5" /> Briefing</TabsTrigger>
              <TabsTrigger value="edit" className="gap-1" disabled={!content}>
                <Pencil className="w-3.5 h-3.5" /> Editar & publicar
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              {(content || lp?.input_prompt) && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleRegenerate}
                  disabled={generating || saving}
                  className="gap-2 bg-gradient-to-r from-[#605882] to-[#DF7344] text-white hover:opacity-90"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Regenerar com IA
                </Button>
              )}
              {content && (
                <>
                  <Button size="sm" variant="outline" onClick={handleSaveEdits} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
                <Button
                  size="sm"
                  variant={lp?.status === "published" ? "outline" : "default"}
                  onClick={togglePublish}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {lp?.status === "published" ? "Despublicar" : "Publicar"}
                </Button>
                </>
              )}
            </div>
          </div>

          <TabsContent value="ai" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <GenerateLayout
              inputLabel="Ideia central"
              placeholder="Ex.: Landing page do curso Ativação exocad DentalCad I.A. para dentistas e protéticos, foco em fluxo digital, tom premium…"
              value={aiIdea}
              onChange={setAiIdea}
              onGenerate={handleGenerate}
              generating={generating}
              loading={loading}
              hasContent={!!content}
              preview={<LivePreview content={previewContent} heroImage={heroImage} />}
              hint="A IA escreve o conteúdo (headline, benefícios, FAQ). O design premium é fixo — sem invenção de preços."
            />
          </TabsContent>

          <TabsContent value="briefing" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
            <GenerateLayout
              inputLabel="Cole o briefing completo"
              placeholder="Cole o texto do LOVABLE.docx ou similar. A IA será fiel ao conteúdo (preços, ofertas, módulos, tom)."
              value={briefing}
              onChange={setBriefing}
              onGenerate={handleGenerate}
              generating={generating}
              loading={loading}
              hasContent={!!content}
              mono
              preview={<LivePreview content={previewContent} heroImage={heroImage} />}
              hint="Modo fiel: a IA usa APENAS o conteúdo colado. Sem invenção de preço ou promessa."
            />
          </TabsContent>

          <TabsContent value="edit" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
            {content ? (
              <div className="h-full min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)] overflow-hidden">
                <EditorSidebar
                  content={content}
                  onChange={setContent}
                  heroImage={heroImage}
                  onHeroImageChange={setHeroImage}
                />
                <LivePreview content={content} heroImage={heroImage} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Gere primeiro na aba "Gerar por IA" ou "Briefing".
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function GenerateLayout(props: {
  inputLabel: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
  loading: boolean;
  hasContent: boolean;
  mono?: boolean;
  preview: JSX.Element;
  hint: string;
}) {
  return (
    <div className="h-full min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] overflow-hidden">
      <div className="h-full min-h-0 border-r p-5 flex flex-col gap-3 overflow-y-auto bg-muted/20">
        <div>
          <Label className="text-xs">{props.inputLabel}</Label>
          <Textarea
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            rows={props.mono ? 20 : 14}
            placeholder={props.placeholder}
            className={props.mono ? "font-mono text-xs" : ""}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{props.hint}</p>
        <div className="mt-auto pt-3 border-t">
          <Button onClick={props.onGenerate} disabled={props.generating || props.loading} className="gap-2 w-full">
            {props.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {props.hasContent ? "Regenerar conteúdo" : "Gerar landing"}
          </Button>
        </div>
      </div>
      {props.preview}
    </div>
  );
}

function LivePreview({ content, heroImage }: { content: LPContent; heroImage: string }) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-100 flex flex-col">
      <div className="absolute top-3 left-3 z-10 text-[10px] uppercase tracking-wider text-muted-foreground bg-white/90 backdrop-blur px-2 py-1 rounded">
        Prévia ao vivo
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
      >
        <div className="mx-auto min-h-full" style={{ maxWidth: 1200 }}>
          <PremiumLandingTemplate content={content} heroImageUrl={heroImage || null} />
        </div>
      </div>
    </div>
  );
}

const EDITOR_SECTIONS: { id: string; label: string }[] = [
  { id: "sec-aparencia", label: "Aparência" },
  { id: "sec-hero", label: "Hero" },
  { id: "sec-como-funciona", label: "Como funciona" },
  { id: "sec-posicionamento", label: "Oferta / Posicionamento" },
  { id: "sec-condicoes", label: "Condições" },
  { id: "sec-modulos", label: "Módulos" },
  { id: "sec-regional", label: "Uso da licença" },
  { id: "sec-implantacao", label: "Implantação" },
  { id: "sec-beneficios", label: "Benefícios" },
  { id: "sec-faq", label: "FAQ" },
  { id: "sec-cta-final", label: "CTA final" },
  { id: "sec-rodape", label: "Rodapé" },
];

function EditorSidebar({
  content,
  onChange,
  heroImage,
  onHeroImageChange,
}: {
  content: LPContent;
  onChange: (c: LPContent) => void;
  heroImage: string;
  onHeroImageChange: (v: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpTo = (id: string) => {
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    const top = target.offsetTop - 8;
    container.scrollTo({ top, behavior: "smooth" });
    // Ensure <details> is open
    if (target.tagName.toLowerCase() === "details" && !(target as HTMLDetailsElement).open) {
      (target as HTMLDetailsElement).open = true;
    }
  };
  return (
    <div className="h-full min-h-0 overflow-hidden border-r bg-muted/20 flex flex-col">
      <nav className="shrink-0 z-10 border-b bg-muted/40 backdrop-blur px-3 py-2 flex flex-wrap gap-1.5">
        {EDITOR_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(s.id)}
            className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-white hover:border-primary hover:text-primary transition"
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-6"
        style={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
      >
        <ContentEditor
          content={content}
          onChange={onChange}
          heroImage={heroImage}
          onHeroImageChange={onHeroImageChange}
        />
      </div>
    </div>
  );
}

// ---------- Content editor ----------
function ContentEditor({
  content,
  onChange,
  heroImage,
  onHeroImageChange,
}: {
  content: LPContent;
  onChange: (c: LPContent) => void;
  heroImage: string;
  onHeroImageChange: (v: string) => void;
}) {
  const patch = (p: Partial<LPContent>) => onChange({ ...content, ...p });

  return (
    <>
      <Section title="Aparência (paleta de cores)" anchorId="sec-aparencia">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(LP_THEMES) as LPThemeKey[]).map((key) => {
            const theme = LP_THEMES[key];
            const active = (content.theme ?? "exocad-purple") === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => patch({ theme: key })}
                className={`flex items-center gap-2 rounded-lg border p-2 text-left transition hover:border-primary/60 ${
                  active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border bg-white"
                }`}
              >
                <div className="flex -space-x-1">
                  {theme.swatch.map((c, i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded-full border border-white shadow-sm"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold">{theme.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">A paleta selecionada é aplicada em tempo real na prévia e ao publicar.</p>
      </Section>

      <Section title="Hero" anchorId="sec-hero">
        <TextField label="Selo (badge laranja)" value={content.hero.badge ?? ""} onChange={(v) => patch({ hero: { ...content.hero, badge: v } })} />
        <TextField label="Eyebrow" value={content.hero.eyebrow ?? ""} onChange={(v) => patch({ hero: { ...content.hero, eyebrow: v } })} />
        <TextField label="Headline" value={content.hero.headline} onChange={(v) => patch({ hero: { ...content.hero, headline: v } })} multiline />
        <TextField label="Subheadline" value={content.hero.sub ?? ""} onChange={(v) => patch({ hero: { ...content.hero, sub: v } })} multiline />
        <TextField label="CTA primário" value={content.hero.primaryCta} onChange={(v) => patch({ hero: { ...content.hero, primaryCta: v } })} />
        <TextField label="CTA secundário" value={content.hero.secondaryCta ?? ""} onChange={(v) => patch({ hero: { ...content.hero, secondaryCta: v } })} />
        <ListEditor label="Bullets do hero" items={content.hero.bullets ?? []} onChange={(items) => patch({ hero: { ...content.hero, bullets: items } })} />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Imagem do hero (opcional)</Label>
          <CoverImageUpload value={heroImage} onChange={onHeroImageChange} />
          <TextField label="ou cole uma URL" value={heroImage} onChange={onHeroImageChange} placeholder="https://…  (deixe vazio para SVG geométrico)" />
        </div>
      </Section>

      <Section title="Como funciona" anchorId="sec-como-funciona">
        <TextField label="Título" value={content.howItWorks?.title ?? ""} onChange={(v) => patch({ howItWorks: { ...(content.howItWorks ?? { items: [] }), title: v } })} />
        <StepListEditor
          items={content.howItWorks?.items ?? []}
          onChange={(items) => patch({ howItWorks: { ...(content.howItWorks ?? {}), items } })}
        />
      </Section>

      <Section title="Oferta / Posicionamento" anchorId="sec-posicionamento">
        <p className="text-[11px] text-muted-foreground">Bloco laranja abaixo do hero. Use <code>{"{strike}"}</code> na headline onde entra o preço-âncora riscado. Deixe todos os campos vazios para ocultar a seção.</p>
        <TextField label="Eyebrow (ex: OFERTA DE PRÉ-LANÇAMENTO)" value={content.positioning?.eyebrow ?? ""} onChange={(v) => patch({ positioning: { ...(content.positioning ?? { headline: "" }), eyebrow: v } })} />
        <TextField label="Headline (use {strike} para o preço riscado)" value={content.positioning?.headline ?? ""} onChange={(v) => patch({ positioning: { ...(content.positioning ?? { headline: "" }), headline: v } })} multiline />
        <TextField label="Preço riscado (opcional)" value={content.positioning?.strikePrice ?? ""} onChange={(v) => patch({ positioning: { ...(content.positioning ?? { headline: "" }), strikePrice: v } })} placeholder="R$ 3.700" />
        <TextField label="Preço destacado (opcional)" value={content.positioning?.highlightPrice ?? ""} onChange={(v) => patch({ positioning: { ...(content.positioning ?? { headline: "" }), highlightPrice: v } })} placeholder="R$ 2.390" />
        <TextField label="Texto de apoio (opcional)" value={content.positioning?.body ?? ""} onChange={(v) => patch({ positioning: { ...(content.positioning ?? { headline: "" }), body: v } })} multiline />
      </Section>

      <Section title="Condições" anchorId="sec-condicoes">
        <TextField label="Título da seção" value={content.conditions?.title ?? ""} onChange={(v) => patch({ conditions: { ...(content.conditions ?? { cards: defaultConditionCards() }), title: v } })} />
        <TextField label="Subtítulo da seção" value={content.conditions?.subtitle ?? ""} onChange={(v) => patch({ conditions: { ...(content.conditions ?? { cards: defaultConditionCards() }), subtitle: v } })} multiline />
        <ConditionCardsEditor
          cards={normalizeConditionCards(content.conditions?.cards)}
          onChange={(cards) => patch({ conditions: { ...(content.conditions ?? {}), cards } })}
        />
      </Section>

      <Section title="Módulos (Ultimate Lab Bundle)" anchorId="sec-modulos">
        <TextField label="Título" value={content.modules?.title ?? ""} onChange={(v) => patch({ modules: { ...(content.modules ?? { items: [] }), title: v } })} />
        <TextField label="Subtítulo" value={content.modules?.subtitle ?? ""} onChange={(v) => patch({ modules: { ...(content.modules ?? { items: [] }), subtitle: v } })} multiline />
        <ModulesEditor
          items={content.modules?.items ?? []}
          onChange={(items) => patch({ modules: { ...(content.modules ?? {}), items } })}
        />
        <TextField label="Nota final" value={content.modules?.footnote ?? ""} onChange={(v) => patch({ modules: { ...(content.modules ?? { items: [] }), footnote: v } })} multiline />
      </Section>

      <Section title="Uso seguro e regular da licença" anchorId="sec-regional">
        <TextField label="Título" value={content.regionalRules?.title ?? ""} onChange={(v) => patch({ regionalRules: { ...(content.regionalRules ?? { items: [] }), title: v } })} />
        <TextField label="Introdução" value={content.regionalRules?.intro ?? ""} onChange={(v) => patch({ regionalRules: { ...(content.regionalRules ?? { items: [] }), intro: v } })} multiline />
        <ListEditor
          label="Regras"
          items={content.regionalRules?.items ?? []}
          onChange={(items) => patch({ regionalRules: { ...(content.regionalRules ?? {}), items } })}
        />
        <TextField label="Nota final" value={content.regionalRules?.footnote ?? ""} onChange={(v) => patch({ regionalRules: { ...(content.regionalRules ?? { items: [] }), footnote: v } })} multiline />
      </Section>

      <Section title="Implantação, ativação, treinamento e suporte" anchorId="sec-implantacao">
        <TextField label="Título" value={content.implementation?.title ?? ""} onChange={(v) => patch({ implementation: { ...(content.implementation ?? {}), title: v } })} />
        <TextField label="Subtítulo" value={content.implementation?.subtitle ?? ""} onChange={(v) => patch({ implementation: { ...(content.implementation ?? {}), subtitle: v } })} multiline />
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Ativação inicial</div>
          <TextField label="Título" value={content.implementation?.activation?.title ?? ""} onChange={(v) => patch({ implementation: { ...(content.implementation ?? {}), activation: { title: v, items: content.implementation?.activation?.items ?? [] } } })} />
          <ListEditor label="Itens" items={content.implementation?.activation?.items ?? []} onChange={(items) => patch({ implementation: { ...(content.implementation ?? {}), activation: { title: content.implementation?.activation?.title ?? "Ativação inicial", items } } })} />
        </div>
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Treinamento inicial</div>
          <TextField label="Título" value={content.implementation?.training?.title ?? ""} onChange={(v) => patch({ implementation: { ...(content.implementation ?? {}), training: { title: v, body: content.implementation?.training?.body ?? "" } } })} />
          <TextField label="Descrição" value={content.implementation?.training?.body ?? ""} onChange={(v) => patch({ implementation: { ...(content.implementation ?? {}), training: { title: content.implementation?.training?.title ?? "Treinamento inicial", body: v } } })} multiline />
        </div>
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Suporte Smart Dent</div>
          <TextField label="Título" value={content.implementation?.support?.title ?? ""} onChange={(v) => patch({ implementation: { ...(content.implementation ?? {}), support: { title: v, items: content.implementation?.support?.items ?? [] } } })} />
          <ListEditor label="Itens" items={content.implementation?.support?.items ?? []} onChange={(items) => patch({ implementation: { ...(content.implementation ?? {}), support: { title: content.implementation?.support?.title ?? "Suporte Smart Dent", items } } })} />
        </div>
      </Section>

      <Section title="Benefícios" anchorId="sec-beneficios">
        <TextField label="Título" value={content.benefits?.title ?? ""} onChange={(v) => patch({ benefits: { ...(content.benefits ?? { items: [] }), title: v } })} />
        <BenefitsEditor
          items={content.benefits?.items ?? []}
          onChange={(items) => patch({ benefits: { ...(content.benefits ?? {}), items } })}
        />
      </Section>

      <Section title="FAQ" anchorId="sec-faq">
        <TextField label="Título" value={content.faq?.title ?? ""} onChange={(v) => patch({ faq: { ...(content.faq ?? { items: [] }), title: v } })} />
        <FaqEditor
          items={content.faq?.items ?? []}
          onChange={(items) => patch({ faq: { ...(content.faq ?? {}), items } })}
        />
      </Section>

      <Section title="CTA final" anchorId="sec-cta-final">
        <TextField label="Headline" value={content.finalCta?.headline ?? ""} onChange={(v) => patch({ finalCta: { ...(content.finalCta ?? { cta: "" }), headline: v } })} multiline />
        <TextField label="Subheadline" value={content.finalCta?.sub ?? ""} onChange={(v) => patch({ finalCta: { ...(content.finalCta ?? { headline: "", cta: "" }), sub: v } })} multiline />
        <TextField label="CTA" value={content.finalCta?.cta ?? ""} onChange={(v) => patch({ finalCta: { ...(content.finalCta ?? { headline: "" }), cta: v } })} />
      </Section>

      <Section title="Rodapé" anchorId="sec-rodape">
        <TextField label="Nome da marca" value={content.brandName ?? ""} onChange={(v) => patch({ brandName: v })} />
        <TextField
          label="URL do logo (imagem no header)"
          value={content.logoUrl ?? ""}
          onChange={(v) => patch({ logoUrl: v })}
          placeholder="https://... (deixe vazio para usar o nome da marca em texto)"
        />
        <TextField label="Legal / copyright" value={content.legal ?? ""} onChange={(v) => patch({ legal: v })} multiline />
      </Section>
    </>
  );
}

function Section({ title, children, anchorId }: { title: string; children: React.ReactNode; anchorId?: string }) {
  return (
    <details open id={anchorId} className="group border rounded-lg bg-white scroll-mt-16">
      <summary className="cursor-pointer list-none px-3 py-2 font-semibold text-sm flex items-center justify-between">
        {title}
        <span className="text-[#F47C42] group-open:rotate-45 transition text-lg leading-none">+</span>
      </summary>
      <div className="px-3 pb-3 space-y-2">{children}</div>
    </details>
  );
}

function defaultConditionCards() {
  return [1, 2, 3].map((n) => ({
    ribbon: `Condição ${n}`,
    title: "",
    priceLabel: "",
    priceNote: "",
    originalPrice: "",
    includes: [""],
    cta: "",
    footnote: "",
  }));
}

function normalizeConditionCards(cards?: ConditionCards) {
  const defaults = defaultConditionCards();
  return defaults.map((fallback, i) => ({ ...fallback, ...(cards?.[i] ?? {}) }));
}

function TextField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className="text-sm" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-9" />
      )}
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="text-sm h-8"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="h-8 px-2 text-xs"
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, ""])} className="h-7 text-xs">
          + Adicionar
        </Button>
      </div>
    </div>
  );
}

function ConditionCardsEditor({
  cards,
  onChange,
}: {
  cards: ConditionCards;
  onChange: (cards: ConditionCards) => void;
}) {
  return (
    <div className="space-y-3">
      {cards.slice(0, 3).map((card, i) => (
        <div key={i} className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Condição {i + 1}</div>
          <TextField label="Faixa superior" value={card.ribbon ?? ""} onChange={(v) => { const n = [...cards]; n[i] = { ...card, ribbon: v }; onChange(n); }} />
          <TextField label="Título" value={card.title} onChange={(v) => { const n = [...cards]; n[i] = { ...card, title: v }; onChange(n); }} />
          <TextField
            label="Preço original (De) — opcional"
            value={card.originalPrice ?? ""}
            onChange={(v) => { const n = [...cards]; n[i] = { ...card, originalPrice: v }; onChange(n); }}
            placeholder="Ex.: R$ 3.500"
          />
          <TextField
            label="Preço / Valor (Por)"
            value={card.priceLabel ?? ""}
            onChange={(v) => { const n = [...cards]; n[i] = { ...card, priceLabel: v }; onChange(n); }}
            placeholder="Ex.: R$ 2.399"
          />
          <DiscountPreview original={card.originalPrice} current={card.priceLabel} />
          <TextField label="Observação do preço" value={card.priceNote ?? ""} onChange={(v) => { const n = [...cards]; n[i] = { ...card, priceNote: v }; onChange(n); }} />
          <ListEditor label="Itens" items={card.includes ?? []} onChange={(items) => { const n = [...cards]; n[i] = { ...card, includes: items }; onChange(n); }} />
          <TextField label="CTA" value={card.cta} onChange={(v) => { const n = [...cards]; n[i] = { ...card, cta: v }; onChange(n); }} />
          <TextField label="Rodapé" value={card.footnote ?? ""} onChange={(v) => { const n = [...cards]; n[i] = { ...card, footnote: v }; onChange(n); }} multiline />
        </div>
      ))}
    </div>
  );
}

function DiscountPreview({ original, current }: { original?: string; current?: string }) {
  const parse = (raw?: string): number | null => {
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d,.\-]/g, "");
    if (!cleaned) return null;
    let norm = cleaned;
    if (cleaned.includes(",") && cleaned.includes(".")) norm = cleaned.replace(/\./g, "").replace(",", ".");
    else if (cleaned.includes(",")) norm = cleaned.replace(",", ".");
    const n = Number(norm);
    return Number.isFinite(n) ? n : null;
  };
  const o = parse(original);
  const c = parse(current);
  if (!o || !c || o <= c) return null;
  const savings = o - c;
  const percent = Math.round((savings / o) * 100);
  const fmt = savings.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: savings % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return (
    <div className="text-[11px] font-semibold text-[#F47C42] bg-[#F47C42]/10 rounded px-2 py-1">
      Desconto calculado: {fmt} ({percent}% OFF)
    </div>
  );
}

function StepListEditor({
  items,
  onChange,
}: {
  items: { title: string; desc: string }[];
  onChange: (items: { title: string; desc: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <div key={i} className="border rounded p-2 space-y-1 bg-muted/30">
          <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
            Passo {i + 1}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
          </div>
          <Input value={s.title} onChange={(e) => { const n = [...items]; n[i] = { ...s, title: e.target.value }; onChange(n); }} placeholder="Título" className="h-8 text-sm" />
          <Textarea value={s.desc} onChange={(e) => { const n = [...items]; n[i] = { ...s, desc: e.target.value }; onChange(n); }} rows={2} placeholder="Descrição" className="text-sm" />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { title: "", desc: "" }])} className="h-7 text-xs">
        + Adicionar passo
      </Button>
    </div>
  );
}

function BenefitsEditor({
  items,
  onChange,
}: {
  items: { icon: any; title: string; desc: string }[];
  onChange: (items: any[]) => void;
}) {
  const icons = ["licenca", "computador", "treinamento", "cartao", "suporte", "brasil", "modulos", "shield", "sparkles", "rocket", "clock"];
  return (
    <div className="space-y-2">
      {items.map((b, i) => (
        <div key={i} className="border rounded p-2 space-y-1 bg-muted/30">
          <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
            Benefício {i + 1}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
          </div>
          <select
            value={b.icon}
            onChange={(e) => { const n = [...items]; n[i] = { ...b, icon: e.target.value }; onChange(n); }}
            className="h-8 text-sm w-full rounded border bg-background px-2"
          >
            {icons.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <Input value={b.title} onChange={(e) => { const n = [...items]; n[i] = { ...b, title: e.target.value }; onChange(n); }} placeholder="Título" className="h-8 text-sm" />
          <Textarea value={b.desc} onChange={(e) => { const n = [...items]; n[i] = { ...b, desc: e.target.value }; onChange(n); }} rows={2} placeholder="Descrição" className="text-sm" />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { icon: "sparkles", title: "", desc: "" }])} className="h-7 text-xs">
        + Adicionar benefício
      </Button>
    </div>
  );
}

function FaqEditor({
  items,
  onChange,
}: {
  items: { q: string; a: string }[];
  onChange: (items: { q: string; a: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((f, i) => (
        <div key={i} className="border rounded p-2 space-y-1 bg-muted/30">
          <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
            Pergunta {i + 1}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
          </div>
          <Input value={f.q} onChange={(e) => { const n = [...items]; n[i] = { ...f, q: e.target.value }; onChange(n); }} placeholder="Pergunta" className="h-8 text-sm" />
          <Textarea value={f.a} onChange={(e) => { const n = [...items]; n[i] = { ...f, a: e.target.value }; onChange(n); }} rows={2} placeholder="Resposta" className="text-sm" />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { q: "", a: "" }])} className="h-7 text-xs">
        + Adicionar pergunta
      </Button>
    </div>
  );
}

function ModulesEditor({
  items,
  onChange,
}: {
  items: { name: string; application: string }[];
  onChange: (items: { name: string; application: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((m, i) => (
        <div key={i} className="border rounded p-2 space-y-1 bg-muted/30">
          <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
            Módulo {i + 1}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
          </div>
          <Input value={m.name} onChange={(e) => { const n = [...items]; n[i] = { ...m, name: e.target.value }; onChange(n); }} placeholder="Nome do módulo" className="h-8 text-sm" />
          <Textarea value={m.application} onChange={(e) => { const n = [...items]; n[i] = { ...m, application: e.target.value }; onChange(n); }} rows={2} placeholder="Aplicação comercial" className="text-sm" />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { name: "", application: "" }])} className="h-7 text-xs">
        + Adicionar módulo
      </Button>
    </div>
  );
}