import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface Rule {
  id: string;
  produto_interesse: string | null;
  trigger_event: string | null;
  delay_days: number | null;
  tipo: string | null;
  template_manychat: string | null;
  ativo: boolean;
}

export function SmartOpsCSRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({ produto_interesse: "", trigger_event: "ganho", delay_days: "3", tipo: "text", template_manychat: "" });
  const { toast } = useToast();

  const fetchRules = async () => {
    const { data } = await supabase.from("cs_automation_rules").select("*").order("produto_interesse").order("delay_days");
    setRules((data as Rule[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const openAdd = () => { setEditing(null); setForm({ produto_interesse: "", trigger_event: "ganho", delay_days: "3", tipo: "text", template_manychat: "" }); setDialogOpen(true); };
  const openEdit = (r: Rule) => { setEditing(r); setForm({ produto_interesse: r.produto_interesse || "", trigger_event: r.trigger_event || "ganho", delay_days: String(r.delay_days || 0), tipo: r.tipo || "text", template_manychat: r.template_manychat || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    const payload = { produto_interesse: form.produto_interesse, trigger_event: form.trigger_event, delay_days: parseInt(form.delay_days), tipo: form.tipo, template_manychat: form.template_manychat };
    if (editing) {
      const { error } = await supabase.from("cs_automation_rules").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("cs_automation_rules").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchRules();
    toast({ title: editing ? "Regra atualizada" : "Regra adicionada" });
  };

  const toggleAtivo = async (r: Rule) => {
    await supabase.from("cs_automation_rules").update({ ativo: !r.ativo }).eq("id", r.id);
    fetchRules();
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando regras...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Réguas CS (Automações)</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Nova Regra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Regra" : "Nova Regra CS"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Produto</Label><Input value={form.produto_interesse} onChange={(e) => setForm({ ...form, produto_interesse: e.target.value })} placeholder="Vitality, EdgeMini..." /></div>
              <div><Label>Trigger Event</Label><Input value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })} placeholder="ganho" /></div>
              <div><Label>Delay (dias)</Label><Input type="number" value={form.delay_days} onChange={(e) => setForm({ ...form, delay_days: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Template ManyChat</Label><Input value={form.template_manychat} onChange={(e) => setForm({ ...form, template_manychat: e.target.value })} placeholder="vitality_boas_vindas" /></div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Delay</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.produto_interesse}</TableCell>
                <TableCell>{r.trigger_event}</TableCell>
                <TableCell>{r.delay_days} dias</TableCell>
                <TableCell>{r.tipo}</TableCell>
                <TableCell className="font-mono text-xs">{r.template_manychat}</TableCell>
                <TableCell><Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Editar</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
