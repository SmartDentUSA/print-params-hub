import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Download, ChevronLeft, ChevronRight, Brain, Route, Tag, Zap, Target,
  Pencil, Save, X, Filter, ChevronDown, ChevronUp, RotateCcw, Users
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───

const PIPELINE_GROUPS: Record<string, { label: string; emoji: string; statuses: string[] }> = {
  vendas: {
    label: "Vendas", emoji: "🎯",
    statuses: ["novo", "sem_contato", "contato_feito", "em_contato", "apresentacao", "proposta_enviada", "negociacao", "fechamento"],
  },
  estagnados: {
    label: "Estagnados", emoji: "🔄",
    statuses: ["est_etapa1", "est_etapa2", "est_etapa3", "est_etapa4", "est_apresentacao", "est_proposta", "estagnado_final"],
  },
  cs: {
    label: "CS", emoji: "🎓",
    statuses: ["cs_auxiliar_email", "cs_em_espera", "cs_sem_data_agendar", "cs_nao_quer_imersao", "cs_treinamento_agendado", "cs_treinamento_realizado", "cs_enviar_imp3d", "cs_equipamentos_entregues", "cs_retirar_scan", "cs_acompanhamento_15d", "cs_acomp_30d_comercial", "cs_acompanhamento_atencao", "cs_finalizado", "cs_nao_use_dkmngr", "cs_nao_use_omie_fix"],
  },
  insumos: {
    label: "Insumos", emoji: "🧪",
    statuses: ["insumos_sem_contato", "insumos_contato_feito", "insumos_amostra_enviada", "insumos_retorno_amostra", "insumos_fechamento"],
  },
  ecommerce: {
    label: "E-commerce", emoji: "🛒",
    statuses: ["ecom_visitantes", "ecom_navegacao", "ecom_checkout", "ecom_abandono", "ecom_transacao", "ecom_pedido", "ecom_pos_venda", "ecom_ativacao"],
  },
  ebook: { label: "Ebook", emoji: "📚", statuses: ["ebook"] },
};

const ALL_STATUSES = Object.values(PIPELINE_GROUPS).flatMap((g) => g.statuses);

const STATUS_LABEL: Record<string, string> = {};
Object.values(PIPELINE_GROUPS).forEach((g) => {
  g.statuses.forEach((s) => {
    STATUS_LABEL[s] = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  });
});

const TEMP_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "quente", label: "🔥 Quente" },
  { key: "morno", label: "🌤 Morno" },
  { key: "frio", label: "❄️ Frio" },
];

const STAGE_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "MQL_pesquisador", label: "🔍 MQL" },
  { key: "SAL_comparador", label: "🔄 SAL" },
  { key: "SQL_decisor", label: "✅ SQL" },
  { key: "CLIENTE_ativo", label: "👑 Cliente" },
];

const URGENCY_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "alta", label: "🔴 Alta" },
  { key: "media", label: "🟡 Média" },
  { key: "baixa", label: "🟢 Baixa" },
];

const OPORT_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "aberta", label: "Aberta" },
  { key: "ganha", label: "Ganha" },
  { key: "perdida", label: "Perdida" },
];

const PRODUCT_FLAGS = ["scan", "notebook", "cad", "cad_ia", "smart_slice", "print", "cura", "insumos"] as const;

const PAGE_SIZE = 200;

// ─── Types ───

interface LeadRow {
  [key: string]: unknown;
  id: string;
  nome: string;
  email: string;
  telefone_normalized: string | null;
  lead_status: string;
  temperatura_lead: string | null;
  lead_stage_detected: string | null;
  urgency_level: string | null;
  source: string;
  produto_interesse: string | null;
  proprietario_lead_crm: string | null;
  status_oportunidade: string | null;
  valor_oportunidade: number | null;
  score: number | null;
  cidade: string | null;
  uf: string | null;
  tags_crm: string[] | null;
  created_at: string;
  updated_at: string;
  itens_proposta_crm: string | null;
  itens_proposta_parsed: unknown;
  piperun_id: string | null;
  piperun_link: string | null;
  funil_entrada_crm: string | null;
  resumo_historico_ia: string | null;
  rota_inicial_lia: string | null;
  intelligence_score_total: number | null;
  ativo_scan: boolean | null;
  ativo_notebook: boolean | null;
  ativo_cad: boolean | null;
  ativo_cad_ia: boolean | null;
  ativo_smart_slice: boolean | null;
  ativo_print: boolean | null;
  ativo_cura: boolean | null;
  ativo_insumos: boolean | null;
  origem_campanha: string | null;
  utm_source: string | null;
  confidence_score_analysis: number | null;
  recommended_approach: string | null;
}

interface Filters {
  search: string;
  pipeline: string;
  status: string;
  temperatura: string;
  stage: string;
  urgency: string;
  source: string;
  produto: string;
  uf: string;
  proprietario: string;
  oportunidade: string;
  activeProduct: string;
  stagnant: boolean;
  valorMin: string;
  valorMax: string;
}

const EMPTY_FILTERS: Filters = {
  search: "", pipeline: "all", status: "all", temperatura: "all", stage: "all",
  urgency: "all", source: "all", produto: "all", uf: "all", proprietario: "all",
  oportunidade: "all", activeProduct: "all", stagnant: false, valorMin: "", valorMax: "",
};

// ─── Helper Components ───

function TempBadge({ temp }: { temp: string | null }) {
  if (!temp) return <span className="text-muted-foreground text-[10px]">—</span>;
  const t = temp.toLowerCase();
  if (t === "quente") return <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5">🔥</Badge>;
  if (t === "morno") return <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5">🌤</Badge>;
  return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">❄️</Badge>;
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const config: Record<string, { label: string; className: string }> = {
    MQL_pesquisador: { label: "MQL", className: "bg-muted text-muted-foreground border-muted" },
    SAL_comparador: { label: "SAL", className: "bg-primary/10 text-primary border-primary/30" },
    SQL_decisor: { label: "SQL", className: "bg-green-50 text-green-700 border-green-300" },
    CLIENTE_ativo: { label: "CLIENTE", className: "bg-purple-50 text-purple-700 border-purple-300" },
  };
  const c = config[stage] || { label: stage, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[9px] px-1.5 ${c.className}`}>{c.label}</Badge>;
}

function UrgencyIcon({ urgency }: { urgency: string | null }) {
  if (!urgency) return null;
  if (urgency === "alta") return <span title="Alta">🔴</span>;
  if (urgency === "media") return <span title="Média">🟡</span>;
  return <span title="Baixa">🟢</span>;
}

function ActiveIcons({ lead }: { lead: LeadRow }) {
  const active = PRODUCT_FLAGS.filter((p) => lead[`ativo_${p}`] === true);
  if (active.length === 0) return <span className="text-muted-foreground text-[10px]">—</span>;
  return (
    <div className="flex gap-0.5 flex-wrap">
      {active.slice(0, 3).map((p) => (
        <Badge key={p} variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-300">
          {p.replace("_", " ").toUpperCase()}
        </Badge>
      ))}
      {active.length > 3 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{active.length - 3}</Badge>}
    </div>
  );
}

function getPipelineForStatus(status: string): string {
  for (const [key, group] of Object.entries(PIPELINE_GROUPS)) {
    if (group.statuses.includes(status)) return `${group.emoji} ${group.label}`;
  }
  return status;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 text-xs pl-2 pr-1 py-0.5">
      {label}
      <button onClick={onRemove} className="hover:bg-muted rounded-full p-0.5"><X className="w-3 h-3" /></button>
    </Badge>
  );
}

// ─── Main Component ───

export function SmartOpsAudienceBuilder() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Dynamic options loaded from DB
  const [allSources, setAllSources] = useState<string[]>([]);
  const [allUFs, setAllUFs] = useState<string[]>([]);
  const [allOwners, setAllOwners] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Load dynamic filter options once
  useEffect(() => {
    Promise.all([
      supabase.from("lia_attendances").select("source").limit(1000),
      supabase.from("lia_attendances").select("uf").limit(1000),
      supabase.from("lia_attendances").select("proprietario_lead_crm").limit(1000),
      supabase.from("lia_attendances").select("produto_interesse").limit(1000),
    ]).then(([sources, ufs, owners, products]) => {
      const unique = (data: { [k: string]: string | null }[] | null, key: string) =>
        [...new Set((data || []).map((d) => d[key]).filter(Boolean))].sort() as string[];
      setAllSources(unique(sources.data as { source: string }[], "source"));
      setAllUFs(unique(ufs.data as { uf: string }[], "uf"));
      setAllOwners(unique(owners.data as { proprietario_lead_crm: string }[], "proprietario_lead_crm"));
      setAllProducts(unique(products.data as { produto_interesse: string }[], "produto_interesse"));
    });
  }, []);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  // Build and execute query
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("lia_attendances")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Pipeline filter → multiple statuses
    if (filters.pipeline !== "all") {
      const group = PIPELINE_GROUPS[filters.pipeline];
      if (group) query = query.in("lead_status", group.statuses);
    }
    // Individual status
    if (filters.status !== "all") query = query.eq("lead_status", filters.status);
    if (filters.temperatura !== "all") query = query.ilike("temperatura_lead", filters.temperatura);
    if (filters.stage !== "all") query = query.eq("lead_stage_detected", filters.stage);
    if (filters.urgency !== "all") query = query.eq("urgency_level", filters.urgency);
    if (filters.source !== "all") query = query.eq("source", filters.source);
    if (filters.produto !== "all") query = query.ilike("produto_interesse", `%${filters.produto}%`);
    if (filters.uf !== "all") query = query.eq("uf", filters.uf);
    if (filters.proprietario !== "all") query = query.eq("proprietario_lead_crm", filters.proprietario);
    if (filters.oportunidade !== "all") query = query.eq("status_oportunidade", filters.oportunidade);
    if (filters.stagnant) query = query.lte("updated_at", thirtyDaysAgo);
    if (filters.valorMin) query = query.gte("valor_oportunidade", Number(filters.valorMin));
    if (filters.valorMax) query = query.lte("valor_oportunidade", Number(filters.valorMax));

    // Active product filter
    if (filters.activeProduct !== "all") {
      query = query.eq(`ativo_${filters.activeProduct}` as any, true);
    }

    // Search
    if (debouncedSearch) {
      query = query.or(`nome.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,telefone_normalized.ilike.%${debouncedSearch}%`);
    }

    const from = page * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await query;
    setLeads((data as LeadRow[]) || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [filters, debouncedSearch, page, thirtyDaysAgo]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(0); }, [filters, debouncedSearch]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: { label: string; key: keyof Filters; resetValue: string | boolean }[] = [];
    if (filters.pipeline !== "all") chips.push({ label: `Pipeline: ${PIPELINE_GROUPS[filters.pipeline]?.label}`, key: "pipeline", resetValue: "all" });
    if (filters.status !== "all") chips.push({ label: `Status: ${STATUS_LABEL[filters.status] || filters.status}`, key: "status", resetValue: "all" });
    if (filters.temperatura !== "all") chips.push({ label: `Temp: ${filters.temperatura}`, key: "temperatura", resetValue: "all" });
    if (filters.stage !== "all") chips.push({ label: `Estágio: ${filters.stage}`, key: "stage", resetValue: "all" });
    if (filters.urgency !== "all") chips.push({ label: `Urgência: ${filters.urgency}`, key: "urgency", resetValue: "all" });
    if (filters.source !== "all") chips.push({ label: `Origem: ${filters.source}`, key: "source", resetValue: "all" });
    if (filters.produto !== "all") chips.push({ label: `Produto: ${filters.produto}`, key: "produto", resetValue: "all" });
    if (filters.uf !== "all") chips.push({ label: `UF: ${filters.uf}`, key: "uf", resetValue: "all" });
    if (filters.proprietario !== "all") chips.push({ label: `Dono: ${filters.proprietario}`, key: "proprietario", resetValue: "all" });
    if (filters.oportunidade !== "all") chips.push({ label: `Oport: ${filters.oportunidade}`, key: "oportunidade", resetValue: "all" });
    if (filters.activeProduct !== "all") chips.push({ label: `Ativo: ${filters.activeProduct}`, key: "activeProduct", resetValue: "all" });
    if (filters.stagnant) chips.push({ label: "Estagnados >30d", key: "stagnant", resetValue: false });
    if (filters.valorMin) chips.push({ label: `Valor ≥ ${filters.valorMin}`, key: "valorMin", resetValue: "" });
    if (filters.valorMax) chips.push({ label: `Valor ≤ ${filters.valorMax}`, key: "valorMax", resetValue: "" });
    return chips;
  }, [filters]);

  const hasFilters = activeChips.length > 0 || debouncedSearch;

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "nome", "email", "telefone_normalized", "cidade", "uf", "lead_status", "temperatura_lead",
      "lead_stage_detected", "urgency_level", "produto_interesse", "status_oportunidade",
      "valor_oportunidade", "score", "intelligence_score_total", "proprietario_lead_crm",
      "source", "funil_entrada_crm", "itens_proposta_crm", "tags_crm",
      "ativo_scan", "ativo_print", "ativo_cad", "ativo_notebook", "ativo_insumos",
      "rota_inicial_lia", "resumo_historico_ia", "created_at", "updated_at"
    ];
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = Array.isArray(v) ? v.join("; ") : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [headers.join(","), ...leads.map((l) => headers.map((h) => escape((l as Record<string, unknown>)[h])).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `publico_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${leads.length} leads exportados`);
  };

  // Available statuses for selected pipeline
  const statusesForPipeline = useMemo(() => {
    if (filters.pipeline === "all") return ALL_STATUSES;
    return PIPELINE_GROUPS[filters.pipeline]?.statuses || ALL_STATUSES;
  }, [filters.pipeline]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">
                Público / Lista
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({totalCount.toLocaleString("pt-BR")} leads)
                </span>
              </CardTitle>
            </div>
            <div className="flex gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Limpar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={leads.length === 0}>
                <Download className="w-4 h-4 mr-1" /> CSV ({leads.length})
              </Button>
            </div>
          </div>

          {/* Primary Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
            <div className="relative col-span-2 md:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, email, telefone..."
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={filters.pipeline} onValueChange={(v) => { setFilter("pipeline", v); setFilter("status", "all"); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pipeline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Pipelines</SelectItem>
                {Object.entries(PIPELINE_GROUPS).map(([k, g]) => (
                  <SelectItem key={k} value={k}>{g.emoji} {g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {statusesForPipeline.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.temperatura} onValueChange={(v) => setFilter("temperatura", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Temp." /></SelectTrigger>
              <SelectContent>
                {TEMP_OPTIONS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.urgency} onValueChange={(v) => setFilter("urgency", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Urgência" /></SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters (collapsible) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1">
                <Filter className="w-3.5 h-3.5" />
                Filtros avançados
                {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Select value={filters.source} onValueChange={(v) => setFilter("source", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Origem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Origens</SelectItem>
                    {allSources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.produto} onValueChange={(v) => setFilter("produto", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Produtos</SelectItem>
                    {allProducts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.uf} onValueChange={(v) => setFilter("uf", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos UFs</SelectItem>
                    {allUFs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.proprietario} onValueChange={(v) => setFilter("proprietario", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Proprietário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {allOwners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.oportunidade} onValueChange={(v) => setFilter("oportunidade", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Oportunidade" /></SelectTrigger>
                  <SelectContent>
                    {OPORT_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.stage} onValueChange={(v) => setFilter("stage", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Estágio Cogn." /></SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.activeProduct} onValueChange={(v) => setFilter("activeProduct", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Prod. Ativo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PRODUCT_FLAGS.map((p) => (
                      <SelectItem key={p} value={p}>{p.replace("_", " ").toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Valor mín."
                  type="number"
                  value={filters.valorMin}
                  onChange={(e) => setFilter("valorMin", e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Valor máx."
                  type="number"
                  value={filters.valorMax}
                  onChange={(e) => setFilter("valorMax", e.target.value)}
                  className="h-9 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="stagnant-filter"
                    checked={filters.stagnant}
                    onCheckedChange={(c) => setFilter("stagnant", !!c)}
                  />
                  <label htmlFor="stagnant-filter" className="text-xs whitespace-nowrap cursor-pointer">
                    Estagnados (&gt;30d)
                  </label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Active Filter Chips */}
          {activeChips.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {activeChips.map((chip) => (
                <FilterChip
                  key={chip.key}
                  label={chip.label}
                  onRemove={() => setFilter(chip.key, chip.resetValue as any)}
                />
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Lead</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>🌡️</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Oport.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Cognitivo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ativos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <TableCell className="font-medium whitespace-nowrap">
                          <div className="text-sm">{lead.nome}</div>
                          <div className="text-[10px] text-muted-foreground">{lead.email}</div>
                          {lead.telefone_normalized && (
                            <div className="text-[10px] text-muted-foreground">{lead.telefone_normalized}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {lead.cidade && lead.uf ? `${lead.cidade}/${lead.uf}` : lead.uf || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] whitespace-nowrap">
                            {getPipelineForStatus(lead.lead_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_LABEL[lead.lead_status] || lead.lead_status}
                          </Badge>
                        </TableCell>
                        <TableCell><TempBadge temp={lead.temperatura_lead} /></TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">
                          {lead.produto_interesse || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={lead.status_oportunidade === "ganha" ? "default" : lead.status_oportunidade === "perdida" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {lead.status_oportunidade || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {lead.valor_oportunidade ? `R$ ${Number(lead.valor_oportunidade).toLocaleString("pt-BR")}` : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {lead.intelligence_score_total ?? lead.score ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">
                          {lead.proprietario_lead_crm || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StageBadge stage={lead.lead_stage_detected} />
                            <UrgencyIcon urgency={lead.urgency_level} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{lead.source || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                        <TableCell><ActiveIcons lead={lead} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Página {page + 1} de {totalPages} · {totalCount.toLocaleString("pt-BR")} leads
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog — simplified inline version */}
      {selectedLead && (
        <Dialog open={!!selectedLead} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes — {selectedLead.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{getPipelineForStatus(selectedLead.lead_status)}</Badge>
                <Badge variant="outline">{STATUS_LABEL[selectedLead.lead_status] || selectedLead.lead_status}</Badge>
                <TempBadge temp={selectedLead.temperatura_lead} />
                <StageBadge stage={selectedLead.lead_stage_detected} />
                <UrgencyIcon urgency={selectedLead.urgency_level} />
              </div>

              {/* AI Summary */}
              {selectedLead.resumo_historico_ia && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Resumo IA</span>
                  </div>
                  <p className="text-sm">{selectedLead.resumo_historico_ia}</p>
                </div>
              )}

              {/* Data grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { label: "Email", value: selectedLead.email },
                  { label: "Telefone", value: selectedLead.telefone_normalized },
                  { label: "Cidade/UF", value: selectedLead.cidade && selectedLead.uf ? `${selectedLead.cidade}/${selectedLead.uf}` : selectedLead.uf },
                  { label: "Produto Interesse", value: selectedLead.produto_interesse },
                  { label: "Proprietário", value: selectedLead.proprietario_lead_crm },
                  { label: "Origem", value: selectedLead.source },
                  { label: "Funil CRM", value: selectedLead.funil_entrada_crm },
                  { label: "PipeRun ID", value: selectedLead.piperun_id },
                  { label: "Oportunidade", value: selectedLead.status_oportunidade },
                  { label: "Valor", value: selectedLead.valor_oportunidade ? `R$ ${Number(selectedLead.valor_oportunidade).toLocaleString("pt-BR")}` : null },
                  { label: "Score", value: selectedLead.intelligence_score_total ?? selectedLead.score },
                  { label: "Rota LIA", value: selectedLead.rota_inicial_lia },
                  { label: "Itens Proposta", value: selectedLead.itens_proposta_crm },
                  { label: "Abordagem", value: selectedLead.recommended_approach },
                  { label: "Campanha", value: selectedLead.origem_campanha },
                  { label: "UTM Source", value: selectedLead.utm_source },
                  { label: "Criado", value: formatDate(selectedLead.created_at) },
                  { label: "Atualizado", value: formatDate(selectedLead.updated_at) },
                ].filter((f) => f.value !== null && f.value !== undefined && f.value !== "").map((f) => (
                  <div key={f.label} className="p-2 rounded border bg-muted/30">
                    <div className="text-[10px] text-muted-foreground font-mono">{f.label}</div>
                    <div className="text-sm break-all">{String(f.value)}</div>
                  </div>
                ))}
              </div>

              {/* Active Products */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Produtos Ativos</h4>
                <div className="flex gap-1.5 flex-wrap">
                  {PRODUCT_FLAGS.map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className={`text-[10px] ${selectedLead[`ativo_${p}`] ? "bg-green-50 text-green-700 border-green-300" : "bg-muted/30 text-muted-foreground"}`}
                    >
                      {p.replace("_", " ").toUpperCase()}: {selectedLead[`ativo_${p}`] ? "✓" : "—"}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tags */}
              {selectedLead.tags_crm && selectedLead.tags_crm.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Tags CRM ({selectedLead.tags_crm.length})</h4>
                  <div className="flex gap-1 flex-wrap">
                    {selectedLead.tags_crm.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* PipeRun link */}
              {selectedLead.piperun_link && (
                <a href={selectedLead.piperun_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                  Abrir no PipeRun →
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
