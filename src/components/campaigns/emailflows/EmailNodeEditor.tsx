import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Paperclip, Trash2, Maximize2 } from "lucide-react";
import { EmailHtmlEditor } from "@/components/smartops/EmailHtmlEditor";
import { EMAIL_TYPES } from "./types";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";
import { EmailContentCanvas, CONTENT_SOURCES, emptyContentSelection, type ContentKey, type ContentSelection } from "./EmailContentCanvas";

const db = supabase as any;

export function signaturePreview(m: any): string {
  if (!m) return "";
  const digits = String(m.whatsapp_number || "").replace(/\D/g, "");
  const icon = (href: string | null, img: string, alt: string) => href ? `<a href="${href}" style="margin-right:6px"><img src="${img}" width="22" height="22" alt="${alt}"></a>` : "";
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;font-family:Arial"><tr>${m.photo_url ? `<td style="padding-right:14px"><img src="${m.photo_url}" width="64" height="64" style="border-radius:50%"></td>` : ""}<td style="font-size:13px;color:#334155;line-height:1.5"><strong style="font-size:15px;color:#0f172a">${m.nome_completo || ""}</strong><br>${m.cargo ? `${m.cargo}<br>` : ""}Smart Dent | Fluxo Digital<br>${digits ? `<a href="https://wa.me/${digits}">+${digits}</a><br>` : ""}<div style="margin-top:6px">${icon(digits ? `https://wa.me/${digits}` : null, "https://img.icons8.com/color/48/whatsapp--v1.png", "WhatsApp")}${icon(m.instagram_url, "https://img.icons8.com/color/48/instagram-new--v1.png", "Instagram")}${icon(m.linkedin_url, "https://img.icons8.com/color/48/linkedin.png", "LinkedIn")}${icon(m.facebook_url, "https://img.icons8.com/color/48/facebook-new.png", "Facebook")}${icon(m.youtube_url, "https://img.icons8.com/color/48/youtube-play.png", "YouTube")}</div></td></tr></table>`;
}

type PickKey = "product_ids" | "post_ids" | "knowledge_ids" | "event_ids" | "course_ids";

function Picker({ items, selected, onToggle, render }: { items: any[]; selected: string[]; onToggle: (id: string) => void; render: (x: any) => React.ReactNode }) {
  const [q, setQ] = useState("");
  const filtered = items.filter((x) => JSON.stringify(x).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" />
      <div className="max-h-64 overflow-auto divide-y border rounded-md">
        {filtered.map((x) => (
          <label key={x.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50">
            <Checkbox checked={selected.includes(x.id)} onCheckedChange={() => onToggle(x.id)} />
            {render(x)}
          </label>
        ))}
        {filtered.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nada encontrado.</div>}
      </div>
    </div>
  );
}

function AiDialog({ open, onClose, emailType, selection, initialSource, onSelectionChange, onResult }: { open: boolean; onClose: () => void; emailType: string; selection: ContentSelection; initialSource: ContentKey; onSelectionChange: (s: ContentSelection) => void; onResult: (r: { subject: string; preheader: string; html: string }) => void }) {
  const [lists, setLists] = useState<Record<string, any[]>>({});
  const sel = selection;
  const [active, setActive] = useState<ContentKey>("product_ids");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setActive(initialSource); }, [open, initialSource]);

  useEffect(() => {
    if (!open || Object.keys(lists).length) return;
    setLoading(true); setLoadError("");
    Promise.all([
      db.from("system_a_catalog").select("id, name, image_url, product_category").in("category", [...PRODUCT_CATALOG_ENTITY_TYPES]).eq("active", true).eq("approved", true).order("name").limit(1000),
      db.from("social_posts").select("id, caption, thumbnail_url, media_url, platform, published_at").eq("platform", "instagram").order("published_at", { ascending: false, nullsFirst: false }).limit(1000),
      db.from("knowledge_contents").select("id, title").eq("active", true).order("created_at", { ascending: false }).limit(400),
      db.from("smartops_events").select("id, name, start_date").order("start_date", { ascending: false }).limit(100),
      db.from("smartops_courses").select("id, title").eq("active", true).order("title"),
    ]).then(([p, s, k, e, c]: any[]) => {
      const failed = [p, s, k, e, c].filter((r) => r.error);
      setLoadError(failed.map((r) => r.error.message).join(" · "));
      setLoading(false);
      setLists((l) => ({ ...l, products: p.data || l.products || [], posts: s.data || [], kb: k.data || [], events: e.data || [], courses: c.data || [] }));
    });
  }, [open, lists]);

  const toggle = (k: PickKey) => (id: string) => { if (!sel[k].includes(id) && sel[k].length >= 10) return toast.error("Selecione até 10 itens por tipo de conteúdo"); onSelectionChange({ ...sel, [k]: sel[k].includes(id) ? sel[k].filter((x) => x !== id) : [...sel[k], id] }); };
  const total = Object.values(sel).reduce((a, b) => a + b.length, 0);

  const generate = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("email-flow-ai", { body: { ...sel, email_type: emailType, instructions } });
    setBusy(false);
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json())?.error || msg; } catch { /* keep */ } }
      return toast.error(msg);
    }
    onResult(data);
    toast.success("E-mail gerado");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[92vh] overflow-auto">
        <DialogHeader><DialogTitle>Gerar e-mail com IA — {EMAIL_TYPES.find((t) => t.v === emailType)?.l}</DialogTitle></DialogHeader>
        <EmailContentCanvas selection={sel} lists={lists} active={active} onSelect={setActive} />
        {loading && <div className="text-xs text-muted-foreground">Carregando conteúdos…</div>}
        {loadError && <div className="text-xs text-destructive">{loadError}<Button size="sm" variant="outline" onClick={() => setLists({})}>Tentar novamente</Button></div>}
        <Tabs value={CONTENT_SOURCES.find((s) => s.key === active)?.list === "products" ? "produtos" : CONTENT_SOURCES.find((s) => s.key === active)?.list === "events" ? "eventos" : CONTENT_SOURCES.find((s) => s.key === active)?.list === "courses" ? "cursos" : CONTENT_SOURCES.find((s) => s.key === active)?.list || "kb"} onValueChange={(v) => setActive(CONTENT_SOURCES.find((s) => s.list === ({ produtos: "products", eventos: "events", cursos: "courses" } as Record<string, string>)[v] || s.list === v)?.key || "product_ids")}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="produtos">Produtos {sel.product_ids.length ? `(${sel.product_ids.length})` : ""}</TabsTrigger>
            <TabsTrigger value="posts">Instagram {sel.post_ids.length ? `(${sel.post_ids.length})` : ""}</TabsTrigger>
            <TabsTrigger value="kb">Base de conhecimento {sel.knowledge_ids.length ? `(${sel.knowledge_ids.length})` : ""}</TabsTrigger>
            <TabsTrigger value="eventos">Eventos {sel.event_ids.length ? `(${sel.event_ids.length})` : ""}</TabsTrigger>
            <TabsTrigger value="cursos">Cursos {sel.course_ids.length ? `(${sel.course_ids.length})` : ""}</TabsTrigger>
          </TabsList>
          <TabsContent value="produtos"><Picker items={lists.products || []} selected={sel.product_ids} onToggle={toggle("product_ids")} render={(x) => <>{x.image_url && <img src={x.image_url} alt="" className="w-10 h-10 object-contain rounded" />}<span className="flex-1 min-w-0">{x.name}</span><span className="text-muted-foreground">{x.product_category}</span></>} /></TabsContent>
          <TabsContent value="posts"><Picker items={lists.posts || []} selected={sel.post_ids} onToggle={toggle("post_ids")} render={(x) => <>{(x.thumbnail_url || x.media_url) && <img src={x.thumbnail_url || x.media_url} alt="" className="w-10 h-10 object-cover rounded" />}<span className="flex-1 line-clamp-2">{x.caption || "(sem legenda)"}</span></>} /></TabsContent>
          <TabsContent value="kb"><Picker items={lists.kb || []} selected={sel.knowledge_ids} onToggle={toggle("knowledge_ids")} render={(x) => <span className="truncate">{x.title}</span>} /></TabsContent>
          <TabsContent value="eventos"><Picker items={lists.events || []} selected={sel.event_ids} onToggle={toggle("event_ids")} render={(x) => <><span className="flex-1 truncate">{x.name}</span><span className="text-muted-foreground">{x.start_date}</span></>} /></TabsContent>
          <TabsContent value="cursos"><Picker items={lists.courses || []} selected={sel.course_ids} onToggle={toggle("course_ids")} render={(x) => <span className="truncate">{x.title}</span>} /></TabsContent>
        </Tabs>
        <div><Label className="text-xs">Instruções adicionais (opcional)</Label><Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex.: convidar para a turma de março, destacar o fluxo chairside" /></div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{total} item(ns) selecionado(s). Sem preços no conteúdo.</span>
          <Button onClick={generate} disabled={busy}><Sparkles className="w-4 h-4 mr-1" /> {busy ? "Gerando…" : "Gerar e-mail"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmailNodeEditor({ data, onChange, members, isCertificateTrigger }: { data: any; onChange: (d: any) => void; members: any[]; isCertificateTrigger: boolean }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [contentSource, setContentSource] = useState<ContentKey>("product_ids");
  const [bigOpen, setBigOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const set = (p: any) => onChange({ ...data, ...p });
  const attachments: any[] = data.attachments || [];
  const contentSelection: ContentSelection = { ...emptyContentSelection(), ...data.content_selection };
  const sigMember = data.signature && data.signature !== "seller" && data.signature !== "none" ? members.find((m) => m.id === data.signature) : null;
  const previewHtml = useMemo(() => {
    const sig = signaturePreview(sigMember || (data.signature === "seller" ? { nome_completo: "{{vendedor_nome}} (vendedor do lead)" } : null));
    const h = data.html || "";
    return /<\/body>/i.test(h) ? h.replace(/<\/body>/i, `${sig}</body>`) : h + sig;
  }, [data.html, data.signature, sigMember]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[11px]">Tipo de e-mail</Label>
          <Select value={data.email_type} onValueChange={(v) => set({ email_type: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{EMAIL_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[11px]">Nome exibido</Label><Input className="h-8 text-xs" value={data.from_name || ""} onChange={(e) => set({ from_name: e.target.value })} /></div>
      </div>
      <div><Label className="text-[11px]">Assunto</Label><Input className="h-8 text-xs" value={data.subject || ""} onChange={(e) => set({ subject: e.target.value })} /></div>
      <div><Label className="text-[11px]">Pré-cabeçalho</Label><Input className="h-8 text-xs" value={data.preheader || ""} onChange={(e) => set({ preheader: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAiOpen(true)}><Sparkles className="w-3.5 h-3.5 mr-1" /> Conteúdos / Gerar com IA</Button>
        <Button size="sm" variant="outline" onClick={() => setBigOpen(true)}><Maximize2 className="w-3.5 h-3.5 mr-1" /> Editor HTML</Button>
      </div>
      <div className="grid gap-1">
        {CONTENT_SOURCES.map((s) => <Button key={s.key} size="sm" variant="outline" className="justify-start text-xs" onClick={() => { setContentSource(s.key); setAiOpen(true); }}><s.Icon className="w-3.5 h-3.5 mr-2" />{s.label}<Badge variant="secondary" className="ml-auto">{contentSelection[s.key].length}</Badge></Button>)}
      </div>
      <div className="text-[10px] text-muted-foreground">Variáveis: {"{{primeiro_nome}} {{nome}} {{curso}} {{vendedor_nome}} {{link_wa_vendedor}}"}</div>
      <iframe title="Prévia" srcDoc={previewHtml || "<p style='font-family:Arial;color:#888;padding:16px'>Sem conteúdo ainda.</p>"} sandbox="" className="w-full h-64 border rounded-md bg-background" />

      <div><Label className="text-[11px]">Assinatura</Label>
        <Select value={data.signature || "seller"} onValueChange={(v) => set({ signature: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="seller">Vendedor atual do lead (automático)</SelectItem>
            <SelectItem value="none">Sem assinatura</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>)}
          </SelectContent>
        </Select>
        {sigMember && !sigMember.photo_url && <div className="text-[10px] text-muted-foreground mt-1">Este membro não tem foto cadastrada.</div>}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] flex items-center gap-1"><Paperclip className="w-3 h-3" /> Anexos</Label>
        {attachments.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="truncate max-w-[220px]">{a.kind === "certificate" ? "Diploma PDF do participante" : a.filename || a.url}</Badge>
            <Button size="sm" variant="ghost" className="h-6" onClick={() => set({ attachments: attachments.filter((_, j) => j !== i) })}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
        <div className="flex gap-1">
          <Input className="h-8 text-xs" placeholder="Link de arquivo (https://…)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <Button size="sm" variant="outline" className="h-8" onClick={() => { if (!/^https?:\/\//.test(newUrl)) return toast.error("Link inválido"); set({ attachments: [...attachments, { kind: "url", url: newUrl }] }); setNewUrl(""); }}>Anexar</Button>
        </div>
        {!attachments.some((a) => a.kind === "certificate") && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => set({ attachments: [...attachments, { kind: "certificate" }] })}>
            + Anexar diploma do participante {isCertificateTrigger ? "" : "(use com o gatilho 'Diploma gerado')"}
          </Button>
        )}
      </div>

      <AiDialog open={aiOpen} onClose={() => setAiOpen(false)} emailType={data.email_type} selection={contentSelection} initialSource={contentSource} onSelectionChange={(content_selection) => set({ content_selection })} onResult={(r) => set({ subject: r.subject || data.subject, preheader: r.preheader || data.preheader, html: r.html })} />
      <Dialog open={bigOpen} onOpenChange={setBigOpen}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader><DialogTitle>Editor HTML do e-mail</DialogTitle></DialogHeader>
          <EmailHtmlEditor value={data.html || ""} onChange={(html) => set({ html })} expanded />
        </DialogContent>
      </Dialog>
    </div>
  );
}
