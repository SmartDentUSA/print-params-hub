// Motor do passo a passo do Copilot: uma pergunta por campo da tela, na mesma
// ordem da tela, sem IA. O roteiro de cada ferramenta implementa WizardScript.
import type { WizardOption } from "./copilotWizardParse.ts";

/** upload = botão de enviar arquivos; a resposta é a lista JSON das mídias enviadas. */
export type WizardInput = "text" | "textarea" | "date" | "money" | "number" | "choice" | "multi" | "upload";

export type WizardQuestion = {
  /** Onde o campo fica na tela, ex.: "Dados da promoção › Nome interno". */
  where: string;
  ask: string;
  /** O que colocar no campo. */
  help?: string;
  input: WizardInput;
  options?: WizardOption[];
  /** Pré-seleção das perguntas de múltipla escolha. */
  selected?: string[];
  /** Respostas rápidas para perguntas digitadas (ex.: "Pular", "Manter ..."). */
  quick?: WizardOption[];
  placeholder?: string;
  /** Perguntas de envio de arquivo: tipos aceitos e se aceita vários. */
  accept?: string;
  multiple?: boolean;
};

export type WizardAnswer<S> = { state: S; note?: string } | { error: string };

export type WizardScript<S, D> = {
  key: string;
  title: string;
  intro: string;
  /** seedText = pedido digitado que abriu o passo a passo (para aproveitar dados já informados). */
  init(deps: D, today: string, seedText?: string): Promise<S>;
  question(s: S): WizardQuestion;
  answer(s: S, raw: string, deps: D): Promise<WizardAnswer<S>>;
  isReview(s: S): boolean;
  summary(s: S): string;
  payload(s: S): Record<string, unknown>;
};

export const WIZ_CONFIRM = "__confirm";
export const WIZ_CANCEL = "__cancel";
export const WIZ_SKIP = "__skip";

const normText = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type WizardKind =
  | "tabela_promocional" | "membro_equipe"
  | "post_social" | "posts_massa" | "post_grupos" | "automacao_lives";

const CREATE_VERB = /\b(criar|crie|cria|cadastrar|cadastre|cadastra|cadastro|adicionar|adicione|adiciona|incluir|inclua|inserir|insira|registrar|novo|nova)\b/;
const MEMBER_NOUN = /\b(membros?|team members?|equipe|vendedor(a|es)?|colaborador(a|es)?|funcionari[oa]s?|integrantes?|pessoa)\b/;
const SOCIAL_VERB = /\b(criar|crie|cria|fazer|faca|montar|monte|novo|nova|novos|novas|agendar|agende|agenda|programar|programe|publicar|publique|postar|poste|configurar|configure|adicionar|adicione|ativar|ative|cadastrar)\b/;
const POST_NOUN = /\b(posts?|postagens?|publicac(ao|oes)|reels?|stories|carross(el|eis))\b/;
const LIVES = /\b(automac(ao|oes)|divulgac(ao|oes)|lembretes?|propagandas?)\b.*\blives?\b|\blives?\b.*\bgrupos?\b/;
const POST_GROUPS = /\bpost grupos\b|\bgrupos?\b.*\b(recebe(m|r)?|receber)\b.*\bposts?\b|\b(automac(ao|oes)|disparo|envio)s? (de |dos |das )?posts?\b.*\bgrupos?\b|\bposts? (nos|para os|aos|em) grupos\b/;
const BULK = /\b(em massa|em lote|varios posts|varias publicacoes|muitos posts|lote de posts|agendamento em massa)\b/;

/**
 * Pedido digitado que deve abrir um passo a passo em vez da conversa livre.
 * sectionId/subtabId = tela escolhida no menu do Copilot: dentro da tela basta o verbo.
 */
export function detectWizardIntent(text: string, sectionId?: string | null, subtabId?: string | null): WizardKind | null {
  const t = normText(String(text || ""));
  if (/\b(editar|edite|alterar|altere|mudar|excluir|apagar|remover|desativar|listar|liste|quais|mostrar|mostre|ver|consultar|relatorio|quantas|quantos)\b/.test(t)) return null;
  if (/\btabelas? (promocional|promocionais|de precos?)\b/.test(t)) return "tabela_promocional";
  const social = detectSocialIntent(t, sectionId === "social" ? subtabId ?? "" : null);
  if (social) return social;
  if (CREATE_VERB.test(t) && (sectionId === "so-equipe" ? (MEMBER_NOUN.test(t) || !/\b(instancias?|qr|conectar|grupos?|webhook)\b/.test(t)) : /\b(team members?|membros? (da|de|na|para a) equipe|novo membro|membro novo)\b/.test(t) || (/\bna equipe\b/.test(t) && MEMBER_NOUN.test(t)))) return "membro_equipe";
  return null;
}

/** subtab = subaba do Social Publisher escolhida no menu (null fora do Social Publisher). */
function detectSocialIntent(t: string, subtab: string | null): WizardKind | null {
  if (LIVES.test(t) && (SOCIAL_VERB.test(t) || subtab === "lives")) return "automacao_lives";
  if (POST_GROUPS.test(t) && (SOCIAL_VERB.test(t) || /\bautomac/.test(t) || subtab === "post-grupos")) return "post_grupos";
  if (BULK.test(t) && (SOCIAL_VERB.test(t) || POST_NOUN.test(t))) return "posts_massa";
  if (subtab === null) return SOCIAL_VERB.test(t) && POST_NOUN.test(t) && !/\b(grupos?|whatsapp|campanha)\b/.test(t) ? "post_social" : null;
  if (!SOCIAL_VERB.test(t) && !POST_NOUN.test(t) && !/\b(grupos?|lives?)\b/.test(t)) return null;
  if (subtab === "lives") return "automacao_lives";
  if (subtab === "post-grupos") return "post_grupos";
  if (subtab === "agendamento-massa") return "posts_massa";
  if (subtab === "novo") return "post_social";
  return null;
}
