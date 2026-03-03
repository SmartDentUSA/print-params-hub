import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

interface MsgLog {
  id: string;
  tipo: string | null;
  mensagem_preview: string | null;
  status: string;
  data_envio: string | null;
  whatsapp_number: string | null;
}

const SYSTEM_TO_SELLER_TYPES = ["escalation_vendedor", "escalation_especialista", "escalation_cs_suporte", "ecommerce_order_created"];
const SELLER_TO_LEAD_TYPES = ["handoff_seller_to_lead", "handoff_unanswered", "proactive_primeira_duvida", "waleads_text", "sellflux_text"];

function MessageItem({ msg }: { msg: MsgLog }) {
  const [expanded, setExpanded] = useState(false);
  const preview = msg.mensagem_preview || "-";
  const needsTruncate = preview.length > 200;

  return (
    <div className="border rounded-md p-2 text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground whitespace-nowrap">
          {msg.data_envio ? new Date(msg.data_envio).toLocaleString("pt-BR") : "-"}
        </span>
        <div className="flex items-center gap-1">
          {msg.tipo && <Badge variant="outline" className="text-[10px]">{msg.tipo}</Badge>}
          <Badge
            variant={msg.status === "enviado" ? "default" : msg.status === "erro" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {msg.status}
          </Badge>
        </div>
      </div>
      <p
        className={`text-foreground ${!expanded && needsTruncate ? "line-clamp-3 cursor-pointer" : "cursor-pointer"}`}
        onClick={() => needsTruncate && setExpanded(!expanded)}
      >
        {expanded ? preview : preview.slice(0, 200)}{!expanded && needsTruncate ? "…" : ""}
      </p>
    </div>
  );
}

function MessageSection({ title, emoji, messages }: { title: string; emoji: string; messages: MsgLog[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase py-1 hover:text-foreground transition-colors">
        <span>{emoji} {title} ({messages.length})</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma mensagem</p>
        ) : (
          messages.map((m) => <MessageItem key={m.id} msg={m} />)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function KanbanLeadDetail({ lead, open, onClose }: KanbanLeadDetailProps) {
  const [systemMsgs, setSystemMsgs] = useState<MsgLog[]>([]);
  const [sellerMsgs, setSellerMsgs] = useState<MsgLog[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (!lead?.id || !open) {
      setSystemMsgs([]);
      setSellerMsgs([]);
      return;
    }
    setLoadingMsgs(true);
    supabase
      .from("message_logs")
      .select("id, tipo, mensagem_preview, status, data_envio, whatsapp_number")
      .eq("lead_id", lead.id)
      .order("data_envio", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const logs = (data || []) as MsgLog[];
        setSystemMsgs(logs.filter((l) => SYSTEM_TO_SELLER_TYPES.includes(l.tipo || "")));
        setSellerMsgs(logs.filter((l) => SELLER_TO_LEAD_TYPES.includes(l.tipo || "")));
        setLoadingMsgs(false);
      });
  }, [lead?.id, open]);

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
            {lead.piperun_created_at && (
              <DetailRow label="Criado (PipeRun)" value={new Date(lead.piperun_created_at).toLocaleString("pt-BR")} emoji="📅" />
            )}
            <DetailRow label="Entrada no sistema" value={new Date(lead.created_at).toLocaleString("pt-BR")} />
            <DetailRow label="Atualizado" value={new Date(lead.updated_at).toLocaleString("pt-BR")} />
          </section>
          <Separator />

          {/* Message History */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Histórico de Mensagens</h4>
            {loadingMsgs ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : (
              <div className="space-y-3">
                <MessageSection title="Sistema → Vendedor" emoji="📨" messages={systemMsgs} />
                <MessageSection title="Vendedor → Lead" emoji="💬" messages={sellerMsgs} />
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
