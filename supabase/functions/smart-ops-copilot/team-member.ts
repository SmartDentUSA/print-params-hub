// Cadastro de membro da equipe pelo passo a passo do Copilot.
// Mesmas regras da tela Equipe: nome, e-mail e WhatsApp obrigatórios; função
// entre as opções da tela; URLs padrão das instâncias quando vazias. Puro, testável.

export const TEAM_ROLES = ["vendedor", "cs", "suporte", "marketing", "distribuicao", "operacao"] as const;
export const TEAM_PROVIDERS = ["evolution", "evolution_go", "manychat", "none"] as const;
export const EVOLUTION_DEFAULT_URL = "http://82.25.75.61:8080";
export const EVO_GO_DEFAULT_URL = "http://82.25.75.61:8081";
export const TEAM_ADMIN_ONLY = "Membros da equipe só podem ser cadastrados por administradores (mesma regra da tela Equipe).";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const opt = (v: unknown, max = 300) => { const s = str(v, max); return s ? s : null; };

/** Celular brasileiro → "+55DDDNÚMERO". Aceita com ou sem 55, espaços e símbolos. */
export function normalizeTeamPhone(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return null;
  return `+${d}`;
}

export type TeamMemberRow = {
  nome_completo: string; email: string; whatsapp_number: string; role: string;
  piperun_owner_id: string | null; manychat_api_key: string | null;
  evolution_enabled: boolean; evolution_instance_name: string | null; evolution_api_key: string | null;
  evolution_phone: string | null; evolution_lid: string | null; evolution_base_url: string;
  messaging_provider: string;
  evo_go_enabled: boolean; evo_go_instance_id: string | null; evo_go_instance_token: string | null; evo_go_base_url: string;
};

export function validateTeamMember(input: any): { row?: TeamMemberRow; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Dados inválidos."] };
  const nome = str(input.nome_completo, 120);
  const email = str(input.email, 160).toLowerCase();
  const phone = normalizeTeamPhone(input.whatsapp_number);
  const role = str(input.role, 30);
  const piperun = opt(input.piperun_owner_id, 20);
  const provider = str(input.messaging_provider, 20) || "evolution";
  if (nome.length < 3) errors.push("Nome completo é obrigatório.");
  if (!EMAIL_RE.test(email)) errors.push("E-mail inválido.");
  if (!phone) errors.push("WhatsApp inválido: use DDD + número, ex.: (16) 99750-1531.");
  if (!(TEAM_ROLES as readonly string[]).includes(role)) errors.push("Função inválida.");
  if (piperun && !/^\d{1,12}$/.test(piperun)) errors.push("ID Vendedor Piperun deve ter só números.");
  if (!(TEAM_PROVIDERS as readonly string[]).includes(provider)) errors.push("Provedor de mensagens inválido.");
  const evoPhone = opt(input.evolution_phone, 20)?.replace(/\D/g, "") || null;
  if (errors.length) return { errors };
  return {
    errors,
    row: {
      nome_completo: nome, email, whatsapp_number: phone!, role,
      piperun_owner_id: piperun, manychat_api_key: opt(input.manychat_api_key, 500),
      evolution_enabled: input.evolution_enabled === true,
      evolution_instance_name: opt(input.evolution_instance_name, 80),
      evolution_api_key: opt(input.evolution_api_key, 200),
      evolution_phone: evoPhone,
      evolution_lid: opt(input.evolution_lid, 80),
      evolution_base_url: opt(input.evolution_base_url, 200) || EVOLUTION_DEFAULT_URL,
      messaging_provider: provider,
      evo_go_enabled: input.evo_go_enabled === true,
      evo_go_instance_id: opt(input.evo_go_instance_id, 120),
      evo_go_instance_token: opt(input.evo_go_instance_token, 300),
      evo_go_base_url: opt(input.evo_go_base_url, 200) || EVO_GO_DEFAULT_URL,
    },
  };
}
