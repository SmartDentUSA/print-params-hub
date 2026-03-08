import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const INTEREST_OPTIONS = [
  { key: "all", label: "Todos Interesses" },
  { key: "sdr_scanner_interesse", label: "📷 Scanner" },
  { key: "sdr_impressora_interesse", label: "🖨️ Impressora" },
  { key: "sdr_software_cad_interesse", label: "💻 Software CAD" },
  { key: "sdr_pos_impressao_interesse", label: "♨️ Pós-impressão" },
  { key: "sdr_caracterizacao_interesse", label: "🔬 Caracterização" },
  { key: "sdr_cursos_interesse", label: "🎓 Cursos" },
  { key: "sdr_dentistica_interesse", label: "🦷 Dentística" },
  { key: "sdr_insumos_lab_interesse", label: "🧪 Insumos Lab" },
  { key: "sdr_solucoes_interesse", label: "🔧 Soluções" },
] as const;

const SDR_FIELDS = INTEREST_OPTIONS.filter(o => o.key !== "all").map(o => o.key);

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
  sdr_scanner_interesse: string | null;
  sdr_impressora_interesse: string | null;
  sdr_software_cad_interesse: string | null;
  sdr_pos_impressao_interesse: string | null;
  sdr_caracterizacao_interesse: string | null;
  sdr_cursos_interesse: string | null;
  sdr_dentistica_interesse: string | null;
  sdr_insumos_lab_interesse: string | null;
  sdr_solucoes_interesse: string | null;
  status_atual_lead_crm: string | null;
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
  interestProduct: string;
  stagnant: boolean;
  valorMin: string;
  valorMax: string;
  itemProposta: string;
  statusCRM: string;
}

const EMPTY_FILTERS: Filters = {
  search: "", pipeline: "all", status: "all", temperatura: "all", stage: "all",
  urgency: "all", source: "all", produto: "all", uf: "all", proprietario: "all",
  oportunidade: "all", activeProduct: "all", interestProduct: "all", stagnant: false,
  valorMin: "", valorMax: "", itemProposta: "all", statusCRM: "all",
};

const ITEM_PROPOSTA_OPTIONS = [
  { key: "all", label: "Todos Itens" },
  { key: "Scanner", label: "Scanner" },
  { key: "Impressora", label: "Impressora" },
  { key: "CAD", label: "Software CAD" },
  { key: "Notebook", label: "Notebook" },
  { key: "Resina", label: "Resina" },
  { key: "Insumo", label: "Insumos" },
  { key: "Pós", label: "Pós-impressão" },
  { key: "Cura", label: "Cura" },
  { key: "Curso", label: "Cursos" },
];

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

function FieldGrid({ lead, fields, startIndex = 0 }: { lead: LeadRow; fields: string[]; startIndex?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {fields.map((f, i) => {
        const val = lead[f];
        const isEmpty = val === null || val === undefined || val === "";
        const num = startIndex + i + 1;
        return (
          <div key={f} className={`p-2 rounded border ${isEmpty ? "bg-muted/10 border-dashed" : "bg-muted/30"}`}>
            <div className="text-[10px] font-mono text-muted-foreground">
              <span className="text-primary/60 font-bold">#{num}</span> · {f}
            </div>
            <div className={`text-sm break-all ${isEmpty ? "text-muted-foreground italic" : ""}`}>
              {isEmpty ? "—"
                : typeof val === "boolean" ? (val ? "✓" : "✗")
                : Array.isArray(val) ? (val as string[]).join(", ")
                : typeof val === "object" ? JSON.stringify(val).slice(0, 120) + "…"
                : String(val)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  if (!data || (typeof data === "object" && Object.keys(data as object).length === 0) || (Array.isArray(data) && data.length === 0)) return null;
  return (
    <details className="mt-2">
      <summary className="text-xs font-mono text-muted-foreground cursor-pointer hover:text-foreground">{label}</summary>
      <pre className="text-[10px] bg-muted/50 p-2 rounded mt-1 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
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

function InterestIcons({ lead }: { lead: LeadRow }) {
  const interests = SDR_FIELDS.filter((f) => lead[f] != null && lead[f] !== "");
  if (interests.length === 0) return <span className="text-muted-foreground text-[10px]">—</span>;
  const labelMap: Record<string, string> = {
    sdr_scanner_interesse: "📷",
    sdr_impressora_interesse: "🖨️",
    sdr_software_cad_interesse: "💻",
    sdr_pos_impressao_interesse: "♨️",
    sdr_caracterizacao_interesse: "🔬",
    sdr_cursos_interesse: "🎓",
    sdr_dentistica_interesse: "🦷",
    sdr_insumos_lab_interesse: "🧪",
    sdr_solucoes_interesse: "🔧",
  };
  return (
    <div className="flex gap-0.5 flex-wrap">
      {interests.slice(0, 4).map((f) => (
        <Badge key={f} variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
          {labelMap[f] || "?"} {String(lead[f]).length > 12 ? String(lead[f]).slice(0, 12) + "…" : lead[f]}
        </Badge>
      ))}
      {interests.length > 4 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{interests.length - 4}</Badge>}
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
  const [allStatusCRM, setAllStatusCRM] = useState<string[]>([]);

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
      supabase.from("lia_attendances").select("status_atual_lead_crm").limit(1000),
    ]).then(([sources, ufs, owners, products, statusCRMs]) => {
      const unique = (data: { [k: string]: string | null }[] | null, key: string) =>
        [...new Set((data || []).map((d) => d[key]).filter(Boolean))].sort() as string[];
      setAllSources(unique(sources.data as { source: string }[], "source"));
      setAllUFs(unique(ufs.data as { uf: string }[], "uf"));
      setAllOwners(unique(owners.data as { proprietario_lead_crm: string }[], "proprietario_lead_crm"));
      setAllProducts(unique(products.data as { produto_interesse: string }[], "produto_interesse"));
      setAllStatusCRM(unique(statusCRMs.data as { status_atual_lead_crm: string }[], "status_atual_lead_crm"));
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
      .order("created_at", { ascending: false }) as any;

    // Pipeline filter → multiple statuses
    if (filters.pipeline !== "all") {
      const group = PIPELINE_GROUPS[filters.pipeline];
      if (group) query = query.in("lead_status", group.statuses);
    }
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
    if (filters.activeProduct !== "all") query = query.eq(`ativo_${filters.activeProduct}`, true);
    if (filters.itemProposta !== "all") query = query.ilike("itens_proposta_crm", `%${filters.itemProposta}%`);
    if (filters.interestProduct !== "all") query = query.not(filters.interestProduct, "is", null);
    if (filters.statusCRM !== "all") query = query.eq("status_atual_lead_crm", filters.statusCRM);

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
    if (filters.itemProposta !== "all") chips.push({ label: `Proposta: ${filters.itemProposta}`, key: "itemProposta", resetValue: "all" });
    if (filters.interestProduct !== "all") {
      const opt = INTEREST_OPTIONS.find(o => o.key === filters.interestProduct);
      chips.push({ label: `Interesse: ${opt?.label.replace(/^[^\s]+ /, '') || filters.interestProduct}`, key: "interestProduct", resetValue: "all" });
    }
    if (filters.stagnant) chips.push({ label: "Estagnados >30d", key: "stagnant", resetValue: false });
    if (filters.statusCRM !== "all") chips.push({ label: `Status CRM: ${filters.statusCRM}`, key: "statusCRM", resetValue: "all" });
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
      "sdr_scanner_interesse", "sdr_impressora_interesse", "sdr_software_cad_interesse",
      "sdr_pos_impressao_interesse", "sdr_cursos_interesse", "sdr_dentistica_interesse",
      "sdr_insumos_lab_interesse", "sdr_solucoes_interesse", "sdr_caracterizacao_interesse",
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
                <Select value={filters.interestProduct} onValueChange={(v) => setFilter("interestProduct", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Interesse" /></SelectTrigger>
                  <SelectContent>
                    {INTEREST_OPTIONS.map((i) => (
                      <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.itemProposta} onValueChange={(v) => setFilter("itemProposta", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Item Proposta" /></SelectTrigger>
                  <SelectContent>
                    {ITEM_PROPOSTA_OPTIONS.map((i) => (
                      <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.statusCRM} onValueChange={(v) => setFilter("statusCRM", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status CRM" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status CRM</SelectItem>
                    {allStatusCRM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                      <TableHead>Interesse</TableHead>
                      <TableHead>Proposta</TableHead>
                      <TableHead>Status CRM</TableHead>
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
                        <TableCell><InterestIcons lead={lead} /></TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">
                          {lead.itens_proposta_crm || "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">
                          {lead.status_atual_lead_crm || "—"}
                        </TableCell>
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

      {/* Lead Detail Dialog — full fields */}
      {selectedLead && (
        <Dialog open={!!selectedLead} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {selectedLead.nome}
                <Badge variant="outline">{getPipelineForStatus(selectedLead.lead_status)}</Badge>
                <Badge variant="outline">{STATUS_LABEL[selectedLead.lead_status] || selectedLead.lead_status}</Badge>
                <TempBadge temp={selectedLead.temperatura_lead} />
                <StageBadge stage={selectedLead.lead_stage_detected} />
                <UrgencyIcon urgency={selectedLead.urgency_level} />
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              <Accordion type="multiple" defaultValue={["ident","funil"]} className="w-full">
                {/* 1 — Identificação */}
                <AccordionItem value="ident">
                  <AccordionTrigger className="text-sm font-semibold">📇 Identificação</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={0} fields={[
                      "nome","email","telefone_normalized","telefone_raw","cidade","uf","pais_origem",
                      "area_atuacao","especialidade","como_digitaliza","tem_impressora","impressora_modelo",
                      "tem_scanner","software_cad","volume_mensal_pecas","principal_aplicacao",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 2 — Funil & Status */}
                <AccordionItem value="funil">
                  <AccordionTrigger className="text-sm font-semibold">🎯 Funil & Status</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={16} fields={[
                      "lead_status","status_oportunidade","temperatura_lead","lead_stage_detected",
                      "urgency_level","status_atual_lead_crm","funil_entrada_crm","ultima_etapa_comercial",
                      "proprietario_lead_crm","produto_interesse","produto_interesse_auto","resina_interesse",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 3 — Oportunidade CRM / PipeRun */}
                <AccordionItem value="crm">
                  <AccordionTrigger className="text-sm font-semibold">💼 Oportunidade CRM</AccordionTrigger>
                  <AccordionContent>
                    {selectedLead.piperun_link && (
                      <a href={String(selectedLead.piperun_link)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mb-2 inline-block">
                        Abrir no PipeRun →
                      </a>
                    )}
                    <FieldGrid lead={selectedLead} startIndex={28} fields={[
                      "piperun_id","piperun_title","piperun_hash","piperun_pipeline_name","piperun_stage_name",
                      "piperun_origin_name","piperun_description","piperun_observation","piperun_probability",
                      "piperun_lead_time","piperun_value_mrr","piperun_status","piperun_frozen","piperun_frozen_at",
                      "piperun_created_at","piperun_closed_at","piperun_probably_closed_at",
                      "piperun_last_contact_at","piperun_stage_changed_at","piperun_pipeline_id",
                      "piperun_stage_id","piperun_origin_id","piperun_owner_id",
                      "valor_oportunidade","data_fechamento_crm","lead_timing_dias",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 4 — Pessoa & Empresa */}
                <AccordionItem value="pessoa">
                  <AccordionTrigger className="text-sm font-semibold">🏢 Pessoa & Empresa</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={54} fields={[
                      "pessoa_cpf","pessoa_cargo","pessoa_genero","pessoa_nascimento",
                      "pessoa_linkedin","pessoa_facebook","pessoa_observation","pessoa_piperun_id",
                      "empresa_cnpj","empresa_razao_social","empresa_nome","empresa_ie",
                      "empresa_porte","empresa_segmento","empresa_situacao","empresa_website","empresa_cnae",
                      "empresa_piperun_id",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 5 — Produtos Ativos */}
                <AccordionItem value="ativos">
                  <AccordionTrigger className="text-sm font-semibold">✅ Produtos Ativos & Equipamentos</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {PRODUCT_FLAGS.map((p) => (
                        <Badge key={p} variant="outline"
                          className={`text-[10px] ${selectedLead[`ativo_${p}`] ? "bg-green-50 text-green-700 border-green-300" : "bg-muted/30 text-muted-foreground"}`}>
                          {p.replace("_", " ").toUpperCase()}: {selectedLead[`ativo_${p}`] ? "✓" : "—"}
                        </Badge>
                      ))}
                    </div>
                    <FieldGrid lead={selectedLead} startIndex={72} fields={[
                      "equip_scanner","equip_scanner_serial","equip_scanner_ativacao",
                      "equip_impressora","equip_impressora_serial","equip_impressora_ativacao",
                      "equip_cad","equip_cad_serial","equip_cad_ativacao",
                      "equip_pos_impressao","equip_pos_impressao_serial","equip_pos_impressao_ativacao",
                      "equip_notebook","equip_notebook_serial","equip_notebook_ativacao",
                      "insumos_adquiridos",
                      "data_ultima_compra_scan","data_ultima_compra_notebook","data_ultima_compra_cad",
                      "data_ultima_compra_cad_ia","data_ultima_compra_smart_slice","data_ultima_compra_print",
                      "data_ultima_compra_cura","data_ultima_compra_insumos",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 6 — Produtos de Interesse (SDR) */}
                <AccordionItem value="interesse">
                  <AccordionTrigger className="text-sm font-semibold">🎯 Produtos de Interesse (SDR)</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={96} fields={[
                      "sdr_scanner_interesse","sdr_impressora_interesse","sdr_software_cad_interesse",
                      "sdr_pos_impressao_interesse","sdr_caracterizacao_interesse","sdr_cursos_interesse",
                      "sdr_dentistica_interesse","sdr_insumos_lab_interesse","sdr_solucoes_interesse",
                      "sdr_marca_impressora_param","sdr_modelo_impressora_param","sdr_resina_param",
                      "informacao_desejada",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 7 — Proposta */}
                <AccordionItem value="proposta">
                  <AccordionTrigger className="text-sm font-semibold">📋 Proposta</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={109} fields={[
                      "itens_proposta_crm","proposals_total_value","proposals_total_mrr","proposals_last_status",
                    ]} />
                    <JsonBlock label="itens_proposta_parsed" data={selectedLead.itens_proposta_parsed} />
                    <JsonBlock label="proposals_data" data={selectedLead.proposals_data} />
                  </AccordionContent>
                </AccordionItem>

                {/* 8 — Inteligência & Cognitivo */}
                <AccordionItem value="intel">
                  <AccordionTrigger className="text-sm font-semibold">🧠 Inteligência & Cognitivo</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={113} fields={[
                      "intelligence_score_total","confidence_score_analysis","prediction_accuracy",
                      "lead_stage_detected","psychological_profile","primary_motivation",
                      "objection_risk","recommended_approach","interest_timeline","urgency_level",
                      "cognitive_analyzed_at","cognitive_model_version",
                    ]} />
                    <JsonBlock label="intelligence_score" data={selectedLead.intelligence_score} />
                    <JsonBlock label="cognitive_analysis" data={selectedLead.cognitive_analysis} />
                  </AccordionContent>
                </AccordionItem>

                {/* 9 — Histórico LIA */}
                <AccordionItem value="lia">
                  <AccordionTrigger className="text-sm font-semibold">💬 Histórico LIA</AccordionTrigger>
                  <AccordionContent>
                    {selectedLead.resumo_historico_ia && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Brain className="w-4 h-4 text-primary" />
                          <span className="text-xs font-semibold text-primary">Resumo IA</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{String(selectedLead.resumo_historico_ia)}</p>
                      </div>
                    )}
                    <FieldGrid lead={selectedLead} startIndex={125} fields={[
                      "total_sessions","total_messages","ultima_sessao_at","rota_inicial_lia",
                      "proactive_count","proactive_sent_at","score",
                    ]} />
                    <JsonBlock label="historico_resumos" data={selectedLead.historico_resumos} />
                  </AccordionContent>
                </AccordionItem>

                {/* 10 — Astron */}
                <AccordionItem value="astron">
                  <AccordionTrigger className="text-sm font-semibold">🎓 Astron</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={132} fields={[
                      "astron_status","astron_user_id","astron_nome","astron_email","astron_phone",
                      "astron_plans_active","astron_courses_total","astron_courses_completed",
                      "astron_last_login_at","astron_created_at","astron_synced_at","astron_login_url",
                    ]} />
                    <JsonBlock label="astron_plans_data" data={selectedLead.astron_plans_data} />
                    <JsonBlock label="astron_courses_access" data={selectedLead.astron_courses_access} />
                  </AccordionContent>
                </AccordionItem>

                {/* 11 — Loja Integrada */}
                <AccordionItem value="loja">
                  <AccordionTrigger className="text-sm font-semibold">🛒 Loja Integrada</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={144} fields={[
                      "lojaintegrada_cliente_id","lojaintegrada_ltv","lojaintegrada_total_pedidos_pagos",
                      "lojaintegrada_primeira_compra","lojaintegrada_ultimo_pedido_numero",
                      "lojaintegrada_ultimo_pedido_data","lojaintegrada_ultimo_pedido_valor",
                      "lojaintegrada_ultimo_pedido_status","lojaintegrada_forma_pagamento",
                      "lojaintegrada_forma_envio","lojaintegrada_cupom_desconto","lojaintegrada_utm_campaign",
                      "lojaintegrada_sexo","lojaintegrada_data_nascimento","lojaintegrada_cliente_obs",
                      "lojaintegrada_endereco","lojaintegrada_numero","lojaintegrada_complemento",
                      "lojaintegrada_bairro","lojaintegrada_cep","lojaintegrada_referencia",
                      "lojaintegrada_updated_at",
                    ]} />
                    <JsonBlock label="lojaintegrada_itens_json" data={selectedLead.lojaintegrada_itens_json} />
                    <JsonBlock label="lojaintegrada_historico_pedidos" data={selectedLead.lojaintegrada_historico_pedidos} />
                  </AccordionContent>
                </AccordionItem>

                {/* 12 — UTM & Origem */}
                <AccordionItem value="utm">
                  <AccordionTrigger className="text-sm font-semibold">📡 UTM & Origem</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={166} fields={[
                      "source","form_name","origem_campanha","utm_source","utm_medium","utm_campaign","utm_term","ip_origem",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 13 — CS & Suporte */}
                <AccordionItem value="cs">
                  <AccordionTrigger className="text-sm font-semibold">🎧 CS & Suporte</AccordionTrigger>
                  <AccordionContent>
                    <FieldGrid lead={selectedLead} startIndex={174} fields={[
                      "cs_treinamento","data_treinamento","data_contrato","codigo_contrato",
                      "sdr_suporte_equipamento","sdr_suporte_tipo","sdr_suporte_descricao",
                      "reuniao_agendada","data_primeiro_contato",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 14 — Tags & Metadados */}
                <AccordionItem value="meta">
                  <AccordionTrigger className="text-sm font-semibold">🏷️ Tags & Metadados</AccordionTrigger>
                  <AccordionContent>
                    {selectedLead.tags_crm && (selectedLead.tags_crm as string[]).length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {(selectedLead.tags_crm as string[]).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <FieldGrid lead={selectedLead} startIndex={183} fields={[
                      "motivo_perda","comentario_perda","id_cliente_smart","entrada_sistema",
                      "created_at","updated_at","last_automated_action_at","automation_cooldown_until",
                      "crm_lock_until","crm_lock_source",
                      "sellflux_synced_at","intelligence_score_updated_at","intelligence_score_backfilled_at",
                    ]} />
                  </AccordionContent>
                </AccordionItem>

                {/* 15 — Raw Data */}
                <AccordionItem value="raw">
                  <AccordionTrigger className="text-sm font-semibold">🗄️ Raw Data (JSON)</AccordionTrigger>
                  <AccordionContent>
                    <JsonBlock label="raw_payload" data={selectedLead.raw_payload} />
                    <JsonBlock label="piperun_custom_fields" data={selectedLead.piperun_custom_fields} />
                    <JsonBlock label="empresa_custom_fields" data={selectedLead.empresa_custom_fields} />
                    <JsonBlock label="sellflux_custom_fields" data={selectedLead.sellflux_custom_fields} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
