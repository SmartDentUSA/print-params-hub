import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SmartOpsSellerAutomations } from "./SmartOpsSellerAutomations";

interface TeamMember {
  id: string;
  role: string;
  nome_completo: string;
  email: string;
  whatsapp_number: string;
  piperun_owner_id: string | null;
  manychat_api_key: string | null;
  waleads_api_key: string | null;
  ativo: boolean;
}

export function SmartOpsTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ nome_completo: "", email: "", whatsapp_number: "", role: "vendedor", piperun_owner_id: "", manychat_api_key: "", waleads_api_key: "" });
  const { toast } = useToast();

  const fetchMembers = async () => {
    const { data } = await supabase.from("team_members").select("*").order("role").order("nome_completo");
    setMembers((data as TeamMember[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const openAdd = () => { setEditing(null); setForm({ nome_completo: "", email: "", whatsapp_number: "", role: "vendedor", piperun_owner_id: "", manychat_api_key: "", waleads_api_key: "" }); setDialogOpen(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setForm({ nome_completo: m.nome_completo, email: m.email, whatsapp_number: m.whatsapp_number, role: m.role, piperun_owner_id: m.piperun_owner_id || "", manychat_api_key: m.manychat_api_key || "", waleads_api_key: m.waleads_api_key || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.nome_completo || !form.email || !form.whatsapp_number) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    if (editing) {
      const { error } = await supabase.from("team_members").update(form).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("team_members").insert(form);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchMembers();
    toast({ title: editing ? "Membro atualizado" : "Membro adicionado" });
  };

  const toggleAtivo = async (m: TeamMember) => {
    await supabase.from("team_members").update({ ativo: !m.ativo }).eq("id", m.id);
    fetchMembers();
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando equipe...</div>;

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Equipe Smart Ops</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Membro" : "Novo Membro"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome Completo</Label><Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>WhatsApp (+55...)</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+5511999999999" /></div>
              <div><Label>ID Vendedor Piperun</Label><Input value={form.piperun_owner_id} onChange={(e) => setForm({ ...form, piperun_owner_id: e.target.value })} placeholder="Ex: 12345" /></div>
              <div>
                <Label>Função</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="cs">CS</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator className="my-2" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurações ManyChat</p>
              <div><Label>API Key ManyChat</Label><Input type="password" value={form.manychat_api_key} onChange={(e) => setForm({ ...form, manychat_api_key: e.target.value })} placeholder="Bearer token do ManyChat" /></div>
              <Separator className="my-2" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurações WaLeads</p>
              <div><Label>API Key WaLeads</Label><Input type="password" value={form.waleads_api_key} onChange={(e) => setForm({ ...form, waleads_api_key: e.target.value })} placeholder="API Key do ChatCenter/WaLeads" /></div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Piperun ID</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Integrações</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nome_completo}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell className="font-mono text-xs">{m.whatsapp_number}</TableCell>
                <TableCell className="font-mono text-xs">{m.piperun_owner_id || "—"}</TableCell>
                <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                <TableCell className="space-x-1">
                  {m.manychat_api_key ? <Badge className="bg-green-600 text-white text-[10px]">MC</Badge> : null}
                  {m.waleads_api_key ? <Badge className="bg-blue-600 text-white text-[10px]">WL</Badge> : null}
                  {!m.manychat_api_key && !m.waleads_api_key && <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell><Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m)} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Editar</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <SmartOpsSellerAutomations />
    </>
  );
}
