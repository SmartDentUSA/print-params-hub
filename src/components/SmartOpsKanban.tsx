import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KanbanColumn, type ColumnDef } from "@/components/smartops/KanbanColumn";
import { KanbanLeadDetail } from "@/components/smartops/KanbanLeadDetail";
import type { Lead } from "@/components/smartops/KanbanLeadCard";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLUMNS: ColumnDef[] = [
  { key: "novo", label: "Novo", color: "bg-emerald-50 border-emerald-300" },
  { key: "sem_contato", label: "Sem Contato", color: "bg-sky-50 border-sky-300" },
  { key: "contato_feito", label: "Contato Feito", color: "bg-blue-50 border-blue-300" },
  { key: "em_contato", label: "Em Contato", color: "bg-yellow-50 border-yellow-300" },
  { key: "apresentacao", label: "Apresentação/Visita", color: "bg-orange-50 border-orange-300" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "bg-purple-50 border-purple-300" },
  { key: "negociacao", label: "Negociação", color: "bg-indigo-50 border-indigo-300" },
  { key: "fechamento", label: "Fechamento", color: "bg-green-50 border-green-300" },
];

const STAGNANT_COLUMNS: ColumnDef[] = [
  { key: "est_etapa1", label: "Etapa 01", color: "bg-rose-50 border-rose-300" },
  { key: "est_etapa2", label: "Etapa 02", color: "bg-rose-100 border-rose-400" },
  { key: "est_etapa3", label: "Etapa 03", color: "bg-amber-50 border-amber-300" },
  { key: "est_etapa4", label: "Etapa 04", color: "bg-amber-100 border-amber-400" },
  { key: "est_apresentacao", label: "Apresentação", color: "bg-orange-100 border-orange-400" },
  { key: "est_proposta", label: "Proposta", color: "bg-slate-50 border-slate-300" },
  { key: "estagnado_final", label: "Final", color: "bg-muted border-border" },
];

const CS_COLUMNS: ColumnDef[] = [
  { key: "cs_auxiliar_email", label: "Auxiliar Email", color: "bg-gray-50 border-gray-300" },
  { key: "cs_em_espera", label: "Em Espera", color: "bg-teal-50 border-teal-300" },
  { key: "cs_sem_data_agendar", label: "Sem Data", color: "bg-cyan-50 border-cyan-300" },
  { key: "cs_nao_quer_imersao", label: "S/ Imersão", color: "bg-slate-50 border-slate-300" },
  { key: "cs_treinamento_agendado", label: "Trein. Agend.", color: "bg-blue-50 border-blue-300" },
  { key: "cs_treinamento_realizado", label: "Trein. Real.", color: "bg-blue-100 border-blue-400" },
  { key: "cs_enviar_imp3d", label: "Enviar IMP3D", color: "bg-indigo-50 border-indigo-300" },
  { key: "cs_equipamentos_entregues", label: "Equip. Entreg.", color: "bg-green-50 border-green-300" },
  { key: "cs_retirar_scan", label: "Retirar Scan", color: "bg-green-100 border-green-400" },
  { key: "cs_acompanhamento_15d", label: "Acomp. 15d", color: "bg-yellow-50 border-yellow-300" },
  { key: "cs_acomp_30d_comercial", label: "Acomp. 30d", color: "bg-yellow-100 border-yellow-400" },
  { key: "cs_acompanhamento_atencao", label: "Atenção", color: "bg-red-50 border-red-300" },
  { key: "cs_finalizado", label: "Finalizado", color: "bg-emerald-50 border-emerald-300" },
  { key: "cs_nao_use_dkmngr", label: "S/ DKMngr", color: "bg-orange-50 border-orange-300" },
  { key: "cs_nao_use_omie_fix", label: "S/ Omie/Fix", color: "bg-orange-100 border-orange-400" },
];

const INSUMOS_COLUMNS: ColumnDef[] = [
  { key: "insumos_sem_contato", label: "Sem Contato", color: "bg-lime-50 border-lime-300" },
  { key: "insumos_contato_feito", label: "Contato Feito", color: "bg-lime-100 border-lime-400" },
  { key: "insumos_amostra_enviada", label: "Amostra Env.", color: "bg-emerald-50 border-emerald-300" },
  { key: "insumos_retorno_amostra", label: "Ret. Amostra", color: "bg-emerald-100 border-emerald-400" },
  { key: "insumos_fechamento", label: "Fechamento", color: "bg-green-100 border-green-400" },
];

const ECOMMERCE_COLUMNS: ColumnDef[] = [
  { key: "ecom_visitantes", label: "Visitantes", color: "bg-sky-50 border-sky-300" },
  { key: "ecom_navegacao", label: "Navegação", color: "bg-sky-100 border-sky-400" },
  { key: "ecom_checkout", label: "Checkout", color: "bg-blue-50 border-blue-300" },
  { key: "ecom_abandono", label: "Abandono", color: "bg-red-50 border-red-300" },
  { key: "ecom_transacao", label: "Transação", color: "bg-yellow-50 border-yellow-300" },
  { key: "ecom_pedido", label: "Pedido", color: "bg-indigo-50 border-indigo-300" },
  { key: "ecom_pos_venda", label: "Pós Venda", color: "bg-green-50 border-green-300" },
  { key: "ecom_ativacao", label: "Ativação", color: "bg-emerald-50 border-emerald-300" },
];

const TABS = [
  { id: "vendas", label: "🎯 Vendas", columns: COLUMNS },
  { id: "estagnados", label: "🔄 Estagnados", columns: STAGNANT_COLUMNS },
  { id: "cs", label: "🎓 CS", columns: CS_COLUMNS },
  { id: "insumos", label: "🧪 Insumos", columns: INSUMOS_COLUMNS },
  { id: "ecommerce", label: "🛒 E-commerce", columns: ECOMMERCE_COLUMNS },
  { id: "ebook", label: "📚 Ebook", columns: [{ key: "ebook", label: "Ebook", color: "bg-violet-50 border-violet-300" }] },
];

const ALL_KEYS = TABS.flatMap((t) => t.columns.map((c) => c.key));
const POLLING_INTERVAL = 30_000;

export function SmartOpsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [movingToPiperun, setMovingToPiperun] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState("vendas");
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeTabColumns = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    return tab ? tab.columns.map((c) => c.key) : [];
  }, [activeTab]);

  // Fetch leads for the active tab only
  const fetchLeads = useCallback(async (tabKeys?: string[]) => {
    const keys = tabKeys || activeTabColumns;
    if (keys.length === 0) return;
    const { data } = await supabase
      .from("lia_attendances")
      .select("*")
      .in("lead_status", keys)
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads((data as unknown as Lead[]) || []);
    setLoading(false);
  }, [activeTabColumns]);

  // Fetch server-side counts for ALL tabs
  const fetchTabCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    const promises = TABS.map(async (tab) => {
      const keys = tab.columns.map((c) => c.key);
      const { count } = await supabase
        .from("lia_attendances")
        .select("*", { count: "exact", head: true })
        .in("lead_status", keys);
      counts[tab.id] = count || 0;
    });
    await Promise.all(promises);
    setTabCounts(counts);
  }, []);

  // Initial load + tab change
  useEffect(() => {
    setLoading(true);
    fetchLeads();
    fetchTabCounts();
  }, [activeTab]);

  // Polling fallback every 30s
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchLeads();
      fetchTabCounts();
    }, POLLING_INTERVAL);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchLeads, fetchTabCounts]);

  // Realtime subscription — filter by active tab
  useEffect(() => {
    const channel = supabase
      .channel("kanban-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lia_attendances" },
        (payload) => {
          const newLead = payload.new as Lead;
          // Always refresh counts
          fetchTabCounts();
          // Only add to local state if it belongs to active tab
          if (activeTabColumns.includes(newLead.lead_status)) {
            setLeads((prev) => {
              if (prev.some((l) => l.id === newLead.id)) return prev;
              return [newLead, ...prev];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lia_attendances" },
        (payload) => {
          const updated = payload.new as Lead;
          fetchTabCounts();
          const inActiveTab = activeTabColumns.includes(updated.lead_status);
          setLeads((prev) => {
            const exists = prev.some((l) => l.id === updated.id);
            if (exists && inActiveTab) {
              return prev.map((l) => (l.id === updated.id ? updated : l));
            }
            if (exists && !inActiveTab) {
              return prev.filter((l) => l.id !== updated.id);
            }
            if (!exists && inActiveTab) {
              return [updated, ...prev];
            }
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "lia_attendances" },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setLeads((prev) => prev.filter((l) => l.id !== deletedId));
          fetchTabCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTabColumns, fetchTabCounts]);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase().trim();
    return leads.filter((l) =>
      l.nome?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.telefone_normalized?.toLowerCase().includes(q) ||
      l.produto_interesse?.toLowerCase().includes(q) ||
      l.cidade?.toLowerCase().includes(q) ||
      l.piperun_id?.toLowerCase().includes(q) ||
      l.proprietario_lead_crm?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const handleDrop = async (newStatus: string) => {
    if (!draggedId) return;
    const lead = leads.find((l) => l.id === draggedId);
    if (!lead || lead.lead_status === newStatus) {
      setDraggedId(null);
      return;
    }

    const { error } = await supabase
      .from("lia_attendances")
      .update({ lead_status: newStatus })
      .eq("id", draggedId);
    if (error) {
      toast({ title: "Erro ao mover lead", description: error.message, variant: "destructive" });
      setDraggedId(null);
      return;
    }

    // If new status is in the active tab, update locally; otherwise remove
    if (activeTabColumns.includes(newStatus)) {
      setLeads((prev) => prev.map((l) => l.id === draggedId ? { ...l, lead_status: newStatus } : l));
    } else {
      setLeads((prev) => prev.filter((l) => l.id !== draggedId));
    }
    fetchTabCounts();

    if (lead.piperun_id) {
      setMovingToPiperun(true);
      try {
        const { data: prResult, error: prError } = await supabase.functions.invoke("smart-ops-kanban-move", {
          body: { piperun_id: lead.piperun_id, new_status: newStatus },
        });
        if (prError) {
          toast({ title: "Lead movido localmente", description: `PipeRun não sincronizado`, variant: "destructive" });
        } else if (prResult?.skipped) {
          toast({ title: "Lead movido", description: `Sem mapeamento PipeRun` });
        } else if (prResult?.success) {
          toast({ title: "Lead movido + PipeRun ✅" });
        }
      } catch (err) {
        console.error("[Kanban] PipeRun sync error:", err);
      } finally {
        setMovingToPiperun(false);
      }
    }
    setDraggedId(null);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>;

  return (
    <div className="space-y-3">
      {/* Search + Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead por nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { fetchLeads(); fetchTabCounts(); }}
          className="h-9 px-2"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {movingToPiperun && (
        <div className="text-xs text-muted-foreground animate-pulse">⏳ Sincronizando PipeRun...</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {tab.label}
              <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">
                {tabCounts[tab.id] ?? "…"}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => {
          const tabLeads = filteredLeads.filter((l) => tab.columns.some((c) => c.key === l.lead_status));
          const showDays = tab.id === "estagnados";
          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-3">
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2" style={{ minWidth: `${tab.columns.length * 212}px` }}>
                  {tab.columns.map((col) => (
                    <KanbanColumn
                      key={col.key}
                      column={col}
                      leads={tabLeads.filter((l) => l.lead_status === col.key)}
                      showDays={showDays}
                      onDragStart={setDraggedId}
                      onDrop={handleDrop}
                      onClick={setSelectedLead}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <KanbanLeadDetail lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
