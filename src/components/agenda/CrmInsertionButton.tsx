import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertTriangle, Briefcase, Building2, Check, ChevronsUpDown, ClipboardPlus, Loader2, Lock, Mail, Search, User } from "lucide-react";
import { CrmLeadSummary, dealStatus } from "./CrmLeadSummary";
import { cn } from "@/lib/utils";

type Kol = { id: string; nome: string; seller_id: string | null; seller_nome: string | null; linked: boolean; contract_pending?: boolean };
type Product = { id: string; name: string; group: string | null };
export type Bootstrap = { me: { id: string; nome: string }; options: { area_atuacao: string[]; especialidade: string[]; produtos: Product[] }; kols: Kol[] };
type Deal = { deal_id: string; lead_id: string | null; pipeline_name: string | null; pipeline_id: number | null; stage_name: string | null; status: string | null; owner_name: string | null; value: number | null; product: string | null; origin_name: string | null; title?: string | null; created_at: string | null; closed_at?: string | null };
type Alert = { deal_id: string; owner_name: string; owner_team_member_id: string | null; has_email?: boolean; pipeline: string; stage: string };
export type Found = { leads: any[]; persons: any[]; companies: any[]; deals: Deal[]; latest_deal: Deal | null; summary: { title: string; lines: string[] }[]; conversions?: { date: string | null; name: string }[]; extras?: { courses: string[]; tickets: number }; alerts: Alert[]; live_checked: boolean };
type FormState = { nome: string; email: string; area_atuacao: string; especialidade: string; product_id: string; kol_id: string; tipo: "" | "ativa" | "fria"; empresa_nome: string; empresa_cnpj: string };

const EMPTY: FormState = { nome: "", email: "", area_atuacao: "", especialidade: "", product_id: "", kol_id: "", tipo: "", empresa_nome: "", empresa_cnpj: "" };

export async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("crm-insercao", { body: { action, ...extra } });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

const brl = (v: unknown) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "");

function Combo({ value, onChange, items, placeholder, empty }: { value: string; onChange: (v: string) => void; items: { value: string; label: string; hint?: string }[]; placeholder: string; empty: string }) {
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="h-9 w-full justify-between font-normal">
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.label ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem key={i.value} value={`${i.label} ${i.hint ?? ""}`} onSelect={() => { onChange(i.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", i.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{i.label}</span>
                  {i.hint && <span className="ml-2 truncate text-xs text-muted-foreground">{i.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UseButton({ locked, onClick }: { locked?: string | null; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!!locked} title={locked ?? undefined} onClick={onClick}>
      {locked && <Lock className="h-3 w-3" />} Utilizar estes dados para nova oportunidade
    </Button>
  );
}

export function RecordCard({ icon, title, badge, lines, onUse, locked }: { icon: React.ReactNode; title: string; badge?: string | null; lines: (string | null | undefined)[]; onUse: () => void; locked?: string | null }) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border bg-card p-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          {badge && <Badge variant="outline" className="shrink-0 text-[10px]">{badge}</Badge>}
        </div>
        {lines.filter(Boolean).map((l, i) => <p key={i} className="break-words text-xs text-muted-foreground">{l}</p>)}
      </div>
      <UseButton locked={locked} onClick={onUse} />
    </div>
  );
}

export function CrmInsertionButton() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [base, setBase] = useState<{ kind: string; id: string } | null>(null);
  const [showAllKols, setShowAllKols] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; emails?: Record<string, string> } | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; emails?: Record<string, string> } | null>(null);

  const boot = useQuery({
    queryKey: ["crm-insercao-bootstrap"],
    enabled: open,
    staleTime: 0, // lista de KOLs muda quando outro vendedor inscreve um candidato: recarrega a cada abertura
    queryFn: () => call<Bootstrap>("bootstrap"),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const products = boot.data?.options.produtos ?? [];
  const kols = boot.data?.kols ?? [];
  const linkedKols = kols.filter((k) => k.linked);
  const visibleKols = showAllKols || !linkedKols.length ? kols : linkedKols;
  const selectedKol = kols.find((k) => k.id === form.kol_id);
  const productIdByName = (name?: string | null) => {
    const n = String(name ?? "").trim().toLowerCase();
    return n ? products.find((p) => p.name.toLowerCase() === n)?.id ?? "" : "";
  };
  const pick = (list: string[] | undefined, v?: string | null) => (v && list?.includes(v) ? v : "");

  const search = async () => {
    setSearchError(""); setResult(null); setFound(null); setBase(null); setNotice(null);
    setSearching(true);
    try { setFound(await call<Found>("search", { telefone: phone })); }
    catch (e) { setSearchError((e as Error).message); }
    finally { setSearching(false); }
  };

  const useLead = (l: any) => {
    setBase({ kind: "ficha", id: l.id });
    setForm((f) => ({
      ...f, nome: l.nome ?? f.nome, email: l.email ?? f.email,
      area_atuacao: pick(boot.data?.options.area_atuacao, l.area_atuacao) || f.area_atuacao,
      especialidade: pick(boot.data?.options.especialidade, l.especialidade) || f.especialidade,
      product_id: productIdByName(l.produto_interesse || l.produto_interesse_auto) || f.product_id,
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
  const useDeal = (d: Deal) => {
    const lead = found?.leads.find((l) => l.id === d.lead_id);
    if (lead) useLead(lead);
    setBase({ kind: "deal", id: d.deal_id });
    const pid = productIdByName(d.product);
    if (pid) set("product_id", pid);
  };

  const myId = boot.data?.me.id;
  const blocking = (found?.alerts ?? []).filter((a) => a.owner_team_member_id !== myId);
  const lockedReason = blocking.length ? `Bloqueado: lead em negociação com ${blocking[0].owner_name}` : null;
  // Só libera o envio se o vendedor do contrato do KOL for o próprio dono do negócio aberto.
  const submitLocked = blocking.length > 0 && !(selectedKol?.seller_id && blocking.every((a) => a.owner_team_member_id === selectedKol.seller_id));

  const notify = async () => {
    setNotifying(true); setNotice(null);
    try {
      const r = await call<any>("notify", { telefone: phone, nome: form.nome || found?.leads[0]?.nome || "", kol_lead_id: form.kol_id || null, indicacao_tipo: form.tipo || null });
      const failed = Object.values(r.emails ?? {}).some((v) => String(v).startsWith("falha"));
      setNotice({ ok: !failed, text: r.already ? "Este aviso já foi enviado há poucos minutos." : failed ? "Aviso registrado, mas algum e-mail falhou:" : "Aviso enviado por e-mail e registrado na timeline do lead.", emails: r.emails });
    } catch (e) { setNotice({ ok: false, text: (e as Error).message }); }
    finally { setNotifying(false); }
  };

  const canSubmit = !!(phone.replace(/\D/g, "").length >= 10 && form.nome.trim() && form.area_atuacao && form.especialidade && form.product_id && form.kol_id && form.tipo);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setResult(null);
    try {
      const product = products.find((p) => p.id === form.product_id);
      const r = await call<any>("submit", {
        data: {
          nome: form.nome, telefone: phone, email: form.email || "",
          area_atuacao: form.area_atuacao, especialidade: form.especialidade,
          produto_interesse: product?.name ?? "", product_catalog_id: form.product_id,
          kol_lead_id: form.kol_id, indicacao_tipo: form.tipo,
          empresa_nome: form.empresa_nome || null, empresa_cnpj: form.empresa_cnpj || null, base,
        },
      });
      if (r.blocked) {
        const c = r.conflicts?.[0];
        setResult({ ok: false, text: `Não foi criada a oportunidade: o lead pertence ao vendedor ${c?.owner_name ?? "—"} e já está no funil de vendas (${c?.pipeline_name ?? "Funil de vendas"} / ${c?.stage_name ?? ""}). Os vendedores e a gestão foram avisados por e-mail.`, emails: r.emails });
      } else {
        setResult({ ok: true, text: `Oportunidade enviada ao CRM com origem "${r.origin}" para ${r.seller}.` });
        setForm(EMPTY); setFound(null); setPhone(""); setBase(null);
      }
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally { setSubmitting(false); }
  };

  const originPreview = selectedKol && form.tipo ? `# - ${form.tipo === "ativa" ? "INDICALEADKOL" : "PROSPLEADKOL"} - ${selectedKol.nome}` : "";
  const productItems = useMemo(() => products.map((p) => ({ value: p.id, label: p.name, hint: p.group ?? undefined })), [products]);

  return (
    <>
      <Button type="button" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}>
        <ClipboardPlus className="h-4 w-4" /> Cadastrar indicações
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar indicações</DialogTitle>
            <DialogDescription>Busque o lead pelo celular, confira o histórico e registre a indicação do profissional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
          {boot.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {boot.error && <p className="text-sm text-destructive">{(boot.error as Error).message}</p>}
          {boot.data && (
            <>
              {/* Passo 1 */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Celular do lead e busca antiduplicidade</p>
                <div className="flex gap-2">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 13))} inputMode="numeric" placeholder="55xxxxxxxxxxx" className="h-9" onKeyDown={(e) => e.key === "Enter" && search()} />
                  <Button type="button" className="h-9 gap-1" onClick={search} disabled={searching || phone.length < 10}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
                  </Button>
                </div>
                {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                {found && (
                  <div className="space-y-2">
                    {!!blocking.length && (
                      <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                          <div className="min-w-0 space-y-1 text-sm">
                            {blocking.map((a) => (
                              <p key={a.deal_id}>Lead pertence ao vendedor <b>{a.owner_name}</b> e já está no funil de vendas (<b>{a.pipeline} / {a.stage}</b>) · negócio #{a.deal_id}.</p>
                            ))}
                            <p className="text-xs text-muted-foreground">Não é possível usar estes dados para nova oportunidade. Avise o vendedor responsável — o e-mail vai para ele, para você e para a gestão, com o resumo do lead.</p>
                          </div>
                        </div>
                        <Button type="button" variant="destructive" className="w-full gap-2 sm:w-auto" onClick={notify} disabled={notifying}>
                          {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Avisar o vendedor por e-mail
                        </Button>
                        {notice && (
                          <div className={cn("rounded-lg border p-2.5 text-xs", notice.ok ? "border-success/40 bg-success/10" : "border-destructive/40 bg-background")}>
                            <p className="font-medium">{notice.text}</p>
                            {notice.emails && <ul className="mt-1 text-muted-foreground">{Object.entries(notice.emails).map(([to, st]) => <li key={to}>{to}: {st}</li>)}</ul>}
                          </div>
                        )}
                      </div>
                    )}
                    {found.alerts.filter((a) => a.owner_team_member_id === myId).map((a) => (
                      <div key={a.deal_id} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                        <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>Este lead já está com você no funil de vendas (<b>{a.pipeline} / {a.stage}</b>).</span>
                      </div>
                    ))}
                    {(found.leads.length > 0 || found.deals.length > 0) && (
                      <CrmLeadSummary lead={found.leads[0] ?? null} person={found.persons[0] ?? null} deals={found.deals} conversions={found.conversions ?? []} extras={found.extras} />
                    )}
                    {!found.leads.length && !found.persons.length && !found.companies.length && !found.deals.length && (
                      <p className="text-sm text-muted-foreground">Nenhum registro encontrado — preencha os dados do novo lead abaixo.</p>
                    )}
                    {found.leads.map((l) => (
                      <RecordCard key={`l-${l.id}`} icon={<User className="h-4 w-4" />} title={`Ficha: ${l.nome ?? "sem nome"}`} badge={l.doc?.badge}
                        lines={[l.doc?.label, [l.telefone_normalized, l.email].filter(Boolean).join(" · "), [l.area_atuacao, l.especialidade].filter(Boolean).join(" · "), l.produto_interesse || l.produto_interesse_auto ? `Interesse: ${l.produto_interesse || l.produto_interesse_auto}` : null, l.form_name ? `Última conversão: ${l.form_name}` : null]}
                        onUse={() => useLead(l)} locked={lockedReason} />
                    ))}
                    {found.persons.map((p) => (
                      <RecordCard key={`p-${p.piperun_person_id}`} icon={<User className="h-4 w-4" />} title={`Pessoa: ${p.nome ?? "sem nome"}`} badge={p.doc?.badge}
                        lines={[p.doc?.label, `PipeRun #${p.piperun_person_id}`, [p.telefone_principal, p.email].filter(Boolean).join(" · "), p.empresa_nome ? `Empresa: ${p.empresa_nome}` : null]}
                        onUse={() => usePerson(p)} locked={lockedReason} />
                    ))}
                    {found.companies.map((c) => (
                      <RecordCard key={`c-${c.piperun_company_id}`} icon={<Building2 className="h-4 w-4" />} title={`Organização: ${c.nome_fantasia || c.nome || c.razao_social || "sem nome"}`} badge={c.doc?.badge}
                        lines={[c.doc?.label, [c.cidade, c.uf].filter(Boolean).join("/")]}
                        onUse={() => useCompany(c)} locked={lockedReason} />
                    ))}
                    {found.latest_deal && (() => {
                      const d = found.latest_deal!;
                      const row = (k: string, v?: string | null) => (v ? <div className="flex gap-2 text-xs"><span className="w-28 shrink-0 text-muted-foreground">{k}</span><span className="min-w-0 break-words">{v}</span></div> : null);
                      return (
                        <div className="space-y-2 rounded-xl border border-primary/40 bg-card p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" />
                            <p className="flex-1 text-sm font-semibold">Negócio mais recente · #{d.deal_id}</p>
                            <Badge variant="outline" className={cn("text-[10px]", dealStatus(d.status).badge)}>{dealStatus(d.status).label}</Badge>
                          </div>
                          <div className="space-y-1">
                            {row("Título", d.title)}
                            {row("Funil / etapa", [d.pipeline_name, d.stage_name].filter(Boolean).join(" / "))}
                            {row("Vendedor", d.owner_name ?? "—")}
                            {row("Valor", d.value ? brl(d.value) : null)}
                            {row("Produto", d.product)}
                            {row("Origem", d.origin_name)}
                            {row("Criado em", dt(d.created_at))}
                            {row("Fechado em", d.status !== "aberta" ? dt(d.closed_at) : null)}
                          </div>
                          <UseButton locked={lockedReason} onClick={() => useDeal(d)} />
                        </div>
                      );
                    })()}
                    {!found.live_checked && <p className="text-xs text-muted-foreground">PipeRun indisponível agora; resultado baseado no espelho do sistema.</p>}
                  </div>
                )}
              </section>

              {/* Passo 2 */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Dados do lead {base && <Badge variant="outline" className="ml-1 text-[10px]">dados de {base.kind} #{base.id}</Badge>}</p>
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
                  <div className="space-y-1">
                    <Label>Produto de interesse</Label>
                    <Combo value={form.product_id} onChange={(v) => set("product_id", v)} items={productItems} placeholder="Selecione o produto" empty="Produto não encontrado" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label>Profissional KOL</Label>
                      {!!linkedKols.length && (
                        <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setShowAllKols((v) => !v)}>
                          {showAllKols ? "Só os vinculados a mim" : "Ver todos"}
                        </button>
                      )}
                    </div>
                    <Combo value={form.kol_id} onChange={(v) => set("kol_id", v)} placeholder="Selecione o profissional" empty="Nenhum profissional"
                      items={visibleKols.map((k) => ({ value: k.id, label: k.contract_pending ? `⚠ ${k.nome}` : k.nome, hint: [k.contract_pending ? "Contrato pendente" : null, k.seller_nome ? `Vendedor: ${k.seller_nome}` : "sem vendedor vinculado"].filter(Boolean).join(" · ") }))} />
                    {!linkedKols.length && <p className="text-xs text-muted-foreground">Nenhum profissional vinculado a você; exibindo todos.</p>}
                    {selectedKol?.contract_pending && (
                      <p className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" /> Contrato pendente — o profissional ainda não assinou o contrato de KOL. A indicação é registrada normalmente.
                      </p>
                    )}
                    {selectedKol && !selectedKol.seller_id && <p className="text-xs text-destructive">Este profissional não tem vendedor de contrato vinculado.</p>}
                  </div>
                </div>
              </section>

              {/* Passo 3 */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3. Tipo de indicação</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([["ativa", "Indicação Ativa", "O profissional enviou o contato e solicitou o contato"], ["fria", "Indicação Fria", "O vendedor pediu a indicação para o profissional"]] as const).map(([v, t, d]) => (
                    <button key={v} type="button" onClick={() => set("tipo", v)}
                      className={cn("rounded-lg border p-3 text-left transition-colors", form.tipo === v ? "border-primary bg-primary/10" : "hover:bg-accent")}>
                      <p className="text-sm font-semibold">{t}</p>
                      <p className="text-xs text-muted-foreground">{d}</p>
                    </button>
                  ))}
                </div>
                {originPreview && <p className="text-xs">Origem do lead: <b>{originPreview}</b>{selectedKol?.seller_nome ? ` · vendedor ${selectedKol.seller_nome}` : ""}</p>}
              </section>

              {result && (
                <div className={cn("rounded-lg border p-3 text-sm", result.ok ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10")}>
                  {result.text}
                  {result.emails && <ul className="mt-1 text-xs text-muted-foreground">{Object.entries(result.emails).map(([to, s]) => <li key={to}>{to}: {s}</li>)}</ul>}
                </div>
              )}

              {submitLocked && <p className="text-xs text-destructive">Envio bloqueado: o lead já está em negociação com {blocking[0].owner_name}. Use “Avisar o vendedor por e-mail”.</p>}
              <Button type="button" className="w-full" disabled={!canSubmit || submitting || submitLocked || !!(selectedKol && !selectedKol.seller_id)} onClick={submit}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Enviar para o CRM
              </Button>
            </>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
