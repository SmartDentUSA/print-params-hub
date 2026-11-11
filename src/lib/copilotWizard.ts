// Motor do passo a passo do Copilot: uma pergunta por campo da tela, na mesma
// ordem da tela, sem IA. O roteiro de cada ferramenta implementa WizardScript.
import type { WizardOption } from "./copilotWizardParse.ts";

export type WizardInput = "text" | "textarea" | "date" | "money" | "number" | "choice" | "multi";

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

export type WizardKind = "tabela_promocional" | "membro_equipe";

const CREATE_VERB = /\b(criar|crie|cria|cadastrar|cadastre|cadastra|cadastro|adicionar|adicione|adiciona|incluir|inclua|inserir|insira|registrar|novo|nova)\b/;
const MEMBER_NOUN = /\b(membros?|team members?|equipe|vendedor(a|es)?|colaborador(a|es)?|funcionari[oa]s?|integrantes?|pessoa)\b/;

/**
 * Pedido digitado que deve abrir um passo a passo em vez da conversa livre.
 * sectionId = tela escolhida no menu do Copilot: dentro de Equipe basta o verbo de criação.
 */
export function detectWizardIntent(text: string, sectionId?: string | null): WizardKind | null {
  const t = normText(String(text || ""));
  if (/\b(editar|edite|alterar|altere|mudar|excluir|apagar|remover|desativar|listar|liste|quais|mostrar|mostre|ver|consultar|relatorio|quantas|quantos)\b/.test(t)) return null;
  if (/\btabelas? (promocional|promocionais|de precos?)\b/.test(t)) return "tabela_promocional";
  if (CREATE_VERB.test(t) && (sectionId === "so-equipe" ? true : /\b(team members?|membros? (da|de|na|para a) equipe|novo membro|membro novo)\b/.test(t) || (/\bna equipe\b/.test(t) && MEMBER_NOUN.test(t)))) return "membro_equipe";
  return null;
}
