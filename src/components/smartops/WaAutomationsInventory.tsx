import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks } from "lucide-react";

type Row = {
  nome: string;
  fn: string;
  instancia: string;
  onde: string;
  status: "ui" | "outra" | "sem-ui";
};

const ROWS: Row[] = [
  { nome: "Briefing de novos leads ao vendedor", fn: "smart-ops-lia-notify-seller", instancia: "smartdent_marketing", onde: "Automações → Briefing de novos leads", status: "ui" },
  { nome: "Boas-vindas ao lead", fn: "smart-ops-lead-welcome", instancia: "por automação", onde: "Automações → Automações LIA", status: "ui" },
  { nome: "Transbordo — WhatsApp Suporte (gatilho)", fn: "smart-ops-trigger-automations", instancia: "Suporte_tecnico", onde: "Automações → Automações por Gatilho", status: "ui" },
  { nome: "Réguas de CS", fn: "smart-ops-cs-processor", instancia: "cs_principal", onde: "Automações → Réguas de CS", status: "ui" },
  { nome: "NPS pós-treinamento", fn: "cs-enviar-nps", instancia: "por curso", onde: "Treinamentos → editar curso → Mensagens de WhatsApp", status: "outra" },
  { nome: "Lembrete de treinamento", fn: "smartops-send-course-reminder", instancia: "por curso", onde: "Treinamentos → editar curso → Mensagens de WhatsApp", status: "outra" },
  { nome: "Broadcast de marketing", fn: "wa-broadcast-dispatch", instancia: "smartdent_marketing", onde: "Campanhas → Grupos WhatsApp / Social Publisher", status: "outra" },
  { nome: "Sequências / cadências", fn: "sequence-runner", instancia: "smartdent_marketing", onde: "Campanhas → Sequências", status: "outra" },
  { nome: "Reativação proativa", fn: "smart-ops-proactive-outreach", instancia: "smartdent_marketing", onde: "Reativação → Réguas", status: "outra" },
  { nome: "Aviso de pagamento Stripe", fn: "_shared/stripe-notify", instancia: "smartdent_marketing", onde: "Sem UI — instância e texto fixos na função", status: "sem-ui" },
  { nome: "Ticket técnico", fn: "create-technical-ticket", instancia: "Suporte_tecnico", onde: "Sem UI — instância e texto fixos na função", status: "sem-ui" },
  { nome: "Escalação da LIA para humano", fn: "_shared/lia-escalation", instancia: "Suporte_tecnico", onde: "Sem UI — instância e texto fixos na função", status: "sem-ui" },
  { nome: "Relatório diário Sentinela", fn: "sentinela-daily-report", instancia: "smartdent_marketing", onde: "Sentinela → Configuração (parcial)", status: "sem-ui" },
  { nome: "Publicação de treinamento", fn: "training-factory-publish", instancia: "smartdent_marketing", onde: "Sem UI — aviso fixo na função", status: "sem-ui" },
  { nome: "Copilot — envio manual", fn: "smart-ops-copilot", instancia: "smartdent_marketing", onde: "Copilot (ação sob demanda, não agendável)", status: "sem-ui" },
];

const BADGE: Record<Row["status"], { label: string; className: string }> = {
  ui: { label: "configurável aqui", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  outra: { label: "outra aba", className: "bg-blue-50 text-blue-700 border-blue-200" },
  "sem-ui": { label: "sem UI", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function WaAutomationsInventory() {
  const count = (s: Row["status"]) => ROWS.filter((r) => r.status === s).length;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <ListChecks className="w-4 h-4" />
          Inventário de automações de WhatsApp
          <Badge variant="outline">{ROWS.length} automações</Badge>
          <Badge variant="outline" className={BADGE.ui.className}>{count("ui")} aqui</Badge>
          <Badge variant="outline" className={BADGE.outra.className}>{count("outra")} em outras abas</Badge>
          <Badge variant="outline" className={BADGE["sem-ui"].className}>{count("sem-ui")} sem UI</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automação</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Instância</TableHead>
                <TableHead>Onde se configura</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((r) => (
                <TableRow key={r.fn + r.nome}>
                  <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                  <TableCell className="font-mono text-[11px] whitespace-nowrap">{r.fn}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.instancia}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.onde}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`text-[10px] ${BADGE[r.status].className}`}>
                      {BADGE[r.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
