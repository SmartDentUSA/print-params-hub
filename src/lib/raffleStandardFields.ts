// Perguntas e respostas padrão dos formulários do sistema (smartops_form_fields).
// O sorteio NUNCA cria campos próprios: usa só estes, com o mesmo texto e lista de respostas.
export type RaffleFieldType = "text" | "email" | "tel" | "number" | "date" | "textarea" | "select" | "radio" | "checkbox";
export type StandardRaffleField = { key: string; label: string; type: RaffleFieldType; required?: boolean; system: true; options?: string[] };

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const RAFFLE_STANDARD_FIELDS: StandardRaffleField[] = [
  { key: "nome", label: "Nome completo", type: "text", required: true, system: true },
  { key: "telefone", label: "Seu WhatsApp", type: "tel", required: true, system: true },
  { key: "email", label: "Seu e-mail", type: "email", required: true, system: true },
  { key: "cidade", label: "Cidade", type: "text", system: true },
  { key: "uf", label: "UF", type: "select", system: true, options: UF },
  { key: "area_atuacao", label: "Qual sua área de atuação", type: "select", system: true, options: ["CLÍNICA OU CONSULTÓRIO","LABORATÓRIO DE PRÓTESE","RADIOLOGIA ODONTOLÓGICA","PLANNING CENTER","EMPRESA DE ALINHADORES","GESTOR DE REDE DE CLÍNICAS","GESTOR DE FRANQUIAS","CENTRAL DE IMPRESSÕES","EDUCAÇÃO"] },
  { key: "especialidade", label: "Qual sua especialidade?", type: "select", system: true, options: ["CLÍNICO GERAL","DENTÍSTICA","IMPLANTODONTISTA","PROTESISTA","ORTODONTISTA","ODONTOPEDIATRIA","PERIODONTISTA","ENDODONTISTA","RADIOLOGISTA","CIRURGIA BUCO MAXILO FACIAL","TÉCNICO EM RADIOLOGIA","TÉCNICO EM PRÓTESE ODONTOLÓGICA","OUTROS"] },
  { key: "tem_scanner", label: "Atualmente, você digitaliza suas moldagens?", type: "select", system: true, options: ["AINDA NÃO DIGITALIZO AS MOLDAGENS","SIM, COM SCANNER INTRA ORAL PRÓPRIO","SIM, COM SCANNER INTRAORAL ALUGADO","SIM, COM SCANNER INTRAORAL DA RADIOLOGIA PARCERIA","SIM, COM SCANNER INTRAORAL DA LABORATORIO PARCEIRO","SIM, COM SCANNER DE BANCADA"] },
  { key: "impressora_modelo", label: "Qual impressora você teve contato ou utiliza no seu dia a dia?", type: "select", system: true, options: ["RAYSHAPE","PHROZEN","ANYCUBIC","FLASHFORGE","WANHAO","MIICRAFT","MOONRAY","SPRINTRAY","STRAUMAN","FORMLABS","STRATASYS","ELEGOO","ENVISIONTEC","3DSYSTEM","PIONEXT","CREALITY","ACKURETTA","PHOTOCENTRIC","KULZER","WILCOS","OUTRAS"] },
  { key: "empresa_nome", label: "Nome Fantasia", type: "text", system: true },
  { key: "instagram", label: "Instagram / perfil profissional de trabalhos", type: "text", system: true },
];

// Chaves antigas do sorteio que correspondem a um campo padrão.
const LEGACY_KEYS: Record<string, string> = { tem_impressora: "impressora_modelo", empresa: "empresa_nome" };

/** Converte campos salvos para os padrões do sistema; descarta campos que não existem no sistema. */
export function normalizeRaffleFields<T extends { key: string; required?: boolean }>(fields: T[] | null | undefined): StandardRaffleField[] {
  const out: StandardRaffleField[] = [];
  for (const f of fields || []) {
    const key = LEGACY_KEYS[f.key] || f.key;
    const std = RAFFLE_STANDARD_FIELDS.find((s) => s.key === key);
    if (!std || out.some((o) => o.key === key)) continue;
    out.push({ ...std, required: std.required || !!f.required });
  }
  return out;
}
