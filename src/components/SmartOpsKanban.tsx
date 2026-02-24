import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

const COLUMNS = [
  { key: "novo", label: "Novo", color: "bg-blue-50 border-blue-200" },
  { key: "em_contato", label: "Em Contato", color: "bg-yellow-50 border-yellow-200" },
  { key: "qualificado", label: "Qualificado", color: "bg-green-50 border-green-200" },
];

export function SmartOpsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone_normalized, produto_interesse, proprietario_lead_crm, source, lead_status, created_at, data_primeiro_contato")
      .in("lead_status", ["novo", "em_contato", "qualificado"])
      .order("created_at", { ascending: false })
      .limit(200);
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => l.lead_status === col.key);
        return (
          <div
            key={col.key}
            className={`rounded-lg border-2 ${col.color} p-3 min-h-[300px]`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge variant="secondary">{colLeads.length}</Badge>
            </div>
            <div className="space-y-2">
              {colLeads.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={() => setDraggedId(lead.id)}
                  className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{lead.nome}</span>
                      {lead.lead_status === "novo" && isStale(lead.created_at) && (
                        <Badge variant="destructive" className="text-xs ml-1">⏰</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{lead.email}</div>
                    {lead.telefone_normalized && (
                      <div className="text-xs text-muted-foreground">{lead.telefone_normalized}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lead.produto_interesse && (
                        <Badge variant="outline" className="text-xs">{lead.produto_interesse}</Badge>
                      )}
                      {lead.proprietario_lead_crm && (
                        <Badge variant="secondary" className="text-xs">{lead.proprietario_lead_crm}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {lead.source} · {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {colLeads.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
