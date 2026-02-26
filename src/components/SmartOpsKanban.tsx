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
  // Additional fields
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
}

const COLUMNS = [
  { key: "novo", label: "Novo", color: "bg-emerald-50 border-emerald-300" },
  { key: "sem_contato", label: "Sem Contato", color: "bg-sky-50 border-sky-300" },
  { key: "contato_feito", label: "Contato Feito", color: "bg-blue-50 border-blue-300" },
  { key: "em_contato", label: "Em Contato", color: "bg-yellow-50 border-yellow-300" },
  { key: "apresentacao", label: "Apresentação/Visita", color: "bg-orange-50 border-orange-300" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "bg-purple-50 border-purple-300" },
  { key: "negociacao", label: "Negociação", color: "bg-indigo-50 border-indigo-300" },
  { key: "fechamento", label: "Fechamento", color: "bg-green-50 border-green-300" },
];

const STAGNANT_COLUMNS = [
  { key: "est_etapa1", label: "Etapa 01 - Reativação", color: "bg-rose-50 border-rose-300" },
  { key: "est_etapa2", label: "Etapa 02 - Reativação", color: "bg-rose-100 border-rose-400" },
  { key: "est_etapa3", label: "Etapa 03 - Reativação", color: "bg-amber-50 border-amber-300" },
  { key: "est_etapa4", label: "Etapa 04 - Reativação", color: "bg-amber-100 border-amber-400" },
  { key: "est_apresentacao", label: "Apresentação/Visita - Estag", color: "bg-orange-100 border-orange-400" },
  { key: "est_proposta", label: "Proposta Enviada - Estag", color: "bg-slate-50 border-slate-300" },
];

const CS_COLUMNS = [
  { key: "cs_em_espera", label: "Em Espera", color: "bg-teal-50 border-teal-300" },
  { key: "cs_agendar", label: "Agendar Treinamento", color: "bg-cyan-50 border-cyan-300" },
];

const ALL_STAGNANT_KEYS = STAGNANT_COLUMNS.map((c) => c.key);
const ALL_CS_KEYS = CS_COLUMNS.map((c) => c.key);
const STATUS_KEYS = [
  ...COLUMNS.map((c) => c.key),
  ...ALL_STAGNANT_KEYS,
  ...ALL_CS_KEYS,
  "estagnado_final",
  "ebook",
];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function SmartOpsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone_normalized, produto_interesse, proprietario_lead_crm, source, lead_status, created_at, updated_at, data_primeiro_contato, score, status_oportunidade, valor_oportunidade, cidade, uf, area_atuacao, temperatura_lead, piperun_link, especialidade, motivo_perda, tem_impressora, impressora_modelo, tem_scanner, como_digitaliza, itens_proposta_crm, tags_crm, funil_entrada_crm, comentario_perda, software_cad, volume_mensal_pecas, principal_aplicacao, resina_interesse, reuniao_agendada, cs_treinamento, lead_stage_detected, urgency_level, psychological_profile, primary_motivation, recommended_approach, rota_inicial_lia, origem_campanha, utm_source, piperun_id, total_messages, total_sessions, confidence_score_analysis")
      .in("lead_status", STATUS_KEYS)
      .order("created_at", { ascending: false })
      .limit(2000);
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
          {lead.piperun_link ? (
            <a href={lead.piperun_link} target="_blank" rel="noopener noreferrer" className="font-medium text-xs truncate text-primary hover:underline">{lead.nome}</a>
          ) : (
            <span className="font-medium text-xs truncate">{lead.nome}</span>
          )}
          {lead.lead_status === "sem_contato" && isStale(lead.created_at) && (
            <Badge variant="destructive" className="text-[10px] ml-1">⏰</Badge>
          )}
          {showDaysStagnant && (
            <Badge variant="outline" className="text-[10px] ml-1">{daysAgo(lead.updated_at)}d</Badge>
          )}
          {lead.temperatura_lead && (
            <Badge variant="outline" className="text-[10px] ml-1">
              {lead.temperatura_lead === "hot" ? "🔥" : lead.temperatura_lead === "warm" ? "🌡️" : "❄️"}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{lead.email}</div>
        {lead.telefone_normalized && (
          <div className="text-[10px] text-muted-foreground">{lead.telefone_normalized}</div>
        )}
        {(lead.cidade || lead.uf) && (
          <div className="text-[10px] text-muted-foreground">
            📍 {[lead.cidade, lead.uf].filter(Boolean).join(" - ")}
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {lead.produto_interesse && (
            <Badge variant="outline" className="text-[10px]">{lead.produto_interesse}</Badge>
          )}
          {lead.area_atuacao && (
            <Badge variant="secondary" className="text-[10px]">{lead.area_atuacao}</Badge>
          )}
          {lead.especialidade && (
            <Badge variant="secondary" className="text-[10px]">{lead.especialidade}</Badge>
          )}
          {lead.tem_impressora && lead.tem_impressora !== "não" && (
            <Badge variant="outline" className="text-[10px]">🖨️ {lead.impressora_modelo || lead.tem_impressora}</Badge>
          )}
          {lead.tem_scanner && lead.tem_scanner !== "não" && (
            <Badge variant="outline" className="text-[10px]">📷 {lead.tem_scanner}</Badge>
          )}
          {lead.como_digitaliza && (
            <Badge variant="outline" className="text-[10px]">🔍 {lead.como_digitaliza}</Badge>
          )}
          {lead.score != null && lead.score > 0 && (
            <Badge className="text-[10px] bg-primary/10 text-primary">{lead.score}pts</Badge>
          )}
          {lead.status_oportunidade && lead.status_oportunidade !== "aberta" && (
            <Badge className={`text-[10px] ${lead.status_oportunidade === "ganha" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {lead.status_oportunidade === "ganha" ? "✅ Ganha" : "❌ Perdida"}
            </Badge>
          )}
          {lead.motivo_perda && (
            <Badge variant="outline" className="text-[10px] border-destructive text-destructive">{lead.motivo_perda}</Badge>
          )}
          {lead.comentario_perda && (
            <div className="text-[10px] text-destructive italic truncate w-full">"{lead.comentario_perda}"</div>
          )}
          {lead.valor_oportunidade != null && lead.valor_oportunidade > 0 && (
            <Badge variant="outline" className="text-[10px] font-semibold">{formatCurrency(lead.valor_oportunidade)}</Badge>
          )}
          {lead.itens_proposta_crm && (() => {
            const m = lead.itens_proposta_crm.match(/(?:\((\d+)\)\s*)?(PRO\s*\d+)/);
            const label = m ? (m[1] ? `(${m[1]}) ${m[2]}` : m[2]) : "Proposta";
            return <Badge variant="outline" className="text-[10px]">📋 {label}</Badge>;
          })()}
          {lead.tags_crm && lead.tags_crm.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">🏷️ {lead.tags_crm.join(", ")}</Badge>
          )}
          {lead.software_cad && (
            <Badge variant="outline" className="text-[10px]">💻 {lead.software_cad}</Badge>
          )}
          {lead.volume_mensal_pecas && (
            <Badge variant="outline" className="text-[10px]">📦 {lead.volume_mensal_pecas}</Badge>
          )}
          {lead.principal_aplicacao && (
            <Badge variant="outline" className="text-[10px]">🎯 {lead.principal_aplicacao}</Badge>
          )}
          {lead.resina_interesse && (
            <Badge variant="outline" className="text-[10px]">🧪 {lead.resina_interesse}</Badge>
          )}
          {lead.reuniao_agendada && (
            <Badge className="text-[10px] bg-primary/10 text-primary">📅 Reunião</Badge>
          )}
          {lead.lead_stage_detected && (
            <Badge variant="secondary" className="text-[10px]">🧠 {lead.lead_stage_detected}</Badge>
          )}
          {lead.urgency_level && (
            <Badge variant={lead.urgency_level === "alta" ? "destructive" : "outline"} className="text-[10px]">
              {lead.urgency_level === "alta" ? "🚨" : lead.urgency_level === "media" ? "⚡" : "🕐"} {lead.urgency_level}
            </Badge>
          )}
          {lead.confidence_score_analysis != null && lead.confidence_score_analysis > 0 && (
            <Badge variant="outline" className="text-[10px]">🎯 {lead.confidence_score_analysis}%</Badge>
          )}
          {lead.rota_inicial_lia && (
            <Badge variant="outline" className="text-[10px]">🛤️ {lead.rota_inicial_lia}</Badge>
          )}
          {lead.origem_campanha && (
            <Badge variant="outline" className="text-[10px]">📣 {lead.origem_campanha}</Badge>
          )}
          {lead.cs_treinamento && lead.cs_treinamento !== "pendente" && (
            <Badge variant="secondary" className="text-[10px]">🎓 {lead.cs_treinamento}</Badge>
          )}
        </div>
        {lead.psychological_profile && (
          <div className="text-[10px] text-muted-foreground italic truncate">🧠 {lead.psychological_profile}</div>
        )}
        {lead.recommended_approach && (
          <div className="text-[10px] text-muted-foreground truncate">💡 {lead.recommended_approach}</div>
        )}
        {lead.proprietario_lead_crm && (
          <div className="text-[10px] text-muted-foreground">👤 {lead.proprietario_lead_crm}</div>
        )}
        {lead.funil_entrada_crm && (
          <div className="text-[10px] text-muted-foreground">🔄 {lead.funil_entrada_crm}</div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {lead.source}{lead.utm_source ? ` (${lead.utm_source})` : ""} · {new Date(lead.created_at).toLocaleDateString("pt-BR")}
          {lead.total_messages != null && lead.total_messages > 0 && ` · ${lead.total_messages}msg`}
          {lead.piperun_id && ` · PR#${lead.piperun_id}`}
        </div>
      </CardContent>
    </Card>
  );

  const renderColumnSection = (
    columns: { key: string; label: string; color: string }[],
    filteredLeads: Lead[],
    showDays = false,
    minWidth = 220,
    minHeight = 250,
  ) => (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: `${columns.length * (minWidth + 16)}px` }}>
        {columns.map((col) => {
          const colLeads = filteredLeads.filter((l) => l.lead_status === col.key);
          return (
            <div
              key={col.key}
              className={`rounded-lg border-2 ${col.color} p-3 min-w-[${minWidth}px] flex-1`}
              style={{ minHeight: `${minHeight}px`, minWidth: `${minWidth}px` }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-xs truncate">{col.label}</h4>
                <Badge variant="secondary" className="text-[10px]">{colLeads.length}</Badge>
              </div>
              <div className="space-y-2">
                {colLeads.map((lead) => renderLeadCard(lead, showDays))}
                {colLeads.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-6">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>;

  const pipelineLeads = leads.filter((l) => COLUMNS.some((c) => c.key === l.lead_status));
  const stagnantLeads = leads.filter((l) => ALL_STAGNANT_KEYS.includes(l.lead_status));
  const csLeads = leads.filter((l) => ALL_CS_KEYS.includes(l.lead_status));
  const ebookLeads = leads.filter((l) => l.lead_status === "ebook");
  const finalLeads = leads.filter((l) => l.lead_status === "estagnado_final");

  return (
    <div className="space-y-6">
      {/* Main Pipeline Kanban */}
      {renderColumnSection(COLUMNS, pipelineLeads, false, 220, 300)}

      {/* Stagnation Funnel */}
      <div className="space-y-3">
        <div className="border-t pt-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
            🔄 Funil Estagnados — Reativação
          </h2>
          <p className="text-[11px] text-muted-foreground mb-3">
            {stagnantLeads.length} leads em reativação · {finalLeads.length} finalizados
          </p>
        </div>
        {renderColumnSection(STAGNANT_COLUMNS, stagnantLeads, true, 200, 250)}

        {/* Estagnado Final */}
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

      {/* CS Onboarding */}
      {(csLeads.length > 0 || true) && (
        <div className="space-y-3">
          <div className="border-t pt-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
              🎓 CS Onboarding
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              {csLeads.length} leads em onboarding
            </p>
          </div>
          {renderColumnSection(CS_COLUMNS, csLeads, false, 220, 200)}
        </div>
      )}

      {/* Ebook Funnel */}
      {(ebookLeads.length > 0 || true) && (
        <div className="space-y-3">
          <div className="border-t pt-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
              📚 Funil E-book
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              {ebookLeads.length} leads
            </p>
          </div>
          <div
            className="rounded-lg border-2 bg-violet-50 border-violet-300 p-3 min-h-[150px] max-w-[300px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop("ebook")}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-xs">Ebook</h4>
              <Badge variant="secondary" className="text-[10px]">{ebookLeads.length}</Badge>
            </div>
            <div className="space-y-2">
              {ebookLeads.map((lead) => renderLeadCard(lead))}
              {ebookLeads.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-6">—</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
