export type RuleType =
  | "created_between" | "form" | "campaign" | "pipeline" | "stage_entered" | "training"
  | "origin" | "equipment_won" | "resin_buyer" | "field"
  | "dist_country" | "dist_state" | "dist_active" | "dist_tipo";

export interface AudienceRule {
  id: string;
  type: RuleType;
  values?: string[];
  from?: string;
  to?: string;
  pipeline?: string;
  stage?: string;
  status?: string;
  course_id?: string;
  turma_id?: string;
  column?: string;
  op?: string;
  value?: string;
  category?: string;
}

export interface AudienceDefinition {
  match: "all" | "any";
  rules: AudienceRule[];
}

export const LEAD_RULES: { type: RuleType; label: string }[] = [
  { type: "created_between", label: "Data de cadastro no CRM" },
  { type: "form", label: "Leads de formulário(s)" },
  { type: "campaign", label: "Leads de campanha / anúncio" },
  { type: "pipeline", label: "Funil / etapa do CRM" },
  { type: "stage_entered", label: "Data de entrada na etapa do funil" },
  { type: "training", label: "Participantes de treinamentos" },
  { type: "origin", label: "Origem do lead" },
  { type: "equipment_won", label: "Equipamento em proposta ganha" },
  { type: "resin_buyer", label: "Comprou resinas (proposta ganha)" },
  { type: "field", label: "Outro campo do lead" },
];

export const DIST_RULES: { type: RuleType; label: string }[] = [
  { type: "dist_country", label: "País" },
  { type: "dist_state", label: "Estado" },
  { type: "dist_active", label: "Ativo" },
  { type: "dist_tipo", label: "Tipo" },
];

export const FIELD_OPS = [
  { v: "eq", l: "é igual a" }, { v: "neq", l: "é diferente de" },
  { v: "contains", l: "contém" }, { v: "not_contains", l: "não contém" },
  { v: "gt", l: "maior que" }, { v: "gte", l: "maior ou igual" },
  { v: "lt", l: "menor que" }, { v: "lte", l: "menor ou igual" },
  { v: "is_null", l: "está vazio" }, { v: "not_null", l: "está preenchido" },
  { v: "is_true", l: "é sim" }, { v: "is_false", l: "é não" },
];

export const EMAIL_TYPES = [
  { v: "boas_vindas", l: "Boas-vindas" },
  { v: "promocional", l: "Promocional" },
  { v: "prospeccao", l: "Prospecção" },
  { v: "follow_up", l: "Follow-up" },
  { v: "educacional", l: "Conteúdo educacional" },
  { v: "reengajamento", l: "Reengajamento" },
  { v: "transacional", l: "Transacional" },
  { v: "feedback", l: "Feedback" },
  { v: "agradecimento", l: "Agradecimento" },
];

export const TRIGGERS = [
  { v: "certificate_generated", l: "Diploma de treinamento gerado" },
  { v: "course_enrolled", l: "Inscrição em curso / turma" },
  { v: "form_submitted", l: "Novo envio de formulário" },
  { v: "stage_changed", l: "Mudança de etapa no funil" },
  { v: "deal_won", l: "Negócio ganho" },
];

export const WEEKDAYS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" }, { v: 4, l: "Qui" },
  { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

export type FlowNodeType = "origin" | "email" | "wait" | "condition" | "whatsapp" | "sms" | "goto_flow" | "end";

export const NODE_LABELS: Record<FlowNodeType, string> = {
  origin: "Origem",
  email: "E-mail",
  wait: "Espera",
  condition: "Condição",
  whatsapp: "WhatsApp",
  sms: "SMS",
  goto_flow: "Ir para outra régua",
  end: "Fim",
};

export function defaultNodeData(t: FlowNodeType): Record<string, any> {
  switch (t) {
    case "email": return { email_type: "educacional", from_name: "Smart Dent | Fluxo Digital", subject: "", preheader: "", html: "", signature: "seller", attachments: [], timing: { mode: "immediate" } };
    case "wait": return { mode: "duration", amount: 1, unit: "days" };
    case "condition": return { check: "opened", timeout_hours: 48 };
    case "whatsapp": return { message: "Olá {{primeiro_nome}}!", instance_member_id: "", timing: { mode: "immediate" } };
    case "sms": return { message: "Smart Dent: ", timing: { mode: "immediate" } };
    case "goto_flow": return { flow_id: "" };
    default: return {};
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10);
