import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeadDetailPanel } from "./smartops/LeadDetailPanel";
import "@/styles/intelligence-dark.css";
import { CreditCard, Search, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface PaymentUnit {
  id: string;
  lead_id: string | null;
  stripe_event_id: string | null;
  stripe_checkout_id: string | null;
  stripe_customer_id: string | null;
  unit_index: number;
  unit_total: number | null;
  product_name: string | null;
  paid_at: string | null;
  id_dongle: string | null;
  stripe_seller_id: string | null;
  pre_ativacao_data: string | null;
  pre_ativacao_status: string | null;
  ativacao_data: string | null;
  ativacao_status: string | null;
  mensalidade_data: string | null;
  mensalidade_status: string | null;
}

interface Subscription {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  lead_id: string | null;
  status: string | null;
  product: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  created_at: string;
}

interface LeadRow {
  id: string;
  nome: string | null;
  email: string | null;
  telefone_normalized: string | null;
}

interface Vendedor {
  codigo: string;
  nome_omie: string | null;
  nome_piperun: string | null;
  ativo: boolean | null;
}

interface Row {
  key: string;
  unit_id: string;
  lead_id: string | null;
  unit_index: number;
  unit_count: number;
  nome: string;
  email: string;
  telefone: string;
  payment_at: string; // ISO
  produto: string;
  valor: number;
  vendedor: string;
  stripe_seller_id: string | null;
  id_dongle: string | null;
  pre_ativacao_at: string | null;
  pre_ativacao_status: string | null;
  ativacao_at: string | null;
  ativacao_status: string | null;
  mensalidade_first_due: string | null;
  mensalidade_status: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

const PRE_STATUSES = ["Pendente", "Agendada", "Concluída", "Bloqueada"];
const ATIV_STATUSES = ["Pendente", "Em andamento", "Concluída", "Cancelada"];
const MENS_STATUSES = ["A vencer", "Paga", "Vencida", "Cancelada", "Trial"];

const PRODUCT_LABELS: Record<string, string> = {
  ativacao_dentalcad_ultimate_lab_bundle_rms: "Ativação DentalCAD Ultimate Lab Bundle - RMS",
  ativacao_exocad_dentalcad_ia: "Ativação DentalCAD Ultimate Lab Bundle - RMS",
  exocad_ultimate_bundle_rms: "Exocad Ultimate Bundle (RMS)",
  mensalidade_dentalcad_ultimate_lab_bundle_rms: "Mensalidade DentalCAD Ultimate Lab Bundle - RMS",
};

function productLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  return PRODUCT_LABELS[slug] || slug;
}

function deriveMensalidadeLabel(sub: { status: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null } | null): string | null {
  if (!sub || !sub.status) return null;
  const s = sub.status.toLowerCase();
  if (s === "trialing") return "Trial";
  if (s === "canceled" || s === "unpaid" || sub.cancel_at_period_end) {
    return s === "canceled" ? "Cancelada" : "Vencida";
  }
  if (s === "past_due") return "Vencida";
  if (s === "active" && sub.current_period_end) {
    const days = Math.round((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000);
    if (days < 0) return "Vencida";
    if (days <= 7) return `Vence em ${days}d`;
    return "Ativa";
  }
  if (s === "active") return "Ativa";
  return sub.status;
}

function statusColor(s: string | null): string {
  if (!s) return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  const l = s.toLowerCase();
  if (l.includes("conclu") || l === "paga" || l === "ativa") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (l.includes("vencid") || l === "cancelada" || l === "bloqueada") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (l.includes("vence") || l === "a vencer" || l === "agendada" || l === "em andamento") return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  if (l === "trial") return "bg-sky-500/10 text-sky-400 border-sky-500/30";
  return "bg-slate-500/10 text-slate-400 border-slate-500/30";
}

export function SmartOpsStripePayments() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativa" | "vencida" | "cancelada" | "trial">("all");
  const [selectedLead, setSelectedLead] = useState<{ id: string; nome: string } | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [invoicePaidByLead, setInvoicePaidByLead] = useState<Map<string, number>>(new Map());

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [unitsRes, subRes, vendRes] = await Promise.all([
        supabase
          .from("stripe_payment_units")
          .select("*")
          .order("paid_at", { ascending: true })
          .limit(2000),
        supabase
          .from("stripe_subscriptions")
          .select("stripe_customer_id, stripe_subscription_id, lead_id, status, product, current_period_end, cancel_at_period_end, canceled_at, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("omie_vendedores")
          .select("codigo, nome_omie, nome_piperun, ativo")
          .eq("ativo", true)
          .order("nome_omie"),
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (subRes.error) throw subRes.error;
      if (vendRes.error) throw vendRes.error;

      const units = (unitsRes.data as PaymentUnit[]) ?? [];
      const subs = (subRes.data as Subscription[]) ?? [];
      setVendedores((vendRes.data as Vendedor[]) ?? []);

      // Count units per checkout for the "(1/N)" label
      const unitCountByCheckout = new Map<string, number>();
      for (const u of units) {
        const k = u.stripe_checkout_id ?? u.id;
        unitCountByCheckout.set(k, (unitCountByCheckout.get(k) ?? 0) + 1);
      }

      const leadIds = Array.from(new Set(units.map(u => u.lead_id).filter(Boolean))) as string[];

      const leadsRes = leadIds.length
        ? await supabase
            .from("lia_attendances")
            .select("id, nome, email, telefone_normalized")
            .in("id", leadIds)
        : { data: [] as LeadRow[], error: null };
      if ((leadsRes as any).error) throw (leadsRes as any).error;
      const leadMap = new Map<string, LeadRow>();
      for (const l of ((leadsRes as any).data as LeadRow[]) ?? []) leadMap.set(l.id, l);

      // Deal fallback for seller
      const dealsRes = leadIds.length
        ? await supabase
            .from("deals")
            .select("lead_id, owner_name, updated_at")
            .in("lead_id", leadIds)
            .order("updated_at", { ascending: false })
        : { data: [] as any[], error: null };
      const dealOwnerByLead = new Map<string, string>();
      for (const d of ((dealsRes as any).data as any[]) ?? []) {
        if (d.lead_id && d.owner_name && !dealOwnerByLead.has(d.lead_id)) {
          dealOwnerByLead.set(d.lead_id, d.owner_name);
        }
      }

      // Aggregate paid invoices from lead_activity_log for the mensalidades KPI
      const invoicePaid = new Map<string, number>();
      if (leadIds.length) {
        const { data: invRows } = await supabase
          .from("lead_activity_log")
          .select("lead_id, value_numeric")
          .in("lead_id", leadIds)
          .eq("event_type", "stripe_invoice_paid");
        for (const r of (invRows as any[]) ?? []) {
          if (!r?.lead_id) continue;
          const v = Number(r.value_numeric ?? 0);
          if (!isFinite(v)) continue;
          invoicePaid.set(r.lead_id, (invoicePaid.get(r.lead_id) ?? 0) + v);
        }
      }
      setInvoicePaidByLead(invoicePaid);

      // Subscriptions map by customer
      const subByCustomer = new Map<string, Subscription>();
      for (const s of subs) {
        if (s.stripe_customer_id && !subByCustomer.has(s.stripe_customer_id)) {
          subByCustomer.set(s.stripe_customer_id, s);
        }
      }

      const vendMap = new Map<string, string>();
      for (const v of (vendRes.data as Vendedor[]) ?? []) {
        vendMap.set(v.codigo, v.nome_omie || v.nome_piperun || v.codigo);
      }

      const built: Row[] = units.map(u => {
        const lead = u.lead_id ? leadMap.get(u.lead_id) : undefined;
        const sub = u.stripe_customer_id ? subByCustomer.get(u.stripe_customer_id) : undefined;
        const sellerCode = u.stripe_seller_id ?? null;
        const vendedorLabel = sellerCode
          ? vendMap.get(sellerCode) || sellerCode
          : (u.lead_id ? dealOwnerByLead.get(u.lead_id) : "") || "";
        const cKey = u.stripe_checkout_id ?? u.id;
        return {
          key: u.id,
          unit_id: u.id,
          lead_id: u.lead_id,
          unit_index: u.unit_index,
          unit_count: unitCountByCheckout.get(cKey) ?? 1,
          nome: lead?.nome || "—",
          email: lead?.email || "",
          telefone: lead?.telefone_normalized || "",
          payment_at: u.paid_at ?? "",
          produto: u.product_name || sub?.product || "—",
          valor: Number(u.unit_total ?? 0),
          vendedor: vendedorLabel,
          stripe_seller_id: sellerCode,
          id_dongle: u.id_dongle ?? null,
          pre_ativacao_at: u.pre_ativacao_data,
          pre_ativacao_status: u.pre_ativacao_status,
          ativacao_at: u.ativacao_data,
          ativacao_status: u.ativacao_status,
          mensalidade_first_due: u.mensalidade_data,
          mensalidade_status: u.mensalidade_status || deriveMensalidadeLabel(sub ?? null) || null,
          subscription_status: sub?.status ?? null,
          current_period_end: sub?.current_period_end ?? null,
          cancel_at_period_end: sub?.cancel_at_period_end ?? null,
        };
      });

      setRows(built);
    } catch (err: any) {
      console.error("[SmartOpsStripePayments] load error", err);
      toast({ title: "Erro ao carregar pagamentos", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== "all") {
        const s = (r.mensalidade_status || "").toLowerCase();
        if (statusFilter === "ativa" && !(s === "ativa" || s.startsWith("vence em"))) return false;
        if (statusFilter === "vencida" && !s.includes("vencid")) return false;
        if (statusFilter === "cancelada" && s !== "cancelada") return false;
        if (statusFilter === "trial" && s !== "trial") return false;
      }
      if (!q) return true;
      return (
        r.nome.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.telefone.toLowerCase().includes(q) ||
        r.produto.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function updateUnit(unitId: string, patch: Partial<PaymentUnit>) {
    const { error } = await supabase.from("stripe_payment_units").update(patch).eq("id", unitId);
    if (error) {
      toast({ title: "Falha ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    setRows(prev => prev.map(r => {
      if (r.unit_id !== unitId) return r;
      const next: any = { ...r };
      if ("stripe_seller_id" in patch) next.stripe_seller_id = patch.stripe_seller_id ?? null;
      if ("id_dongle" in patch) next.id_dongle = patch.id_dongle ?? null;
      if ("pre_ativacao_data" in patch) next.pre_ativacao_at = patch.pre_ativacao_data ?? null;
      if ("pre_ativacao_status" in patch) next.pre_ativacao_status = patch.pre_ativacao_status ?? null;
      if ("ativacao_data" in patch) next.ativacao_at = patch.ativacao_data ?? null;
      if ("ativacao_status" in patch) next.ativacao_status = patch.ativacao_status ?? null;
      if ("mensalidade_data" in patch) next.mensalidade_first_due = patch.mensalidade_data ?? null;
      if ("mensalidade_status" in patch) next.mensalidade_status = patch.mensalidade_status ?? null;
      return next;
    }));
    return true;
  }

  const total = filtered.reduce((s, r) => s + (r.valor || 0), 0);

  const isDoneStatus = (s: string | null | undefined) => {
    const l = (s || "").toLowerCase();
    return l === "paga" || l === "ativa" || l.includes("conclu");
  };
  const isPendingActivation = (s: string | null | undefined) => {
    const l = (s || "").toLowerCase();
    if (!l) return true;
    return l.includes("vence") || l.includes("agend") || l.includes("andament") || l === "a vencer";
  };
  const isFailedStatus = (s: string | null | undefined) => {
    const l = (s || "").toLowerCase();
    return l.includes("vencid") || l === "cancelada" || l === "bloqueada";
  };

  const kpis = useMemo(() => {
    const totalUnits = filtered.length;
    const faturamento = total;
    const tickets = new Set<string>();
    let ativacoesPagas = 0;
    let subsAtivas = 0;
    let subsFalhas = 0;
    let preAtivPend = 0;
    let ativPend = 0;
    let semDongle = 0;
    for (const r of filtered) {
      const ativDone = isDoneStatus(r.ativacao_status) || !!r.ativacao_at;
      if (ativDone) ativacoesPagas += r.valor || 0;
      if (!ativDone) ativPend += 1;
      if (!r.pre_ativacao_at && !isDoneStatus(r.pre_ativacao_status)) preAtivPend += 1;
      const ss = (r.subscription_status || "").toLowerCase();
      if (ss === "active" || ss === "trialing") subsAtivas += 1;
      if (isFailedStatus(r.mensalidade_status) || ss === "past_due" || ss === "canceled" || ss === "unpaid") subsFalhas += 1;
      if (!r.id_dongle || !r.id_dongle.trim()) semDongle += 1;
    }
    // mensalidades pagas: soma via lead_activity_log (invoice_paid). Deduzimos a ativação
    // inicial (checkout) que já entra em "Faturamento total" para evitar dupla contagem.
    let mensalidadesPagas = 0;
    const leadsInView = new Set<string>();
    for (const r of filtered) if (r.lead_id) leadsInView.add(r.lead_id);
    for (const lid of leadsInView) mensalidadesPagas += invoicePaidByLead.get(lid) ?? 0;
    const ticketMedio = groups.length > 0 ? faturamento / groups.length : 0;
    return {
      pagamentos: groups.length,
      unidades: totalUnits,
      faturamento,
      ticketMedio,
      ativacoesPagas,
      mensalidadesPagas,
      subsAtivas,
      subsFalhas,
      preAtivPend,
      ativPend,
      semDongle,
    };
  }, [filtered, groups, total, invoicePaidByLead]);

  // Group rows by checkout so multi-unit purchases render as a single card
  // (shared client/product/seller cells) with one sub-row per unit for the
  // per-unit fields (ID Dongle, pré-ativação, ativação, mensalidade).
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const gk = r.unit_id && r.unit_count > 1
        ? `co:${r.key.split(":")[0]}` // fallback
        : r.key;
      // Prefer grouping by unit_count>1 using a stable key from unit itself
      const key = r.unit_count > 1
        ? `${r.lead_id ?? "nolead"}|${r.payment_at}|${r.produto}|${r.valor}`
        : r.key;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    // sort units inside each group
    for (const arr of map.values()) arr.sort((a, b) => a.unit_index - b.unit_index);
    // return groups ordered by first row's payment date (already sorted desc in filtered)
    return Array.from(map.entries()).map(([k, units]) => ({ key: k, units }));
  }, [filtered]);

  if (loading) {
    return (
      <div className="io-dark min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="io-dark p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Stripe / Pagamentos</h1>
          <Badge variant="outline" className="ml-2">{groups.length} pagamentos · {filtered.length} unidades · {fmtBRL(total)}</Badge>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail, telefone…"
            className="pl-8 w-72"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="ativa">Ativa</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
          <option value="trial">Trial</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">E-mail</th>
                <th className="text-left p-2">Celular</th>
                <th className="text-left p-2">Data pagamento</th>
                <th className="text-left p-2">Produto</th>
                <th className="text-right p-2">Valor</th>
                <th className="text-left p-2">Vendedor</th>
                <th className="text-left p-2">ID Smart Dent</th>
                <th className="text-left p-2">ID Dongle</th>
                <th className="text-left p-2">Pré-ativação</th>
                <th className="text-left p-2">Status Pré</th>
                <th className="text-left p-2">Ativação</th>
                <th className="text-left p-2">Status Ativação</th>
                <th className="text-left p-2">1ª Mensalidade</th>
                <th className="text-left p-2">Status Mensalidade</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => g.units.map((r, ui) => {
                const isFirst = ui === 0;
                const span = g.units.length;
                return (
                <tr key={r.key} className={`hover:bg-muted/20 ${isFirst ? "border-t-2 border-border" : "border-t border-dashed border-border/50"}`}>
                  {isFirst && (
                    <td rowSpan={span} className="p-2 text-xs text-muted-foreground whitespace-nowrap align-top">
                      {gi + 1}{span > 1 ? ` · ${span} unid.` : ""}
                    </td>
                  )}
                  {isFirst && <td rowSpan={span} className="p-2 font-medium align-top">{r.nome}</td>}
                  {isFirst && <td rowSpan={span} className="p-2 text-muted-foreground align-top">{r.email || "—"}</td>}
                  {isFirst && <td rowSpan={span} className="p-2 text-muted-foreground align-top">{r.telefone || "—"}</td>}
                  {isFirst && <td rowSpan={span} className="p-2 whitespace-nowrap align-top">{fmtDateTime(r.payment_at)}</td>}
                  {isFirst && <td rowSpan={span} className="p-2 text-xs align-top">{productLabel(r.produto)}</td>}
                  {isFirst && (
                    <td rowSpan={span} className="p-2 text-right whitespace-nowrap align-top">
                      {fmtBRL(g.units.reduce((s, u) => s + (u.valor || 0), 0))}
                      {span > 1 && (
                        <div className="text-[10px] text-muted-foreground">{span}× {fmtBRL(r.valor)}</div>
                      )}
                    </td>
                  )}
                  {isFirst ? (
                  <td rowSpan={span} className="p-2 align-top">
                    <select
                      value={r.stripe_seller_id ?? ""}
                      onChange={e => updateUnit(r.unit_id, { stripe_seller_id: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs min-w-[140px]"
                    >
                      <option value="">— {r.vendedor || "Sem vendedor"}</option>
                      {vendedores.map(v => (
                        <option key={v.codigo} value={v.codigo}>{v.nome_omie || v.nome_piperun || v.codigo}</option>
                      ))}
                    </select>
                  </td>
                  ) : null}
                  {isFirst ? (
                  <td rowSpan={span} className="p-2 align-top">
                    <span
                      className="font-mono text-[10px] text-muted-foreground cursor-pointer"
                      title={r.lead_id ?? ""}
                      onClick={() => r.lead_id && navigator.clipboard?.writeText(r.lead_id)}
                    >
                      {r.lead_id ? r.lead_id.slice(0, 8) : "—"}
                    </span>
                  </td>
                  ) : null}
                  <td className="p-2">
                    {span > 1 && (
                      <div className="text-[10px] text-muted-foreground mb-1">Unid. {r.unit_index}/{span}</div>
                    )}
                    <input
                      type="text"
                      defaultValue={r.id_dongle ?? ""}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if ((v || null) !== (r.id_dongle ?? null)) updateUnit(r.unit_id, { id_dongle: v || null });
                      }}
                      placeholder="—"
                      className="h-7 rounded border border-border bg-background px-1 text-xs w-32"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      value={r.pre_ativacao_at ? r.pre_ativacao_at.slice(0, 10) : ""}
                      onChange={e => updateUnit(r.unit_id, { pre_ativacao_data: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={r.pre_ativacao_status ?? ""}
                      onChange={e => updateUnit(r.unit_id, { pre_ativacao_status: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    >
                      <option value="">—</option>
                      {PRE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {r.pre_ativacao_status && (
                      <div className="mt-1"><Badge variant="outline" className={statusColor(r.pre_ativacao_status)}>{r.pre_ativacao_status}</Badge></div>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      value={r.ativacao_at ? r.ativacao_at.slice(0, 10) : ""}
                      onChange={e => updateUnit(r.unit_id, { ativacao_data: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={r.ativacao_status ?? ""}
                      onChange={e => updateUnit(r.unit_id, { ativacao_status: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    >
                      <option value="">—</option>
                      {ATIV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {r.ativacao_status && (
                      <div className="mt-1"><Badge variant="outline" className={statusColor(r.ativacao_status)}>{r.ativacao_status}</Badge></div>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      value={r.mensalidade_first_due ?? ""}
                      onChange={e => updateUnit(r.unit_id, { mensalidade_data: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={r.mensalidade_status ?? ""}
                      onChange={e => updateUnit(r.unit_id, { mensalidade_status: e.target.value || null })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    >
                      <option value="">— {deriveMensalidadeLabel({ status: r.subscription_status, current_period_end: r.current_period_end, cancel_at_period_end: r.cancel_at_period_end }) || "Sem assinatura"}</option>
                      {MENS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {r.mensalidade_status && (
                      <div className="mt-1"><Badge variant="outline" className={statusColor(r.mensalidade_status)}>{r.mensalidade_status}</Badge></div>
                    )}
                  </td>
                  <td className="p-2">
                    {isFirst && r.lead_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLead({ id: r.lead_id!, nome: r.nome })}
                        title="Abrir lead"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
                );
              }))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={17} className="p-8 text-center text-muted-foreground text-sm">
                    Nenhum pagamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedLead && (
        <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
}