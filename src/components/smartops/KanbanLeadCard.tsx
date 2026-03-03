import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Lead {
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
  status_oportunidade: string | null;
  valor_oportunidade: number | null;
  cidade: string | null;
  uf: string | null;
  area_atuacao: string | null;
  temperatura_lead: string | null;
  piperun_link: string | null;
  especialidade: string | null;
  motivo_perda: string | null;
  tem_impressora: string | null;
  impressora_modelo: string | null;
  tem_scanner: string | null;
  como_digitaliza: string | null;
  itens_proposta_crm: string | null;
  tags_crm: string[] | null;
  funil_entrada_crm: string | null;
  comentario_perda: string | null;
  software_cad: string | null;
  volume_mensal_pecas: string | null;
  principal_aplicacao: string | null;
  resina_interesse: string | null;
  reuniao_agendada: boolean | null;
  cs_treinamento: string | null;
  lead_stage_detected: string | null;
  urgency_level: string | null;
  psychological_profile: string | null;
  primary_motivation: string | null;
  recommended_approach: string | null;
  rota_inicial_lia: string | null;
  origem_campanha: string | null;
  utm_source: string | null;
  piperun_id: string | null;
  total_messages: number | null;
  total_sessions: number | null;
  confidence_score_analysis: number | null;
  piperun_created_at: string | null;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

interface KanbanLeadCardProps {
  lead: Lead;
  showDaysStagnant?: boolean;
  onDragStart: (id: string) => void;
  onClick: (lead: Lead) => void;
}

export function KanbanLeadCard({ lead, showDaysStagnant = false, onDragStart, onClick }: KanbanLeadCardProps) {
  const isStale = Date.now() - new Date(lead.created_at).getTime() > 15 * 60 * 1000;

  return (
    <Card
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onClick={() => onClick(lead)}
      className="cursor-pointer hover:shadow-md transition-shadow hover:ring-1 hover:ring-primary/30"
    >
      <CardContent className="p-2 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          {lead.piperun_link ? (
            <a href={lead.piperun_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-medium text-[11px] truncate text-primary hover:underline">{lead.nome}</a>
          ) : (
            <span className="font-medium text-[11px] truncate">{lead.nome}</span>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            {lead.lead_status === "sem_contato" && isStale && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0">⏰</Badge>
            )}
            {showDaysStagnant && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">{daysAgo(lead.updated_at)}d</Badge>
            )}
            {lead.temperatura_lead && (
              <span className="text-[10px]">
                {lead.temperatura_lead === "hot" ? "🔥" : lead.temperatura_lead === "warm" ? "🌡️" : "❄️"}
              </span>
            )}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{lead.email}</div>
        {(lead.cidade || lead.uf) && (
          <div className="text-[10px] text-muted-foreground truncate">
            📍 {[lead.cidade, lead.uf].filter(Boolean).join("-")}
          </div>
        )}
        <div className="flex flex-wrap gap-0.5">
          {lead.produto_interesse && (
            <Badge variant="outline" className="text-[9px] px-1 py-0">{lead.produto_interesse}</Badge>
          )}
          {lead.valor_oportunidade != null && lead.valor_oportunidade > 0 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-semibold">{formatCurrency(lead.valor_oportunidade)}</Badge>
          )}
          {lead.score != null && lead.score > 0 && (
            <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary">{lead.score}pts</Badge>
          )}
          {lead.status_oportunidade && lead.status_oportunidade !== "aberta" && (
            <Badge className={`text-[9px] px-1 py-0 ${lead.status_oportunidade === "ganha" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {lead.status_oportunidade === "ganha" ? "✅" : "❌"}
            </Badge>
          )}
        </div>
        <div className="text-[9px] text-muted-foreground truncate">
          {lead.source}{lead.piperun_id ? ` · PR#${lead.piperun_id}` : ""} · {new Date(lead.piperun_created_at || lead.created_at).toLocaleDateString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}
