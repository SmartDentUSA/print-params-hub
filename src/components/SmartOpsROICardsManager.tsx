import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Image, ChevronDown, Package, Monitor, FlaskConical, Printer, Zap, DollarSign } from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ROICard {
  id: string;
  name: string;
  slug: string | null;
  category: string;
  image_url: string | null;
  scan_time_manual: number;
  scan_time_smart: number;
  cad_time_manual: number;
  cad_time_smart: number;
  cad_cost_manual: number;
  cad_cost_smart: number;
  cam_time_manual: number;
  cam_time_smart: number;
  asb_cam: boolean;
  print_time_manual: number;
  print_time_smart: number;
  clean_time_manual: number;
  clean_time_smart: number;
  cure_time_manual: number;
  cure_time_smart: number;
  finish_time_manual: number;
  finish_time_smart: number;
  waste_pct_manual: number;
  waste_pct_smart: number;
  asb_scan: boolean;
  asb_cad: boolean;
  asb_print: boolean;
  asb_clean: boolean;
  asb_cure: boolean;
  asb_finish: boolean;
  preco_mercado: number | null;
  preco_combo: number | null;
  rendimento_unidades: number | null;
  investimento_inicial: number;
  faturamento_kit: number;
  status: string;
  active: boolean;
  resin_id: string | null;
  printer_model_id: string | null;
  cam_support_type: string;
  cam_support_time: number;
  cam_operator: string;
  workflow_descriptions: Record<string, { description?: string; operator?: string }>;
}

interface ComboItem {
  id: string;
  roi_card_id: string;
  description: string;
  investimento_fora_combo: number;
  investimento_com_combo: number;
  economia_imediata: number;
  sort_order: number;
}

interface CadType {
  id: string;
  roi_card_id: string;
  procedure_name: string;
  cad_manual_time: number;
  cad_manual_cost: number;
  cad_terceirizado_time: number;
  cad_terceirizado_cost: number;
  cad_ia_time: number;
  cad_ia_cost: number;
  cad_mentoria_cost: number;
  sort_order: number;
}

const EMPTY_CARD: Omit<ROICard, "id"> = {
  name: "", slug: null, category: "combo", image_url: null,
  scan_time_manual: 15, scan_time_smart: 5,
  cad_time_manual: 20, cad_time_smart: 4,
  cad_cost_manual: 50, cad_cost_smart: 8,
  cam_time_manual: 5, cam_time_smart: 0.5, asb_cam: true,
  print_time_manual: 15, print_time_smart: 0.5,
  clean_time_manual: 10, clean_time_smart: 0.67,
  cure_time_manual: 15, cure_time_smart: 5,
  finish_time_manual: 30, finish_time_smart: 9,
  waste_pct_manual: 20, waste_pct_smart: 0,
  asb_scan: true, asb_cad: false, asb_cam: true, asb_print: true,
  asb_clean: true, asb_cure: true, asb_finish: true,
  preco_mercado: null, preco_combo: null, rendimento_unidades: null,
  investimento_inicial: 77900, faturamento_kit: 128524.82,
  status: "rascunho", active: true,
  resin_id: null, printer_model_id: null,
  cam_support_type: "", cam_support_time: 0, cam_operator: "",
  workflow_descriptions: {},
};

const STAGES = [
  { key: "scan", label: "Escaneamento" },
  { key: "cad", label: "CAD Planejamento" },
  { key: "cam", label: "CAM Impressão" },
  { key: "print", label: "Impressão" },
  { key: "clean", label: "Limpeza Pós impressão" },
  { key: "cure", label: "Pós cura" },
  { key: "finish", label: "Finalização" },
] as const;

const DEFAULT_PROCEDURES = [
  "Coroas sobre dente", "Placas Miorrelaxantes", "Modelos ortodônticos",
  "Modelos para prótese", "Inlay/Onlay", "Facetas e Lentes",
  "Enceramento MOCKUP", "Coroas sobre Implante", "Protocolo sobre implante",
];

// ─── Main Component ──────────────────────────────────────────────────────────
export function SmartOpsROICardsManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ROICard | null>(null);
  const [form, setForm] = useState<Omit<ROICard, "id">>(EMPTY_CARD);
  const [uploading, setUploading] = useState(false);

  // Sub-entity states
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [cadTypes, setCadTypes] = useState<CadType[]>([]);
  const [resinPresentations, setResinPresentations] = useState<any[]>([]);

  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["roi-cards-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roi_cards").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ROICard[];
    },
  });

  const { data: resins = [] } = useQuery({
    queryKey: ["resins-list"],
    queryFn: async () => {
      const { data } = await supabase.from("resins").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: printerModels = [] } = useQuery({
    queryKey: ["models-list"],
    queryFn: async () => {
      const { data } = await supabase.from("models").select("id, name").order("name");
      return data || [];
    },
  });

  // ─── Load sub-entities when editing ──────────────────────────────────────
  const loadSubEntities = useCallback(async (cardId: string) => {
    const [itemsRes, cadRes] = await Promise.all([
      supabase.from("roi_card_items").select("*").eq("roi_card_id", cardId).order("sort_order"),
      supabase.from("roi_card_cad_types").select("*").eq("roi_card_id", cardId).order("sort_order"),
    ]);
    setComboItems((itemsRes.data as ComboItem[]) || []);
    setCadTypes((cadRes.data as CadType[]) || []);
  }, []);

  const loadResinPresentations = useCallback(async (resinId: string | null) => {
    if (!resinId) { setResinPresentations([]); return; }
    const { data } = await supabase.from("resin_presentations").select("*").eq("resin_id", resinId).order("sort_order");
    setResinPresentations(data || []);
  }, []);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (card: Omit<ROICard, "id"> & { id?: string }) => {
      const slug = card.slug || card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      const payload = { ...card, slug };
      if (card.id) {
        const { error } = await supabase.from("roi_cards").update(payload as any).eq("id", card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("roi_cards").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roi-cards-admin"] });
      qc.invalidateQueries({ queryKey: ["roi-cards-published"] });
      toast.success("Card salvo!");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roi_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roi-cards-admin"] });
      toast.success("Card excluído");
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `roi-cards/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("catalog-images").upload(path, file);
    if (error) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("catalog-images").getPublicUrl(path);
    setForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
    setUploading(false);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_CARD); setComboItems([]); setCadTypes([]); setResinPresentations([]); setOpen(true); };
  const openEdit = (c: ROICard) => {
    setEditing(c);
    setForm({ ...c, workflow_descriptions: (c.workflow_descriptions as any) || {} });
    loadSubEntities(c.id);
    loadResinPresentations(c.resin_id);
    setOpen(true);
  };
  const handleSave = () => saveMutation.mutate(editing ? { ...form, id: editing.id } : form);

  const setNum = (key: string, val: string) => setForm(p => ({ ...p, [key]: val === "" ? null : Number(val) } as any));
  const setBool = (key: string, val: boolean) => setForm(p => ({ ...p, [key]: val } as any));

  // Debounced sub-entity update
  const debouncedUpdate = (table: string, id: string, updates: Record<string, any>) => {
    const k = `${table}-${id}`;
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(async () => {
      await supabase.from(table as any).update(updates).eq("id", id);
    }, 600);
  };

  // ─── Combo Items CRUD ────────────────────────────────────────────────────
  const addComboItem = async () => {
    if (!editing) return;
    const { data, error } = await supabase.from("roi_card_items").insert({ roi_card_id: editing.id, sort_order: comboItems.length } as any).select().single();
    if (error) { toast.error(error.message); return; }
    setComboItems(prev => [...prev, data as ComboItem]);
  };

  const updateComboItem = (idx: number, field: string, val: string) => {
    setComboItems(prev => {
      const updated = [...prev];
      const numVal = field === "description" ? val : Number(val) || 0;
      (updated[idx] as any)[field] = numVal;
      // Auto-calc economia
      if (field !== "description") {
        updated[idx].economia_imediata = updated[idx].investimento_fora_combo - updated[idx].investimento_com_combo;
      }
      debouncedUpdate("roi_card_items", updated[idx].id, {
        [field]: numVal,
        economia_imediata: updated[idx].economia_imediata,
      });
      return updated;
    });
  };

  const deleteComboItem = async (id: string) => {
    await supabase.from("roi_card_items").delete().eq("id", id);
    setComboItems(prev => prev.filter(i => i.id !== id));
  };

  // ─── CAD Types CRUD ──────────────────────────────────────────────────────
  const addCadType = async (procName: string) => {
    if (!editing) return;
    const { data, error } = await supabase.from("roi_card_cad_types").insert({ roi_card_id: editing.id, procedure_name: procName, sort_order: cadTypes.length } as any).select().single();
    if (error) { toast.error(error.message); return; }
    setCadTypes(prev => [...prev, data as CadType]);
  };

  const seedAllProcedures = async () => {
    if (!editing) return;
    for (const proc of DEFAULT_PROCEDURES) {
      if (!cadTypes.find(c => c.procedure_name === proc)) {
        await addCadType(proc);
      }
    }
  };

  const updateCadType = (idx: number, field: string, val: string) => {
    setCadTypes(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = field === "procedure_name" ? val : Number(val) || 0;
      debouncedUpdate("roi_card_cad_types", updated[idx].id, { [field]: (updated[idx] as any)[field] });
      return updated;
    });
  };

  const deleteCadType = async (id: string) => {
    await supabase.from("roi_card_cad_types").delete().eq("id", id);
    setCadTypes(prev => prev.filter(i => i.id !== id));
  };

  // ─── Workflow descriptions ───────────────────────────────────────────────
  const setWorkflowField = (stageKey: string, field: "description" | "operator", val: string) => {
    setForm(prev => ({
      ...prev,
      workflow_descriptions: {
        ...prev.workflow_descriptions,
        [stageKey]: { ...(prev.workflow_descriptions?.[stageKey] || {}), [field]: val },
      },
    }));
  };

  // ─── Collapsible Section Helper ──────────────────────────────────────────
  const Section = ({ icon: Icon, title, children, defaultOpen = false }: { icon: any; title: string; children: React.ReactNode; defaultOpen?: boolean }) => (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 font-semibold text-sm hover:text-primary transition-colors group">
        <Icon className="w-4 h-4 text-primary" />
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  // Combo totals
  const totalFora = comboItems.reduce((s, i) => s + (i.investimento_fora_combo || 0), 0);
  const totalCom = comboItems.reduce((s, i) => s + (i.investimento_com_combo || 0), 0);
  const totalEconomia = totalFora - totalCom;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Gerenciador de Cards ROI</CardTitle>
        <Button onClick={openCreate} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Card</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Investimento</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {c.image_url && <img src={c.image_url} className="w-8 h-8 rounded object-cover" alt="" />}
                    {c.name}
                  </TableCell>
                  <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                  <TableCell><Badge variant={c.status === "publicado" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell>R$ {Number(c.investimento_inicial).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {cards.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum card cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* ─── Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Card" : "Novo Card ROI"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">

            {/* ── Seção 1: Identidade ── */}
            <Section icon={Package} title="Identidade" defaultOpen>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Combo High-End RayShape" />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scanner">Scanner</SelectItem>
                      <SelectItem value="printer">Impressora</SelectItem>
                      <SelectItem value="resin">Insumo</SelectItem>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="combo">Combo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="publicado">Publicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Imagem</Label>
                  <div className="flex items-center gap-2">
                    {form.image_url && <img src={form.image_url} className="w-10 h-10 rounded object-cover" alt="" />}
                    <label className="cursor-pointer inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      <Image className="w-4 h-4" /> {uploading ? "Enviando..." : "Upload"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Seção 2: Produtos do Combo ── */}
            {editing && (
              <Section icon={Package} title="📦 Produtos do Combo">
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Descrição</th>
                        <th className="text-center p-2 whitespace-nowrap">Invest. Fora (R$)</th>
                        <th className="text-center p-2 whitespace-nowrap">Invest. Combo (R$)</th>
                        <th className="text-center p-2">Economia</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comboItems.map((item, idx) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-1"><Input className="h-8" value={item.description} onChange={e => updateComboItem(idx, "description", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-8 text-center" value={item.investimento_fora_combo || ""} onChange={e => updateComboItem(idx, "investimento_fora_combo", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-8 text-center" value={item.investimento_com_combo || ""} onChange={e => updateComboItem(idx, "investimento_com_combo", e.target.value)} /></td>
                          <td className="p-1 text-center font-medium text-green-600">R$ {(item.economia_imediata || 0).toLocaleString("pt-BR")}</td>
                          <td className="p-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteComboItem(item.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 font-semibold text-sm">
                      <tr>
                        <td className="p-2">TOTAL</td>
                        <td className="p-2 text-center">R$ {totalFora.toLocaleString("pt-BR")}</td>
                        <td className="p-2 text-center">R$ {totalCom.toLocaleString("pt-BR")}</td>
                        <td className="p-2 text-center text-green-600">R$ {totalEconomia.toLocaleString("pt-BR")}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Button variant="outline" size="sm" onClick={addComboItem} className="gap-1"><Plus className="w-3 h-3" /> Adicionar Item</Button>
              </Section>
            )}

            {/* ── Seção 3: Seleção de CAD ── */}
            {editing && (
              <Section icon={Monitor} title="🖥️ Selecione o CAD">
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Procedimento</th>
                        <th className="text-center p-1">Manual (min)</th>
                        <th className="text-center p-1">Manual (R$)</th>
                        <th className="text-center p-1">Terc. (min)</th>
                        <th className="text-center p-1">Terc. (R$)</th>
                        <th className="text-center p-1">IA (min)</th>
                        <th className="text-center p-1">IA (R$)</th>
                        <th className="text-center p-1">Mentoria (R$)</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cadTypes.map((cad, idx) => (
                        <tr key={cad.id} className="border-t">
                          <td className="p-1"><Input className="h-7 text-xs" value={cad.procedure_name} onChange={e => updateCadType(idx, "procedure_name", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_manual_time || ""} onChange={e => updateCadType(idx, "cad_manual_time", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_manual_cost || ""} onChange={e => updateCadType(idx, "cad_manual_cost", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_terceirizado_time || ""} onChange={e => updateCadType(idx, "cad_terceirizado_time", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_terceirizado_cost || ""} onChange={e => updateCadType(idx, "cad_terceirizado_cost", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_ia_time || ""} onChange={e => updateCadType(idx, "cad_ia_time", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_ia_cost || ""} onChange={e => updateCadType(idx, "cad_ia_cost", e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 text-xs text-center" value={cad.cad_mentoria_cost || ""} onChange={e => updateCadType(idx, "cad_mentoria_cost", e.target.value)} /></td>
                          <td className="p-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteCadType(cad.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addCadType("")} className="gap-1"><Plus className="w-3 h-3" /> Adicionar</Button>
                  {cadTypes.length === 0 && (
                    <Button variant="secondary" size="sm" onClick={seedAllProcedures}>Carregar 9 procedimentos padrão</Button>
                  )}
                </div>
              </Section>
            )}

            {/* ── Seção 4: Resina do Combo ── */}
            <Section icon={FlaskConical} title="🧪 Resina do Combo">
              <div className="space-y-2">
                <Select value={form.resin_id || ""} onValueChange={v => { setForm(p => ({ ...p, resin_id: v || null })); loadResinPresentations(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a resina" /></SelectTrigger>
                  <SelectContent>
                    {resins.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {resinPresentations.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Apresentação</th>
                          <th className="text-center p-2">Preço</th>
                          <th className="text-center p-2">R$/g</th>
                          <th className="text-center p-2">Tipo Impressão</th>
                          <th className="text-center p-2">g/impressão</th>
                          <th className="text-center p-2">Impressões/frasco</th>
                          <th className="text-center p-2">Custo/impressão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resinPresentations.map((p: any) => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">{p.label}</td>
                            <td className="p-2 text-center">R$ {Number(p.price || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">R$ {Number(p.price_per_gram || 0).toFixed(4)}</td>
                            <td className="p-2 text-center">{p.print_type}</td>
                            <td className="p-2 text-center">{p.grams_per_print}</td>
                            <td className="p-2 text-center">{p.prints_per_bottle}</td>
                            <td className="p-2 text-center">R$ {Number(p.cost_per_print || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Seção 5: CAM & Impressora ── */}
            <Section icon={Printer} title="🖨️ CAM & Impressora">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tipo inserção de suportes</Label>
                  <Input value={form.cam_support_type} onChange={e => setForm(p => ({ ...p, cam_support_type: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Tempo para suportes (min)</Label>
                  <Input type="number" value={form.cam_support_time || ""} onChange={e => setNum("cam_support_time", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Operador</Label>
                  <Input value={form.cam_operator} onChange={e => setForm(p => ({ ...p, cam_operator: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Impressora</Label>
                  <Select value={form.printer_model_id || ""} onValueChange={v => setForm(p => ({ ...p, printer_model_id: v || null }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                    <SelectContent>
                      {printerModels.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            {/* ── Seção 6: Workflow por Etapa ── */}
            <Section icon={Zap} title="⚡ Workflow por Etapa">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Etapa</th>
                      <th className="text-center p-2">Manual</th>
                      <th className="text-center p-2">Smart</th>
                      <th className="text-center p-2">ASB?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAGES.map(s => (
                      <tr key={s.key} className="border-t">
                        <td className="p-2 font-medium">{s.label}</td>
                        <td className="p-2"><Input type="number" className="h-8 text-center" value={(form as any)[`${s.key}_time_manual`] ?? ""} onChange={e => setNum(`${s.key}_time_manual`, e.target.value)} /></td>
                        <td className="p-2"><Input type="number" className="h-8 text-center" value={(form as any)[`${s.key}_time_smart`] ?? ""} onChange={e => setNum(`${s.key}_time_smart`, e.target.value)} /></td>
                        <td className="p-2 text-center"><Switch checked={(form as any)[`asb_${s.key}`]} onCheckedChange={v => setBool(`asb_${s.key}`, v)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 mt-3">
                <h4 className="text-xs font-semibold text-muted-foreground">Descrições e Operadores por Etapa</h4>
                {STAGES.map(s => (
                  <div key={s.key} className="grid gap-2 sm:grid-cols-[1fr_1fr] border rounded-md p-2">
                    <div>
                      <Label className="text-xs">{s.label} — Descrição</Label>
                      <Textarea className="h-16 text-xs" value={form.workflow_descriptions?.[s.key]?.description || ""} onChange={e => setWorkflowField(s.key, "description", e.target.value)} placeholder="Descrição do processo..." />
                    </div>
                    <div>
                      <Label className="text-xs">{s.label} — Operador</Label>
                      <Input className="h-8 text-xs" value={form.workflow_descriptions?.[s.key]?.operator || ""} onChange={e => setWorkflowField(s.key, "operator", e.target.value)} placeholder="Ex: Qualquer operador" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Custos CAD + Desperdício */}
              <div className="grid gap-4 sm:grid-cols-2 mt-3">
                <div className="space-y-1">
                  <Label>Custo CAD Manual (R$)</Label>
                  <Input type="number" value={form.cad_cost_manual ?? ""} onChange={e => setNum("cad_cost_manual", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Custo CAD Smart (R$)</Label>
                  <Input type="number" value={form.cad_cost_smart ?? ""} onChange={e => setNum("cad_cost_smart", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Desperdício Manual (%)</Label>
                  <Input type="number" value={form.waste_pct_manual ?? ""} onChange={e => setNum("waste_pct_manual", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Desperdício Smart (%)</Label>
                  <Input type="number" value={form.waste_pct_smart ?? ""} onChange={e => setNum("waste_pct_smart", e.target.value)} />
                </div>
              </div>
            </Section>

            {/* ── Seção 7: Financeiro ── */}
            <Section icon={DollarSign} title="💰 Financeiro">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Investimento Inicial (R$)</Label>
                  <Input type="number" value={form.investimento_inicial ?? ""} onChange={e => setNum("investimento_inicial", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Faturamento Kit (R$)</Label>
                  <Input type="number" value={form.faturamento_kit ?? ""} onChange={e => setNum("faturamento_kit", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Preço Mercado (R$)</Label>
                  <Input type="number" value={form.preco_mercado ?? ""} onChange={e => setNum("preco_mercado", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Preço Combo (R$)</Label>
                  <Input type="number" value={form.preco_combo ?? ""} onChange={e => setNum("preco_combo", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Rendimento (unidades)</Label>
                  <Input type="number" value={form.rendimento_unidades ?? ""} onChange={e => setNum("rendimento_unidades", e.target.value)} />
                </div>
              </div>
            </Section>

            <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending || !form.name}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
