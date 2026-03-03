import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Lead } from "./KanbanLeadCard";

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

interface KanbanLeadDetailProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

function DetailRow({ label, value, emoji }: { label: string; value: string | null | undefined; emoji?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{emoji && `${emoji} `}{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export function KanbanLeadDetail({ lead, open, onClose }: KanbanLeadDetailProps) {
  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg">{lead.nome}</SheetTitle>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{lead.lead_status}</Badge>
            {lead.temperatura_lead && (
              <Badge variant="secondary">
                {lead.temperatura_lead === "hot" ? "🔥 Quente" : lead.temperatura_lead === "warm" ? "🌡️ Morno" : "❄️ Frio"}
              </Badge>
            )}
            {lead.score != null && lead.score > 0 && (
              <Badge className="bg-primary/10 text-primary">{lead.score} pts</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Contact */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Contato</h4>
            <DetailRow label="Email" value={lead.email} emoji="📧" />
            <DetailRow label="Telefone" value={lead.telefone_normalized} emoji="📱" />
            <DetailRow label="Cidade/UF" value={[lead.cidade, lead.uf].filter(Boolean).join(" - ") || null} emoji="📍" />
          </section>
          <Separator />

          {/* Commercial */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Comercial</h4>
            <DetailRow label="Produto" value={lead.produto_interesse} emoji="🎯" />
            {lead.valor_oportunidade != null && lead.valor_oportunidade > 0 && (
              <DetailRow label="Valor" value={formatCurrency(lead.valor_oportunidade)} emoji="💰" />
            )}
            <DetailRow label="Proprietário" value={lead.proprietario_lead_crm} emoji="👤" />
            <DetailRow label="Funil CRM" value={lead.funil_entrada_crm} emoji="🔄" />
            <DetailRow label="Status Oport." value={lead.status_oportunidade} />
            <DetailRow label="Itens Proposta" value={lead.itens_proposta_crm} emoji="📋" />
            <DetailRow label="Motivo Perda" value={lead.motivo_perda} emoji="❌" />
            {lead.comentario_perda && (
              <p className="text-xs text-destructive italic mt-1">"{lead.comentario_perda}"</p>
            )}
            {lead.piperun_link && (
              <a href={lead.piperun_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block mt-1">
                🔗 Abrir no PipeRun
              </a>
            )}
          </section>
          <Separator />

          {/* Profile */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Perfil</h4>
            <DetailRow label="Área" value={lead.area_atuacao} />
            <DetailRow label="Especialidade" value={lead.especialidade} />
            <DetailRow label="Impressora" value={lead.tem_impressora === "não" ? null : (lead.impressora_modelo || lead.tem_impressora)} emoji="🖨️" />
            <DetailRow label="Scanner" value={lead.tem_scanner === "não" ? null : lead.tem_scanner} emoji="📷" />
            <DetailRow label="Digitalização" value={lead.como_digitaliza} emoji="🔍" />
            <DetailRow label="Software CAD" value={lead.software_cad} emoji="💻" />
            <DetailRow label="Vol. Mensal" value={lead.volume_mensal_pecas} emoji="📦" />
            <DetailRow label="Aplicação" value={lead.principal_aplicacao} />
            <DetailRow label="Resina" value={lead.resina_interesse} emoji="🧪" />
          </section>
          <Separator />

          {/* AI Analysis */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Análise IA</h4>
            <DetailRow label="Estágio" value={lead.lead_stage_detected} emoji="🧠" />
            <DetailRow label="Urgência" value={lead.urgency_level} />
            <DetailRow label="Perfil Psicológico" value={lead.psychological_profile} />
            <DetailRow label="Motivação" value={lead.primary_motivation} />
            <DetailRow label="Abordagem" value={lead.recommended_approach} emoji="💡" />
            <DetailRow label="Rota Inicial" value={lead.rota_inicial_lia} emoji="🛤️" />
            {lead.confidence_score_analysis != null && lead.confidence_score_analysis > 0 && (
              <DetailRow label="Confiança" value={`${lead.confidence_score_analysis}%`} emoji="🎯" />
            )}
          </section>
          <Separator />

          {/* Meta */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Origem & Meta</h4>
            <DetailRow label="Source" value={lead.source} />
            <DetailRow label="UTM" value={lead.utm_source} />
            <DetailRow label="Campanha" value={lead.origem_campanha} emoji="📣" />
            <DetailRow label="Mensagens" value={lead.total_messages?.toString()} />
            <DetailRow label="Sessões" value={lead.total_sessions?.toString()} />
            {lead.reuniao_agendada && <DetailRow label="Reunião" value="Agendada" emoji="📅" />}
            <DetailRow label="CS Treinamento" value={lead.cs_treinamento === "pendente" ? null : lead.cs_treinamento} emoji="🎓" />
            {lead.tags_crm && lead.tags_crm.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {lead.tags_crm.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">🏷️ {t}</Badge>)}
              </div>
            )}
            <DetailRow label="Criado" value={new Date(lead.created_at).toLocaleString("pt-BR")} />
            <DetailRow label="Atualizado" value={new Date(lead.updated_at).toLocaleString("pt-BR")} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
