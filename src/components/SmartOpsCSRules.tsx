import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { MessageVariableBar, HighlightVariables } from "@/components/smartops/MessageVariableBar";
import { MessageMediaPreview } from "@/components/smartops/MessageMediaPreview";
import { SmartOpsLiaAutomations } from "@/components/smartops/SmartOpsLiaAutomations";
import { SellerBriefingAutomation } from "@/components/smartops/SellerBriefingAutomation";
import { TriggerAutomations } from "@/components/smartops/TriggerAutomations";
import { WaAutomationsInventory } from "@/components/smartops/WaAutomationsInventory";
import { WaAutomationSettings } from "@/components/smartops/WaAutomationSettings";

const ACCEPT_BY_TIPO: Record<string, string> = {
  image: "image/*",
  audio: "audio/*",
  video: "video/*",
  document: "application/pdf,.doc,.docx,.xls,.xlsx",
};

function sanitizeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

interface TeamMember {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
  ativo: boolean;
  whatsapp_number: string;
}

interface Rule {
  id: string;
  team_member_id: string | null;
  trigger_event: string | null;
  produto_interesse: string | null;
  delay_days: number | null;
  tipo: string | null;
  template_manychat: string | null;
  manychat_ativo: boolean;
  wa_ativo: boolean;
  wa_tipo: string | null;
  mensagem_wa: string | null;
  wa_media_url: string | null;
  wa_media_caption: string | null;
  evolution_ativo: boolean;
  mensagem_evolution: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  dias_semana: number[] | null;
  enviar_fora_horario: boolean;
  mensagem_fora_horario: string | null;
  media_url: string | null;
  media_caption: string | null;
  media_filename: string | null;
  ativo: boolean;
}

const ROLE_SECTIONS = [
  { key: "vendedor", label: "Vendedores" },
  { key: "cs", label: "CS" },
  { key: "suporte", label: "Suporte" },
];

const TRIGGER_OPTIONS = [
  { value: "novo_lead", label: "Novo Lead" },
  { value: "ganho", label: "Ganho" },
  { value: "estagnado", label: "Estagnado" },
  { value: "perdido", label: "Perdido" },
];

const WA_TIPOS = [
  { value: "text", label: "Texto" },
  { value: "image", label: "Imagem" },
  { value: "audio", label: "Áudio" },
  { value: "video", label: "Vídeo" },
  { value: "document", label: "Documento" },
];

const DIAS_SEMANA: { v: number; l: string }[] = [
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
  { v: 0, l: "Dom" },
];

const TIPO_ICON: Record<string, string> = {
  text: "💬",
  image: "🖼️",
  audio: "🎵",
  video: "🎥",
  document: "📄",
};

function formatDias(d?: number[] | null): string {
  if (!d || d.length === 0) return "Sem dias";
  const set = new Set(d);
  const weekdays = [1, 2, 3, 4, 5];
  const isWeekdays = weekdays.every((x) => set.has(x)) && !set.has(0) && !set.has(6);
  if (isWeekdays && set.size === 5) return "Seg–Sex";
  if (set.size === 7) return "Todos os dias";
  return DIAS_SEMANA.filter((x) => set.has(x.v)).map((x) => x.l).join(", ");
}

const defaultForm = {
  trigger_event: "novo_lead",
  produto_interesse: "",
  delay_days: "0",
  tipo: "text",
  template_manychat: "",
  manychat_ativo: true,
  wa_ativo: false,
  wa_tipo: "text",
  mensagem_wa: "",
  wa_media_url: "",
  wa_media_caption: "",
  evolution_ativo: false,
  mensagem_evolution: "",
  horario_inicio: "08:00",
  horario_fim: "18:00",
  dias_semana: [1, 2, 3, 4, 5] as number[],
  enviar_fora_horario: false,
  mensagem_fora_horario: "",
  media_url: "",
  media_caption: "",
  media_filename: "",
};

export function SmartOpsCSRules() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    const [membersRes, rulesRes] = await Promise.all([
      supabase.from("team_members").select("id, nome_completo, email, role, ativo, whatsapp_number").eq("ativo", true).order("role").order("nome_completo"),
      supabase.from("cs_automation_rules").select("*").order("delay_days"),
    ]);
    setMembers((membersRes.data as TeamMember[]) || []);
    setRules((rulesRes.data as Rule[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = (memberId: string) => {
    setEditing(null);
    setSelectedMemberId(memberId);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setSelectedMemberId(r.team_member_id);
    setForm({
      trigger_event: r.trigger_event || "novo_lead",
      produto_interesse: r.produto_interesse || "",
      delay_days: String(r.delay_days ?? 0),
      tipo: r.tipo || "text",
      template_manychat: r.template_manychat || "",
      manychat_ativo: r.manychat_ativo ?? true,
      wa_ativo: r.wa_ativo ?? false,
      wa_tipo: r.wa_tipo || "text",
      mensagem_wa: r.mensagem_wa || "",
      wa_media_url: r.wa_media_url || "",
      wa_media_caption: r.wa_media_caption || "",
      evolution_ativo: r.evolution_ativo ?? false,
      mensagem_evolution: r.mensagem_evolution || "",
      horario_inicio: (r.horario_inicio || "08:00").slice(0, 5),
      horario_fim: (r.horario_fim || "18:00").slice(0, 5),
      dias_semana: Array.isArray(r.dias_semana) && r.dias_semana.length > 0 ? r.dias_semana : [1, 2, 3, 4, 5],
      enviar_fora_horario: r.enviar_fora_horario ?? false,
      mensagem_fora_horario: r.mensagem_fora_horario || "",
      media_url: r.media_url || "",
      media_caption: r.media_caption || "",
      media_filename: r.media_filename || "",
    });
    setDialogOpen(true);
  };

  const insertVariable = (varKey: string) => {
    const textarea = textareaRef.current;
    const tag = `{{${varKey}}}`;
    if (!textarea) {
      setForm(f => ({ ...f, mensagem_wa: f.mensagem_wa + tag }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.mensagem_wa;
    const newText = text.substring(0, start) + tag + text.substring(end);
    setForm(f => ({ ...f, mensagem_wa: newText }));
    setTimeout(() => {
      textarea.focus();
      const pos = start + tag.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertCaptionVariable = (varKey: string) => {
    setForm(f => ({ ...f, wa_media_caption: f.wa_media_caption + `{{${varKey}}}` }));
  };

  const [uploadingField, setUploadingField] = useState<null | "media" | "wa">(null);

  const handleMediaUpload = async (
    file: File,
    target: "media" | "wa",
    tipo: string,
  ) => {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite de 16 MB (WhatsApp).", variant: "destructive" });
      return;
    }
    setUploadingField(target);
    try {
      const safe = sanitizeFilename(file.name);
      const path = `automations/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const url = pub.publicUrl;
      if (target === "media") {
        setForm(f => ({
          ...f,
          media_url: url,
          ...(tipo === "document" ? { media_filename: file.name } : {}),
        }));
      } else {
        setForm(f => ({ ...f, wa_media_url: url }));
      }
      toast({ title: "Upload concluído" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro no upload", description: msg, variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    const payload: Record<string, unknown> = {
      team_member_id: selectedMemberId,
      trigger_event: form.trigger_event,
      produto_interesse: form.produto_interesse || null,
      delay_days: parseInt(form.delay_days),
      tipo: form.tipo,
      template_manychat: form.template_manychat || null,
      manychat_ativo: form.manychat_ativo,
      wa_ativo: form.wa_ativo,
      wa_tipo: form.wa_tipo,
      mensagem_wa: form.mensagem_wa || null,
      wa_media_url: form.wa_media_url || null,
      wa_media_caption: form.wa_media_caption || null,
      evolution_ativo: form.evolution_ativo,
      mensagem_evolution: form.mensagem_evolution || null,
      horario_inicio: form.horario_inicio || null,
      horario_fim: form.horario_fim || null,
      dias_semana: form.dias_semana,
      enviar_fora_horario: form.enviar_fora_horario,
      mensagem_fora_horario: form.mensagem_fora_horario || null,
      media_url: form.media_url || null,
      media_caption: form.media_caption || null,
      media_filename: form.media_filename || null,
    };
    if (editing) {
      const { error } = await supabase.from("cs_automation_rules").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("cs_automation_rules").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchData();
    toast({ title: editing ? "Automação atualizada" : "Automação criada" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cs_automation_rules").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
    toast({ title: "Automação removida" });
  };

  const toggleAtivo = async (r: Rule) => {
    await supabase.from("cs_automation_rules").update({ ativo: !r.ativo }).eq("id", r.id);
    fetchData();
  };

  const renderRuleCard = (r: Rule) => (
    <Card key={r.id} className={`border ${!r.ativo ? "opacity-50" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[11px]">
              {TRIGGER_OPTIONS.find(t => t.value === r.trigger_event)?.label || r.trigger_event}
            </Badge>
            {r.produto_interesse && (
              <Badge variant="secondary" className="text-[11px]">{r.produto_interesse}</Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              {r.delay_days === 0 ? "Imediato" : `${r.delay_days}d delay`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {(r.horario_inicio || r.horario_fim) && (
            <span>🕐 {(r.horario_inicio || "00:00").slice(0, 5)}–{(r.horario_fim || "23:59").slice(0, 5)} · {formatDias(r.dias_semana)}</span>
          )}
          <span>{TIPO_ICON[r.tipo || "text"]} {WA_TIPOS.find(t => t.value === (r.tipo || "text"))?.label}</span>
        </div>
        {r.enviar_fora_horario && r.mensagem_fora_horario && (
          <div className="text-[11px] text-muted-foreground">
            ⏰ Fora do horário: {r.mensagem_fora_horario.slice(0, 60)}{r.mensagem_fora_horario.length > 60 ? "…" : ""}
          </div>
        )}
        <div className="flex gap-4 text-[11px]">
          {r.manychat_ativo && (
            <span className="text-primary">✓ ManyChat: <span className="font-mono">{r.template_manychat || "—"}</span></span>
          )}
          {r.wa_ativo && (
            <div className="flex items-start gap-2">
              {r.wa_tipo !== "text" && r.wa_media_url && (
                <MessageMediaPreview tipo={r.wa_tipo || "image"} url={r.wa_media_url} compact />
              )}
              <div className="space-y-0.5">
                <span className="text-primary">
                  ✓ WhatsApp ({WA_TIPOS.find(t => t.value === r.wa_tipo)?.label})
                </span>
                {r.wa_tipo === "text" && r.mensagem_wa && (
                  <div className="block">
                    <HighlightVariables text={r.mensagem_wa.substring(0, 80) + (r.mensagem_wa.length > 80 ? "…" : "")} />
                  </div>
                )}
                {r.wa_tipo !== "text" && r.wa_media_caption && (
                  <div className="block">
                    <HighlightVariables text={r.wa_media_caption.substring(0, 60) + (r.wa_media_caption.length > 60 ? "…" : "")} />
                  </div>
                )}
              </div>
            </div>
          )}
          {r.evolution_ativo && (
            <span className="text-primary">✓ Evolution</span>
          )}
          {!r.manychat_ativo && !r.wa_ativo && !r.evolution_ativo && (
            <span className="text-muted-foreground">Nenhum canal ativo</span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando automações...</div>;

  return (
    <div className="space-y-4">
      <SmartOpsLiaAutomations />

      <Accordion type="multiple" defaultValue={ROLE_SECTIONS.map(r => r.key)} className="space-y-3">
        {ROLE_SECTIONS.map((section) => {
          const sectionMembers = members.filter(m => m.role === section.key);
          const sectionRuleCount = rules.filter(r => sectionMembers.some(m => m.id === r.team_member_id)).length;

          return (
            <AccordionItem key={section.key} value={section.key} className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{section.label}</span>
                  <Badge variant="secondary" className="text-xs">{sectionMembers.length} membros</Badge>
                  <Badge variant="outline" className="text-xs">{sectionRuleCount} regras</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {sectionMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum membro com role "{section.key}"
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sectionMembers.map((member) => {
                      const memberRules = rules.filter(r => r.team_member_id === member.id);
                      return (
                        <Card key={member.id}>
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-sm">{member.nome_completo}</CardTitle>
                                <p className="text-[11px] text-muted-foreground">{member.email} · {member.whatsapp_number}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => openAdd(member.id)}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Nova Automação
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="px-4 pb-3 space-y-2">
                            {memberRules.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma automação configurada</p>
                            ) : (
                              memberRules.map(renderRuleCard)
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Regras globais (sem membro associado) */}
      {rules.filter(r => !r.team_member_id).length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Regras Globais (sem membro associado)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {rules.filter(r => !r.team_member_id).map(renderRuleCard)}
          </CardContent>
        </Card>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Automação" : "Nova Automação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trigger Event</Label>
                <Select value={form.trigger_event} onValueChange={(v) => setForm({ ...form, trigger_event: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produto de Interesse</Label>
                <Input value={form.produto_interesse} onChange={(e) => setForm({ ...form, produto_interesse: e.target.value })} placeholder="Vitality, EdgeMini..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delay (dias)</Label>
                <Input type="number" min="0" value={form.delay_days} onChange={(e) => setForm({ ...form, delay_days: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">0 = imediato</p>
              </div>
              <div>
                <Label>Tipo geral</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WA_TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{TIPO_ICON[t.value]} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mídia geral (quando tipo != texto) */}
            {form.tipo !== "text" && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Label className="text-xs font-semibold">Mídia ({WA_TIPOS.find(t => t.value === form.tipo)?.label})</Label>
                <div>
                  <Label className="text-xs">URL da mídia</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.media_url}
                      onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingField === "media"}
                      onClick={() => document.getElementById("media-upload-input")?.click()}
                    >
                      {uploadingField === "media" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Upload className="h-4 w-4 mr-1" />Upload</>
                      )}
                    </Button>
                    <input
                      id="media-upload-input"
                      type="file"
                      hidden
                      accept={ACCEPT_BY_TIPO[form.tipo] || "*/*"}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleMediaUpload(f, "media", form.tipo);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Legenda (opcional)</Label>
                  <Input value={form.media_caption} onChange={(e) => setForm({ ...form, media_caption: e.target.value })} placeholder="Legenda da mídia" />
                </div>
                {form.tipo === "document" && (
                  <div>
                    <Label className="text-xs">Nome do arquivo</Label>
                    <Input value={form.media_filename} onChange={(e) => setForm({ ...form, media_filename: e.target.value })} placeholder="proposta.pdf" />
                  </div>
                )}
                {form.media_url && (
                  <div className="pt-2">
                    {form.tipo === "image" && (
                      <img src={form.media_url} alt="preview" className="max-h-32 rounded border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    {form.tipo === "audio" && (
                      <audio controls src={form.media_url} className="w-full" />
                    )}
                    {form.tipo === "video" && (
                      <video controls src={form.media_url} className="max-h-32 rounded border" />
                    )}
                    {form.tipo === "document" && (
                      <div className="text-sm flex items-center gap-2 p-2 bg-background rounded border">
                        <span>📄</span><span>{form.media_filename || "arquivo"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Horário de Envio */}
            <div className="space-y-3">
              <Label className="font-semibold">🕐 Horário de Envio</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Enviar a partir de</Label>
                  <Input type="time" value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="time" value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DIAS_SEMANA.map((d) => {
                    const active = form.dias_semana.includes(d.v);
                    return (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            dias_semana: active
                              ? f.dias_semana.filter((x) => x !== d.v)
                              : [...f.dias_semana, d.v].sort(),
                          }))
                        }
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enviar mensagem fora do horário</Label>
                <Switch checked={form.enviar_fora_horario} onCheckedChange={(v) => setForm({ ...form, enviar_fora_horario: v })} />
              </div>
              {form.enviar_fora_horario && (
                <div>
                  <Label className="text-xs">Mensagem fora do horário</Label>
                  <Textarea
                    value={form.mensagem_fora_horario}
                    onChange={(e) => setForm({ ...form, mensagem_fora_horario: e.target.value })}
                    placeholder="Ex: Olá! Recebi seu contato e te respondo amanhã no horário comercial 😊"
                    rows={3}
                  />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Quando o toggle está desligado, mensagens fora do horário ficam enfileiradas para a próxima abertura.
              </p>
            </div>

            <Separator />

            {/* ManyChat */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">ManyChat</Label>
                <Switch checked={form.manychat_ativo} onCheckedChange={(v) => setForm({ ...form, manychat_ativo: v })} />
              </div>
              {form.manychat_ativo && (
                <div>
                  <Label className="text-xs">Template ManyChat</Label>
                  <Input value={form.template_manychat} onChange={(e) => setForm({ ...form, template_manychat: e.target.value })} placeholder="vitality_boas_vindas" />
                </div>
              )}
            </div>

            <Separator />

            {/* WhatsApp */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">WhatsApp</Label>
                <Switch checked={form.wa_ativo} onCheckedChange={(v) => setForm({ ...form, wa_ativo: v })} />
              </div>
              {form.wa_ativo && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Tipo de Mensagem</Label>
                    <Select value={form.wa_tipo} onValueChange={(v) => setForm({ ...form, wa_tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WA_TIPOS.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.wa_tipo === "text" ? (
                    <div className="space-y-2">
                      <MessageVariableBar onInsert={insertVariable} />
                      <div>
                        <Label className="text-xs">Mensagem</Label>
                        <Textarea
                          ref={textareaRef}
                          value={form.mensagem_wa}
                          onChange={(e) => setForm({ ...form, mensagem_wa: e.target.value })}
                          placeholder="Olá {{nome}}! Vi que se interessou pelo {{produto_interesse}}..."
                          rows={4}
                        />
                      </div>
                      {form.mensagem_wa && (
                        <div className="p-2 bg-muted/50 rounded border">
                          <span className="text-[10px] text-muted-foreground block mb-1">Preview:</span>
                          <HighlightVariables text={form.mensagem_wa} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">URL da mídia ({WA_TIPOS.find(t => t.value === form.wa_tipo)?.label})</Label>
                        <div className="flex gap-2">
                          <Input
                            value={form.wa_media_url}
                            onChange={(e) => setForm({ ...form, wa_media_url: e.target.value })}
                            placeholder="https://..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingField === "wa"}
                            onClick={() => document.getElementById("wa-upload-input")?.click()}
                          >
                            {uploadingField === "wa" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><Upload className="h-4 w-4 mr-1" />Upload</>
                            )}
                          </Button>
                          <input
                            id="wa-upload-input"
                            type="file"
                            hidden
                            accept={ACCEPT_BY_TIPO[form.wa_tipo] || "*/*"}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleMediaUpload(f, "wa", form.wa_tipo);
                              e.target.value = "";
                            }}
                          />
                        </div>
                      </div>

                      {form.wa_media_url && (
                        <MessageMediaPreview tipo={form.wa_tipo} url={form.wa_media_url} />
                      )}

                      <div className="space-y-2">
                        <MessageVariableBar onInsert={insertCaptionVariable} />
                        <div>
                          <Label className="text-xs">Legenda (opcional)</Label>
                          <Input
                            value={form.wa_media_caption}
                            onChange={(e) => setForm({ ...form, wa_media_caption: e.target.value })}
                            placeholder="Confira {{nome}}! Novidades sobre {{produto_interesse}}"
                          />
                        </div>
                        {form.wa_media_caption && (
                          <div className="p-2 bg-muted/50 rounded border">
                            <span className="text-[10px] text-muted-foreground block mb-1">Preview legenda:</span>
                            <HighlightVariables text={form.wa_media_caption} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Evolution API */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Evolution API</Label>
                <Switch checked={form.evolution_ativo} onCheckedChange={(v) => setForm({ ...form, evolution_ativo: v })} />
              </div>
              {form.evolution_ativo && (
                <div>
                  <Label className="text-xs">Mensagem Evolution</Label>
                  <Textarea
                    value={form.mensagem_evolution}
                    onChange={(e) => setForm({ ...form, mensagem_evolution: e.target.value })}
                    placeholder="Deixe vazio para usar a mesma mensagem do WhatsApp"
                    rows={4}
                  />
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
      <SellerBriefingAutomation />
      <TriggerAutomations />

      <Card className="mt-4 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Automações de treinamento</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            Confirmação de matrícula, lembrete de aula (1h antes) e pesquisa de NPS são configurados
            <strong> dentro do card de cada curso</strong> — incluindo a instância de WhatsApp que faz o envio.
          </p>
          <p>Acesse <strong>Treinamentos → Catálogo → editar curso → Mensagens de WhatsApp do treinamento</strong>.</p>
        </CardContent>
      </Card>

      <WaAutomationSettings />

      <WaAutomationsInventory />
    </div>
  );
}
