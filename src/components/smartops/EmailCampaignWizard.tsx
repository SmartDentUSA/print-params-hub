import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Send, Mail, X, Eye, RefreshCw, CheckCircle2, Clock, Search, ArrowLeft, ArrowRight, ListPlus, Code2, LayoutList, Type, Maximize2, Minimize2 } from "lucide-react";
import { EmailSequenceBuilder } from "./EmailSequenceBuilder";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { EmailRichEditor } from "./EmailRichEditor";
import { EmailHtmlEditor } from "./EmailHtmlEditor";
import { parseSections, serializeSections, toggleSection, type EmailSection } from "./emailSections";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CtaType = "landing" | "form" | "custom";
interface CtaOption { id: string; label: string; url: string; tipo: CtaType }
interface Cta { tipo: CtaType; id?: string; url: string; label: string }

interface Props {
  campaignName: string;
  description?: string;
  filters: Record<string, unknown>;
  audienceCount?: number;
  onSent?: (result: { campaign_id: string | null; sent: number; failed: number }) => void;
}

const STEPS = [
  { id: 1, label: "Produto & CTA", icon: Mail },
  { id: 2, label: "Revisar & Ajustar", icon: Eye },
  { id: 3, label: "Testar envio", icon: Send },
  { id: 4, label: "Agendar ou enviar", icon: Clock },
  { id: 5, label: "Criar régua", icon: ListPlus },
] as const;

export function EmailCampaignWizard({ campaignName, description, filters, audienceCount, onSent }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // ── Products & CTAs ──
  const [products, setProducts] = useState<Array<{ id: string; title: string; category?: string }>>([]);
  const [produtoId, setProdutoId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [ctaOptions, setCtaOptions] = useState<Record<CtaType, CtaOption[]>>({
    landing: [], form: [], custom: [],
  });
  const [ctaPrincipal, setCtaPrincipal] = useState<Cta | null>(null);
  const [ctasSecundarios, setCtasSecundarios] = useState<Cta[]>([]);
  const [tom, setTom] = useState<string>("consultivo");
  const [tomCustom, setTomCustom] = useState<string>("");
  const [useLandingPage, setUseLandingPage] = useState<boolean>(true);
  const [emailSource, setEmailSource] = useState<"landing_page_ai" | "landing_page_verbatim" | "catalog_dossier" | null>(null);

  // ── Generated content ──
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [html, setHtml] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [generating, setGenerating] = useState(false);

  // ── Sending / meta ──
  const [sending, setSending] = useState(false);
  const [fromName, setFromName] = useState("Smart Dent | Fluxo Digital");
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  // Queue + metrics
  const [queueStatus, setQueueStatus] = useState<{
    sent_today: number; daily_cap: number; queued_total: number;
    active_campaigns: number; window_start: string; window_end: string;
  } | null>(null);
  const [lastCampaignId, setLastCampaignId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testHistory, setTestHistory] = useState<Array<{ to: string; status: "ok" | "fail"; at: string; error?: string }>>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [dispatchMode, setDispatchMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  // ── Section toggles ──
  const [sections, setSections] = useState<EmailSection[]>([]);
  const [editorTab, setEditorTab] = useState<"visual" | "html" | "sections">("visual");
  const [editorExpanded, setEditorExpanded] = useState(false);

  // Re-parse sections whenever the HTML changes, preserving enabled state by key+ordinal.
  useEffect(() => {
    setSections((prev) => {
      const parsed = parseSections(html);
      const seen = new Map<string, number>();
      return parsed.map((p) => {
        const idx = seen.get(p.key) ?? 0;
        seen.set(p.key, idx + 1);
        const match = prev.filter((s) => s.key === p.key)[idx];
        return match ? { ...p, enabled: match.enabled } : p;
      });
    });
  }, [html]);

  const effectiveHtml = useMemo(() => {
    if (!html) return "";
    if (sections.length === 0) return html;
    return serializeSections(html, sections);
  }, [html, sections]);

  // ── Load who am I ──
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("smart-ops-send-gmail", { body: { action: "whoami" } });
      if (!error && (data as any)?.emailAddress) setConnectedEmail((data as any).emailAddress);
    })();
  }, []);

  // ── Load products (all active/visible, up to 1000) ──
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("system_a_catalog")
        .select("id, name, product_category, active, visible_in_ui, display_order")
        .or("active.eq.true,visible_in_ui.eq.true")
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .limit(1000);
      const rows = (data || [])
        .map((p: any) => ({ id: p.id, title: p.name, category: p.product_category }))
        .filter((p: any) => p.title);
      setProducts(rows);
    })();
  }, []);

  // ── Load CTA option lists — restricted to the selected product's LP + Form ──
  useEffect(() => {
    (async () => {
      if (!produtoId) {
        setCtaOptions({ landing: [], form: [], custom: [] });
        setCtaPrincipal(null);
        setCtasSecundarios([]);
        return;
      }
      const sb = supabase as any;
      const { data: prodForms } = await sb
        .from("smartops_forms")
        .select("id, name, slug")
        .eq("product_catalog_id", produtoId);
      const formIds = (prodForms || []).map((f: any) => f.id);
      const { data: prodLps } = formIds.length
        ? await sb
            .from("smartops_form_landing_pages")
            .select("id, status, form_id")
            .in("form_id", formIds)
            .eq("status", "published")
        : { data: [] as any[] };

      // Load official short links for these forms (same shorts shown on the form card).
      const formSlugs = (prodForms || []).map((f: any) => f.slug).filter(Boolean);
      const { data: shortRows } = formSlugs.length
        ? await sb
            .from("smartops_short_links")
            .select("short_code, form_slug, default_target")
            .in("form_slug", formSlugs)
        : { data: [] as any[] };
      const shortBase = "https://s.smartdent.com.br";
      const shortMap: Record<string, { form?: string; landing_page?: string }> = {};
      for (const r of (shortRows || []) as any[]) {
        if (!r.form_slug) continue;
        shortMap[r.form_slug] = shortMap[r.form_slug] || {};
        if (r.default_target === "form" || r.default_target === "landing_page") {
          shortMap[r.form_slug][r.default_target as "form" | "landing_page"] = r.short_code;
        }
      }
      const formSlugById: Record<string, string> = {};
      const formNameById: Record<string, string> = {};
      for (const f of (prodForms || []) as any[]) {
        formSlugById[f.id] = f.slug;
        formNameById[f.id] = f.name || f.slug;
      }

      const origin = "https://smartdent.com.br";
      const landing: CtaOption[] = (prodLps || []).map((p: any) => {
        const fSlug = formSlugById[p.form_id];
        const code = fSlug ? shortMap[fSlug]?.landing_page : undefined;
        return {
          id: p.id,
          tipo: "landing" as const,
          label: `Landing: ${formNameById[p.form_id] || fSlug || p.id}`,
          url: code ? `${shortBase}/${code}` : `${origin}/lp/${fSlug || ""}`,
        };
      });
      const form: CtaOption[] = (prodForms || []).map((f: any) => ({
        id: f.id, tipo: "form",
        label: `Formulário: ${f.name || f.slug}`,
        url: (() => {
          const code = shortMap[f.slug]?.form;
          return code ? `${shortBase}/${code}` : `${origin}/f/${f.slug}`;
        })(),
      }));

      setCtaOptions({ landing, form, custom: [] });

      // Auto-select: LP as principal, Form as secondary (or reverse if only one exists)
      const first = landing[0] || form[0] || null;
      const second = landing[0] && form[0] ? form[0] : null;
      setCtaPrincipal(first ? { tipo: first.tipo, id: first.id, url: first.url, label: first.label } : null);
      setCtasSecundarios(second ? [{ tipo: second.tipo, id: second.id, url: second.url, label: second.label }] : []);
    })();
  }, [produtoId]);

  const allCtas = useMemo(() => [...ctaOptions.landing, ...ctaOptions.form], [ctaOptions]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const s = productSearch.toLowerCase();
    return products.filter(p =>
      p.title.toLowerCase().includes(s) || (p.category || "").toLowerCase().includes(s));
  }, [products, productSearch]);

  const pickCta = (key: string): CtaOption | null => {
    const [tipo, id] = key.split("::");
    const list = (ctaOptions as any)[tipo] as CtaOption[] | undefined;
    return list?.find(o => o.id === id) || null;
  };

  async function handleGenerate(mode: "all" | "subject" = "all") {
    if (!produtoId) return toast.error("Escolha um produto primeiro");
    if (!ctaPrincipal) return toast.error("Este produto não tem landing page nem formulário vinculado. Cadastre um antes de gerar o e-mail.");
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-generate-email-ai", {
        body: {
          produto_id: produtoId,
          cta_principal: ctaPrincipal,
          ctas_secundarios: ctasSecundarios,
          segmento_resumo: JSON.stringify(filters).slice(0, 500),
          tom: tom === "custom" ? (tomCustom || "consultivo, profissional") : tom,
          regenerate: mode,
          base_html: mode === "subject" ? html : undefined,
          use_landing_page: useLandingPage,
        },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Falha ao gerar");
      const d = data as any;
      setSubject(d.subject);
      setPreheader(d.preheader);
      setCtaLabel(d.cta_button_label);
      if (mode === "all") {
        setHtml(d.html_body);
        setStep(2);
      }
      const src = (d.source || null) as typeof emailSource;
      if (mode === "all") setEmailSource(src);
      if (mode === "all") {
        if (useLandingPage && ctaPrincipal?.tipo === "landing" && src === "catalog_dossier") {
          toast.warning("A LP do produto não foi encontrada — gerado a partir do catálogo.");
        } else if (src === "landing_page_verbatim") {
          toast.success("Email gerado como espelho fiel da Landing Page");
        } else {
          toast.success("Email gerado a partir do dossiê do catálogo");
        }
      } else {
        toast.success("Assunto regenerado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na geração");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTest() {
    if (!subject.trim() || !html.trim()) return toast.error("Assunto e corpo são obrigatórios");
    if (!testEmail.trim()) return toast.error("Informe o email de teste");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-send-gmail", {
        body: {
          campaign_name: campaignName || `Email — ${new Date().toISOString().slice(0, 10)}`,
          description, from_name: fromName,
          subject, preheader, html: effectiveHtml || html,
          filters,
          cta_config: { produto_id: produtoId, cta_principal: ctaPrincipal, ctas_secundarios: ctasSecundarios },
          test_email: testEmail,
        },
      });
      if (error) throw error;
      setTestHistory(h => [{ to: testEmail, status: "ok" as const, at: new Date().toISOString() }, ...h].slice(0, 5));
      toast.success(`Teste enviado para ${testEmail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar";
      setTestHistory(h => [{ to: testEmail, status: "fail" as const, at: new Date().toISOString(), error: msg }, ...h].slice(0, 5));
      toast.error(msg);
    } finally { setSending(false); }
  }

  async function handleDispatch() {
    if (!subject.trim() || !html.trim()) return toast.error("Assunto e corpo são obrigatórios");
    if (dispatchMode === "scheduled" && !scheduledAt) return toast.error("Escolha data/hora do agendamento");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-send-gmail", {
        body: {
          campaign_name: campaignName || `Email — ${new Date().toISOString().slice(0, 10)}`,
          description, from_name: fromName,
          subject, preheader, html: effectiveHtml || html, filters,
          cta_config: { produto_id: produtoId, cta_principal: ctaPrincipal, ctas_secundarios: ctasSecundarios },
          scheduled_at: dispatchMode === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
        },
      });
      if (error) throw error;
      const d = data as any;
      setLastCampaignId(d?.campaign_id ?? null);
      toast.success(`Campanha enfileirada — ${d.audience} leads na fila global`);
      onSent?.(d);
      setStep(5);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally { setSending(false); }
  }

  const previewHtml = effectiveHtml
    .split("{{nome}}").join("Dr. João")
    .split("{{primeiro_nome}}").join("Dr. João")
    .split("{{vendedor_nome}}").join(fromName);

  const renderEditorArea = (expanded = false) => {
    const previewHeightClass = expanded
      ? "h-[calc(100vh-260px)] min-h-[500px]"
      : emailSource?.startsWith("landing_page")
        ? "h-[640px]"
        : "h-[600px]";
    return (
      <div className="space-y-3">
        {htmlWarning && (
          <div className="text-xs bg-yellow-100 text-yellow-900 border border-yellow-300 rounded px-3 py-2">
            ⚠️ {htmlWarning}
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Assunto</Label>
            <Button size="sm" variant="ghost" onClick={() => handleGenerate("subject")} disabled={generating}>
              <RefreshCw className="w-3 h-3 mr-1" /> Regerar assunto
            </Button>
          </div>
          <Input value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Preheader (linha de pré-visualização na inbox)</Label>
          <Input value={preheader} onChange={e => setPreheader(e.target.value)} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as typeof editorTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="visual" className="text-xs gap-1"><Type className="w-3 h-3" /> Visual</TabsTrigger>
                <TabsTrigger value="html" className="text-xs gap-1"><Code2 className="w-3 h-3" /> HTML</TabsTrigger>
                <TabsTrigger value="sections" className="text-xs gap-1">
                  <LayoutList className="w-3 h-3" /> Seções
                  {sections.filter(s => s.removable).length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {sections.filter(s => s.enabled && s.removable).length}/{sections.filter(s => s.removable).length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="visual" className="mt-2">
                {/<table[\s>]|style\s*=\s*"/i.test(html) ? (
                  <>
                    <div className="text-[11px] text-muted-foreground mb-2 p-2 border rounded bg-muted/20">
                      Este email usa layout HTML complexo (tabelas / estilos inline). Edite o código à esquerda — o preview atualiza automaticamente e todo o estilo é preservado.
                    </div>
                    <EmailHtmlEditor value={html} onChange={setHtml} expanded={expanded} />
                  </>
                ) : (
                  <EmailRichEditor value={html} onChange={setHtml} />
                )}
                {sections.some(s => s.removable && !s.enabled) && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Seções desligadas continuam visíveis aqui, mas são removidas do preview e do envio.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="html" className="mt-2">
                <Textarea value={html} onChange={e => setHtml(e.target.value)} className={`font-mono text-xs ${expanded ? "h-[calc(100vh-260px)] min-h-[500px]" : "h-[600px]"}`} />
              </TabsContent>
              <TabsContent value="sections" className="mt-2">
                {sections.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3">Gere o email para ver as seções.</p>
                )}
                {sections.length > 0 && sections.every(s => !s.removable) && (
                  <div className="text-xs text-muted-foreground p-3 border rounded bg-muted/30">
                    Este email tem um único bloco de conteúdo. Não foi possível detectar seções automaticamente — regere para que a IA gere blocos separados (hero, benefícios, CTA, prova social, rodapé).
                  </div>
                )}
                {sections.some(s => s.auto) && (
                  <div className="text-xs text-muted-foreground p-2 mb-2 border rounded bg-muted/20">
                    Seções detectadas automaticamente. Rótulos são aproximações — regere o email para rótulos mais precisos.
                  </div>
                )}
                {sections.filter(s => s.removable).length > 0 && sections.filter(s => s.removable).every(s => !s.enabled) && (
                  <div className="text-xs text-amber-800 p-2 mb-2 border border-amber-300 rounded bg-amber-50">
                    Todas as seções estão desativadas — o email será enviado vazio. Reative pelo menos uma.
                  </div>
                )}
                <div className="space-y-2">
                  {sections.filter(s => s.removable).map((s) => (
                    <div key={s.id} className="flex items-center justify-between border rounded px-3 py-2 bg-background">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className="text-[11px] text-muted-foreground">{s.key}</span>
                      </div>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={() => setSections(prev => toggleSection(prev, s.id))}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          {showPreview && (
            <div className="flex flex-col">
              <Label className="text-xs">Preview</Label>
              <div className={`border rounded bg-white overflow-hidden ${previewHeightClass}`}>
                <iframe srcDoc={previewHtml} title="preview" className="w-full h-full" sandbox="" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Poll global queue status while on step 4
  useEffect(() => {
    if (step !== 4) return;
    let alive = true;
    const tick = async () => {
      const { data } = await supabase.rpc("fn_email_queue_status");
      if (alive && data) setQueueStatus(data as any);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [step]);

  // Poll metrics for the just-enqueued campaign while on step 5
  useEffect(() => {
    if (!lastCampaignId || step !== 5) return;
    let alive = true;
    const tick = async () => {
      const { data } = await supabase.rpc("fn_email_campaign_metrics", { p_campaign_id: lastCampaignId });
      if (alive && data) setMetrics(data);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [lastCampaignId, step]);

  const htmlWarning = useMemo(() => {
    if (!html) return null;
    if (!/<body[\s>]/i.test(html)) return "HTML sem <body> — sanitizador vai envolver, mas prefira regenerar.";
    if (/<\/td>\s*(?!<)/i.test(html) && !/<table[\s>]/i.test(html)) return "HTML tem </td> solto sem <table>. Regere.";
    return null;
  }, [html]);

  // ─────────────────────────────── UI ───────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stepper */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className="flex items-center gap-2 min-w-fit">
                  <button
                    onClick={() => setStep(s.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active ? "bg-primary text-primary-foreground"
                      : done ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.id}. {s.label}</span>
                    <span className="sm:hidden">{s.id}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className={`w-6 h-px ${done ? "bg-primary" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>📧 <b>{connectedEmail || "…"}</b></span>
            <span>📊 Público: <b>{audienceCount ?? "?"}</b></span>
            <span className="ml-auto">Campanha: <b>{campaignName || "sem nome"}</b></span>
          </div>
        </CardContent>
      </Card>

      {/* ────── Step 1: Produto & CTA ────── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">1. Produto & Call-to-Action</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Remetente (nome exibido)</Label>
                <Input value={fromName} onChange={e => setFromName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Conta Gmail conectada</Label>
                <Input value={connectedEmail || "…verificando…"} readOnly className="bg-muted" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Produto ({products.length} disponíveis)</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 mb-1"
                  placeholder="Buscar produto por nome ou categoria…"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent className="max-h-96">
                  {filteredProducts.slice(0, 300).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}{p.category ? ` — ${p.category}` : ""}
                    </SelectItem>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-2 py-4 text-xs text-muted-foreground text-center">Nenhum produto encontrado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">CTA principal (botão do email)</Label>
              <Select
                value={ctaPrincipal ? `${ctaPrincipal.tipo}::${ctaPrincipal.id}` : ""}
                onValueChange={(v) => {
                  const o = pickCta(v);
                  if (o) setCtaPrincipal({ tipo: o.tipo, id: o.id, url: o.url, label: o.label });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Escolha o destino principal" /></SelectTrigger>
                <SelectContent className="max-h-96">
                  {(["landing","form"] as CtaType[]).flatMap(t => {
                    const list = ctaOptions[t];
                    if (!list.length) return [];
                    return [
                      <div key={`h-${t}`} className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                        {({ landing: "Landing Page do produto", form: "Formulário do produto" } as any)[t]}
                      </div>,
                      ...list.map(o => (
                        <SelectItem key={`${o.tipo}-${o.id}`} value={`${o.tipo}::${o.id}`}>{o.label}</SelectItem>
                      )),
                    ];
                  })}
                  {!allCtas.length && (
                    <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                      {produtoId
                        ? "Este produto não tem landing page nem formulário vinculado."
                        : "Selecione um produto primeiro."}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">CTAs secundários (rodapé, até 3)</Label>
                {ctasSecundarios.length < 3 && (
                  <Select
                    value=""
                    onValueChange={(v) => {
                      const o = pickCta(v);
                      if (o) setCtasSecundarios(prev => [...prev, { tipo: o.tipo, id: o.id, url: o.url, label: o.label }]);
                    }}
                  >
                    <SelectTrigger className="h-8 w-44"><SelectValue placeholder="+ Adicionar CTA" /></SelectTrigger>
                    <SelectContent className="max-h-96">
                      {allCtas.map(o => (
                        <SelectItem key={`s-${o.tipo}-${o.id}`} value={`${o.tipo}::${o.id}`}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ctasSecundarios.map((c, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {c.label.slice(0, 30)}
                    <button onClick={() => setCtasSecundarios(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {!ctasSecundarios.length && <span className="text-xs text-muted-foreground">Nenhum</span>}
              </div>
            </div>

            <div>
              <Label className="text-xs">Tom da mensagem</Label>
              <Select value={tom} onValueChange={setTom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultivo">🎓 Consultivo — orienta sem pressionar</SelectItem>
                  <SelectItem value="tecnico">🔬 Técnico especialista — labs & dentistas avançados</SelectItem>
                  <SelectItem value="educativo">📚 Educativo — artigos e casos clínicos</SelectItem>
                  <SelectItem value="direto_comercial">🎯 Direto & Comercial — leads quentes</SelectItem>
                  <SelectItem value="storytelling">📖 Storytelling clínico — jornada digital</SelectItem>
                  <SelectItem value="urgencia_soft">⏰ Urgência suave — reativação / vagas</SelectItem>
                  <SelectItem value="celebrativo">🎉 Celebrativo — lançamentos e marcos</SelectItem>
                  <SelectItem value="reativacao_amigavel">🤝 Reativação amigável — leads frios</SelectItem>
                  <SelectItem value="pos_venda_cs">✅ Pós-venda / CS — onboarding e suporte</SelectItem>
                  <SelectItem value="evento_convite">🎫 Convite p/ evento — cursos e webinars</SelectItem>
                  <SelectItem value="custom">✏️ Personalizado…</SelectItem>
                </SelectContent>
              </Select>
              {tom === "custom" && (
                <Input className="mt-2" value={tomCustom} onChange={e => setTomCustom(e.target.value)}
                  placeholder="Ex: irreverente, provocativo mas técnico" />
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => handleGenerate("all")} disabled={generating || !produtoId || !ctaPrincipal}>
                <Sparkles className="w-4 h-4 mr-1" />
                {generating ? "Gerando com IA..." : "Gerar email com IA →"}
              </Button>
            </div>
            {ctaPrincipal?.tipo === "landing" && (
              <div className="flex items-center justify-end gap-3 -mt-2 text-xs">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useLandingPage}
                    onChange={e => setUseLandingPage(e.target.checked)}
                    className="accent-primary"
                  />
                  Usar a Landing Page do produto como base visual e de copy
                </label>
                {useLandingPage && (
                  <Badge variant="secondary" className="text-[10px]">
                    {emailSource === "landing_page_ai"
                      ? "Espelho fiel da Landing Page (verbatim)"
                      : emailSource === "landing_page_verbatim"
                      ? "Espelho fiel da Landing Page (verbatim)"
                      : emailSource === "catalog_dossier"
                      ? "Fallback: dossiê do catálogo"
                      : "E-mail padrão: espelho fiel da LP"}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────── Step 2: Revisar & Ajustar ────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                2. Revisar & Ajustar
                {emailSource?.startsWith("landing_page") && (
                  <Badge variant="secondary" className="text-[10px]">Espelho fiel da Landing Page</Badge>
                )}
                {emailSource === "catalog_dossier" && (
                  <Badge variant="outline" className="text-[10px]">Fallback catálogo</Badge>
                )}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditorExpanded(true)}>
                  <Maximize2 className="w-4 h-4 mr-1" /> Expandir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(s => !s)}>
                  <Eye className="w-4 h-4 mr-1" />
                  {showPreview ? "Ocultar preview" : "Ver preview"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {renderEditorArea(false)}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!subject || !html}>
                Testar envio <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────── Step 3: Testar envio ────── */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Testar envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[240px]">
                <Label className="text-xs">Enviar teste para</Label>
                <Input placeholder="seu@email.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
              </div>
              <Button onClick={handleTest} disabled={sending || !testEmail}>
                <Send className="w-4 h-4 mr-1" /> {sending ? "Enviando..." : "Enviar teste"}
              </Button>
            </div>

            {testHistory.length > 0 && (
              <div className="space-y-1 text-xs">
                <Label className="text-xs">Últimos testes</Label>
                {testHistory.map((t, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded border ${
                    t.status === "ok" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  }`}>
                    {t.status === "ok" ? "✅" : "❌"}
                    <span className="font-mono">{t.to}</span>
                    <span className="text-muted-foreground">{new Date(t.at).toLocaleTimeString()}</span>
                    {t.error && <span className="text-red-700 truncate">— {t.error}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 text-xs bg-muted/40 rounded p-3">
              <div className="font-medium text-sm mb-1">Checklist antes de disparar:</div>
              <div className="flex items-center gap-2">{subject ? "✅" : "◻️"} Assunto preenchido</div>
              <div className="flex items-center gap-2">{preheader ? "✅" : "◻️"} Preheader preenchido</div>
              <div className="flex items-center gap-2">{ctaPrincipal ? "✅" : "◻️"} CTA principal definido</div>
              <div className="flex items-center gap-2">{!htmlWarning ? "✅" : "⚠️"} HTML sanitário</div>
              <div className="flex items-center gap-2">{testHistory.some(t => t.status === "ok") ? "✅" : "◻️"} Ao menos 1 teste OK</div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button onClick={() => setStep(4)}>Agendar ou enviar <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────── Step 4: Agendar ou enviar ────── */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">4. Agendar ou enviar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={dispatchMode} onValueChange={(v) => setDispatchMode(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="now" id="rg-now" />
                <label htmlFor="rg-now" className="text-sm">Enviar agora</label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="scheduled" id="rg-sch" />
                <label htmlFor="rg-sch" className="text-sm">Agendar para…</label>
              </div>
            </RadioGroup>
            {dispatchMode === "scheduled" && (
              <div>
                <Label className="text-xs">Data e hora (America/Sao_Paulo)</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">
                  A fila só começa a enviar a partir da data agendada, respeitando janela e cap diário.
                </p>
              </div>
            )}

            <div className="text-sm bg-primary/5 border border-primary/20 rounded p-3">
              📧 <b>{audienceCount ?? "?"}</b> emails para leads da segmentação<br />
              {dispatchMode === "now"
                ? <>Enfileirar agora via Gmail conectado (<b>{connectedEmail}</b>)</>
                : <>Agendado para <b>{scheduledAt || "—"}</b></>}
            </div>

            <div className="border-t pt-3 space-y-2 text-xs">
              <div className="font-medium text-foreground">Fila inteligente de envio</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>Até <b>499 e-mails/dia</b> no Gmail conectado (limite oficial ~500/dia).</li>
                <li>Janela: <b>{queueStatus?.window_start ?? "07:30"}–{queueStatus?.window_end ?? "19:00"}</b> (America/Sao_Paulo).</li>
                <li>Se houver várias campanhas ativas, a fila envia <b>1 e-mail de cada em rodízio</b> até completar todas.</li>
                <li>Aberturas e cliques são rastreados automaticamente.</li>
              </ul>
              {queueStatus && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Enviados hoje</div>
                    <div className="font-semibold">{queueStatus.sent_today}/{queueStatus.daily_cap}</div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Na fila</div>
                    <div className="font-semibold">{queueStatus.queued_total}</div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Campanhas ativas</div>
                    <div className="font-semibold">{queueStatus.active_campaigns}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button onClick={handleDispatch} disabled={sending}>
                <Send className="w-4 h-4 mr-1" />
                {sending ? "Disparando..."
                  : dispatchMode === "now"
                    ? `Enfileirar ${audienceCount ?? "?"} leads`
                    : "Confirmar agendamento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────── Step 5: Criar régua ────── */}
      {step === 5 && (
        <div className="space-y-4">
          {lastCampaignId && (
            <Card>
              <CardHeader><CardTitle className="text-base">Métricas ao vivo</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Enviados</div>
                    <div className="font-semibold text-base">{metrics?.enviados ?? 0}<span className="text-muted-foreground text-xs">/{metrics?.total ?? 0}</span></div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Pendentes</div>
                    <div className="font-semibold text-base">{metrics?.pendentes ?? 0}</div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Abertos</div>
                    <div className="font-semibold text-base">{metrics?.abertos ?? 0} <span className="text-muted-foreground">({metrics?.taxa_abertura ?? 0}%)</span></div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Cliques (leads)</div>
                    <div className="font-semibold text-base">{metrics?.clicks ?? 0} <span className="text-muted-foreground">({metrics?.taxa_click ?? 0}%)</span></div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Cliques (total)</div>
                    <div className="font-semibold text-base">{metrics?.click_total ?? 0}</div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Erros</div>
                    <div className="font-semibold text-base">{metrics?.erros ?? 0}</div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Atualiza a cada 30s. Fila envia entre 07:30–19:00 (America/Sao_Paulo), respeitando 499/dia.</p>
              </CardContent>
            </Card>
          )}
          <EmailSequenceBuilder
          seedFromCurrent={{
            produto_id: produtoId,
            audience_filter: filters,
            subject, preheader, html: effectiveHtml || html,
            cta_config: { produto_id: produtoId, cta_principal: ctaPrincipal, ctas_secundarios: ctasSecundarios },
            cta_button_label: ctaLabel,
            tom,
            campaign_name: campaignName,
          }}
          onBack={() => setStep(4)}
          />
        </div>
      )}

      <Dialog open={editorExpanded} onOpenChange={setEditorExpanded}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                Revisar & Ajustar — Tela expandida
                {emailSource?.startsWith("landing_page") && (
                  <Badge variant="secondary" className="text-[10px]">Espelho fiel da Landing Page</Badge>
                )}
                {emailSource === "catalog_dossier" && (
                  <Badge variant="outline" className="text-[10px]">Fallback catálogo</Badge>
                )}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(s => !s)}>
                  <Eye className="w-4 h-4 mr-1" />
                  {showPreview ? "Ocultar preview" : "Ver preview"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditorExpanded(false)}>
                  <Minimize2 className="w-4 h-4 mr-1" /> Reduzir
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            {renderEditorArea(true)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}