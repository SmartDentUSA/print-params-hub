import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Loader2, Trash2 } from "lucide-react";
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
  evolution_instance_name: string | null;
  messaging_provider: string | null;
  ativo: boolean;
}

const slugifyName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const EMPTY_FORM = {
  nome_completo: "",
  email: "",
  whatsapp_number: "",
  role: "vendedor",
  piperun_owner_id: "",
  manychat_api_key: "",
  waleads_api_key: "",
  evolution_instance_name: "",
  messaging_provider: "waleads",
};

type EvolutionStatus = "open" | "connecting" | "close" | "unknown";

function EvolutionStatusBadge({ status }: { status: EvolutionStatus }) {
  if (status === "open") return <Badge className="bg-green-600 text-white text-[10px]">🟢 Conectado</Badge>;
  if (status === "connecting") return <Badge className="bg-yellow-500 text-white text-[10px]">🟡 Aguardando QR</Badge>;
  return <Badge className="bg-red-600 text-white text-[10px]">🔴 Desconectado</Badge>;
}

export function SmartOpsTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const { toast } = useToast();

  // Evolution state
  const [evolutionStatus, setEvolutionStatus] = useState<EvolutionStatus>("unknown");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [evoConnecting, setEvoConnecting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  // WaLeads test state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testMember, setTestMember] = useState<TeamMember | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste do WaLeads. 🚀");
  const [testSending, setTestSending] = useState(false);

  const fetchMembers = async () => {
    const { data } = await supabase.from("team_members").select("*").order("role").order("nome_completo");
    setMembers((data as TeamMember[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setEvolutionStatus("unknown");
    setDialogOpen(true);
  };
  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setForm({
      nome_completo: m.nome_completo,
      email: m.email,
      whatsapp_number: m.whatsapp_number,
      role: m.role,
      piperun_owner_id: m.piperun_owner_id || "",
      manychat_api_key: m.manychat_api_key || "",
      waleads_api_key: m.waleads_api_key || "",
      evolution_instance_name: m.evolution_instance_name || "",
      messaging_provider: m.messaging_provider || "waleads",
    });
    setEvolutionStatus("unknown");
    setDialogOpen(true);
    // Fetch Evolution status
    if (m.evolution_instance_name) {
      fetchEvolutionStatus(m.id, m.evolution_instance_name);
    }
  };

  const fetchEvolutionStatus = async (memberId: string, instanceName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-evolution-manager", {
        body: { action: "get_status", instance_name: instanceName, member_id: memberId },
      });
      if (error) throw error;
      const state = (data?.state || data?.status || "close") as string;
      if (state === "open" || state === "connecting" || state === "close") {
        setEvolutionStatus(state);
      } else {
        setEvolutionStatus("unknown");
      }
    } catch {
      setEvolutionStatus("close");
    }
  };

  const handleNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      nome_completo: value,
      evolution_instance_name: f.evolution_instance_name || slugifyName(value),
    }));
  };

  const connectWhatsApp = async () => {
    // 1. Garantir instance_name (auto-slug do nome)
    let instanceName = form.evolution_instance_name?.trim() || "";
    if (!instanceName) {
      if (!form.nome_completo?.trim()) {
        toast({ title: "Preencha o nome do membro antes", variant: "destructive" });
        return;
      }
      instanceName = slugifyName(form.nome_completo);
      setForm((f) => ({ ...f, evolution_instance_name: instanceName }));
      // Persiste imediatamente se já existe membro
      if (editing?.id) {
        await supabase
          .from("team_members")
          .update({ evolution_instance_name: instanceName })
          .eq("id", editing.id);
      }
    }

    const memberId = editing?.id || null;
    stopPolling();
    setQrSrc(null);
    setQrError(null);
    setEvoConnecting(true);
    setQrModalOpen(true);

    try {
      // 2. Chamada com action: get_qr
      const { data, error } = await supabase.functions.invoke(
        "smart-ops-evolution-manager",
        { body: { action: "get_qr", instance_name: instanceName, member_id: memberId } },
      );
      if (error) throw error;

      // 3. Tratamento da resposta
      const state = data?.state as string | undefined;
      const qrcode = data?.qrcode as string | undefined;

      if (state === "open") {
        setEvolutionStatus("open");
        setEvoConnecting(false);
        setQrModalOpen(false);
        toast({ title: "✅ WhatsApp já conectado!" });
        return;
      }

      if (qrcode) {
        const src = qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`;
        setQrSrc(src);
        setEvolutionStatus("connecting");

        // 5. Polling get_status (3s, máx 5min)
        const startedAt = Date.now();
        pollingRef.current = setInterval(async () => {
          if (Date.now() - startedAt > 5 * 60 * 1000) {
            stopPolling();
            setEvoConnecting(false);
            toast({
              title: "Tempo esgotado",
              description: "QR expirou. Gere um novo.",
              variant: "destructive",
            });
            return;
          }
          try {
            const { data: stData } = await supabase.functions.invoke(
              "smart-ops-evolution-manager",
              { body: { action: "get_status", instance_name: instanceName, member_id: memberId } },
            );
            if (stData?.state === "open") {
              stopPolling();
              setEvolutionStatus("open");
              setEvoConnecting(false);
              setQrModalOpen(false);
              toast({ title: "✅ WhatsApp conectado!" });
            }
          } catch {/* keep polling */}
        }, 3000);
      } else {
        setQrError(`QR não retornado. Debug: ${JSON.stringify(data)}`);
        setEvoConnecting(false);
      }
    } catch (err) {
      setEvoConnecting(false);
      setQrError(`Erro ao conectar: ${String(err)}`);
    }
  };

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

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("team_members").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      const isFk = /foreign key|violates|referenced/i.test(error.message);
      toast({
        title: isFk ? "Não é possível excluir" : "Erro ao excluir",
        description: isFk
          ? "Este membro tem registros vinculados (deals, leads, etc). Desative-o em vez de excluir."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Membro excluído" });
    setDeleteTarget(null);
    fetchMembers();
  };

  const openTestWaLeads = (m: TeamMember) => {
    setTestMember(m);
    setTestPhone(m.whatsapp_number);
    setTestMessage("Olá! Esta é uma mensagem de teste do WaLeads. 🚀");
    setTestDialogOpen(true);
  };

  const handleTestSend = async () => {
    if (!testMember || !testPhone) return;
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-send-waleads", {
        body: {
          team_member_id: testMember.id,
          phone: testPhone,
          tipo: "text",
          message: testMessage,
          test_mode: true,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "✅ Mensagem enviada!", description: `Enviado para ${testPhone}` });
      } else {
        toast({ title: "⚠️ Falha no envio", description: data?.response || "Verifique a API Key", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally {
      setTestSending(false);
    }
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
              <div><Label>Nome Completo</Label><Input value={form.nome_completo} onChange={(e) => handleNameChange(e.target.value)} /></div>
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
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurações Evolution</p>
                <EvolutionStatusBadge status={evolutionStatus} />
              </div>
              <div>
                <Label>Nome da Instância</Label>
                <Input
                  value={form.evolution_instance_name}
                  onChange={(e) => setForm({ ...form, evolution_instance_name: e.target.value })}
                  placeholder="janaina_santos"
                />
              </div>
              <div>
                <Label>Provedor de mensagens</Label>
                <Select value={form.messaging_provider} onValueChange={(v) => setForm({ ...form, messaging_provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waleads">WaLeads</SelectItem>
                    <SelectItem value="evolution">Evolution API</SelectItem>
                    <SelectItem value="manychat">ManyChat</SelectItem>
                    <SelectItem value="none">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={connectWhatsApp} disabled={evoConnecting} className="w-full">
                📱 {evoConnecting ? "Conectando..." : "Conectar WhatsApp"}
              </Button>
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
                  {m.messaging_provider === "evolution" ? <Badge className="bg-purple-600 text-white text-[10px]">EV</Badge> : null}
                  {!m.manychat_api_key && !m.waleads_api_key && m.messaging_provider !== "evolution" && <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell><Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m)} /></TableCell>
                <TableCell className="space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Editar</Button>
                  {m.waleads_api_key && (
                    <Button variant="outline" size="sm" onClick={() => openTestWaLeads(m)}>
                      <Send className="w-3 h-3 mr-1" /> Testar WL
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(m)} title="Excluir membro">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    {/* WaLeads Test Dialog */}
    <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Testar Envio WaLeads — {testMember?.nome_completo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Telefone destino</Label>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+5511999999999" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={3} />
          </div>
          <Button onClick={handleTestSend} disabled={testSending} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            {testSending ? "Enviando..." : "Enviar teste"}
          </Button>
          <p className="text-xs text-muted-foreground">Modo teste: a mensagem será enviada e registrada nos logs com sufixo _test.</p>
        </div>
      </DialogContent>
    </Dialog>

    {/* Evolution QR Dialog */}
    <Dialog
      open={qrModalOpen}
      onOpenChange={(open) => {
        setQrModalOpen(open);
        if (!open) {
          stopPolling();
          setEvoConnecting(false);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp Evolution</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          {qrSrc ? (
            <>
              <img src={qrSrc} width={256} height={256} alt="QR WhatsApp" className="mx-auto" />
              <p className="text-sm text-muted-foreground">
                Escaneie com o WhatsApp do número <span className="font-mono">{form.whatsapp_number}</span>
              </p>
              <p className="text-xs text-muted-foreground">Aguardando confirmação… (até 5min)</p>
            </>
          ) : qrError ? (
            <p className="text-destructive text-sm break-all py-6">{qrError}</p>
          ) : (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="animate-spin h-4 w-4" />
              <span className="text-sm text-muted-foreground">Gerando QR code...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <SmartOpsSellerAutomations />
    </>
  );
}
