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

const STATUS_KEYS = COLUMNS.map((c) => c.key);

export function SmartOpsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone_normalized, produto_interesse, proprietario_lead_crm, source, lead_status, created_at, data_primeiro_contato, score")
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

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: `${COLUMNS.length * 236}px` }}>
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.lead_status === col.key);
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
                {colLeads.map((lead) => (
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
                ))}
                {colLeads.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-8">Nenhum lead</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
