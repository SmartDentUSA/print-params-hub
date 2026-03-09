import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Image } from "lucide-react";
import { toast } from "sonner";

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
}

const EMPTY_CARD: Omit<ROICard, "id"> = {
  name: "",
  slug: null,
  category: "combo",
  image_url: null,
  scan_time_manual: 15, scan_time_smart: 5,
  cad_time_manual: 20, cad_time_smart: 4,
  cad_cost_manual: 50, cad_cost_smart: 8,
  print_time_manual: 15, print_time_smart: 0.5,
  clean_time_manual: 10, clean_time_smart: 0.67,
  cure_time_manual: 15, cure_time_smart: 5,
  finish_time_manual: 30, finish_time_smart: 9,
  waste_pct_manual: 20, waste_pct_smart: 0,
  asb_scan: true, asb_cad: false, asb_print: true,
  asb_clean: true, asb_cure: true, asb_finish: true,
  preco_mercado: null, preco_combo: null, rendimento_unidades: null,
  investimento_inicial: 77900, faturamento_kit: 128524.82,
  status: "rascunho", active: true,
};

const STAGES = [
  { key: "scan", label: "Escaneamento" },
  { key: "cad", label: "CAD/Planejamento" },
  { key: "print", label: "Impressão" },
  { key: "clean", label: "Limpeza" },
  { key: "cure", label: "Pós-Cura" },
  { key: "finish", label: "Finalização" },
] as const;

export function SmartOpsROICardsManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ROICard | null>(null);
  const [form, setForm] = useState<Omit<ROICard, "id">>(EMPTY_CARD);
  const [uploading, setUploading] = useState(false);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["roi-cards-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roi_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ROICard[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (card: Omit<ROICard, "id"> & { id?: string }) => {
      const slug = card.slug || card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      const payload = { ...card, slug };
      if (card.id) {
        const { error } = await supabase.from("roi_cards").update(payload).eq("id", card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("roi_cards").insert(payload);
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
      qc.invalidateQueries({ queryKey: ["roi-cards-published"] });
      toast.success("Card excluído");
    },
  });

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

  const openCreate = () => { setEditing(null); setForm(EMPTY_CARD); setOpen(true); };
  const openEdit = (c: ROICard) => { setEditing(c); setForm({ ...c }); setOpen(true); };
  const handleSave = () => saveMutation.mutate(editing ? { ...form, id: editing.id } : form);

  const setNum = (key: string, val: string) => setForm(p => ({ ...p, [key]: val === "" ? null : Number(val) } as any));
  const setBool = (key: string, val: boolean) => setForm(p => ({ ...p, [key]: val } as any));

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
                  <TableCell>
                    <Badge variant={c.status === "publicado" ? "default" : "secondary"}>{c.status}</Badge>
                  </TableCell>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Card" : "Novo Card ROI"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Identity */}
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

            {/* Tempos por etapa */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Tempos por Etapa (min)</h4>
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
            </div>

            {/* Custos CAD + Desperdício */}
            <div className="grid gap-4 sm:grid-cols-2">
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

            {/* Financeiro */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Financeiro</h4>
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
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending || !form.name}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
