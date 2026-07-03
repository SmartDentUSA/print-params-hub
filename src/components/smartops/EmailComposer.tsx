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
import { Sparkles, Send, Mail, Plus, X, Eye, RefreshCw } from "lucide-react";

type CtaType = "landing" | "form" | "knowledge" | "social_post" | "store" | "seller_wa" | "custom";

interface CtaOption { id: string; label: string; url: string; tipo: CtaType }
interface Cta { tipo: CtaType; id?: string; url: string; label: string }

interface EmailComposerProps {
  campaignName: string;
  description?: string;
  filters: Record<string, unknown>;
  audienceCount?: number;
  onSent?: (result: { campaign_id: string | null; sent: number; failed: number }) => void;
}

export function EmailComposer({ campaignName, description, filters, audienceCount, onSent }: EmailComposerProps) {
  // Product state
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [produtoId, setProdutoId] = useState<string>("");
  const [ctaOptions, setCtaOptions] = useState<Record<CtaType, CtaOption[]>>({
    landing: [], form: [], knowledge: [], social_post: [], store: [], seller_wa: [], custom: [],
  });

  // CTA state
  const [ctaPrincipal, setCtaPrincipal] = useState<Cta | null>(null);
  const [ctasSecundarios, setCtasSecundarios] = useState<Cta[]>([]);
  const [tom, setTom] = useState<string>("consultivo, profissional, direto");

  // Generated content
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [html, setHtml] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [generating, setGenerating] = useState(false);

  // Send
  const [sending, setSending] = useState(false);
  const [fromName, setFromName] = useState("Smart Dent | Fluxo Digital");
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Load who am I (connected Gmail account)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("smart-ops-send-gmail", { body: { action: "whoami" } });
      if (!error && data?.emailAddress) setConnectedEmail(data.emailAddress);
    })();
  }, []);

  // Load products
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("system_a_catalog")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true })
        .limit(200);
      const rows = (data || []).map((p: any) => ({ id: p.id, title: p.name })).filter((p: any) => p.title);
      setProducts(rows);
    })();
  }, []);

  // Load CTA option lists when product changes (or once)
  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [lp, forms, know, posts, store] = await Promise.all([
        sb.from("smartops_form_landing_pages").select("id, slug, title").limit(100),
        sb.from("smartops_forms").select("id, name, slug").limit(100),
        sb.from("knowledge_contents").select("id, title, slug, category, language")
          .eq("status", "published").order("updated_at", { ascending: false }).limit(50),
        sb.from("social_scheduled_posts")
          .select("id, caption, permalink_url, media_url").eq("status", "published")
          .order("scheduled_at", { ascending: false }).limit(30),
        produtoId
          ? sb.from("system_a_catalog").select("id, name, product_url").eq("id", produtoId).limit(1)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const origin = "https://smartdent.com.br";
      setCtaOptions({
        landing: (lp.data || []).map((p: any) => ({
          id: p.id, tipo: "landing", label: p.title || p.slug,
          url: `${origin}/lp/${p.slug}`,
        })),
        form: (forms.data || []).map((f: any) => ({
          id: f.id, tipo: "form", label: f.name || f.slug,
          url: `${origin}/formulario/${f.slug}`,
        })),
        knowledge: (know.data || []).map((k: any) => ({
          id: k.id, tipo: "knowledge", label: k.title,
          url: `${origin}/base-conhecimento/${k.category || "a"}/${k.slug}`,
        })),
        social_post: (posts.data || []).filter((p: any) => p.permalink_url).map((p: any) => ({
          id: p.id, tipo: "social_post",
          label: (p.caption || "post").slice(0, 60),
          url: p.permalink_url,
        })),
        store: (store.data || []).filter((p: any) => p.product_url).map((p: any) => ({
          id: p.id, tipo: "store", label: `Loja: ${p.name || p.title}`, url: p.product_url,
        })),
        seller_wa: [{
          id: "dynamic", tipo: "seller_wa",
          label: "WhatsApp do vendedor responsável (dinâmico)",
          url: "{{link_wa_vendedor}}",
        }],
        custom: [],
      });
    })();
  }, [produtoId]);

  const allCtas = useMemo(() => {
    return [
      ...ctaOptions.landing, ...ctaOptions.form, ...ctaOptions.knowledge,
      ...ctaOptions.social_post, ...ctaOptions.store, ...ctaOptions.seller_wa,
    ];
  }, [ctaOptions]);

  const pickCta = (key: string): CtaOption | null => {
    const [tipo, id] = key.split("::");
    const list = (ctaOptions as any)[tipo] as CtaOption[] | undefined;
    return list?.find(o => o.id === id) || null;
  };

  async function handleGenerate(mode: "all" | "subject" = "all") {
    if (!produtoId) return toast.error("Escolha um produto primeiro");
    if (!ctaPrincipal) return toast.error("Escolha um CTA principal");
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-generate-email-ai", {
        body: {
          produto_id: produtoId,
          cta_principal: ctaPrincipal,
          ctas_secundarios: ctasSecundarios,
          segmento_resumo: JSON.stringify(filters).slice(0, 500),
          tom,
          regenerate: mode,
          base_html: mode === "subject" ? html : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao gerar");
      setSubject(data.subject);
      setPreheader(data.preheader);
      setCtaLabel(data.cta_button_label);
      if (mode === "all") setHtml(data.html_body);
      toast.success(mode === "subject" ? "Assunto regenerado" : "Email gerado pela IA");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na geração");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend(isTest: boolean) {
    if (!subject.trim() || !html.trim()) return toast.error("Assunto e corpo são obrigatórios");
    if (isTest && !testEmail.trim()) return toast.error("Informe o email de teste");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-send-gmail", {
        body: {
          campaign_name: campaignName || `Email — ${new Date().toISOString().slice(0, 10)}`,
          description,
          from_name: fromName,
          subject, preheader, html,
          filters,
          cta_config: { produto_id: produtoId, cta_principal: ctaPrincipal, ctas_secundarios: ctasSecundarios },
          test_email: isTest ? testEmail : undefined,
        },
      });
      if (error) throw error;
      toast.success(isTest
        ? `Teste enviado para ${testEmail}`
        : `Enviados ${data.sent}/${data.audience} • Falhas: ${data.failed}`);
      if (!isTest) onSent?.(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  const previewHtml = html
    .split("{{nome}}").join("Dr. João")
    .split("{{primeiro_nome}}").join("Dr. João")
    .split("{{vendedor_nome}}").join(fromName)
    .split("{{link_wa_vendedor}}").join("https://wa.me/5511999999999");

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" /> Composer Email (Gmail)
          </CardTitle>
        </CardHeader>
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
          <div className="text-xs text-muted-foreground">
            📊 Público estimado: <b>{audienceCount ?? "?"}</b> leads (somente com email cadastrado)
          </div>
        </CardContent>
      </Card>

      {/* Product + CTA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Produto & Call-to-Action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Produto</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
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
                {(["landing","form","knowledge","social_post","store","seller_wa"] as CtaType[]).flatMap(t => {
                  const list = ctaOptions[t];
                  if (!list.length) return [];
                  return [
                    <div key={`h-${t}`} className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                      {({
                        landing: "Landing Pages", form: "Formulários", knowledge: "Publicações",
                        social_post: "Posts Redes", store: "Loja", seller_wa: "WhatsApp", custom: "",
                      } as any)[t]}
                    </div>,
                    ...list.map(o => (
                      <SelectItem key={`${o.tipo}-${o.id}`} value={`${o.tipo}::${o.id}`}>
                        {o.label}
                      </SelectItem>
                    )),
                  ];
                })}
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
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="+ Adicionar CTA" />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {allCtas.map(o => (
                      <SelectItem key={`s-${o.tipo}-${o.id}`} value={`${o.tipo}::${o.id}`}>
                        {o.label}
                      </SelectItem>
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
            <Input value={tom} onChange={e => setTom(e.target.value)} placeholder="Ex: consultivo, técnico, direto" />
          </div>

          <Button onClick={() => handleGenerate("all")} disabled={generating || !produtoId || !ctaPrincipal} className="w-full">
            <Sparkles className="w-4 h-4 mr-1" />
            {generating ? "Gerando com IA..." : "Gerar email por IA"}
          </Button>
        </CardContent>
      </Card>

      {/* Editor + Preview */}
      {(subject || html) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>2. Revisar & Ajustar</span>
              <Button size="sm" variant="ghost" onClick={() => setShowPreview(s => !s)}>
                <Eye className="w-4 h-4 mr-1" />
                {showPreview ? "Ocultar preview" : "Ver preview"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                <Label className="text-xs">HTML</Label>
                <Textarea
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  className="font-mono text-xs h-96"
                />
              </div>
              {showPreview && (
                <div>
                  <Label className="text-xs">Preview</Label>
                  <div className="border rounded bg-white overflow-hidden h-96">
                    <iframe
                      srcDoc={previewHtml}
                      title="preview"
                      className="w-full h-full"
                      sandbox=""
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send */}
      {subject && html && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Enviar teste para</Label>
                <Input placeholder="seu@email.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => handleSend(true)} disabled={sending || !testEmail}>
                <Send className="w-4 h-4 mr-1" /> Enviar teste
              </Button>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-3">
              ⚠️ Limite Gmail padrão: ~500 envios/dia. Aberturas dependem do cliente carregar imagens.
            </div>
            <Button
              onClick={() => handleSend(false)}
              disabled={sending}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-1" />
              {sending ? "Disparando..." : `📧 Disparar para ${audienceCount ?? "?"} leads`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}