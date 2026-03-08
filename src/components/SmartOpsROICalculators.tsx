import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Calculator, Plus, Pencil, Trash2, Eye, TrendingUp, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";

interface ROICalculator {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: "rascunho" | "publicado";
  investimento_inicial: number;
  custo_terceirizado_peca: number;
  custo_operacional_peca: number;
  volume_mensal: number;
  created_at: string;
}

const TIPOS = [
  { value: "impressora_3d", label: "Impressora 3D" },
  { value: "scanner", label: "Scanner Intraoral" },
  { value: "software_cad", label: "Software CAD" },
  { value: "fluxo_completo", label: "Fluxo Digital Completo" },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").substring(0, 60);
}

function calcROI(calc: ROICalculator) {
  const economiaPorPeca = calc.custo_terceirizado_peca - calc.custo_operacional_peca;
  const economiaMensal = economiaPorPeca * calc.volume_mensal;
  const paybackMeses = economiaMensal > 0 ? calc.investimento_inicial / economiaMensal : Infinity;
  const roiAnual = calc.investimento_inicial > 0
    ? ((economiaMensal * 12 - calc.investimento_inicial) / calc.investimento_inicial) * 100
    : 0;
  return { economiaPorPeca, economiaMensal, paybackMeses, roiAnual };
}

function ROIPreview({ calc }: { calc: ROICalculator }) {
  const { economiaPorPeca, economiaMensal, paybackMeses, roiAnual } = calcROI(calc);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-3 text-center">
          <DollarSign className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-xs text-muted-foreground">Economia/peça</p>
          <p className="text-lg font-bold text-emerald-600">R$ {economiaPorPeca.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xs text-muted-foreground">Economia mensal</p>
          <p className="text-lg font-bold text-primary">R$ {economiaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-3 text-center">
          <Clock className="w-5 h-5 mx-auto text-amber-500 mb-1" />
          <p className="text-xs text-muted-foreground">Payback</p>
          <p className="text-lg font-bold text-amber-600">
            {paybackMeses === Infinity ? "—" : `${paybackMeses.toFixed(1)} meses`}
          </p>
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-3 text-center">
          <Calculator className="w-5 h-5 mx-auto text-purple-500 mb-1" />
          <p className="text-xs text-muted-foreground">ROI anual</p>
          <p className={`text-lg font-bold ${roiAnual >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {roiAnual.toFixed(0)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CalcFormDialog({
  open, onOpenChange, initialData, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData: ROICalculator | null;
  onSave: (c: ROICalculator) => void;
}) {
  const empty: ROICalculator = {
    id: crypto.randomUUID(), name: "", slug: "", type: "impressora_3d",
    status: "rascunho", investimento_inicial: 0, custo_terceirizado_peca: 0,
    custo_operacional_peca: 0, volume_mensal: 0, created_at: new Date().toISOString(),
  };
  const [form, setForm] = useState<ROICalculator>(initialData || empty);

  const set = (k: keyof ROICalculator, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const slug = form.slug || slugify(form.name);
    onSave({ ...form, slug });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            {initialData ? "Editar Calculadora" : "Nova Calculadora ROI"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => { set("name", e.target.value); if (!initialData) set("slug", slugify(e.target.value)); }} /></div>
            <div><Label>Slug (URL)</Label><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="roi-impressora-3d" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as "rascunho" | "publicado")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Valores padrão da calculadora</p>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Investimento inicial (R$)</Label><Input type="number" value={form.investimento_inicial || ""} onChange={(e) => set("investimento_inicial", Number(e.target.value))} /></div>
            <div><Label>Volume mensal (peças)</Label><Input type="number" value={form.volume_mensal || ""} onChange={(e) => set("volume_mensal", Number(e.target.value))} /></div>
            <div><Label>Custo terceirizado/peça (R$)</Label><Input type="number" value={form.custo_terceirizado_peca || ""} onChange={(e) => set("custo_terceirizado_peca", Number(e.target.value))} /></div>
            <div><Label>Custo operacional/peça (R$)</Label><Input type="number" value={form.custo_operacional_peca || ""} onChange={(e) => set("custo_operacional_peca", Number(e.target.value))} /></div>
          </div>

          <ROIPreview calc={form} />

          <Button onClick={handleSave} className="w-full">{initialData ? "Salvar alterações" : "Criar calculadora"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SmartOpsROICalculators() {
  const [calculators, setCalculators] = useState<ROICalculator[]>(() => {
    try {
      const stored = localStorage.getItem("roi_calculators");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ROICalculator | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const persist = (list: ROICalculator[]) => {
    setCalculators(list);
    localStorage.setItem("roi_calculators", JSON.stringify(list));
  };

  const handleSave = (calc: ROICalculator) => {
    const exists = calculators.find((c) => c.id === calc.id);
    if (exists) {
      persist(calculators.map((c) => (c.id === calc.id ? calc : c)));
      toast.success("Calculadora atualizada");
    } else {
      persist([...calculators, calc]);
      toast.success("Calculadora criada");
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    persist(calculators.filter((c) => c.id !== id));
    toast.success("Calculadora removida");
  };

  const previewCalc = useMemo(() => calculators.find((c) => c.id === previewId) || null, [calculators, previewId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Calculadoras ROI</h3>
          <p className="text-sm text-muted-foreground">Gerencie calculadoras interativas de retorno sobre investimento</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Calculadora
        </Button>
      </div>

      {calculators.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Calculator className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-medium">Nenhuma calculadora criada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie calculadoras de ROI para impressoras 3D, scanners, software CAD ou fluxo digital completo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px] text-right">Investimento</TableHead>
                <TableHead className="w-[100px] text-right">Payback</TableHead>
                <TableHead className="w-[80px] text-right">ROI</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculators.map((calc) => {
                const { paybackMeses, roiAnual } = calcROI(calc);
                return (
                  <TableRow key={calc.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{calc.name}</p>
                      <p className="text-xs text-muted-foreground">/f/{calc.slug}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TIPO_LABELS[calc.type] || calc.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={calc.status === "publicado" ? "default" : "secondary"}>
                        {calc.status === "publicado" ? "Publicado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      R$ {calc.investimento_inicial.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {paybackMeses === Infinity ? "—" : `${paybackMeses.toFixed(1)}m`}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${roiAnual >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {roiAnual.toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewId(previewId === calc.id ? null : calc.id)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(calc); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(calc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {previewCalc && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preview: {previewCalc.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ROIPreview calc={previewCalc} />
          </CardContent>
        </Card>
      )}

      <CalcFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        initialData={editing}
        onSave={handleSave}
      />
    </div>
  );
}
