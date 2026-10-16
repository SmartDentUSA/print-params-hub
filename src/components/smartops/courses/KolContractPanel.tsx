import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Send, Plus, Eye, Ban, RefreshCw } from "lucide-react";

interface TeamMember { id: string; nome_completo: string | null; evolution_instance_name: string | null; evolution_phone: string | null; role: string | null }
interface Loan { id?: string; product_name: string; serial_number: string; released_at: string; returned_at?: string | null; value_brl: string; status: string }
interface Contract { id: string; number: string; status: string; pending_fields: string[]; body_rendered: string; created_at: string; sent_at: string | null; signed_at: string | null; wa_group_id: string | null; wa_group_error: string | null; adjust_notes: string | null }

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", ajuste_solicitado: "Ajuste solicitado",
  assinado: "Assinado", revogado: "Revogado",
};

const emptyLoan: Loan = { product_name: "", serial_number: "", released_at: "", value_brl: "", status: "emprestado" };

export default function KolContractPanel({ leadId, leadNome }: { leadId: string; leadNome: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [viewing, setViewing] = useState<Contract | null>(null);
  const [newLoan, setNewLoan] = useState<Loan>(emptyLoan);

  // Dados do contrato
  const [personType, setPersonType] = useState("PF");
  const [legalName, setLegalName] = useState(leadNome);
  const [document, setDocument] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [repName, setRepName] = useState("");
  const [repCpf, setRepCpf] = useState("");
  const [waInstance, setWaInstance] = useState("");
  const [waMembers, setWaMembers] = useState<string[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [pendingMember, setPendingMember] = useState("");

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("kol-contract", { body: { action, ...extra } });
    if (error) throw new Error((data as any)?.error ?? error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cada fonte carrega sozinha: falha no contrato não pode esvaziar vendedores/integrantes.
      const [c, l, tm] = await Promise.allSettled([
        call("list", { lead_id: leadId }),
        (supabase as any).from("kol_equipment_loans").select("*").eq("lead_id", leadId).order("created_at"),
        (supabase as any).from("team_members").select("id, nome_completo, evolution_instance_name, evolution_phone, role")
          .eq("ativo", true).order("nome_completo"),
      ]);
      if (c.status === "fulfilled") setContracts(c.value.contracts ?? []);
      else toast({ title: "Contrato indisponível", description: (c.reason as Error)?.message, variant: "destructive" });
      if (l.status === "fulfilled") setLoans(((l.value as any).data ?? []).map((x: any) => ({ ...x, value_brl: x.value_brl != null ? String(x.value_brl) : "", released_at: x.released_at?.slice(0, 10) ?? "" })));
      if (tm.status === "fulfilled") {
        if ((tm.value as any).error) toast({ title: "Erro ao carregar equipe", description: (tm.value as any).error.message, variant: "destructive" });
        setMembers((tm.value as any).data ?? []);
      }
    } catch (e: any) {
      toast({ title: "Erro ao carregar contrato", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [leadId, call, toast]);

  useEffect(() => { void load(); }, [load]);

  const latest = contracts[0] ?? null;
  const canGenerate = !latest || ["rascunho", "ajuste_solicitado", "revogado"].includes(latest.status);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await call("generate", {
        lead_id: leadId, person_type: personType, legal_name: legalName, document,
        pix_key: pixKey, rep_name: repName, rep_cpf: repCpf,
        wa_instance_name: waInstance, wa_group_members: waMembers, seller_team_member_id: sellerId,
      });
      if (r.pending_fields?.length) {
        toast({ title: "Rascunho gerado com pendências", description: r.pending_fields.join(", ") });
      } else {
        toast({ title: `Rascunho ${r.number} gerado` });
      }
      await load();
    } catch (e: any) {
      toast({ title: "Não foi possível gerar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const send = async (id: string) => {
    setBusy(true);
    try {
      const r = await call("send", { contract_id: id });
      toast({
        title: r.whatsapp_sent ? "Contrato enviado por WhatsApp" : "Contrato marcado como enviado",
        description: r.whatsapp_sent ? undefined : (r.send_error ?? "WhatsApp não enviado"),
        variant: r.whatsapp_sent ? "default" : "destructive",
      });
      await load();
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    const reason = prompt("Motivo da revogação:") ?? "";
    setBusy(true);
    try {
      await call("revoke", { contract_id: id, reason });
      toast({ title: "Contrato revogado" });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao revogar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const addLoan = async () => {
    if (!newLoan.product_name.trim()) return toast({ title: "Informe o equipamento", variant: "destructive" });
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("kol_equipment_loans").insert({
        lead_id: leadId,
        product_name: newLoan.product_name.trim(),
        serial_number: newLoan.serial_number.trim() || null,
        released_at: newLoan.released_at || null,
        value_brl: newLoan.value_brl ? Number(newLoan.value_brl) : null,
        status: "emprestado",
      });
      if (error) throw error;
      setNewLoan(emptyLoan);
      toast({ title: "Equipamento registrado" });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const markReturned = async (loan: Loan) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("kol_equipment_loans")
        .update({ status: "devolvido", returned_at: new Date().toISOString().slice(0, 10) }).eq("id", loan.id);
      if (error) throw error;
      toast({ title: "Devolução registrada" });
      await load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const toggleMember = (id: string) =>
    setWaMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const instances = Array.from(new Set(members.map((m) => m.evolution_instance_name).filter(Boolean))) as string[];

  if (loading) return <Card><CardContent className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando contrato…</CardContent></Card>;

  return (
    <div className="space-y-6">
      {/* Dados do contrato */}
      <Card>
        <CardHeader><CardTitle>Dados do contrato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Tipo de pessoa</Label>
            <Select value={personType} onValueChange={setPersonType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa física</SelectItem>
                <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{personType === "PF" ? "Nome completo (legal)" : "Razão social"}</Label>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div>
            <Label>{personType === "PF" ? "CPF" : "CNPJ"}</Label>
            <Input value={document} onChange={(e) => setDocument(e.target.value)} />
          </div>
          <div>
            <Label>Chave PIX</Label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
          </div>
          {personType !== "PF" && (
            <>
              <div>
                <Label>Representante legal</Label>
                <Input value={repName} onChange={(e) => setRepName(e.target.value)} />
              </div>
              <div>
                <Label>CPF do representante</Label>
                <Input value={repCpf} onChange={(e) => setRepCpf(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <Label>Instância de WhatsApp do grupo</Label>
            <Select value={waInstance} onValueChange={setWaInstance}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {instances.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vendedor responsável</Label>
            <Select value={sellerId} onValueChange={(v) => { setSellerId(v); setWaMembers((m) => (m.includes(v) ? m : [...m, v])); }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {members.filter((m) => String(m.role ?? "").toLowerCase() === "vendedor").map((m) => <SelectItem key={m.id} value={m.id}>{m.nome_completo ?? m.id.slice(0, 8)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label>Integrantes do grupo (entram como administradores)</Label>
            <div className="flex gap-2 mt-1">
              <Select value={pendingMember} onValueChange={setPendingMember}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um team member (qualquer departamento)..." /></SelectTrigger>
                <SelectContent>
                  {members.filter((m) => !waMembers.includes(m.id)).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome_completo ?? m.id.slice(0, 8)}{m.role ? ` · ${m.role}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!pendingMember}
                onClick={() => { toggleMember(pendingMember); setPendingMember(""); }}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {waMembers.map((id) => {
                const m = members.find((x) => x.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {m?.nome_completo ?? id.slice(0, 8)}{m?.role ? ` · ${m.role}` : ""}
                    <button type="button" className="ml-1" onClick={() => toggleMember(id)} aria-label="Remover">×</button>
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipamentos */}
      <Card>
        <CardHeader><CardTitle>Equipamentos em comodato</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loans.length === 0 && <p className="text-sm text-muted-foreground">Nenhum equipamento emprestado.</p>}
          {loans.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm border rounded-md p-2">
              <span className="font-medium">{l.product_name}</span>
              {l.serial_number && <Badge variant="outline">S/N {l.serial_number}</Badge>}
              {l.value_brl && <span>R$ {Number(l.value_brl).toFixed(2)}</span>}
              {l.released_at && <span className="text-muted-foreground">liberado em {l.released_at}</span>}
              <Badge variant={l.status === "emprestado" ? "secondary" : "outline"}>{l.status}</Badge>
              {l.status === "emprestado" && (
                <Button size="sm" variant="ghost" onClick={() => markReturned(l)} disabled={busy}>Registrar devolução</Button>
              )}
            </div>
          ))}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end border-t pt-3">
            <div className="md:col-span-2"><Label>Equipamento</Label><Input value={newLoan.product_name} onChange={(e) => setNewLoan({ ...newLoan, product_name: e.target.value })} placeholder="Ex.: Impressora 3D RayShape Edge Mini" /></div>
            <div><Label>Nº de série</Label><Input value={newLoan.serial_number} onChange={(e) => setNewLoan({ ...newLoan, serial_number: e.target.value })} /></div>
            <div><Label>Liberação</Label><Input type="date" value={newLoan.released_at} onChange={(e) => setNewLoan({ ...newLoan, released_at: e.target.value })} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" value={newLoan.value_brl} onChange={(e) => setNewLoan({ ...newLoan, value_brl: e.target.value })} /></div>
          </div>
          <Button size="sm" variant="outline" onClick={addLoan} disabled={busy}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar equipamento
          </Button>
        </CardContent>
      </Card>

      {/* Contrato */}
      <Card>
        <CardHeader><CardTitle>Contrato</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {latest ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{latest.number}</span>
                <Badge variant={latest.status === "assinado" ? "secondary" : latest.status === "revogado" ? "destructive" : "outline"}>
                  {STATUS_LABEL[latest.status] ?? latest.status}
                </Badge>
                {latest.signed_at && <span className="text-xs text-muted-foreground">assinado em {new Date(latest.signed_at).toLocaleString("pt-BR")}</span>}
                {latest.wa_group_id && <Badge variant="secondary">Grupo criado</Badge>}
                {latest.wa_group_error && <Badge variant="destructive" title={latest.wa_group_error}>Grupo pendente</Badge>}
              </div>
              {latest.status === "ajuste_solicitado" && latest.adjust_notes && (
                <p className="text-sm border-l-2 border-orange-400 pl-2">Ajuste pedido pelo KOL: {latest.adjust_notes}</p>
              )}
              {Array.isArray(latest.pending_fields) && latest.pending_fields.length > 0 && latest.status === "rascunho" && (
                <p className="text-sm text-orange-600">Pendências: {latest.pending_fields.join(", ")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewing(latest)}>
                  <Eye className="w-4 h-4 mr-2" /> Visualizar texto
                </Button>
                {canGenerate && (
                  <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Regerar rascunho
                  </Button>
                )}
                {(latest.status === "rascunho" || latest.status === "ajuste_solicitado") && (
                  <Button size="sm" onClick={() => send(latest.id)} disabled={busy}>
                    <Send className="w-4 h-4 mr-2" /> Enviar para aceite
                  </Button>
                )}
                {latest.status !== "revogado" && latest.status !== "assinado" && (
                  <Button size="sm" variant="ghost" onClick={() => revoke(latest.id)} disabled={busy}>
                    <Ban className="w-4 h-4 mr-2" /> Revogar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Nenhum contrato gerado para este profissional.</p>
              <Button size="sm" onClick={generate} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                Gerar rascunho do contrato
              </Button>
            </div>
          )}
          {contracts.length > 1 && (
            <p className="text-xs text-muted-foreground">{contracts.length - 1} contrato(s) anterior(es) no histórico.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-100">
          <DialogHeader><DialogTitle>{viewing?.number} — {STATUS_LABEL[viewing?.status ?? ""] ?? viewing?.status}</DialogTitle></DialogHeader>
          {viewing?.body_rendered && <ContractDocument body={viewing.body_rendered} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
