import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, ChevronLeft, ChevronRight, Check, X } from "lucide-react";

const STATUS_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "novo", label: "Novo" },
  { key: "sem_contato", label: "Sem Contato" },
  { key: "contato_feito", label: "Contato Feito" },
  { key: "em_contato", label: "Em Contato" },
  { key: "apresentacao", label: "Apresentação" },
  { key: "proposta_enviada", label: "Proposta Enviada" },
  { key: "negociacao", label: "Negociação" },
  { key: "fechamento", label: "Fechamento" },
];

const PAGE_SIZE = 50;

const PRODUCT_FLAGS = ["scan", "notebook", "cad", "cad_ia", "smart_slice", "print", "cura", "insumos"] as const;

interface LeadFull {
  [key: string]: unknown;
  id: string;
  nome: string;
  email: string;
  telefone_raw: string | null;
  telefone_normalized: string | null;
  source: string;
  form_name: string | null;
  lead_status: string;
  score: number | null;
  created_at: string;
  updated_at: string;
  data_primeiro_contato: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  como_digitaliza: string | null;
  tem_impressora: string | null;
  impressora_modelo: string | null;
  resina_interesse: string | null;
  produto_interesse: string | null;
  origem_campanha: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  proprietario_lead_crm: string | null;
  status_atual_lead_crm: string | null;
  funil_entrada_crm: string | null;
  piperun_id: string | null;
  id_cliente_smart: string | null;
  rota_inicial_lia: string | null;
  resumo_historico_ia: string | null;
  reuniao_agendada: boolean | null;
  data_contrato: string | null;
  cs_treinamento: string | null;
  ativo_scan: boolean | null;
  ativo_notebook: boolean | null;
  ativo_cad: boolean | null;
  ativo_cad_ia: boolean | null;
  ativo_smart_slice: boolean | null;
  ativo_print: boolean | null;
  ativo_cura: boolean | null;
  ativo_insumos: boolean | null;
  // New CRM fields
  status_oportunidade: string | null;
  valor_oportunidade: number | null;
  tags_crm: string[] | null;
  temperatura_lead: string | null;
  motivo_perda: string | null;
  comentario_perda: string | null;
  cidade: string | null;
  uf: string | null;
  tem_scanner: string | null;
  data_fechamento_crm: string | null;
  lead_timing_dias: number | null;
  itens_proposta_crm: string | null;
  piperun_link: string | null;
}

function ActiveIcons({ lead }: { lead: LeadFull }) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {PRODUCT_FLAGS.map((p) => {
        const key = `ativo_${p}` as keyof LeadFull;
        const active = lead[key] === true;
        if (!active) return null;
        return (
          <Badge key={p} variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-300">
            {p.replace("_", " ").toUpperCase()}
          </Badge>
        );
      })}
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function SmartOpsLeadsList() {
  const [leads, setLeads] = useState<LeadFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<LeadFull | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("lia_attendances")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      setLeads((data as LeadFull[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const sources = useMemo(() => [...new Set(leads.map((l) => l.source))].sort(), [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.lead_status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.nome.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, sourceFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search, statusFilter, sourceFilter]);

  const exportCSV = () => {
    const headers = ["nome", "email", "telefone_normalized", "produto_interesse", "lead_status", "score", "proprietario_lead_crm", "source", "created_at"];
    const csv = [headers.join(","), ...filtered.map((l) => headers.map((h) => `"${formatValue((l as Record<string, unknown>)[h])}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_smartops_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <CardTitle className="text-lg">Lista de Leads ({filtered.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Oport.</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Temp.</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ativos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <div>{lead.nome}</div>
                      <div className="text-[10px] text-muted-foreground">{lead.email}</div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {lead.cidade && lead.uf ? `${lead.cidade}/${lead.uf}` : lead.uf || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{lead.produto_interesse || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{lead.lead_status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={lead.status_oportunidade === "ganha" ? "default" : lead.status_oportunidade === "perdida" ? "destructive" : "secondary"} className="text-[10px]">
                        {lead.status_oportunidade || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {lead.valor_oportunidade ? `R$ ${Number(lead.valor_oportunidade).toLocaleString("pt-BR")}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{lead.temperatura_lead || "—"}</TableCell>
                    <TableCell className="text-center">{lead.score ?? 0}</TableCell>
                    <TableCell className="text-xs">{lead.proprietario_lead_crm || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                    <TableCell><ActiveIcons lead={lead} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
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
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes — {selectedLead?.nome}</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(selectedLead).filter(([k]) => k !== "raw_payload").map(([key, val]) => (
                <div key={key} className="p-2 rounded bg-muted/30 border">
                  <div className="text-[10px] text-muted-foreground font-mono">{key}</div>
                  <div className="text-sm break-all">{formatValue(val)}</div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
