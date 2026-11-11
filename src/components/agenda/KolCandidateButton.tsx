import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Briefcase, Building2, CheckCircle2, Loader2, Search, User, UserPlus, XCircle } from "lucide-react";
import { CrmLeadSummary } from "./CrmLeadSummary";
import { call, RecordCard, type Bootstrap, type Found } from "./CrmInsertionButton";
import { cn } from "@/lib/utils";

type KolFound = Found & {
  resolved_phone: string;
  searched_by: "phone" | "crm_id";
  kol: { is_kol: boolean; contract: { number: string | null; status: string } | null; registration: { piperun_deal_id: number | null; wa_group_jid: string | null; wa_message_sent_at: string | null; created_at: string } | null } | null;
};
type Step = { step: string; ok: boolean; detail: string };
type Result = { ok: boolean; nome?: string; deal_id?: number | null; origin?: string; steps?: Step[]; error?: string };
type FormState = { nome: string; email: string; area_atuacao: string; especialidade: string; empresa_nome: string; empresa_cnpj: string };
const EMPTY: FormState = { nome: "", email: "", area_atuacao: "", especialidade: "", empresa_nome: "", empresa_cnpj: "" };

const STEP_LABEL: Record<string, string> = {
  ficha: "Ficha do profissional (Cursos > KOLs)", portal: "Link do Portal do Profissional Parceiro", crm: "CRM",
  crm_pessoa: "Pessoa no CRM", crm_deal: "Negócio no funil KOL", grupo: "Grupo de WhatsApp", mensagem: "Mensagem da Beatriz", crm_nota: "Nota no negócio",
};

export function KolCandidateButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<KolFound | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [base, setBase] = useState<{ kind: string; id: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const boot = useQuery({ queryKey: ["crm-insercao-bootstrap"], enabled: open, staleTime: 5 * 60_000, queryFn: () => call<Bootstrap>("bootstrap") });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const pick = (list: string[] | undefined, v?: string | null) => (v && list?.includes(v) ? v : "");

  const search = async () => {
    setSearchError(""); setResult(null); setFound(null); setBase(null);
    setSearching(true);
    try {
      const r = await call<KolFound>("kol_search", { query });
      setFound(r);
      setPhone(r.resolved_phone.replace(/\D/g, ""));
    } catch (e) { setSearchError((e as Error).message); }
    finally { setSearching(false); }
  };

  const useLead = (l: any) => {
    setBase({ kind: "ficha", id: l.id });
    setForm((f) => ({
      ...f, nome: l.nome ?? f.nome, email: l.email ?? f.email,
      area_atuacao: pick(boot.data?.options.area_atuacao, l.area_atuacao) || f.area_atuacao,
      especialidade: pick(boot.data?.options.especialidade, l.especialidade) || f.especialidade,
      empresa_nome: l.empresa_nome ?? f.empresa_nome, empresa_cnpj: l.empresa_cnpj ?? f.empresa_cnpj,
    }));
  };
  const usePerson = (p: any) => {
    setBase({ kind: "pessoa", id: String(p.piperun_person_id) });
    setForm((f) => ({
      ...f, nome: p.nome ?? f.nome, email: p.email ?? f.email,
      area_atuacao: pick(boot.data?.options.area_atuacao, p.area_atuacao) || f.area_atuacao,
      especialidade: pick(boot.data?.options.especialidade, p.especialidade) || f.especialidade,
      empresa_nome: p.empresa_nome ?? f.empresa_nome,
    }));
  };
  const useCompany = (c: any) => {
    setBase({ kind: "organizacao", id: String(c.piperun_company_id) });
    setForm((f) => ({ ...f, empresa_nome: c.nome_fantasia || c.nome || c.razao_social || f.empresa_nome, empresa_cnpj: c.cnpj ?? f.empresa_cnpj }));
  };

  const signed = found?.kol?.contract?.status === "assinado";
  const canSubmit = !!(phone.length >= 10 && form.nome.trim() && form.area_atuacao && form.especialidade) && !signed;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setResult(null);
    try {
      const r = await call<Result>("kol_submit", {
        data: { nome: form.nome, telefone: phone, email: form.email || "", area_atuacao: form.area_atuacao, especialidade: form.especialidade, empresa_nome: form.empresa_nome || null, empresa_cnpj: form.empresa_cnpj || null, base },
      });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["crm-insercao-bootstrap"] });
    } catch (e) { setResult({ ok: false, error: (e as Error).message }); }
    finally { setSubmitting(false); }
  };

  const reset = () => { setForm(EMPTY); setFound(null); setQuery(""); setPhone(""); setBase(null); setResult(null); };

  return (
    <>
      <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Inscrição Kols
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inscrição Kols</DialogTitle>
            <DialogDescription>Busque o candidato pelo celular ou ID do CRM, confira os dados e envie para validação do Marketing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {boot.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {boot.error && <p className="text-sm text-destructive">{(boot.error as Error).message}</p>}
            {boot.data && (
              <>
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Celular ou ID do CRM do candidato</p>
                  <div className="flex gap-2">
                    <Input value={query} onChange={(e) => setQuery(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} inputMode="numeric" placeholder="55xxxxxxxxxxx ou ID do CRM" className="h-9" onKeyDown={(e) => e.key === "Enter" && search()} />
                    <Button type="button" className="h-9 gap-1" onClick={search} disabled={searching || query.length < 4}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
                    </Button>
                  </div>
                  {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                  {found && (
                    <div className="space-y-2">
                      {found.searched_by === "crm_id" && <p className="text-xs text-muted-foreground">Celular encontrado pelo ID do CRM: <b>{found.resolved_phone}</b></p>}
                      {signed && (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          <span>Este profissional já é KOL com contrato assinado ({found.kol?.contract?.number ?? "sem número"}).</span>
                        </div>
                      )}
                      {!signed && found.kol?.registration && (
                        <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                          <span>Já inscrito como candidato em {new Date(found.kol.registration.created_at).toLocaleDateString("pt-BR")}{found.kol.registration.piperun_deal_id ? ` · negócio #${found.kol.registration.piperun_deal_id}` : ""}. Enviar de novo refaz só as etapas que falharam.</span>
                        </div>
                      )}
                      {found.alerts.map((a) => (
                        <div key={a.deal_id} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                          <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>Em negociação com <b>{a.owner_name}</b> ({a.pipeline} / {a.stage}). A inscrição KOL não altera esse negócio.</span>
                        </div>
                      ))}
                      {(found.leads.length > 0 || found.deals.length > 0) && (
                        <CrmLeadSummary lead={found.leads[0] ?? null} person={found.persons[0] ?? null} deals={found.deals} conversions={found.conversions ?? []} extras={found.extras} />
                      )}
                      {!found.leads.length && !found.persons.length && !found.companies.length && (
                        <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado — preencha os dados do candidato abaixo.</p>
                      )}
                      {found.leads.map((l) => (
                        <RecordCard key={`l-${l.id}`} icon={<User className="h-4 w-4" />} title={`Ficha: ${l.nome ?? "sem nome"}`} badge={l.doc?.badge}
                          lines={[l.doc?.label, [l.telefone_normalized, l.email].filter(Boolean).join(" · "), [l.area_atuacao, l.especialidade].filter(Boolean).join(" · ")]}
                          onUse={() => useLead(l)} />
                      ))}
                      {found.persons.map((p) => (
                        <RecordCard key={`p-${p.piperun_person_id}`} icon={<User className="h-4 w-4" />} title={`Pessoa: ${p.nome ?? "sem nome"}`} badge={p.doc?.badge}
                          lines={[p.doc?.label, `CRM #${p.piperun_person_id}`, [p.telefone_principal, p.email].filter(Boolean).join(" · "), p.empresa_nome ? `Empresa: ${p.empresa_nome}` : null]}
                          onUse={() => usePerson(p)} />
                      ))}
                      {found.companies.map((c) => (
                        <RecordCard key={`c-${c.piperun_company_id}`} icon={<Building2 className="h-4 w-4" />} title={`Organização: ${c.nome_fantasia || c.nome || c.razao_social || "sem nome"}`} badge={c.doc?.badge}
                          lines={[c.doc?.label, [c.cidade, c.uf].filter(Boolean).join("/")]} onUse={() => useCompany(c)} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Dados do candidato {base && <Badge variant="outline" className="ml-1 text-[10px]">dados de {base.kind} #{base.id}</Badge>}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label>Nome</Label><Input className="h-9" value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Celular</Label><Input className="h-9" value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} /></div>
                    <div className="space-y-1"><Label>E-mail</Label><Input className="h-9" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                    <div className="space-y-1">
                      <Label>Área de atuação</Label>
                      <Select value={form.area_atuacao} onValueChange={(v) => set("area_atuacao", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{boot.data.options.area_atuacao.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Especialidade</Label>
                      <Select value={form.especialidade} onValueChange={(v) => set("especialidade", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{boot.data.options.especialidade.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Empresa</Label><Input className="h-9" value={form.empresa_nome} onChange={(e) => set("empresa_nome", e.target.value)} /></div>
                  </div>
                  <p className="text-xs">Origem no CRM: <b>Indicação - {boot.data.me.nome}</b> · funil KOL, etapa Interessados</p>
                </section>

                {result && (
                  <div className={cn("space-y-2 rounded-lg border p-3 text-sm", result.error ? "border-destructive/40 bg-destructive/10" : result.ok ? "border-primary/40 bg-primary/10" : "border-warning/50 bg-warning/10")}>
                    {result.error ? <p>{result.error}</p> : (
                      <>
                        <p className="font-medium">{result.ok ? `${result.nome} inscrito como candidato a KOL.` : `${result.nome} inscrito, mas algumas etapas falharam — envie de novo para refazer só elas.`}</p>
                        <ul className="space-y-1">
                          {(result.steps ?? []).map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs">
                              {s.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                              <span className="min-w-0 break-words"><b>{STEP_LABEL[s.step] ?? s.step}:</b> {s.detail}</span>
                            </li>
                          ))}
                        </ul>
                        {result.ok && <Button type="button" size="sm" variant="outline" onClick={reset}>Nova inscrição</Button>}
                      </>
                    )}
                  </div>
                )}

                <Button type="button" className="w-full" disabled={!canSubmit || submitting} onClick={submit}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Inscrever candidato a KOL
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
