import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone_normalized: string | null;
  produto_interesse: string | null;
  proprietario_lead_crm: string | null;
  source: string;
  lead_status: string;
  created_at: string;
  updated_at: string;
  data_primeiro_contato: string | null;
  score: number | null;
}

const COLUMNS = [
  { key: "sem_contato", label: "Sem Contato", color: "bg-sky-50 border-sky-300" },
  { key: "contato_feito", label: "Contato Feito", color: "bg-blue-50 border-blue-300" },
  { key: "em_contato", label: "Em Contato", color: "bg-yellow-50 border-yellow-300" },
  { key: "apresentacao", label: "Apresentação/Visita", color: "bg-orange-50 border-orange-300" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "bg-purple-50 border-purple-300" },
  { key: "negociacao", label: "Negociação", color: "bg-indigo-50 border-indigo-300" },
  { key: "fechamento", label: "Fechamento", color: "bg-green-50 border-green-300" },
];

const STAGE_LABELS = ["0d", "T+5", "T+10", "T+15", "T+20", "T+25"];

const STAGNANT_FUNNELS = [
  {
    id: "est1",
    label: "Funil Estagnado 1",
    color: "bg-rose-50 border-rose-300",
    colColor: (i: number) => `bg-rose-${50 + i * 50 > 300 ? 100 : 50} border-rose-${200 + i * 50}`,
    stages: Array.from({ length: 6 }, (_, i) => ({ key: `est1_${i}`, label: STAGE_LABELS[i] })),
  },
  {
    id: "est2",
    label: "Funil Estagnado 2",
    color: "bg-slate-50 border-slate-300",
    stages: Array.from({ length: 6 }, (_, i) => ({ key: `est2_${i}`, label: STAGE_LABELS[i] })),
  },
  {
    id: "est3",
    label: "Funil Estagnado 3",
    color: "bg-amber-50 border-amber-300",
    stages: Array.from({ length: 6 }, (_, i) => ({ key: `est3_${i}`, label: STAGE_LABELS[i] })),
  },
];

const FUNNEL_COLORS: Record<string, string> = {
  est1: "bg-rose-50 border-rose-300",
  est2: "bg-slate-50 border-slate-300",
  est3: "bg-amber-50 border-amber-300",
};

const ALL_STAGNANT_KEYS = STAGNANT_FUNNELS.flatMap((f) => f.stages.map((s) => s.key));
const STATUS_KEYS = [...COLUMNS.map((c) => c.key), ...ALL_STAGNANT_KEYS, "estagnado_final"];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function SmartOpsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone_normalized, produto_interesse, proprietario_lead_crm, source, lead_status, created_at, updated_at, data_primeiro_contato, score")
      .in("lead_status", STATUS_KEYS)
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleDrop = async (newStatus: string) => {
    if (!draggedId) return;
    const { error } = await supabase
      .from("lia_attendances")
      .update({ lead_status: newStatus })
      .eq("id", draggedId);
    if (error) {
      toast({ title: "Erro ao mover lead", description: error.message, variant: "destructive" });
    } else {
      setLeads((prev) => prev.map((l) => l.id === draggedId ? { ...l, lead_status: newStatus } : l));
    }
    setDraggedId(null);
  };

  const isStale = (createdAt: string) => {
    return Date.now() - new Date(createdAt).getTime() > 15 * 60 * 1000;
  };

  const renderLeadCard = (lead: Lead, showDaysStagnant = false) => (
    <Card
      key={lead.id}
      draggable
      onDragStart={() => setDraggedId(lead.id)}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <CardContent className="p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-xs truncate">{lead.nome}</span>
          {lead.lead_status === "sem_contato" && isStale(lead.created_at) && (
            <Badge variant="destructive" className="text-[10px] ml-1">⏰</Badge>
          )}
          {showDaysStagnant && (
            <Badge variant="outline" className="text-[10px] ml-1">{daysAgo(lead.updated_at)}d</Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{lead.email}</div>
        {lead.telefone_normalized && (
          <div className="text-[10px] text-muted-foreground">{lead.telefone_normalized}</div>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {lead.produto_interesse && (
            <Badge variant="outline" className="text-[10px]">{lead.produto_interesse}</Badge>
          )}
          {lead.score != null && lead.score > 0 && (
            <Badge className="text-[10px] bg-primary/10 text-primary">{lead.score}pts</Badge>
          )}
        </div>
        {lead.proprietario_lead_crm && (
          <div className="text-[10px] text-muted-foreground">{lead.proprietario_lead_crm}</div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {lead.source} · {new Date(lead.created_at).toLocaleDateString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>;

  const pipelineLeads = leads.filter((l) => COLUMNS.some((c) => c.key === l.lead_status));
  const stagnantLeads = leads.filter((l) => l.lead_status.startsWith("est"));
  const finalLeads = leads.filter((l) => l.lead_status === "estagnado_final");

  return (
    <div className="space-y-6">
      {/* Main Pipeline Kanban */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3" style={{ minWidth: `${COLUMNS.length * 236}px` }}>
          {COLUMNS.map((col) => {
            const colLeads = pipelineLeads.filter((l) => l.lead_status === col.key);
            return (
              <div
                key={col.key}
                className={`rounded-lg border-2 ${col.color} p-3 min-h-[300px] min-w-[220px] flex-1`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-xs truncate">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{colLeads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colLeads.map((lead) => renderLeadCard(lead))}
                  {colLeads.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-8">Nenhum lead</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stagnation Funnels */}
      <div className="space-y-4">
          <div className="border-t pt-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
              🔄 Leads Estagnados — Funis de Reativação
            </h2>
            <p className="text-[11px] text-muted-foreground mb-4">
              {stagnantLeads.length} leads em reativação · {finalLeads.length} finalizados
            </p>
          </div>

          {STAGNANT_FUNNELS.map((funnel) => {
            const funnelLeads = stagnantLeads.filter((l) => l.lead_status.startsWith(funnel.id + "_"));
            

            return (
              <div key={funnel.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold">{funnel.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{funnelLeads.length}</Badge>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="flex gap-2" style={{ minWidth: `${funnel.stages.length * 190}px` }}>
                    {funnel.stages.map((stage) => {
                      const stageLeads = stagnantLeads.filter((l) => l.lead_status === stage.key);
                      return (
                        <div
                          key={stage.key}
                          className={`rounded-lg border-2 ${FUNNEL_COLORS[funnel.id]} p-2 min-h-[200px] min-w-[175px] flex-1`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(stage.key)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-[11px]">{stage.label}</h4>
                            <Badge variant="secondary" className="text-[10px]">{stageLeads.length}</Badge>
                          </div>
                          <div className="space-y-1.5">
                            {stageLeads.map((lead) => renderLeadCard(lead, true))}
                            {stageLeads.length === 0 && (
                              <p className="text-[10px] text-muted-foreground text-center py-6">—</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Estagnado Final column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Estagnado Final</h3>
              <Badge variant="secondary" className="text-[10px]">{finalLeads.length}</Badge>
            </div>
            <div
              className="rounded-lg border-2 bg-muted border-border p-3 min-h-[100px] max-w-[300px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop("estagnado_final")}
            >
              <div className="space-y-1.5">
                {finalLeads.map((lead) => renderLeadCard(lead, true))}
                {finalLeads.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-6">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
