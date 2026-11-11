// Roteiro do passo a passo "Novo membro da equipe" — segue a tela
// Smart Ops › Equipe › Adicionar, aba por aba e campo a campo:
// Dados do membro → WhatsApp individual → Grupos (EvoGo) → Salvar.
import type { WizardQuestion, WizardScript, WizardAnswer } from "./copilotWizard.ts";
import { WIZ_SKIP } from "./copilotWizard.ts";
import { WIZ_CONFIRM, WIZ_CANCEL } from "./copilotWizard.ts";
import { matchOption, parseYesNo, type WizardOption } from "./copilotWizardParse.ts";

export type TeamRef = { nome: string; email: string; phones: string[]; ativo: boolean };
export type TeamDeps = { loadMembers(): Promise<TeamRef[]> };

export const TEAM_ROLE_OPTIONS: WizardOption[] = [
  { value: "vendedor", label: "Vendedor" },
  { value: "cs", label: "CS" },
  { value: "suporte", label: "Suporte" },
  { value: "marketing", label: "Marketing" },
  { value: "distribuicao", label: "Distribuição" },
  { value: "operacao", label: "Operação" },
];
const PROVIDER_OPTIONS: WizardOption[] = [
  { value: "evolution", label: "Evolution API" },
  { value: "evolution_go", label: "Evolution GO" },
  { value: "manychat", label: "ManyChat" },
  { value: "none", label: "Manual" },
];
const EVO_URL = "http://82.25.75.61:8080";
const GO_URL = "http://82.25.75.61:8081";

export type TeamStep =
  | "nome" | "email" | "whatsapp" | "piperun" | "role" | "manychat"
  | "evo_enabled" | "evo_instance" | "evo_apikey" | "evo_phone" | "evo_lid" | "evo_base" | "provider"
  | "go_enabled" | "go_id" | "go_token" | "go_base" | "review";

export type TeamData = {
  nome_completo: string; email: string; whatsapp_number: string; piperun_owner_id: string | null;
  role: string; manychat_api_key: string | null;
  evolution_enabled: boolean; evolution_instance_name: string | null; evolution_api_key: string | null;
  evolution_phone: string | null; evolution_lid: string | null; evolution_base_url: string | null;
  messaging_provider: string;
  evo_go_enabled: boolean; evo_go_instance_id: string | null; evo_go_instance_token: string | null; evo_go_base_url: string | null;
};
export type TeamSeed = { email?: string; phone?: string; role?: string };
export type TeamState = { step: TeamStep; members: TeamRef[]; seed: TeamSeed; data: TeamData };

const D = "Dados do membro";
const W = "WhatsApp individual";
const G = "Grupos (EvoGo)";
const SKIP: WizardOption = { value: WIZ_SKIP, label: "Pular" };
const YESNO: WizardOption[] = [{ value: "yes", label: "Sim, ativar" }, { value: "no", label: "Não" }];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const digits = (s: string) => String(s || "").replace(/\D/g, "");
const ok = (state: TeamState, note?: string): WizardAnswer<TeamState> => ({ state, note });
const err = (error: string): WizardAnswer<TeamState> => ({ error });
const yesNo = (raw: string) => (raw === "yes" ? true : raw === "no" ? false : parseYesNo(raw));
const val = (raw: string) => (raw === WIZ_SKIP ? null : raw.trim() || null);
export const slugifyName = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Celular brasileiro → "+55DDDNÚMERO" (mesma regra do servidor). */
export function normalizeTeamPhone(raw: string): string | null {
  let d = digits(raw);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return null;
  return `+${d}`;
}
/** Mesmo celular: DDD + últimos 8 dígitos (com ou sem 55 e 9º dígito). */
const phoneKey = (raw: string) => {
  let d = digits(raw);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : null;
};

/** Lê do pedido digitado o que já dá para aproveitar: e-mail, celular e função. */
export function teamSeedFromText(text: string): TeamSeed {
  const t = String(text || "");
  const seed: TeamSeed = {};
  const email = t.match(/[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}/i)?.[0];
  if (email) seed.email = email.toLowerCase();
  const phone = t.replace(email || "", "").match(/\+?\d[\d\s().-]{8,}\d/)?.[0];
  if (phone && normalizeTeamPhone(phone)) seed.phone = normalizeTeamPhone(phone)!;
  const n = norm(t);
  if (/\bvendedor(a|es)?\b/.test(n)) seed.role = "vendedor";
  else if (/\b(cs|customer success|pos[- ]venda)\b/.test(n)) seed.role = "cs";
  else if (/\bsuporte\b/.test(n)) seed.role = "suporte";
  else if (/\bmarketing\b/.test(n)) seed.role = "marketing";
  else if (/\bdistribui/.test(n)) seed.role = "distribuicao";
  else if (/\bopera(cao|coes|dor|dora)\b/.test(n)) seed.role = "operacao";
  return seed;
}

const roleLabel = (v: string) => TEAM_ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v;
const providerLabel = (v: string) => PROVIDER_OPTIONS.find((o) => o.value === v)?.label ?? v;

export function teamQuestion(s: TeamState): WizardQuestion {
  const d = s.data;
  const suggested = slugifyName(d.nome_completo);
  switch (s.step) {
    case "nome": return { where: `${D} › Nome Completo`, input: "text", ask: "Qual é o **nome completo** do novo membro?", help: "É o nome que aparece na equipe, nas notas do CRM e na Agenda. A foto você coloca depois na tela Equipe.", placeholder: "Ex.: Maria Souza" };
    case "email": return { where: `${D} › Email`, input: "text", ask: "Qual é o **e-mail** do membro?", help: "Use o e-mail de trabalho. Ele não pode repetir o de outro membro.", quick: s.seed.email ? [{ value: s.seed.email, label: `Usar ${s.seed.email}` }] : undefined, placeholder: "nome@smartdent.com.br" };
    case "whatsapp": return { where: `${D} › WhatsApp (+55...)`, input: "text", ask: "Qual é o **WhatsApp** do membro, com DDD?", help: "É com esse celular que ele entra na Agenda. Pode digitar com ou sem 55, ex.: (16) 99750-1531.", quick: s.seed.phone ? [{ value: s.seed.phone, label: `Usar ${s.seed.phone}` }] : undefined, placeholder: "(16) 99999-9999" };
    case "piperun": return { where: `${D} › ID Vendedor Piperun`, input: "text", ask: "Qual é o **ID de vendedor no PipeRun**?", help: d.role === "vendedor" || s.seed.role === "vendedor" ? "Vendedores só entram no rodízio de leads com esse ID. Ele fica no PipeRun, em Usuários." : "Só é necessário para quem recebe negócios no CRM. Se não tiver, clique em Pular.", quick: [SKIP], placeholder: "Ex.: 104356" };
    case "role": return { where: `${D} › Função`, input: "choice", ask: "Qual é a **função** do membro?", help: s.seed.role ? `Pelo seu pedido: ${roleLabel(s.seed.role)}.` : "Define em qual grupo ele aparece na equipe.", options: s.seed.role ? [...TEAM_ROLE_OPTIONS.filter((o) => o.value === s.seed.role), ...TEAM_ROLE_OPTIONS.filter((o) => o.value !== s.seed.role)] : TEAM_ROLE_OPTIONS };
    case "manychat": return { where: `${D} › API Key ManyChat`, input: "text", ask: "Tem **API Key do ManyChat** para este membro?", help: "Só para quem envia pelo ManyChat. Quase sempre fica em branco.", quick: [SKIP] };
    case "evo_enabled": return { where: `${W} › Integração ativada`, input: "choice", ask: "Ativar a integração de **WhatsApp individual** (Evolution API) para este membro?", help: "É o que permite o sistema enviar mensagens pelo WhatsApp dele. A conexão por QR Code é feita depois, na tela Equipe.", options: YESNO };
    case "evo_instance": return { where: `${W} › Nome da Instância`, input: "text", ask: "Qual o **nome da instância**?", help: "Use letras minúsculas e _ . A tela sugere o nome do membro.", quick: suggested ? [{ value: suggested, label: `Usar ${suggested}` }] : undefined, placeholder: "maria_souza" };
    case "evo_apikey": return { where: `${W} › API Key da Instância`, input: "text", ask: "Qual a **API Key da instância**?", help: "Cada instância tem a sua. Se ainda não tem, pule: ela é gerada quando você clica em Conectar WhatsApp na tela.", quick: [SKIP] };
    case "evo_phone": return { where: `${W} › Telefone Conectado`, input: "text", ask: "Qual **telefone** fica conectado nessa instância?", help: "Normalmente é o mesmo WhatsApp do membro.", quick: [{ value: digits(d.whatsapp_number), label: `Mesmo WhatsApp (${digits(d.whatsapp_number)})` }, SKIP] };
    case "evo_lid": return { where: `${W} › LID do Bot`, input: "text", ask: "Qual o **LID do bot**?", help: "Ex.: 98908885786860@lid. Se não souber, pule — ele aparece depois da conexão.", quick: [SKIP] };
    case "evo_base": return { where: `${W} › Base URL`, input: "text", ask: "Qual a **Base URL** da Evolution?", help: "Use o padrão, a não ser que o técnico tenha passado outro endereço.", quick: [{ value: EVO_URL, label: `Usar padrão ${EVO_URL}` }] };
    case "provider": return { where: `${W} › Provedor de mensagens`, input: "choice", ask: "Por qual **provedor** saem as mensagens deste membro?", help: "Evolution API é o padrão da tela.", options: d.evolution_enabled ? PROVIDER_OPTIONS : [...PROVIDER_OPTIONS.filter((o) => o.value === "none"), ...PROVIDER_OPTIONS.filter((o) => o.value !== "none")] };
    case "go_enabled": return { where: `${G} › Integração ativada`, input: "choice", ask: "Ativar a instância de **grupos** (EvoGo) para este membro?", help: "Só para quem cria ou envia mensagens em grupos de WhatsApp.", options: YESNO };
    case "go_id": return { where: `${G} › Instance ID`, input: "text", ask: "Qual o **Instance ID** no EvoGo?", help: "Se ainda não existe, pule: a instância é criada ao clicar em Conectar WhatsApp (EvoGo) na tela.", quick: [SKIP] };
    case "go_token": return { where: `${G} › Instance Token`, input: "text", ask: "Qual o **Instance Token** do EvoGo?", quick: [SKIP] };
    case "go_base": return { where: `${G} › Base URL`, input: "text", ask: "Qual a **Base URL** do EvoGo?", quick: [{ value: GO_URL, label: `Usar padrão ${GO_URL}` }] };
    case "review": return { where: "Salvar membro", input: "choice", ask: "Confira o resumo acima. **Posso salvar o membro?**", help: "Ao confirmar eu clico em Salvar por você. Ele já entra ativo.", options: [{ value: WIZ_CONFIRM, label: "Confirmar e salvar" }, { value: WIZ_CANCEL, label: "Cancelar" }] };
  }
}

export async function teamAnswer(s: TeamState, raw: string): Promise<WizardAnswer<TeamState>> {
  const r = String(raw ?? "").trim();
  const d = s.data;
  const set = (patch: Partial<TeamData>, step: TeamStep, note?: string) => ok({ ...s, step, data: { ...d, ...patch } }, note);
  switch (s.step) {
    case "nome":
      if (r.length < 3) return err("Digite o nome completo.");
      return set({ nome_completo: r.replace(/\s+/g, " ") }, "email");
    case "email": {
      const e = r.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return err("E-mail inválido. Ex.: nome@smartdent.com.br");
      const dup = s.members.find((m) => norm(m.email) === norm(e));
      if (dup) return err(`Já existe um membro com esse e-mail: ${dup.nome}${dup.ativo ? "" : " (inativo)"}. Use outro e-mail ou edite o existente na tela Equipe.`);
      return set({ email: e }, "whatsapp");
    }
    case "whatsapp": {
      const p = normalizeTeamPhone(r);
      if (!p) return err("Celular inválido. Digite DDD + número, ex.: (16) 99750-1531.");
      const key = phoneKey(p);
      const dup = s.members.find((m) => m.phones.some((x) => phoneKey(x) === key));
      return set({ whatsapp_number: p }, "piperun", dup ? `⚠️ Esse celular já está cadastrado para **${dup.nome}**${dup.ativo ? "" : " (inativo)"}. Pode seguir, mas confira se não é a mesma pessoa.` : undefined);
    }
    case "piperun": {
      const v = val(r);
      if (v && !/^\d{1,12}$/.test(v)) return err("O ID do PipeRun tem só números. Ex.: 104356");
      return set({ piperun_owner_id: v }, "role");
    }
    case "role": {
      const o = matchOption(r, TEAM_ROLE_OPTIONS);
      if (!o) return err("Escolha uma das funções.");
      return set({ role: o.value }, "manychat");
    }
    case "manychat": return set({ manychat_api_key: val(r) }, "evo_enabled");
    case "evo_enabled": {
      const y = yesNo(r);
      if (y === null) return err("Responda Sim ou Não.");
      return y ? set({ evolution_enabled: true }, "evo_instance") : set({ evolution_enabled: false }, "provider");
    }
    case "evo_instance": {
      const v = slugifyName(r);
      if (!v) return err("Digite o nome da instância.");
      return set({ evolution_instance_name: v }, "evo_apikey");
    }
    case "evo_apikey": return set({ evolution_api_key: val(r) }, "evo_phone");
    case "evo_phone": {
      const v = val(r);
      if (v && digits(v).length < 10) return err("Telefone inválido. Ex.: 5516997501531");
      return set({ evolution_phone: v ? digits(v) : null }, "evo_lid");
    }
    case "evo_lid": return set({ evolution_lid: val(r) }, "evo_base");
    case "evo_base": return set({ evolution_base_url: val(r) || EVO_URL }, "provider");
    case "provider": {
      const o = matchOption(r, PROVIDER_OPTIONS);
      if (!o) return err("Escolha um provedor.");
      return set({ messaging_provider: o.value }, "go_enabled");
    }
    case "go_enabled": {
      const y = yesNo(r);
      if (y === null) return err("Responda Sim ou Não.");
      return y ? set({ evo_go_enabled: true }, "go_id") : set({ evo_go_enabled: false }, "review");
    }
    case "go_id": return set({ evo_go_instance_id: val(r) }, "go_token");
    case "go_token": return set({ evo_go_instance_token: val(r) }, "go_base");
    case "go_base": return set({ evo_go_base_url: val(r) || GO_URL }, "review");
    case "review": return ok(s);
  }
}

const secret = (v: string | null) => (v ? "informada" : "—");
export function teamSummary(s: TeamState): string {
  const d = s.data;
  const lines = [
    "**Resumo do novo membro**",
    `- Nome: ${d.nome_completo}`,
    `- E-mail: ${d.email}`,
    `- WhatsApp: ${d.whatsapp_number}`,
    `- Função: ${roleLabel(d.role)}`,
    `- ID Vendedor PipeRun: ${d.piperun_owner_id || "—"}`,
    `- API Key ManyChat: ${secret(d.manychat_api_key)}`,
    `- WhatsApp individual: ${d.evolution_enabled ? `ativado · instância ${d.evolution_instance_name} · API Key ${secret(d.evolution_api_key)} · telefone ${d.evolution_phone || "—"} · LID ${d.evolution_lid || "—"} · ${d.evolution_base_url || EVO_URL}` : "não"}`,
    `- Provedor de mensagens: ${providerLabel(d.messaging_provider)}`,
    `- Grupos (EvoGo): ${d.evo_go_enabled ? `ativado · Instance ID ${d.evo_go_instance_id || "—"} · token ${secret(d.evo_go_instance_token)} · ${d.evo_go_base_url || GO_URL}` : "não"}`,
    "- Situação: ativo",
  ];
  return lines.join("\n");
}

export const teamMemberWizard: WizardScript<TeamState, TeamDeps> = {
  key: "membro_equipe",
  title: "Novo membro da equipe",
  intro: "Vou cadastrar o **novo membro** com você, campo por campo, na mesma ordem da tela **Equipe › Adicionar**: Dados do membro, WhatsApp individual e Grupos. Para cada campo eu digo o que colocar. Use **Voltar** para corrigir a resposta anterior.",
  async init(deps, _today, seedText) {
    const members = await deps.loadMembers();
    const seed = teamSeedFromText(seedText || "");
    return {
      step: "nome", members, seed,
      data: {
        nome_completo: "", email: "", whatsapp_number: "", piperun_owner_id: null, role: seed.role || "vendedor",
        manychat_api_key: null, evolution_enabled: false, evolution_instance_name: null, evolution_api_key: null,
        evolution_phone: null, evolution_lid: null, evolution_base_url: null, messaging_provider: "evolution",
        evo_go_enabled: false, evo_go_instance_id: null, evo_go_instance_token: null, evo_go_base_url: null,
      },
    };
  },
  question: teamQuestion,
  answer: (s, raw) => teamAnswer(s, raw),
  isReview: (s) => s.step === "review",
  summary: teamSummary,
  payload: (s) => ({ ...s.data }),
};
