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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { WaLeadsVariableBar, HighlightVariables } from "@/components/smartops/WaLeadsVariableBar";
import { WaLeadsMediaPreview } from "@/components/smartops/WaLeadsMediaPreview";

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
  waleads_ativo: boolean;
  waleads_tipo: string | null;
  mensagem_waleads: string | null;
  waleads_media_url: string | null;
  waleads_media_caption: string | null;
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

const WALEADS_TIPOS = [
  { value: "text", label: "Texto" },
  { value: "image", label: "Imagem" },
  { value: "audio", label: "Áudio" },
  { value: "video", label: "Vídeo" },
  { value: "document", label: "Documento" },
];

const defaultForm = {
  trigger_event: "novo_lead",
  produto_interesse: "",
  delay_days: "0",
  tipo: "text",
  template_manychat: "",
  manychat_ativo: true,
  waleads_ativo: false,
  waleads_tipo: "text",
  mensagem_waleads: "",
  waleads_media_url: "",
  waleads_media_caption: "",
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
      waleads_ativo: r.waleads_ativo ?? false,
      waleads_tipo: r.waleads_tipo || "text",
      mensagem_waleads: r.mensagem_waleads || "",
      waleads_media_url: r.waleads_media_url || "",
      waleads_media_caption: r.waleads_media_caption || "",
    });
    setDialogOpen(true);
  };

  const insertVariable = (varKey: string) => {
    const textarea = textareaRef.current;
    const tag = `{{${varKey}}}`;
    if (!textarea) {
      setForm(f => ({ ...f, mensagem_waleads: f.mensagem_waleads + tag }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.mensagem_waleads;
    const newText = text.substring(0, start) + tag + text.substring(end);
    setForm(f => ({ ...f, mensagem_waleads: newText }));
    setTimeout(() => {
      textarea.focus();
      const pos = start + tag.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertCaptionVariable = (varKey: string) => {
    setForm(f => ({ ...f, waleads_media_caption: f.waleads_media_caption + `{{${varKey}}}` }));
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
      waleads_ativo: form.waleads_ativo,
      waleads_tipo: form.waleads_tipo,
      mensagem_waleads: form.mensagem_waleads || null,
      waleads_media_url: form.waleads_media_url || null,
      waleads_media_caption: form.waleads_media_caption || null,
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
        <div className="flex gap-4 text-[11px]">
          {r.manychat_ativo && (
            <span className="text-primary">✓ ManyChat: <span className="font-mono">{r.template_manychat || "—"}</span></span>
          )}
          {r.waleads_ativo && (
            <div className="flex items-start gap-2">
              {r.waleads_tipo !== "text" && r.waleads_media_url && (
                <WaLeadsMediaPreview tipo={r.waleads_tipo || "image"} url={r.waleads_media_url} compact />
              )}
              <div className="space-y-0.5">
                <span className="text-primary">
                  ✓ WaLeads ({WALEADS_TIPOS.find(t => t.value === r.waleads_tipo)?.label})
                </span>
                {r.waleads_tipo === "text" && r.mensagem_waleads && (
                  <div className="block">
                    <HighlightVariables text={r.mensagem_waleads.substring(0, 80) + (r.mensagem_waleads.length > 80 ? "…" : "")} />
                  </div>
                )}
                {r.waleads_tipo !== "text" && r.waleads_media_caption && (
                  <div className="block">
                    <HighlightVariables text={r.waleads_media_caption.substring(0, 60) + (r.waleads_media_caption.length > 60 ? "…" : "")} />
                  </div>
                )}
              </div>
            </div>
          )}
          {!r.manychat_ativo && !r.waleads_ativo && (
            <span className="text-muted-foreground">Nenhum canal ativo</span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando automações...</div>;

  return (
    <div className="space-y-4">
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
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

            {/* WaLeads */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">WaLeads</Label>
                <Switch checked={form.waleads_ativo} onCheckedChange={(v) => setForm({ ...form, waleads_ativo: v })} />
              </div>
              {form.waleads_ativo && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Tipo de Mensagem</Label>
                    <Select value={form.waleads_tipo} onValueChange={(v) => setForm({ ...form, waleads_tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WALEADS_TIPOS.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.waleads_tipo === "text" ? (
                    <div className="space-y-2">
                      <WaLeadsVariableBar onInsert={insertVariable} />
                      <div>
                        <Label className="text-xs">Mensagem</Label>
                        <Textarea
                          ref={textareaRef}
                          value={form.mensagem_waleads}
                          onChange={(e) => setForm({ ...form, mensagem_waleads: e.target.value })}
                          placeholder="Olá {{nome}}! Vi que se interessou pelo {{produto_interesse}}..."
                          rows={4}
                        />
                      </div>
                      {form.mensagem_waleads && (
                        <div className="p-2 bg-muted/50 rounded border">
                          <span className="text-[10px] text-muted-foreground block mb-1">Preview:</span>
                          <HighlightVariables text={form.mensagem_waleads} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">URL da mídia ({WALEADS_TIPOS.find(t => t.value === form.waleads_tipo)?.label})</Label>
                        <Input
                          value={form.waleads_media_url}
                          onChange={(e) => setForm({ ...form, waleads_media_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>

                      {form.waleads_media_url && (
                        <WaLeadsMediaPreview tipo={form.waleads_tipo} url={form.waleads_media_url} />
                      )}

                      <div className="space-y-2">
                        <WaLeadsVariableBar onInsert={insertCaptionVariable} />
                        <div>
                          <Label className="text-xs">Legenda (opcional)</Label>
                          <Input
                            value={form.waleads_media_caption}
                            onChange={(e) => setForm({ ...form, waleads_media_caption: e.target.value })}
                            placeholder="Confira {{nome}}! Novidades sobre {{produto_interesse}}"
                          />
                        </div>
                        {form.waleads_media_caption && (
                          <div className="p-2 bg-muted/50 rounded border">
                            <span className="text-[10px] text-muted-foreground block mb-1">Preview legenda:</span>
                            <HighlightVariables text={form.waleads_media_caption} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
