import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Sparkles, User, Building2, Briefcase, FileText } from "lucide-react";

type Sources = { person_data?: boolean; person_address?: boolean; company_data?: boolean; company_address?: boolean };

const PERSON_FIELDS = [
  ["nome", "Nome (CRM)"], ["pessoa_cpf", "CPF"], ["email", "E-mail"], ["telefone_raw", "Telefone"],
  ["pessoa_cargo", "Cargo"], ["pessoa_piperun_id", "Pessoa ID (PipeRun)"],
] as const;
const COMPANY_FIELDS = [
  ["empresa_razao_social", "Razão social"], ["empresa_nome", "Nome fantasia"], ["empresa_cnpj", "CNPJ"],
  ["empresa_ie", "Inscrição estadual"], ["empresa_email", "E-mail"], ["empresa_telefone", "Telefone"],
  ["empresa_piperun_id", "Organização ID (PipeRun)"],
] as const;
const ADDRESS_FIELDS = "pessoa_endereco, empresa_endereco, empresa_cidade, empresa_uf";

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const brl = (v?: number | null) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const addrText = (v: any) => (!v ? "" : typeof v === "string" ? v : Object.values(v).filter(Boolean).join(", "));

export default function ProfessionalCrmOverview({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const { toast } = useToast();
  const [lead, setLead] = useState<Record<string, any> | null>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [nfs, setNfs] = useState<any[]>([]);
  const [sources, setSources] = useState<Sources>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cols = [...PERSON_FIELDS, ...COMPANY_FIELDS].map(([k]) => k).join(", ");
      const { data } = await supabase.from("lia_attendances")
        .select(`id, ${cols}, ${ADDRESS_FIELDS}, prof_contract_sources, prof_ai_summary, prof_ai_summary_at` as any)
        .eq("id", leadId).is("merged_into", null).maybeSingle();
      const l: any = data;
      const orFilter = [`lead_id.eq.${leadId}`];
      const [d, n] = await Promise.all([
        supabase.from("deals").select("piperun_deal_id, deal_title, pipeline_name, stage_name, status, value, piperun_created_at, closed_at")
          .or(orFilter.join(",")).order("piperun_created_at", { ascending: false }).limit(100),
        supabase.from("omie_notas_fiscais").select("numero_nf, serie, data_emissao, valor_total, tipo_operacao, omie_pedido_id")
          .eq("lead_id", leadId).order("data_emissao", { ascending: false }).limit(100),
      ]);
      if (!alive) return;
      setLead(l ?? null);
      setSources((l?.prof_contract_sources as Sources) ?? {});
      setDeals(d.data ?? []);
      setNfs(n.data ?? []);
    })();
    return () => { alive = false; };
  }, [leadId]);

  if (!lead) return <Card><CardContent className="py-6 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Carregando dados do CRM…</CardContent></Card>;

  const set = (k: string, v: any) => setLead((p) => ({ ...(p ?? {}), [k]: v }));
  const hasCompany = !!(lead.empresa_cnpj || lead.empresa_razao_social || lead.empresa_piperun_id);
  const won = deals.filter((d) => /ganh|won/i.test(d.status ?? ""));

  const save = async () => {
    setSaving(true);
    const payload: any = { prof_contract_sources: sources };
    for (const [k] of [...PERSON_FIELDS, ...COMPANY_FIELDS]) {
      if (k === "pessoa_piperun_id" || k === "empresa_piperun_id") continue;
      payload[k] = lead[k] === "" ? null : lead[k];
    }
    payload.pessoa_endereco = lead.pessoa_endereco ?? null;
    payload.empresa_endereco = lead.empresa_endereco ?? null;
    if (payload.telefone_raw !== undefined) {
      const dg = String(payload.telefone_raw ?? "").replace(/\D/g, "");
      payload.telefone_normalized = dg ? (dg.startsWith("55") ? dg : `55${dg}`) : null;
    }
    const { error } = await supabase.from("lia_attendances").update(payload).eq("id", leadId);
    setSaving(false);
    toast(error ? { title: "Erro ao salvar", description: error.message, variant: "destructive" } : { title: "Dados do CRM salvos" });
  };

  const genSummary = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("prof-history-summary", { body: { lead_id: leadId } });
    setGenerating(false);
    if (error || (data as any)?.error) {
      toast({ title: "Não foi possível gerar o resumo", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    set("prof_ai_summary", (data as any).summary);
    set("prof_ai_summary_at", (data as any).generated_at);
  };

  const field = (k: string, label: string, readOnly = false) => (
    <div key={k}>
      <Label>{label}</Label>
      <Input value={lead[k] ?? ""} onChange={(e) => set(k, e.target.value)} disabled={disabled || readOnly} />
    </div>
  );
  const check = (k: keyof Sources, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={!!sources[k]} disabled={disabled} onCheckedChange={(v) => setSources((s) => ({ ...s, [k]: !!v }))} />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Pessoa (CRM)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PERSON_FIELDS.map(([k, l]) => field(k, l, k === "pessoa_piperun_id"))}
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={addrText(lead.pessoa_endereco)} onChange={(e) => set("pessoa_endereco", e.target.value)} disabled={disabled} />
          </div>
          <div className="flex flex-wrap gap-6">
            {check("person_data", "Usar estes dados no contrato")}
            {check("person_address", "Usar este endereço no contrato")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Organização vinculada</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!hasCompany && <p className="text-sm text-muted-foreground">Nenhuma organização (CNPJ) vinculada no CRM. Você pode preencher abaixo.</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {COMPANY_FIELDS.map(([k, l]) => field(k, l, k === "empresa_piperun_id"))}
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={[addrText(lead.empresa_endereco), lead.empresa_cidade, lead.empresa_uf].filter(Boolean).join(" · ")} onChange={(e) => set("empresa_endereco", e.target.value)} disabled={disabled} />
          </div>
          <div className="flex flex-wrap gap-6">
            {check("company_data", "Usar estes dados no contrato")}
            {check("company_address", "Usar este endereço no contrato")}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={disabled || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Salvar pessoa, organização e escolhas do contrato
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" />Negócios vinculados ({deals.length})</CardTitle></CardHeader>
        <CardContent>
          {deals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum negócio no CRM.</p> : (
            <div className="max-h-72 overflow-auto divide-y text-sm">
              {deals.map((d) => (
                <div key={d.piperun_deal_id} className="py-2 flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-medium">#{d.piperun_deal_id} · {d.deal_title ?? "—"}</span>
                  <span className="text-muted-foreground">{d.pipeline_name} › {d.stage_name}</span>
                  <Badge variant="outline">{d.status ?? "—"}</Badge>
                  <span>{brl(d.value)}</span>
                  <span className="text-muted-foreground">{fmtDate(d.piperun_created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Contratos de compra e notas fiscais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-medium mb-2">Contratos de compra (negócios ganhos)</p>
            {won.length === 0 ? <p className="text-muted-foreground">Sem registro.</p> : won.map((d) => (
              <div key={d.piperun_deal_id} className="flex justify-between py-1 border-b">
                <span>Nº {d.piperun_deal_id}</span><span className="text-muted-foreground">{fmtDate(d.closed_at)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="font-medium mb-2">NF-es</p>
            {nfs.length === 0 ? <p className="text-muted-foreground">Sem registro.</p> : nfs.map((n, i) => (
              <div key={`${n.numero_nf}-${i}`} className="flex justify-between py-1 border-b">
                <span>NF {n.numero_nf}{n.serie ? `/${n.serie}` : ""}</span>
                <span>{brl(n.valor_total)}</span>
                <span className="text-muted-foreground">{fmtDate(n.data_emissao)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Sparkles className="w-5 h-5" />Resumo por IA do histórico com a Smart Dent</span>
            <Button size="sm" variant="outline" onClick={genSummary} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {lead.prof_ai_summary ? "Gerar novamente" : "Gerar resumo"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lead.prof_ai_summary ? (
            <>
              <p className="whitespace-pre-wrap text-sm">{lead.prof_ai_summary}</p>
              <p className="text-[11px] text-muted-foreground mt-2">Gerado em {new Date(lead.prof_ai_summary_at).toLocaleString("pt-BR")} a partir da timeline, negócios, NF-es, indicações e eventos.</p>
            </>
          ) : <p className="text-sm text-muted-foreground">Clique em "Gerar resumo" para ver compras, indicações, eventos e redes sociais deste profissional.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
